const fs = require("fs");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");
const { ensureDirectory, writeBytesDurable } = require("./durable-io");
const { assertRegularFile, blobPath } = require("./recovery-paths");

function persistBlob(rootDir, bytes) {
  const hash = sha256(bytes);
  const target = blobPath(rootDir, hash);
  ensureDirectory(path.dirname(target));
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target);
    if (sha256(existing) !== hash) throw new Error(`Snapshot blob hash mismatch: ${hash}.`);
    return hash;
  }
  try {
    writeBytesDurable(target, bytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target);
    if (sha256(existing) !== hash) throw new Error(`Snapshot blob collision: ${hash}.`);
  }
  return hash;
}

function readSnapshotBlob(rootDir, entry) {
  if (!entry.existed) return null;
  const target = blobPath(rootDir, entry.blobHash);
  assertRegularFile(target, "Snapshot blob");
  const bytes = fs.readFileSync(target);
  if (sha256(bytes) !== entry.blobHash) throw new Error(`Snapshot blob verification failed: ${entry.path}.`);
  return bytes;
}

module.exports = { persistBlob, readSnapshotBlob };
