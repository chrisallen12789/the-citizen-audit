const fs = require("fs");
const { decodeWriteContent } = require("../transactions/validate");
const { institutionFile } = require("./path-safety");

function createCandidateState(rootDir, writes) {
  const proposed = new Map();
  for (const write of writes) {
    proposed.set(write.path, write.operation === "write"
      ? { operation: "write", bytes: Buffer.from(decodeWriteContent(write)) }
      : { operation: "delete" });
  }

  function exists(relativePath) {
    const entry = proposed.get(relativePath);
    if (entry) return entry.operation === "write";
    return fs.existsSync(institutionFile(rootDir, relativePath));
  }

  function readFile(relativePath, encoding = null) {
    const entry = proposed.get(relativePath);
    if (entry && entry.operation === "delete") {
      const error = new Error(`Candidate path does not exist: ${relativePath}.`);
      error.code = "ENOENT";
      throw error;
    }
    const bytes = entry ? Buffer.from(entry.bytes) : fs.readFileSync(institutionFile(rootDir, relativePath));
    return encoding ? bytes.toString(encoding) : bytes;
  }

  function isFile(relativePath) {
    const entry = proposed.get(relativePath);
    if (entry) return entry.operation === "write";
    const target = institutionFile(rootDir, relativePath);
    return fs.existsSync(target) && fs.statSync(target).isFile();
  }

  return Object.freeze({
    exists,
    isFile,
    readFile,
    proposedPaths: Object.freeze([...proposed.keys()].sort())
  });
}

module.exports = { createCandidateState };
