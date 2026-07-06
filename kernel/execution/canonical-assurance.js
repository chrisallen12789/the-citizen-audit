const { sha256 } = require("../lib/append-only-log");
const { decodeWriteContent } = require("../transactions/validate");
const { fileState } = require("./file-state");

function matchesDeclaredWrite(rootDir, write) {
  const current = fileState(rootDir, write.path);
  if (!current.existed || write.operation !== "write") return false;
  return sha256(current.bytes) === sha256(decodeWriteContent(write));
}

module.exports = { matchesDeclaredWrite };
