const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { writeCanonicalJsonAtomic } = require("./durable-io");
const { validationResultPath } = require("./recovery-paths");

// Durably record the validation result artifact for an attempt and return its
// canonical hash, which the committed ledger transition binds.
function writeValidationResult(rootDir, attemptId, phases, options = {}) {
  const body = {
    version: "1.0.0",
    attemptId,
    completedAt: options.completedAt || new Date().toISOString(),
    phases: phases.filter(Boolean).map((phase) => ({
      phase: phase.phase,
      status: phase.status,
      resultHash: phase.resultHash,
      results: phase.results
    }))
  };
  const record = { ...body, validationResultHash: sha256(canonicalStringify(body)) };
  writeCanonicalJsonAtomic(validationResultPath(rootDir, attemptId), record);
  return Object.freeze(record);
}

module.exports = { writeValidationResult };
