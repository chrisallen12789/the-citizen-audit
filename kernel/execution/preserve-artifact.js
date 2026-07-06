const fs = require("fs");
const { sha256 } = require("../lib/append-only-log");
const { writeBytesDurable } = require("./durable-io");
const { vaultPath } = require("./artifact-vault");

function preserveArtifact(rootDir, targetPath, label = "artifact", options = {}) {
  if (!fs.existsSync(targetPath)) return null;
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Artifact is not a regular file: ${targetPath}.`);
  const bytes = fs.readFileSync(targetPath);
  const contentHash = sha256(bytes);
  const vault = vaultPath(rootDir, label, options);
  writeBytesDurable(vault.destination, bytes, { flag: "wx", mode: stat.mode & 0o777 });
  return Object.freeze({
    source: targetPath,
    destination: vault.destination,
    contentHash,
    mode: stat.mode & 0o777
  });
}

module.exports = { preserveArtifact };
