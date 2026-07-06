const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");

function preserveRecoveryRecord(options) {
  const root = options.recoveryRoot || path.join(os.tmpdir(), "institution-os-recovery");
  const directory = path.join(root, options.executionId);
  fs.mkdirSync(directory, { recursive: true });
  const snapshots = [];
  for (const snapshot of options.snapshots) {
    const contentFile = snapshot.existed ? `${sha256(snapshot.path)}.bin` : null;
    if (contentFile) fs.writeFileSync(path.join(directory, contentFile), snapshot.bytes, { mode: 0o600 });
    snapshots.push({ path: snapshot.path, existed: snapshot.existed, mode: snapshot.mode || null, hash: snapshot.hash, contentFile });
  }
  const manifest = {
    executionId: options.executionId,
    transactionId: options.transactionId,
    createdAt: new Date().toISOString(),
    reason: options.reason,
    snapshots
  };
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return directory;
}

module.exports = { preserveRecoveryRecord };
