const { sha256 } = require("../lib/append-only-log");
const { fileState } = require("./file-state");
const {
  createPreStateManifest,
  loadPreStateManifest,
  readSnapshotBlob
} = require("./recovery-store");

function snapshotWrites(rootDir, writes, options = {}) {
  if (!options.attemptId) throw new Error("Durable snapshots require an attemptId.");
  return createPreStateManifest(rootDir, options.attemptId, writes, options);
}

function verifySnapshot(rootDir, snapshot) {
  const current = fileState(rootDir, snapshot.path);
  if (current.existed !== snapshot.existed) return false;
  if (!snapshot.existed) return true;
  return sha256(current.bytes) === snapshot.contentHash && current.mode === snapshot.mode;
}

function verifyRestoration(rootDir, manifestOrAttemptId) {
  const manifest = typeof manifestOrAttemptId === "string"
    ? loadPreStateManifest(rootDir, manifestOrAttemptId)
    : manifestOrAttemptId;
  const failures = manifest.entries.filter((entry) => !verifySnapshot(rootDir, entry)).map((entry) => entry.path);
  return { valid: failures.length === 0, failures };
}

module.exports = {
  loadPreStateManifest,
  readSnapshotBlob,
  snapshotWrites,
  verifyRestoration,
  verifySnapshot
};
