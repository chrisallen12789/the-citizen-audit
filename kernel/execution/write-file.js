const fs = require("fs");
const path = require("path");
const { institutionFile } = require("./path-safety");

function writeInstitutionFile(rootDir, relativePath, bytes) {
  const target = institutionFile(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return target;
}

module.exports = { writeInstitutionFile };
