const path = require("path");
const { normalizeRelativePath } = require("../transactions/validate");

function normalizeInstitutionPath(relativePath) {
  return normalizeRelativePath(relativePath);
}

function institutionFile(rootDir, relativePath) {
  return path.join(rootDir, normalizeInstitutionPath(relativePath));
}

module.exports = { institutionFile, normalizeInstitutionPath };
