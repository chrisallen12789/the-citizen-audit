const path = require("path");
const { appendEntry, readVerifiedLog } = require("../lib/append-only-log");
const { canonicalStringify } = require("../lib/canonical-json");
const {
  ATTEMPT_SCHEMA_VERSION,
  assertValidExecutionAttempt,
  assertValidExecutionTransition,
  normalizeExecutionAttempt,
  normalizeExecutionTransition
} = require("./attempt-schema");
const {
  assertExecutionStateTransition,
  isTerminalExecutionState,
  requiredTransitionHash
} = require("./state-machine");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const RECORD_TYPES = Object.freeze({
  CREATED: "execution.attempt.created",
  TRANSITIONED: "execution.attempt.transitioned"
});

function defaultExecutionLedgerPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "execution", "state", "ledger.jsonl");
}

function ledgerError(message, code = "INVALID_EXECUTION_LEDGER", cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function immutableClone(value) {
  const cloned = JSON.parse(canonicalStringify(value));
  function freeze(current) {
    if (!current || typeof current !== "object" || Object.isFrozen(current)) return current;
    for (const child of Object.values(current)) freeze(child);
    return Object.freeze(current);
  }
  return freeze(cloned);
}

function initialView(attempt, entry) {
  return {
    ...attempt,
    lastTransitionAt: attempt.createdAt,
    transitionCount: 0,
    ledgerSequence: entry.sequence,
    ledgerHash: entry.hash,
    problems: [],
    warnings: []
  };
}

function assertTransitionBindings(to, data, context = "Execution transition") {
  const requiredHash = requiredTransitionHash(to);
  if (requiredHash && !data[requiredHash]) {
    throw ledgerError(`${context}: transition to ${to} requires ${requiredHash}.`, "MISSING_EXECUTION_TRANSITION_HASH");
  }
  if (data.preStateManifestHash && to !== "recovery_persisted") {
    throw ledgerError(`${context}: preStateManifestHash may only be bound by recovery_persisted.`);
  }
  if (data.validationResultHash && to !== "committed") {
    throw ledgerError(`${context}: validationResultHash may only be bound by committed.`);
  }
  if (data.rollbackResultHash && !["rolled_back", "recovery_required"].includes(to)) {
    throw ledgerError(`${context}: rollbackResultHash may only be bound by a rollback terminal state.`);
  }
}

function applyTransition(view, transition, entry) {
  if (transition.transactionId !== view.transactionId) {
    throw ledgerError(`Execution ledger: transaction mismatch for ${transition.attemptId} at sequence ${entry.sequence}.`);
  }
  if (transition.from !== view.state) {
    throw ledgerError(`Execution ledger: stale transition for ${transition.attemptId} at sequence ${entry.sequence}; expected from ${view.state}, found ${transition.from}.`);
  }
  assertExecutionStateTransition(transition.from, transition.to);
  assertTransitionBindings(transition.to, transition.data, `Execution ledger sequence ${entry.sequence}`);
  if (transition.to === "recovery_persisted" && view.preStateManifestHash !== null) {
    throw ledgerError(`Execution ledger: pre-state manifest already bound for ${transition.attemptId}.`);
  }

  const next = {
    ...view,
    state: transition.to,
    lastTransitionAt: transition.transitionedAt,
    transitionCount: view.transitionCount + 1,
    ledgerSequence: entry.sequence,
    ledgerHash: entry.hash,
    problems: [...transition.data.problems],
    warnings: [...transition.data.warnings]
  };
  if (transition.data.preStateManifestHash) next.preStateManifestHash = transition.data.preStateManifestHash;
  if (transition.data.validationResultHash) next.validationResultHash = transition.data.validationResultHash;
  if (transition.data.rollbackResultHash) next.rollbackResultHash = transition.data.rollbackResultHash;
  if (isTerminalExecutionState(transition.to)) next.terminalDisposition = transition.to;
  return next;
}

function replayExecutionEntries(entries) {
  const attempts = new Map();
  const committedByTransaction = new Map();

  for (const entry of entries) {
    try {
      if (entry.schemaVersion !== ATTEMPT_SCHEMA_VERSION) {
        throw ledgerError(`Execution ledger: unsupported schemaVersion at sequence ${entry.sequence}: ${entry.schemaVersion}.`);
      }

      if (entry.recordType === RECORD_TYPES.CREATED) {
        if (!entry.attempt) throw ledgerError(`Execution ledger: missing attempt at sequence ${entry.sequence}.`);
        assertValidExecutionAttempt(entry.attempt);
        if (attempts.has(entry.attempt.id)) throw ledgerError(`Execution ledger: duplicate attempt id ${entry.attempt.id}.`, "DUPLICATE_EXECUTION_ATTEMPT");
        if (committedByTransaction.has(entry.attempt.transactionId)) {
          throw ledgerError(`Execution ledger: transaction already committed: ${entry.attempt.transactionId}.`, "TRANSACTION_ALREADY_COMMITTED");
        }
        attempts.set(entry.attempt.id, initialView(entry.attempt, entry));
        continue;
      }

      if (entry.recordType === RECORD_TYPES.TRANSITIONED) {
        if (!entry.transition) throw ledgerError(`Execution ledger: missing transition at sequence ${entry.sequence}.`);
        assertValidExecutionTransition(entry.transition);
        const current = attempts.get(entry.transition.attemptId);
        if (!current) throw ledgerError(`Execution ledger: transition references unknown attempt ${entry.transition.attemptId}.`, "EXECUTION_ATTEMPT_NOT_FOUND");
        const next = applyTransition(current, entry.transition, entry);
        if (next.state === "committed") {
          const existing = committedByTransaction.get(next.transactionId);
          if (existing && existing !== next.id) {
            throw ledgerError(`Execution ledger: transaction committed by multiple attempts: ${next.transactionId}.`, "TRANSACTION_ALREADY_COMMITTED");
          }
          committedByTransaction.set(next.transactionId, next.id);
        }
        attempts.set(next.id, next);
        continue;
      }

      throw ledgerError(`Execution ledger: unknown recordType at sequence ${entry.sequence}: ${entry.recordType}.`);
    } catch (error) {
      if (error.code === "INVALID_EXECUTION_LEDGER" || error.code === "DUPLICATE_EXECUTION_ATTEMPT" || error.code === "TRANSACTION_ALREADY_COMMITTED" || error.code === "EXECUTION_ATTEMPT_NOT_FOUND") throw error;
      throw ledgerError(`Execution ledger: invalid record at sequence ${entry.sequence}: ${error.message}`, "INVALID_EXECUTION_LEDGER", error);
    }
  }

  return {
    attempts,
    committedByTransaction
  };
}

function readExecutionLedger(options = {}) {
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(options.rootDir);
  const verified = readVerifiedLog(ledgerPath, "execution ledger");
  const replayed = replayExecutionEntries(verified.entries);
  const attempts = [...replayed.attempts.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map(immutableClone);
  return {
    ...verified,
    entries: Object.freeze(verified.entries.map(immutableClone)),
    ledgerPath,
    attempts: Object.freeze(attempts),
    committedTransactions: immutableClone(Object.fromEntries([...replayed.committedByTransaction.entries()].sort()))
  };
}

function findAttempt(result, attemptId) {
  return result.attempts.find((attempt) => attempt.id === attemptId) || null;
}

function getExecutionAttempt(attemptId, options = {}) {
  const attempt = findAttempt(readExecutionLedger(options), attemptId);
  if (!attempt) throw ledgerError(`Execution attempt not found: ${attemptId}.`, "EXECUTION_ATTEMPT_NOT_FOUND");
  return attempt;
}

function createExecutionAttempt(input, options = {}) {
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(options.rootDir);
  const current = readExecutionLedger({ ledgerPath });
  if (findAttempt(current, input.id)) throw ledgerError(`Execution attempt already exists: ${input.id}.`, "DUPLICATE_EXECUTION_ATTEMPT");
  if (current.committedTransactions[input.transactionId]) {
    throw ledgerError(`Transaction already committed: ${input.transactionId}.`, "TRANSACTION_ALREADY_COMMITTED");
  }
  const attempt = normalizeExecutionAttempt(input, { createdAt: options.createdAt });
  appendEntry(ledgerPath, {
    recordType: RECORD_TYPES.CREATED,
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    attempt
  }, {
    label: "execution ledger",
    recordedAt: options.recordedAt || attempt.createdAt
  });
  return getExecutionAttempt(attempt.id, { ledgerPath });
}

function transitionExecutionAttempt(attemptId, to, data = {}, options = {}) {
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(options.rootDir);
  const current = readExecutionLedger({ ledgerPath });
  const attempt = findAttempt(current, attemptId);
  if (!attempt) throw ledgerError(`Execution attempt not found: ${attemptId}.`, "EXECUTION_ATTEMPT_NOT_FOUND");
  if (isTerminalExecutionState(attempt.state)) {
    throw ledgerError(`Execution attempt is terminal and immutable: ${attemptId} (${attempt.state}).`, "TERMINAL_EXECUTION_ATTEMPT");
  }
  assertExecutionStateTransition(attempt.state, to);
  if (to === "committed") {
    const existing = current.committedTransactions[attempt.transactionId];
    if (existing && existing !== attempt.id) {
      throw ledgerError(`Transaction already committed: ${attempt.transactionId}.`, "TRANSACTION_ALREADY_COMMITTED");
    }
  }
  const transition = normalizeExecutionTransition({
    attemptId,
    transactionId: attempt.transactionId,
    from: attempt.state,
    to,
    transitionedAt: options.transitionedAt,
    data
  });
  assertTransitionBindings(to, transition.data);
  appendEntry(ledgerPath, {
    recordType: RECORD_TYPES.TRANSITIONED,
    schemaVersion: ATTEMPT_SCHEMA_VERSION,
    transition
  }, {
    label: "execution ledger",
    recordedAt: options.recordedAt || transition.transitionedAt
  });
  return getExecutionAttempt(attemptId, { ledgerPath });
}

function listExecutionAttempts(options = {}) {
  return readExecutionLedger(options).attempts;
}

function hasCommittedTransaction(transactionId, options = {}) {
  return Boolean(readExecutionLedger(options).committedTransactions[transactionId]);
}

function reportVerification(result) {
  console.log("Institution OS Execution Ledger");
  console.log("");
  console.log(`Records: ${result.count}`);
  console.log(`Attempts: ${result.attempts.length}`);
  console.log(`Head hash: ${result.headHash}`);
  console.log("Execution ledger: PASS");
}

module.exports = {
  RECORD_TYPES,
  createExecutionAttempt,
  defaultExecutionLedgerPath,
  getExecutionAttempt,
  hasCommittedTransaction,
  listExecutionAttempts,
  readExecutionLedger,
  replayExecutionEntries,
  transitionExecutionAttempt
};

if (require.main === module) {
  const [command, value] = process.argv.slice(2);
  try {
    if (command === "verify") {
      reportVerification(readExecutionLedger());
    } else if (command === "show" && value) {
      console.log(JSON.stringify(getExecutionAttempt(value), null, 2));
    } else if (command === "list") {
      console.log(JSON.stringify(listExecutionAttempts(), null, 2));
    } else {
      console.error("Usage: node kernel/execution/ledger.js verify | show <attempt-id> | list");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
