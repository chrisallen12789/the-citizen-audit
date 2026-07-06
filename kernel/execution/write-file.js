const { institutionFile } = require("./path-safety");
const { atomicReplaceFile } = require("./durable-io");

function writeInstitutionFile(rootDir, relativePath, bytes, mode = 0o600, options = {}) {
  const target = institutionFile(rootDir, relativePath);
  atomicReplaceFile(target, bytes, { mode, token: options.token });
  return target;
}

module.exports = { writeInstitutionFile };
