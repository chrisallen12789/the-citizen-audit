const crypto = require("crypto");
const os = require("os");
const path = require("path");

function vaultPath(label = "artifact") {
  const name = `${label}-${crypto.randomUUID()}`;
  const directory = path.join(os.tmpdir(), "institution-os-artifact-vault");
  return { directory, destination: path.join(directory, name) };
}

module.exports = { vaultPath };
