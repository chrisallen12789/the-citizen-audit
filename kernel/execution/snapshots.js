const { sha256 } = require("../lib/append-only-log");
const { decodeWriteContent } = require("../transactions/validate");
const { fileState } = require("./file-state");

function snapshotWrites(rootDir, writes) {
  return writes.map((write) => {
    const state = fileState(rootDir, write.path);
    return { ...state, hash: state.existed ? sha256(state.bytes) : null };
  });
}

function verifySnapshot(rootDir, snapshot) {
  const current = fileState(rootDir, snapshot.path);
  if (current.existed !== snapshot.existed) return false;
  if (!snapshot.existed) return true;
  return sha256(current.bytes) === snapshot.hash && current.mode === snapshot.mode;
}

function verifyRestoration(rootDir, snapshots) {
  const failures = snapshots.filter((snapshot) => !verifySnapshot(rootDir, snapshot)).map((snapshot) => snapshot.path);
  return { valid: failures.length === 0, failures };
}

module.exports = { snapshotWrites, verifyRestoration, verifySnapshot };
