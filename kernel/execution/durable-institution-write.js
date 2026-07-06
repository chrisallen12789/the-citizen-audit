const fs = require("fs");
const path = require("path");
const { durableWrite } = require("./durable-write");
const { institutionFile } = require("./path-safety");

function durableInstitutionWrite(rootDir, relativePath, bytes, mode = 0o600) {
  const target = institutionFile(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return durableWrite(target, bytes, mode);
}

module.exports = { durableInstitutionWrite };
