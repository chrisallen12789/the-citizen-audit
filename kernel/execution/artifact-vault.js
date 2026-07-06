const crypto = require("crypto");
const path = require("path");
const { defaultExecutionStateRoot } = require("./exclusive-boundary");

function sanitizeLabel(label) {
  return String(label || "artifact").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "artifact";
}

function vaultPath(rootDir, label = "artifact", options = {}) {
  if (!rootDir) throw new Error("Artifact vault requires the institution root directory.");
  const name = `${sanitizeLabel(label)}-${sanitizeLabel(options.id || crypto.randomUUID())}`;
  const directory = path.join(defaultExecutionStateRoot(rootDir), "artifacts");
  return { directory, destination: path.join(directory, name) };
}

module.exports = { sanitizeLabel, vaultPath };
