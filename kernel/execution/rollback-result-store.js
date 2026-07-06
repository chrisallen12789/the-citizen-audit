const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { writeCanonicalJsonAtomic } = require("./durable-io");
const { rollbackResultPath } = require("./recovery-paths");

function writeRollbackResult(rootDir, attemptId, result, options = {}) {
  const body = {
    version: "1.0.0",
    attemptId,
    completedAt: options.completedAt || new Date().toISOString(),
    status: result.status,
    restoredPaths: [...result.restoredPaths],
    removedDirectories: [...result.removedDirectories],
    failures: [...result.failures]
  };
  const record = { ...body, rollbackResultHash: sha256(canonicalStringify(body)) };
  writeCanonicalJsonAtomic(rollbackResultPath(rootDir, attemptId), record);
  return Object.freeze(record);
}

module.exports = { writeRollbackResult };
