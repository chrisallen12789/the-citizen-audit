const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkAction } = require("../authority/engine");
const { createEventWriter } = require("../events/write");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { getTransaction } = require("../transactions/store");
const { assertValidTransaction, computeWriteSetHash, decodeWriteContent } = require("../transactions/validate");
const { applyDeclaredChange } = require("./apply-change");
const { assessPlan } = require("./assurance");
const { createCandidateState } = require("./candidate-state");
const { matchesDeclaredWrite } = require("./canonical-assurance");
const { enterMutationBoundary } = require("./exclusion");
const { buildExecutionPlan, loadInstitutionRegistry, readJson } = require("./plan");
const { appendExecutionHistory, previousSuccessfulExecution } = require("./records");
const { preserveRecoveryRecord } = require("./recovery-record");
const { restoreExistingFile } = require("./restore-existing");
const { snapshotWrites, verifyRestoration, verifySnapshot } = require("./snapshots");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function defaultPolicy(rootDir = repositoryRoot) {
  return readJson(path.join(rootDir, "kernel", "execution", "policy.json"));
}

function defaultHistoryPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "execution", "history.jsonl");
}

function defaultBoundaryPath(rootDir) {
  return path.join(os.tmpdir(), "institution-os-boundaries", `${sha256(path.resolve(rootDir)).slice(0, 24)}.jsonl`);
}

function nextExecutionId(now = new Date()) {
  return `EXEC-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function normalizeRecordedTransaction(transaction) {
  return { ...transaction, writeSetHash: transaction.writeSetHash || computeWriteSetHash(transaction.proposedWrites) };
}

function resolveTransaction(transactionOrId, options) {
  if (typeof transactionOrId === "string") return getTransaction(transactionOrId, { rootDir: options.rootDir, logPath: options.transactionLogPath });
  if (!transactionOrId || typeof transactionOrId !== "object") throw new Error("Execution requires a transaction object or transaction id.");
  if (!options.requireRecorded) return transactionOrId;
  const recorded = getTransaction(transactionOrId.id, { rootDir: options.rootDir, logPath: options.transactionLogPath });
  if (canonicalStringify(recorded) !== canonicalStringify(normalizeRecordedTransaction(transactionOrId))) throw new Error(`Transaction input differs from append-only record: ${transactionOrId.id}.`);
  return recorded;
}

function createExecutionEmitter(writeEvent, context) {
  return function emit(type, summary, data = {}, severity = "info") {
    return writeEvent({
      type,
      summary,
      severity,
      actor: context.actor,
      relatedRecords: [context.executionId, context.transactionId, ...(context.affectedObjects || [])],
      data: {
        executionId: context.executionId,
        transactionId: context.transactionId,
        affectedObjects: context.affectedObjects || [],
        declaredPaths: context.declaredPaths || [],
        ...data
      }
    });
  };
}

function prepareExecution(transactionOrId, options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const transaction = normalizeRecordedTransaction(resolveTransaction(transactionOrId, { ...options, rootDir, requireRecorded: options.requireRecorded !== false }));
  assertValidTransaction(transaction);
  if (transaction.status !== "approved") {
    const error = new Error(`Transaction is not approved: ${transaction.id}.`);
    error.code = "TRANSACTION_NOT_APPROVED";
    throw error;
  }
  const historyPath = options.historyPath || defaultHistoryPath(rootDir);
  if (previousSuccessfulExecution(historyPath, transaction.id)) {
    const error = new Error(`Transaction already executed successfully: ${transaction.id}.`);
    error.code = "DUPLICATE_EXECUTION";
    throw error;
  }
  const authorityDecision = (options.authorityCheck || checkAction)(transaction.actor.id, transaction.action);
  if (!authorityDecision.allowed) {
    const error = new Error(`Authority denied at execution time: ${authorityDecision.reason}.`);
    error.code = "AUTHORITY_DENIED";
    error.authorityDecision = authorityDecision;
    throw error;
  }
  const policy = options.policy || defaultPolicy(rootDir);
  const registry = options.registry || loadInstitutionRegistry(rootDir);
  const plan = buildExecutionPlan(transaction, policy, registry);
  if (plan.writeSetHash !== transaction.writeSetHash) {
    const error = new Error("Transaction write-set hash changed before execution.");
    error.code = "WRITE_SET_MISMATCH";
    throw error;
  }
  return { rootDir, transaction, historyPath, authorityDecision, policy, registry, plan };
}

module.exports = { createExecutionEmitter, defaultBoundaryPath, defaultHistoryPath, defaultPolicy, nextExecutionId, prepareExecution, resolveTransaction };
