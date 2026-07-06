const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { writeCanonicalJsonAtomic } = require("./durable-io");
const { validationResultPath } = require("./recovery-paths");

function writeValidationArtifact(rootDir, attemptId, transactionId, planHash, candidate, postWrite) {
  const body = {
    version: "1.0.0",
    attemptId,
    transactionId,
    planHash,
    candidate: { passed: candidate.passed, results: candidate.results },
    postWrite: { passed: postWrite.passed, results: postWrite.results }
  };
  const validationResultHash = sha256(canonicalStringify(body));
  const artifact = Object.freeze({ ...body, validationResultHash });
  writeCanonicalJsonAtomic(validationResultPath(rootDir, attemptId), artifact);
  return artifact;
}

module.exports = { writeValidationArtifact };
