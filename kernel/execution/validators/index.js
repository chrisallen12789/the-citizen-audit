const {
  PRODUCTION_ROOT_POLICY_ID,
  VALIDATOR_REGISTRY_LOADER_VERSION,
  VALIDATOR_RUNNER_VERSION,
  extractStaticValidatorContract,
  loadValidatorRegistryAtDirectory,
  selectRequiredValidators,
  validatorsForPhase
} = require("./registry-core");

function loadValidatorRegistry(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "validatorsDir")) {
    throw new Error("Production validator registry rejects caller-selected validatorsDir.");
  }
  if (Object.prototype.hasOwnProperty.call(options, "projectRoot")) {
    throw new Error("Production validator registry rejects caller-selected projectRoot.");
  }
  return loadValidatorRegistryAtDirectory({ mode: "production" });
}

module.exports = {
  PRODUCTION_ROOT_POLICY_ID,
  VALIDATOR_REGISTRY_LOADER_VERSION,
  VALIDATOR_RUNNER_VERSION,
  extractStaticValidatorContract,
  loadValidatorRegistry,
  selectRequiredValidators,
  validatorsForPhase
};
