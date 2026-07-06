const fs = require("fs");
const path = require("path");
const { normalizeRelativePath } = require("../transactions/validate");
const { fileKind } = require("./file-kind");

function normalizeInstitutionPath(relativePath) {
  return normalizeRelativePath(relativePath);
}

function institutionPath(rootDir, relativePath, options = {}) {
  const normalized = normalizeInstitutionPath(relativePath);
  const segments = normalized.split("/");
  let current = rootDir;

  segments.forEach((segment, index) => {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) return;
    if (fileKind(current) === "link") throw new Error(`Linked execution paths are prohibited: ${relativePath}.`);

    const isFinal = index === segments.length - 1;
    if (!isFinal && !fs.statSync(current).isDirectory()) {
      throw new Error(`Execution path contains a non-directory component: ${relativePath}.`);
    }
    if (isFinal && options.directory && !fs.statSync(current).isDirectory()) {
      throw new Error(`Execution directory path is not a directory: ${relativePath}.`);
    }
  });

  return path.join(rootDir, normalized);
}

function institutionFile(rootDir, relativePath) {
  return institutionPath(rootDir, relativePath);
}

function institutionDirectory(rootDir, relativePath) {
  return institutionPath(rootDir, relativePath, { directory: true });
}

module.exports = {
  institutionDirectory,
  institutionFile,
  institutionPath,
  normalizeInstitutionPath
};
