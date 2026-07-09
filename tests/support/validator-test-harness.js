const {
  PRODUCTION_ROOT_POLICY_ID,
  VALIDATOR_REGISTRY_LOADER_VERSION,
  VALIDATOR_RUNNER_VERSION,
  extractStaticValidatorContract,
  loadValidatorRegistryAtDirectory,
  selectRequiredValidators,
  validatorsForPhase
} = require("../../kernel/execution/validators/registry-core");

function loadValidatorRegistryForTest(options = {}) {
  return loadValidatorRegistryAtDirectory({ ...options, mode: "test" });
}

module.exports = {
  PRODUCTION_ROOT_POLICY_ID,
  VALIDATOR_REGISTRY_LOADER_VERSION,
  VALIDATOR_RUNNER_VERSION,
  extractStaticValidatorContract,
  loadValidatorRegistryForTest,
  selectRequiredValidators,
  validatorsForPhase
};
