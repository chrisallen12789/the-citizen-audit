const fs = require("fs");
const {
  acquireExecutionLock,
  readExecutionLock,
  releaseRecoveredExecutionLock
} = require("./exclusive-boundary");
const {
  attemptStateDirectory,
  loadPreStateManifest,
  manifestPath
} = require("./recovery-store");
const { getExecutionAttempt, listExecutionAttempts } = require("./ledger");
const { rollbackExecutionAttempt, verifyManifestRestoration } = require("./rollback");

function incompleteAttempts(rootDir, ledgerPath) {
  return listExecutionAttempts({ ledgerPath }).filter((attempt) => {
    if (["committed", "rolled_back", "recovery_required"].includes(attempt.state)) return false;
    if (attempt.state !== "prepared") return true;
    return fs.existsSync(manifestPath(rootDir, attempt.id));
  });
}

function recoverIncompleteExecution(rootDir, options = {}) {
  const ledgerPath = options.ledgerPath;
  const attempts = listExecutionAttempts({ ledgerPath });
  const barriers = attempts.filter((attempt) => attempt.state === "recovery_required");
  if (barriers.length) return { status: "recovery_required", recovered: barriers.map((item) => item.id) };
  const lock = readExecutionLock(rootDir);
  const incomplete = incompleteAttempts(rootDir, ledgerPath);
  if (!lock && incomplete.length === 0) return { status: "clean", recovered: [] };
  if (incomplete.length > 1) {
    const error = new Error(`Multiple incomplete execution attempts require operator review: ${incomplete.map((item) => item.id).join(", ")}.`);
    error.code = "AMBIGUOUS_EXECUTION_RECOVERY";
    throw error;
  }
  const attempt = lock ? getExecutionAttempt(lock.attemptId, { ledgerPath }) : incomplete[0];
  if (!attempt) throw new Error("Execution lock references a missing attempt.");
  let recoveryLock = lock;
  if (!recoveryLock) recoveryLock = acquireExecutionLock(rootDir, attempt.id, options.recoveryLock || {});
  if (lock && !options.assumeOwnerDead) {
    const error = new Error(`Execution lock is still owned by ${lock.attemptId}; recovery takeover was not authorized.`);
    error.code = "EXECUTION_RECOVERY_TAKEOVER_REQUIRED";
    throw error;
  }
  if (attempt.state === "prepared") {
    const stateDirectory = attemptStateDirectory(rootDir, attempt.id);
    if (fs.existsSync(manifestPath(rootDir, attempt.id))) {
      const manifest = loadPreStateManifest(rootDir, attempt.id);
      const verification = verifyManifestRestoration(rootDir, manifest);
      if (!verification.valid) {
        const error = new Error(`Prepared recovery state does not match live state: ${verification.failures.join(", ")}.`);
        error.code = "PREPARED_RECOVERY_STATE_MISMATCH";
        throw error;
      }
    }
    if (fs.existsSync(stateDirectory)) fs.rmSync(stateDirectory, { recursive: true, force: true });
    releaseRecoveredExecutionLock(rootDir, attempt.id);
    return { status: "no_mutation", recovered: [attempt.id] };
  }
  if (["committed", "rolled_back"].includes(attempt.state)) {
    releaseRecoveredExecutionLock(rootDir, attempt.id);
    return { status: attempt.state, recovered: [attempt.id] };
  }
  const result = rollbackExecutionAttempt(rootDir, attempt.id, { ...options, ledgerPath, recoveryTakeover: true });
  return { status: result.status, recovered: [attempt.id], result };
}

module.exports = { incompleteAttempts, recoverIncompleteExecution };
