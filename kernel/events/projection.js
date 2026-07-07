const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { readExecutionLedger, defaultExecutionLedgerPath } = require("../execution/ledger");

// Canonical execution-event projection.
//
// Execution events are a PROJECTION of the authoritative hash-chained execution
// ledger, not a competing source of truth. Event ids are derived from the
// verified ledger sequence (safely allocated — no unlocked append-file
// scanning). A malformed or tampered ledger fails verification in
// readExecutionLedger and therefore prevents projection. Rebuilding is a pure
// function of the ledger and is deterministic.

function eventTypeForEntry(entry) {
  if (entry.recordType === "execution.attempt.created") return "execution.attempt.created";
  if (entry.recordType === "execution.attempt.transitioned") return `execution.attempt.${entry.transition.to}`;
  return "execution.attempt.unknown";
}

function projectEntry(entry) {
  const isCreated = entry.recordType === "execution.attempt.created";
  const attemptId = isCreated ? entry.attempt.id : entry.transition.attemptId;
  const transactionId = isCreated ? entry.attempt.transactionId : entry.transition.transactionId;
  const type = eventTypeForEntry(entry);

  const body = {
    id: `EXEC-EVENT-${String(entry.sequence).padStart(8, "0")}`,
    type,
    ledgerSequence: entry.sequence,
    ledgerHash: entry.hash,
    attemptId,
    transactionId,
    relatedRecords: [transactionId, attemptId],
    recordedAt: entry.recordedAt,
    data: isCreated
      ? { writeSetHash: entry.attempt.writeSetHash, actor: entry.attempt.actor }
      : { from: entry.transition.from, to: entry.transition.to }
  };
  return Object.freeze({ ...body, eventHash: sha256(canonicalStringify(body)) });
}

// Project canonical execution events from the ledger. Throws if the ledger fails
// verification (tamper) — projection cannot proceed on an untrusted ledger.
function projectExecutionEvents(options = {}) {
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(options.rootDir);
  const ledger = readExecutionLedger({ ledgerPath });
  const events = ledger.entries.map(projectEntry);
  const projectionHash = sha256(canonicalStringify(events.map((event) => event.eventHash)));
  return Object.freeze({ events: Object.freeze(events), projectionHash, count: events.length, ledgerHead: ledger.headHash });
}

// Determinism check: two independent projections of the same ledger must be
// byte-identical.
function projectionIsDeterministic(options = {}) {
  const a = projectExecutionEvents(options);
  const b = projectExecutionEvents(options);
  return a.projectionHash === b.projectionHash;
}

module.exports = { projectExecutionEvents, projectionIsDeterministic };
