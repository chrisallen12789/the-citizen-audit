const { appendEntry, readVerifiedLog } = require("../lib/append-only-log");
const { journalPath } = require("./recovery-store");

const JOURNAL_VERSION = "1.0.0";
const RECORD_TYPES = Object.freeze([
  "mutation.operation.started",
  "mutation.operation.completed",
  "rollback.operation.completed",
  "rollback.directory.removed"
]);

function appendMutationRecord(rootDir, attemptId, record, options = {}) {
  if (!RECORD_TYPES.includes(record.recordType)) throw new Error(`Unknown mutation journal record type: ${record.recordType}.`);
  if (record.attemptId && record.attemptId !== attemptId) throw new Error("Mutation journal attempt id mismatch.");
  return appendEntry(journalPath(rootDir, attemptId), {
    journalVersion: JOURNAL_VERSION,
    attemptId,
    ...record
  }, {
    label: `mutation journal ${attemptId}`,
    recordedAt: options.recordedAt
  });
}

function readMutationJournal(rootDir, attemptId) {
  const verified = readVerifiedLog(journalPath(rootDir, attemptId), `mutation journal ${attemptId}`);
  const started = new Map();
  const completed = new Set();
  const createdParents = new Set();
  for (const entry of verified.entries) {
    if (entry.journalVersion !== JOURNAL_VERSION || entry.attemptId !== attemptId || !RECORD_TYPES.includes(entry.recordType)) {
      throw new Error(`Mutation journal contains an invalid record at sequence ${entry.sequence}.`);
    }
    if (entry.recordType === "mutation.operation.started") {
      if (typeof entry.operationId !== "string" || started.has(entry.operationId)) throw new Error(`Mutation journal contains duplicate operation: ${entry.operationId}.`);
      started.set(entry.operationId, entry);
      for (const parent of entry.plannedParentDirectories || []) createdParents.add(parent);
    }
    if (entry.recordType === "mutation.operation.completed") {
      if (!started.has(entry.operationId) || completed.has(entry.operationId)) throw new Error(`Mutation journal completion is invalid: ${entry.operationId}.`);
      completed.add(entry.operationId);
    }
  }
  return {
    ...verified,
    started,
    completed,
    plannedParentDirectories: [...createdParents]
  };
}

module.exports = { JOURNAL_VERSION, appendMutationRecord, readMutationJournal };
