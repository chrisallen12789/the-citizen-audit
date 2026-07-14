const fs = require("fs");
const path = require("path");
const { defaultExecutionStateRoot } = require("./exclusive-boundary");

const ATTEMPT_ID_PATTERN = /^ATTEMPT-[A-Z0-9][A-Z0-9-]{2,63}$/;

function assertAttemptId(attemptId) {
  if (!ATTEMPT_ID_PATTERN.test(attemptId || "")) throw new Error(`Invalid recovery attempt id: ${attemptId}.`);
  return attemptId;
}

function assertRegularFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} is not a regular file: ${filePath}.`);
}

function attemptStateDirectory(rootDir, attemptId) {
  assertAttemptId(attemptId);
  return path.join(defaultExecutionStateRoot(rootDir), "attempts", attemptId);
}
function manifestPath(rootDir, attemptId) { return path.join(attemptStateDirectory(rootDir, attemptId), "manifest.json"); }
function rollbackResultPath(rootDir, attemptId) { return path.join(attemptStateDirectory(rootDir, attemptId), "rollback.json"); }
function validationResultPath(rootDir, attemptId) { return path.join(attemptStateDirectory(rootDir, attemptId), "validation.json"); }
function blobRoot(rootDir) { return path.join(defaultExecutionStateRoot(rootDir), "blobs"); }
function blobPath(rootDir, hash) { return path.join(blobRoot(rootDir), hash); }
function journalPath(rootDir, attemptId) { return path.join(attemptStateDirectory(rootDir, attemptId), "journal.jsonl"); }

module.exports = {
  assertAttemptId,
  assertRegularFile,
  attemptStateDirectory,
  blobPath,
  blobRoot,
  journalPath,
  manifestPath,
  rollbackResultPath,
  validationResultPath
};
