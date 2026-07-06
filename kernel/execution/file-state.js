const fs = require("fs");
const { institutionFile } = require("./path-safety");

function fileState(rootDir, relativePath) {
  const target = institutionFile(rootDir, relativePath);
  if (!fs.existsSync(target)) return { path: relativePath, existed: false, hash: null };
  const stat = fs.statSync(target);
  if (!stat.isFile()) throw new Error(`Execution target is not a file: ${relativePath}.`);
  return { path: relativePath, existed: true, mode: stat.mode & 0o777, bytes: fs.readFileSync(target) };
}

module.exports = { fileState };
