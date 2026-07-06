const crypto = require("crypto");
const path = require("path");
const { appendEntry } = require("../lib/append-only-log");
const { assertValidTransaction, computeWriteSetHash } = require("../transactions/validate");

function defaultTransactionLogPath(rootDir) {
  return path.join(rootDir, "kernel", "transactions", "state", "transactions.jsonl");
}

function createTransactionId() {
  return `TX-CAPTURE-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function captureTransaction(rootDir, input, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const transaction = {
    version: "1.0.0",
    id: options.transactionId || createTransactionId(),
    createdAt,
    actor: { type: "agent", id: input.agent.id },
    action: input.action,
    affectedObjects: [...input.affectedObjects],
    preconditions: [],
    proposedWrites: input.writes.map((write) => ({ ...write })),
    justification: `Captured from isolated runtime invocation ${input.invocationId}.`,
    status: "proposed",
    approval: null,
    writeSetHash: computeWriteSetHash(input.writes),
    metadata: {
      runtimeInvocationId: input.invocationId,
      sandboxed: true,
      commandHash: input.commandHash,
      stdoutHash: input.stdoutHash,
      stderrHash: input.stderrHash
    }
  };
  assertValidTransaction(transaction);
  appendEntry(options.transactionLogPath || defaultTransactionLogPath(rootDir), {
    recordType: "transaction.proposed",
    schemaVersion: "1.0.0",
    transaction
  }, {
    label: "transaction log",
    recordedAt: options.recordedAt || createdAt
  });
  return Object.freeze(transaction);
}

module.exports = { captureTransaction, createTransactionId, defaultTransactionLogPath };
