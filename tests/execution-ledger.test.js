const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { appendEntry } = require("../kernel/lib/append-only-log");
const { ATTEMPT_SCHEMA_VERSION } = require("../kernel/execution/attempt-schema");
const { ALLOWED_TRANSITIONS, EXECUTION_STATES, assertExecutionStateTransition } = require("../kernel/execution/state-machine");
const {
  createExecutionAttempt,
  getExecutionAttempt,
  hasCommittedTransaction,
  readExecutionLedger,
  transitionExecutionAttempt
} = require("../kernel/execution/ledger");

const H = Object.freeze({
  writeSet: "1".repeat(64),
  authority: "2".repeat(64),
  policy: "3".repeat(64),
  validators: "4".repeat(64),
  plan: "5".repeat(64),
  manifest: "6".repeat(64),
  validation: "7".repeat(64),
  rollback: "8".repeat(64)
});

function withLedger(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "execution-ledger-test-"));
  const ledgerPath = path.join(tempDir, "ledger.jsonl");
  try {
    return fn({ tempDir, ledgerPath });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function attemptInput(overrides = {}) {
  return {
    id: "ATTEMPT-001",
    transactionId: "TX-001",
    writeSetHash: H.writeSet,
    actor: { type: "system", id: "TEST-SYSTEM" },
    authorityStateHash: H.authority,
    policyHash: H.policy,
    validatorSetHash: H.validators,
    planHash: H.plan,
    metadata: { test: true },
    ...overrides
  };
}

function prepareToValidating(ledgerPath, id = "ATTEMPT-001") {
  transitionExecutionAttempt(id, "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath, transitionedAt: "2026-07-06T13:01:00.000Z" });
  transitionExecutionAttempt(id, "applying", {}, { ledgerPath, transitionedAt: "2026-07-06T13:02:00.000Z" });
  transitionExecutionAttempt(id, "validating", {}, { ledgerPath, transitionedAt: "2026-07-06T13:03:00.000Z" });
}

test("replays a valid committed attempt deterministically", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath, createdAt: "2026-07-06T13:00:00.000Z" });
  prepareToValidating(ledgerPath);
  const committed = transitionExecutionAttempt("ATTEMPT-001", "committed", { validationResultHash: H.validation, warnings: ["reviewed"] }, { ledgerPath, transitionedAt: "2026-07-06T13:04:00.000Z" });

  assert.equal(committed.state, "committed");
  assert.equal(committed.terminalDisposition, "committed");
  assert.equal(committed.preStateManifestHash, H.manifest);
  assert.equal(committed.validationResultHash, H.validation);
  assert.equal(committed.transitionCount, 4);
  assert.deepEqual(committed.warnings, ["reviewed"]);
  assert.equal(hasCommittedTransaction("TX-001", { ledgerPath }), true);
  assert.deepEqual(readExecutionLedger({ ledgerPath }).attempts, readExecutionLedger({ ledgerPath }).attempts);
}));

test("rejects skipped, repeated, and unknown transitions", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath, createdAt: "2026-07-06T13:00:00.000Z" });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-001", "applying", {}, { ledgerPath }), { code: "INVALID_EXECUTION_STATE_TRANSITION" });
  transitionExecutionAttempt("ATTEMPT-001", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-001", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath }), { code: "INVALID_EXECUTION_STATE_TRANSITION" });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-001", "unknown", {}, { ledgerPath }), { code: "UNKNOWN_EXECUTION_STATE" });
}));

test("requires phase-binding hashes", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-001", "recovery_persisted", {}, { ledgerPath }), { code: "MISSING_EXECUTION_TRANSITION_HASH" });
  transitionExecutionAttempt("ATTEMPT-001", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-001", "applying", {}, { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-001", "validating", {}, { ledgerPath });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-001", "committed", {}, { ledgerPath }), { code: "MISSING_EXECUTION_TRANSITION_HASH" });
}));

test("rejects duplicate attempt ids", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath });
  assert.throws(() => createExecutionAttempt(attemptInput(), { ledgerPath }), { code: "DUPLICATE_EXECUTION_ATTEMPT" });
}));

test("permits multiple attempts but only one commit per transaction", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput({ id: "ATTEMPT-001" }), { ledgerPath });
  createExecutionAttempt(attemptInput({ id: "ATTEMPT-002" }), { ledgerPath });
  prepareToValidating(ledgerPath, "ATTEMPT-001");
  prepareToValidating(ledgerPath, "ATTEMPT-002");
  transitionExecutionAttempt("ATTEMPT-001", "committed", { validationResultHash: H.validation }, { ledgerPath });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-002", "committed", { validationResultHash: H.validation }, { ledgerPath }), { code: "TRANSACTION_ALREADY_COMMITTED" });
  assert.throws(() => createExecutionAttempt(attemptInput({ id: "ATTEMPT-003" }), { ledgerPath }), { code: "TRANSACTION_ALREADY_COMMITTED" });
}));

test("terminal attempts are immutable", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath });
  prepareToValidating(ledgerPath);
  transitionExecutionAttempt("ATTEMPT-001", "committed", { validationResultHash: H.validation }, { ledgerPath });
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-001", "rolling_back", {}, { ledgerPath }), { code: "TERMINAL_EXECUTION_ATTEMPT" });
}));

test("records rolled_back and recovery_required terminal outcomes", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput({ id: "ATTEMPT-ROLLBACK", transactionId: "TX-ROLLBACK" }), { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-ROLLBACK", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-ROLLBACK", "applying", {}, { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-ROLLBACK", "rolling_back", { problems: ["write failed"] }, { ledgerPath });
  const rolledBack = transitionExecutionAttempt("ATTEMPT-ROLLBACK", "rolled_back", { rollbackResultHash: H.rollback }, { ledgerPath });
  assert.equal(rolledBack.terminalDisposition, "rolled_back");
  assert.deepEqual(rolledBack.problems, ["write failed"]);

  createExecutionAttempt(attemptInput({ id: "ATTEMPT-RECOVERY", transactionId: "TX-RECOVERY" }), { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-RECOVERY", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-RECOVERY", "applying", {}, { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-RECOVERY", "rolling_back", {}, { ledgerPath });
  const recovery = transitionExecutionAttempt("ATTEMPT-RECOVERY", "recovery_required", { rollbackResultHash: H.rollback, problems: ["restoration mismatch"] }, { ledgerPath });
  assert.equal(recovery.terminalDisposition, "recovery_required");
  assert.deepEqual(recovery.problems, ["restoration mismatch"]);
}));

test("detects hash-chain tampering", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath, createdAt: "2026-07-06T13:00:00.000Z" });
  const line = JSON.parse(fs.readFileSync(ledgerPath, "utf8").trim());
  line.attempt.transactionId = "TX-TAMPERED";
  fs.writeFileSync(ledgerPath, `${JSON.stringify(line)}\n`, "utf8");
  assert.throws(() => readExecutionLedger({ ledgerPath }), /hash verification failed/);
}));

test("rejects malformed semantic ledger entries even when hash chain is valid", () => withLedger(({ ledgerPath }) => {
  appendEntry(ledgerPath, { recordType: "execution.unknown", schemaVersion: "1.0.0" }, { label: "execution ledger", recordedAt: "2026-07-06T13:00:00.000Z" });
  assert.throws(() => readExecutionLedger({ ledgerPath }), { code: "INVALID_EXECUTION_LEDGER" });
}));

test("fixed inputs produce deterministic ledger hashes", () => {
  const createFixed = () => withLedger(({ ledgerPath }) => {
    createExecutionAttempt(attemptInput(), {
      ledgerPath,
      createdAt: "2026-07-06T13:00:00.000Z",
      recordedAt: "2026-07-06T13:00:00.000Z"
    });
    return readExecutionLedger({ ledgerPath }).headHash;
  });
  assert.equal(createFixed(), createFixed());
});

test("returned attempt views are deeply immutable", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath });
  const attempt = getExecutionAttempt("ATTEMPT-001", { ledgerPath });
  assert.equal(Object.isFrozen(attempt), true);
  assert.equal(Object.isFrozen(attempt.actor), true);
  attempt.actor.id = "MUTATED";
  assert.equal(attempt.actor.id, "TEST-SYSTEM");
}));

test("state machine accepts only its declared transition matrix", () => {
  for (const from of EXECUTION_STATES) {
    for (const to of EXECUTION_STATES) {
      if (ALLOWED_TRANSITIONS[from].includes(to)) {
        assert.doesNotThrow(() => assertExecutionStateTransition(from, to));
      } else {
        assert.throws(() => assertExecutionStateTransition(from, to), { code: "INVALID_EXECUTION_STATE_TRANSITION" });
      }
    }
  }
});

test("rejects phase hashes before appending an invalid record", () => withLedger(({ ledgerPath }) => {
  createExecutionAttempt(attemptInput(), { ledgerPath });
  transitionExecutionAttempt("ATTEMPT-001", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath });
  const before = readExecutionLedger({ ledgerPath });
  assert.throws(
    () => transitionExecutionAttempt("ATTEMPT-001", "applying", { validationResultHash: H.validation }, { ledgerPath }),
    { code: "INVALID_EXECUTION_TRANSITION_BINDING" }
  );
  const after = readExecutionLedger({ ledgerPath });
  assert.equal(after.count, before.count);
  assert.equal(after.headHash, before.headHash);
}));


test("rejects invalid attempt input before appending", () => withLedger(({ ledgerPath }) => {
  assert.throws(
    () => createExecutionAttempt(attemptInput({ writeSetHash: "not-a-hash", actor: { type: "system", id: "TEST", extra: true } }), { ledgerPath }),
    { code: "INVALID_EXECUTION_ATTEMPT" }
  );
  assert.equal(readExecutionLedger({ ledgerPath }).count, 0);
}));

test("rejects unknown attempts without creating ledger entries", () => withLedger(({ ledgerPath }) => {
  assert.throws(() => transitionExecutionAttempt("ATTEMPT-MISSING", "recovery_persisted", { preStateManifestHash: H.manifest }, { ledgerPath }), { code: "EXECUTION_ATTEMPT_NOT_FOUND" });
  assert.equal(readExecutionLedger({ ledgerPath }).count, 0);
}));

test("rejects unsupported ledger schema versions", () => withLedger(({ ledgerPath }) => {
  appendEntry(ledgerPath, { recordType: "execution.attempt.created", schemaVersion: "9.9.9", attempt: {} }, { label: "execution ledger", recordedAt: "2026-07-06T13:00:00.000Z" });
  assert.throws(() => readExecutionLedger({ ledgerPath }), { code: "INVALID_EXECUTION_LEDGER" });
  assert.equal(ATTEMPT_SCHEMA_VERSION, "1.0.0");
}));
