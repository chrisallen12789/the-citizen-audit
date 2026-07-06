const fs = require("fs");
const path = require("path");
const { institutionFile } = require("./path-safety");

function missingParentDirectories(rootDir, relativePath) {
  const target = institutionFile(rootDir, relativePath);
  const created = [];
  let current = path.dirname(target);
  while (current !== rootDir && !fs.existsSync(current)) {
    created.push(current);
    current = path.dirname(current);
  }
  return created;
}

module.exports = { missingParentDirectories };
