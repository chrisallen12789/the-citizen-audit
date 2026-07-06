const fs = require("fs");
const path = require("path");
const { normalizeRelativePath } = require("../transactions/validate");
const { fileKind } = require("./file-kind");

function normalizeInstitutionPath(relativePath) {
  return normalizeRelativePath(relativePath);
}

function institutionFile(rootDir, relativePath) {
  const normalized = normalizeInstitutionPath(relativePath);
  let current = rootDir;
  for (const segment of normalized.split("/")) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fileKind(current) === "link") throw new Error(`Linked execution paths are prohibited: ${relativePath}.`);
  }
  return path.join(rootDir, normalized);
}

module.exports = { institutionFile, normalizeInstitutionPath };
