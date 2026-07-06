const fs = require("fs");
const { vaultPath } = require("./artifact-vault");
const { moveFile } = require("./move-file");

function preserveArtifact(targetPath, label = "artifact") {
  if (!fs.existsSync(targetPath)) return null;
  const vault = vaultPath(label);
  fs.mkdirSync(vault.directory, { recursive: true });
  return moveFile(targetPath, vault.destination);
}

module.exports = { preserveArtifact };
