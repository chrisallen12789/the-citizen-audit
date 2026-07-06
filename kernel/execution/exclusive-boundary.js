const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { ensureDirectory, fsyncDirectory } = require("./durable-io");

const LOCK_VERSION = "1.0.0";
const ATTEMPT_ID_PATTERN = /^ATTEMPT-[A-Z0-9][A-Z0-9-]{2,63}$/;

function assertAttemptId(attemptId) {
  if (!ATTEMPT_ID_PATTERN.test(attemptId || "")) throw new Error(`Invalid execution lock attempt id: ${attemptId}.`);
}

function defaultExecutionStateRoot(rootDir) {
  return path.join(rootDir, "kernel", "execution", "state");
}

function defaultExecutionLockPath(rootDir) {
  return path.join(defaultExecutionStateRoot(rootDir), "lock.json");
}

function readExecutionLock(rootDir, options = {}) {
  const lockPath = options.lockPath || defaultExecutionLockPath(rootDir);
  if (!fs.existsSync(lockPath)) return null;
  let owner;
  try {
    const stat = fs.lstatSync(lockPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("lock path is not a regular file");
    owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    const wrapped = new Error(`Execution lock is unreadable: ${error.message}`);
    wrapped.code = "INVALID_EXECUTION_LOCK";
    throw wrapped;
  }
  if (!owner || owner.version !== LOCK_VERSION || typeof owner.attemptId !== "string" || typeof owner.token !== "string") {
    const error = new Error("Execution lock metadata is invalid.");
    error.code = "INVALID_EXECUTION_LOCK";
    throw error;
  }
  return Object.freeze({ ...owner, lockPath });
}

function acquireExecutionLock(rootDir, attemptId, options = {}) {
  assertAttemptId(attemptId);
  const lockPath = options.lockPath || defaultExecutionLockPath(rootDir);
  ensureDirectory(path.dirname(lockPath));
  const owner = {
    version: LOCK_VERSION,
    attemptId,
    token: options.token || crypto.randomUUID(),
    pid: options.pid === undefined ? process.pid : options.pid,
    hostname: options.hostname || os.hostname(),
    acquiredAt: options.acquiredAt || new Date().toISOString()
  };
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(descriptor, `${canonicalStringify(owner)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(path.dirname(lockPath));
    return Object.freeze({ ...owner, lockPath });
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (error.code === "EEXIST") {
      const current = readExecutionLock(rootDir, { lockPath });
      const locked = new Error(`Execution is already locked by ${current ? current.attemptId : "an unknown attempt"}.`);
      locked.code = "EXECUTION_LOCKED";
      locked.owner = current;
      throw locked;
    }
    throw error;
  }
}

function releaseExecutionLock(rootDir, lock, options = {}) {
  const lockPath = options.lockPath || lock.lockPath || defaultExecutionLockPath(rootDir);
  const current = readExecutionLock(rootDir, { lockPath });
  if (!current) return false;
  if (current.attemptId !== lock.attemptId || current.token !== lock.token) {
    const error = new Error("Execution lock ownership mismatch.");
    error.code = "EXECUTION_LOCK_OWNERSHIP_MISMATCH";
    throw error;
  }
  fs.unlinkSync(lockPath);
  fsyncDirectory(path.dirname(lockPath));
  return true;
}

function releaseRecoveredExecutionLock(rootDir, attemptId, options = {}) {
  const lockPath = options.lockPath || defaultExecutionLockPath(rootDir);
  const current = readExecutionLock(rootDir, { lockPath });
  if (!current) return false;
  if (current.attemptId !== attemptId) {
    const error = new Error(`Recovery cannot release lock owned by ${current.attemptId}.`);
    error.code = "EXECUTION_LOCK_OWNERSHIP_MISMATCH";
    throw error;
  }
  fs.unlinkSync(lockPath);
  fsyncDirectory(path.dirname(lockPath));
  return true;
}

module.exports = {
  LOCK_VERSION,
  acquireExecutionLock,
  defaultExecutionLockPath,
  defaultExecutionStateRoot,
  readExecutionLock,
  releaseExecutionLock,
  releaseRecoveredExecutionLock
};
