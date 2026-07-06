const fs = require("fs");
const { sha256 } = require("../lib/append-only-log");
const { institutionDirectory, institutionFile } = require("./path-safety");
const { fileState } = require("./file-state");
const { atomicReplaceFile, unlinkDurable } = require("./durable-io");
const {
  readExecutionLock,
  releaseExecutionLock,
  releaseRecoveredExecutionLock
} = require("./exclusive-boundary");
const {
  loadPreStateManifest,
  readSnapshotBlob,
  writeRollbackResult
} = require("./recovery-store");
const { appendMutationRecord, readMutationJournal } = require("./mutation-journal");
const { getExecutionAttempt, transitionExecutionAttempt } = require("./ledger");

function invokeHook(options, point, context = {}) {
  if (typeof options.onStep === "function") options.onStep(point, context);
}

function verifyManifestRestoration(rootDir, manifest) {
  const failures = [];
  for (const entry of manifest.entries) {
    try {
      const state = fileState(rootDir, entry.path);
      if (state.existed !== entry.existed) {
        failures.push(`${entry.path}: existence mismatch`);
        continue;
      }
      if (!entry.existed) continue;
      if (sha256(state.bytes) !== entry.contentHash) failures.push(`${entry.path}: content mismatch`);
      if (state.mode !== entry.mode) failures.push(`${entry.path}: mode mismatch`);
    } catch (error) {
      failures.push(`${entry.path}: ${error.message}`);
    }
  }
  return { valid: failures.length === 0, failures };
}

function restoreFromManifest(rootDir, attemptId, options = {}) {
  const manifest = loadPreStateManifest(rootDir, attemptId);
  const restoredPaths = [];
  const removedDirectories = [];
  const failures = [];
  let journal;
  try {
    journal = readMutationJournal(rootDir, attemptId);
  } catch (error) {
    failures.push(`journal: ${error.message}`);
    journal = { plannedParentDirectories: [] };
  }

  for (const entry of [...manifest.entries].reverse()) {
    invokeHook(options, "before_rollback_path", { attemptId, entry });
    try {
      const target = institutionFile(rootDir, entry.path);
      if (entry.existed) {
        atomicReplaceFile(target, readSnapshotBlob(rootDir, entry), { mode: entry.mode, token: `rollback-${attemptId}-${entry.index}` });
      } else if (fs.existsSync(target)) {
        unlinkDurable(target);
      }
      restoredPaths.push(entry.path);
      appendMutationRecord(rootDir, attemptId, {
        recordType: "rollback.operation.completed",
        operationId: `rollback:${entry.index}:${entry.path}`,
        index: entry.index,
        path: entry.path,
        restoredExisted: entry.existed
      }, { recordedAt: options.recordedAt });
    } catch (error) {
      failures.push(`${entry.path}: ${error.message}`);
    }
    invokeHook(options, "after_rollback_path", { attemptId, entry });
  }

  const planned = [...new Set(journal.plannedParentDirectories || [])]
    .sort((a, b) => b.split("/").length - a.split("/").length || b.localeCompare(a));
  for (const relative of planned) {
    try {
      const directory = institutionDirectory(rootDir, relative);
      if (fs.existsSync(directory) && fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length === 0) {
        fs.rmdirSync(directory);
        removedDirectories.push(relative);
        appendMutationRecord(rootDir, attemptId, {
          recordType: "rollback.directory.removed",
          path: relative
        }, { recordedAt: options.recordedAt });
      }
    } catch (error) {
      failures.push(`${relative}: ${error.message}`);
    }
  }

  const verification = verifyManifestRestoration(rootDir, manifest);
  failures.push(...verification.failures);
  return { status: failures.length ? "recovery_required" : "rolled_back", restoredPaths, removedDirectories, failures };
}

function ensureRollingBack(attemptId, ledgerPath, options = {}) {
  let attempt = getExecutionAttempt(attemptId, { ledgerPath });
  if (attempt.state === "recovery_persisted") {
    transitionExecutionAttempt(attemptId, "applying", {}, { ledgerPath, transitionedAt: options.transitionedAt, recordedAt: options.recordedAt });
    attempt = getExecutionAttempt(attemptId, { ledgerPath });
  }
  if (["applying", "validating"].includes(attempt.state)) {
    transitionExecutionAttempt(attemptId, "rolling_back", { problems: options.problems || [] }, { ledgerPath, transitionedAt: options.transitionedAt, recordedAt: options.recordedAt });
    attempt = getExecutionAttempt(attemptId, { ledgerPath });
  }
  if (attempt.state !== "rolling_back") throw new Error(`Rollback requires a recoverable state, found ${attempt.state}.`);
  return attempt;
}

function rollbackExecutionAttempt(rootDir, attemptId, options = {}) {
  const ledgerPath = options.ledgerPath;
  ensureRollingBack(attemptId, ledgerPath, options);
  let result;
  try {
    result = restoreFromManifest(rootDir, attemptId, options);
  } catch (error) {
    if (error.code === "INJECTED_CRASH") throw error;
    result = {
      status: "recovery_required",
      restoredPaths: [],
      removedDirectories: [],
      failures: [`recovery infrastructure: ${error.message}`]
    };
  }
  const artifact = writeRollbackResult(rootDir, attemptId, result, { completedAt: options.completedAt });
  transitionExecutionAttempt(attemptId, result.status, {
    rollbackResultHash: artifact.rollbackResultHash,
    problems: result.failures
  }, {
    ledgerPath,
    transitionedAt: options.transitionedAt,
    recordedAt: options.recordedAt
  });
  if (result.status === "rolled_back") {
    const currentLock = readExecutionLock(rootDir);
    if (currentLock && options.lock) releaseExecutionLock(rootDir, options.lock);
    else if (currentLock && options.recoveryTakeover) releaseRecoveredExecutionLock(rootDir, attemptId);
  }
  return { ...result, rollbackResultHash: artifact.rollbackResultHash };
}

module.exports = {
  restoreFromManifest,
  rollbackExecutionAttempt,
  verifyManifestRestoration
};
