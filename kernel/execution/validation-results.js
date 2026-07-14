const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const VALIDATION_PHASES = Object.freeze(["candidate", "post_write"]);

function toStringArray(value) {
  return Array.isArray(value) ? value.map(String) : null;
}

// Normalize a validator outcome into a deterministic, serializable record.
// Fails closed: a thrown exception, malformed output, unsupported phase, or an
// explicit failure all normalize to status "failed". Exceptions are never
// downgraded to warnings.
function normalizeValidationResult(validator, phase, raw, error) {
  const validatorId = (validator && validator.id) || "unknown";
  const validatorVersion = (validator && validator.version) || "0.0.0";
  const problems = [];
  const warnings = [];
  let checkedObjects = [];
  let checkedPaths = [];

  if (error) {
    problems.push(`Validator ${validatorId} threw: ${error.message}`);
  } else if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    problems.push(`Validator ${validatorId} returned a malformed result.`);
  } else {
    const problemList = toStringArray(raw.problems);
    const warningList = raw.warnings === undefined ? [] : toStringArray(raw.warnings);
    if (raw.status !== "passed" && raw.status !== "failed") {
      problems.push(`Validator ${validatorId} returned an invalid status.`);
    }
    if (problemList === null) {
      problems.push(`Validator ${validatorId} returned malformed problems.`);
    } else {
      problems.push(...problemList);
    }
    if (warningList === null) {
      problems.push(`Validator ${validatorId} returned malformed warnings.`);
    } else {
      warnings.push(...warningList);
    }
    checkedObjects = Array.isArray(raw.checkedObjects) ? raw.checkedObjects.map(String) : [];
    checkedPaths = Array.isArray(raw.checkedPaths) ? raw.checkedPaths.map(String) : [];
    if (raw.status === "failed" && problemList !== null && problemList.length === 0) {
      problems.push(`Validator ${validatorId} reported failure without a stated problem.`);
    }
  }

  const status = problems.length === 0 ? "passed" : "failed";
  const body = {
    validatorId,
    validatorVersion,
    phase,
    status,
    problems,
    warnings,
    checkedObjects,
    checkedPaths
  };
  return Object.freeze({ ...body, resultHash: sha256(canonicalStringify(body)) });
}

module.exports = { VALIDATION_PHASES, normalizeValidationResult };
