const fs = require("fs");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");
const { decodeWriteContent } = require("../transactions/validate");
const { institutionDirectory, institutionFile } = require("./path-safety");
const { atomicReplaceFile, ensureDirectory, unlinkDurable } = require("./durable-io");
const {
  acquireExecutionLock,
  readExecutionLock,
  releaseExecutionLock
} = require("./exclusive-boundary");
const {
  createPreStateManifest,
  loadPreStateManifest,
  manifestPath
} = require("./recovery-store");
const { appendMutationRecord } = require("./mutation-journal");
const {
  getExecutionAttempt,
  listExecutionAttempts,
  transitionExecutionAttempt
} = require("./ledger");

function invokeHook(options, point, context = {}) {
  if (typeof options.onStep === "function") options.onStep(point, context);
}

function assertNoRecoveryBarrier(ledgerPath) {
  const barriers = listExecutionAttempts({ ledgerPath }).filter((attempt) => attempt.state === "recovery_required");
  if (barriers.length) {
    const error = new Error(`Execution is blocked by recovery_required attempt(s): ${barriers.map((item) => item.id).join(", ")}.`);
    error.code = "EXECUTION_RECOVERY_REQUIRED";
    error.attempts = barriers.map((item) => item.id);
    throw error;
  }
}

function assertSessionIntegrity(session) {
  const { rootDir, attemptId, writes, ledgerPath, lock } = session;
  const owner = readExecutionLock(rootDir);
  if (!owner || !lock || owner.attemptId !== attemptId || owner.token !== lock.token) {
    const error = new Error("Recovery session does not own the execution lock.");
    error.code = "EXECUTION_LOCK_OWNERSHIP_MISMATCH";
    throw error;
  }
  const attempt = getExecutionAttempt(attemptId, { ledgerPath });
  const manifest = loadPreStateManifest(rootDir, attemptId);
  if (attempt.preStateManifestHash !== manifest.manifestHash) {
    const error = new Error("Recovery session manifest is not bound to the execution attempt.");
    error.code = "RECOVERY_MANIFEST_BINDING_MISMATCH";
    throw error;
  }
  if (writes.length !== manifest.entries.length) throw new Error("Recovery session write count does not match manifest.");
  writes.forEach((write, index) => {
    const entry = manifest.entries[index];
    if (entry.index !== index || entry.path !== write.path || entry.operation !== write.operation) {
      const error = new Error(`Recovery session write does not match manifest at index ${index}.`);
      error.code = "RECOVERY_WRITE_SET_MISMATCH";
      throw error;
    }
  });
  return { attempt, manifest, owner };
}

function missingParentDirectories(rootDir, relativePath) {
  const target = institutionFile(rootDir, relativePath);
  const missing = [];
  let current = path.dirname(target);
  while (current !== rootDir && !fs.existsSync(current)) {
    missing.push(path.relative(rootDir, current).split(path.sep).join("/"));
    current = path.dirname(current);
  }
  return missing.reverse();
}

function createPlannedParents(rootDir, planned, options = {}) {
  for (const relative of planned) {
    ensureDirectory(institutionDirectory(rootDir, relative));
    invokeHook(options, "after_parent_created", { path: relative });
  }
}

function beginRecoveryAttempt(rootDir, attemptId, writes, options = {}) {
  const ledgerPath = options.ledgerPath;
  assertNoRecoveryBarrier(ledgerPath);
  const attempt = getExecutionAttempt(attemptId, { ledgerPath });
  if (attempt.state !== "prepared") throw new Error(`Recovery preparation requires prepared attempt state: ${attempt.state}.`);
  const lock = acquireExecutionLock(rootDir, attemptId, options.lock || {});
  invokeHook(options, "after_lock", { attemptId, lock });
  try {
    const manifest = createPreStateManifest(rootDir, attemptId, writes, { createdAt: options.createdAt });
    invokeHook(options, "after_manifest", { attemptId, manifest });
    transitionExecutionAttempt(attemptId, "recovery_persisted", {
      preStateManifestHash: manifest.manifestHash
    }, {
      ledgerPath,
      transitionedAt: options.transitionedAt,
      recordedAt: options.recordedAt
    });
    invokeHook(options, "after_recovery_persisted", { attemptId, manifest });
    return Object.freeze({ rootDir, attemptId, writes: writes.map((write) => ({ ...write })), manifest, lock, ledgerPath });
  } catch (error) {
    if (!fs.existsSync(manifestPath(rootDir, attemptId))) releaseExecutionLock(rootDir, lock);
    throw error;
  }
}

function applyJournaledWrites(session, options = {}) {
  const { rootDir, attemptId, writes, ledgerPath } = session;
  const { attempt, manifest } = assertSessionIntegrity(session);
  if (attempt.state !== "recovery_persisted") throw new Error(`Applying requires recovery_persisted state: ${attempt.state}.`);
  transitionExecutionAttempt(attemptId, "applying", {}, {
    ledgerPath,
    transitionedAt: options.transitionedAt,
    recordedAt: options.recordedAt
  });
  invokeHook(options, "after_state_applying", { attemptId });

  for (let index = 0; index < writes.length; index += 1) {
    const write = writes[index];
    const operationId = `${String(index + 1).padStart(6, "0")}:${write.path}`;
    const plannedParentDirectories = write.operation === "write" ? missingParentDirectories(rootDir, write.path) : [];
    const bytes = write.operation === "write" ? decodeWriteContent(write) : null;
    appendMutationRecord(rootDir, attemptId, {
      recordType: "mutation.operation.started",
      operationId,
      index,
      operation: write.operation,
      path: write.path,
      plannedParentDirectories,
      contentHash: bytes ? sha256(bytes) : null
    }, { recordedAt: options.recordedAt });
    invokeHook(options, "after_operation_started", { attemptId, operationId, write });

    createPlannedParents(rootDir, plannedParentDirectories, options);
    const target = institutionFile(rootDir, write.path);
    if (write.operation === "write") {
      const manifestEntry = manifest.entries[index];
      atomicReplaceFile(target, bytes, { mode: manifestEntry.existed ? manifestEntry.mode : 0o600, token: `${attemptId}-${index}` });
    } else if (fs.existsSync(target)) {
      unlinkDurable(target);
    }
    invokeHook(options, "after_materialized", { attemptId, operationId, write });
    appendMutationRecord(rootDir, attemptId, {
      recordType: "mutation.operation.completed",
      operationId,
      index,
      operation: write.operation,
      path: write.path
    }, { recordedAt: options.recordedAt });
    invokeHook(options, "after_operation_completed", { attemptId, operationId, write });
  }
  return getExecutionAttempt(attemptId, { ledgerPath });
}

module.exports = {
  applyJournaledWrites,
  assertNoRecoveryBarrier,
  assertSessionIntegrity,
  beginRecoveryAttempt
};
