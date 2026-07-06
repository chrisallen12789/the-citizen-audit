function normalizeValidationResult(validatorId, phase, result) {
  const problems = result && Array.isArray(result.problems) ? result.problems.map(String) : ["Validator returned no structured result."];
  const warnings = result && Array.isArray(result.warnings) ? result.warnings.map(String) : [];
  return {
    validatorId,
    phase,
    status: result && result.status === "passed" && problems.length === 0 ? "passed" : "failed",
    problems,
    warnings,
    checkedObjects: result && Array.isArray(result.checkedObjects) ? [...result.checkedObjects] : [],
    checkedPaths: result && Array.isArray(result.checkedPaths) ? [...result.checkedPaths] : []
  };
}

module.exports = { normalizeValidationResult };
