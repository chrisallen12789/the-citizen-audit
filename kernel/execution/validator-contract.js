const { executionError } = require("./orchestrator-errors");

function assertValidatorCoverage(plan, registry, policy) {
  const registrations = new Map(registry.validators.map((item) => [item.id, item]));
  for (const validatorId of plan.validatorIds) {
    if (!registrations.has(validatorId)) throw executionError(`Execution plan references unknown validator: ${validatorId}.`, "UNKNOWN_EXECUTION_VALIDATOR");
  }
  const requiredPhases = {
    "execution-plan": ["candidate", "post_write"],
    "exact-materialization": ["post_write"],
    "institution-registry": ["post_write"],
    "dependency-references": ["post_write"],
    "dependency-cycles": ["post_write"]
  };
  for (const [validatorId, phases] of Object.entries(requiredPhases)) {
    const registration = registrations.get(validatorId);
    if (!registration || phases.some((phase) => !registration.phases.includes(phase))) {
      throw executionError(`Mandatory validator phase contract is invalid: ${validatorId}.`, "INVALID_VALIDATOR_PHASE_CONTRACT");
    }
  }
  for (const validatorId of policy.actions[plan.action].semanticValidators || []) {
    const registration = registrations.get(validatorId);
    if (!registration || !registration.phases.includes("post_write")) {
      throw executionError(`Semantic validator must support post_write: ${validatorId}.`, "INVALID_SEMANTIC_VALIDATOR");
    }
  }
  if (plan.validatorIds[plan.validatorIds.length - 1] !== "exact-materialization") {
    throw executionError("Exact materialization must be the final post-write validator.", "INVALID_VALIDATOR_ORDER");
  }
}

module.exports = { assertValidatorCoverage };
