const fs = require("fs");
const { institutionFile } = require("./path-safety");

function createLiveState(rootDir) {
  function exists(relativePath) {
    return fs.existsSync(institutionFile(rootDir, relativePath));
  }
  function isFile(relativePath) {
    const target = institutionFile(rootDir, relativePath);
    return fs.existsSync(target) && fs.statSync(target).isFile();
  }
  function readFile(relativePath, encoding = null) {
    const bytes = fs.readFileSync(institutionFile(rootDir, relativePath));
    return encoding ? bytes.toString(encoding) : bytes;
  }
  return Object.freeze({ exists, isFile, readFile });
}

module.exports = { createLiveState };
