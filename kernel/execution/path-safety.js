const { normalizeRelativePath } = require("../transactions/validate");

function normalizeInstitutionPath(relativePath) {
  return normalizeRelativePath(relativePath);
}

module.exports = { normalizeInstitutionPath };
