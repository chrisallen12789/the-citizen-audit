const validatorsModulePath = require.resolve("../../kernel/execution/validators");
const validationCycleModulePath = require.resolve("../../kernel/execution/validation-cycle");
const orchestratorModulePath = require.resolve("../../kernel/execution/orchestrator");
const orchestratorCoreModulePath = require.resolve("../../kernel/execution/orchestrator-core");
const validatorsModuleExports = require("../../kernel/execution/validators");
const validationCycleTestCore = require("./validation-cycle-test-core");

function executeWithInjectedRegistry(loader, transactionId, options = {}) {
  const originalValidatorsModule = require.cache[validatorsModulePath];
  const originalValidationCycleModule = require.cache[validationCycleModulePath];
  require.cache[validatorsModulePath] = {
    id: validatorsModulePath,
    filename: validatorsModulePath,
    loaded: true,
    exports: {
      ...validatorsModuleExports,
      loadValidatorRegistry: loader
    }
  };
  require.cache[validationCycleModulePath] = {
    id: validationCycleModulePath,
    filename: validationCycleModulePath,
    loaded: true,
    exports: {
      DEFAULT_TIMEOUT_MS: validationCycleTestCore.DEFAULT_TIMEOUT_MS,
      LIMITS: validationCycleTestCore.LIMITS,
      async runValidationPhase(phase, validatorIds, context, runOptions = {}) {
        const registry = loader();
        if (typeof runOptions.expectedValidatorSetHash === "string" && runOptions.expectedValidatorSetHash !== registry.validatorSetHash) {
          return validationCycleTestCore.runValidationPhase(phase, [], context, { timeoutMs: runOptions.timeoutMs });
        }
        const descriptors = validatorIds.map((validatorId) => registry.descriptors.get(validatorId)).filter(Boolean);
        return validationCycleTestCore.runValidationPhase(phase, descriptors, context, { timeoutMs: runOptions.timeoutMs });
      }
    }
  };

  delete require.cache[orchestratorModulePath];
  delete require.cache[orchestratorCoreModulePath];

  const { executeApprovedTransaction } = require("../../kernel/execution/orchestrator");
  return Promise.resolve()
    .then(() => executeApprovedTransaction(transactionId, options))
    .finally(() => {
      delete require.cache[validationCycleModulePath];
      delete require.cache[orchestratorModulePath];
      delete require.cache[orchestratorCoreModulePath];
      if (originalValidatorsModule) require.cache[validatorsModulePath] = originalValidatorsModule;
      else delete require.cache[validatorsModulePath];
      if (originalValidationCycleModule) require.cache[validationCycleModulePath] = originalValidationCycleModule;
      else delete require.cache[validationCycleModulePath];
    });
}

async function executeApprovedTransactionForTest(transactionId, options = {}) {
  const { loadValidatorRegistryForTest } = require("./validator-test-harness");
  const sanitizedOptions = { ...options };
  delete sanitizedOptions.validatorsDir;
  delete sanitizedOptions.projectRoot;
  return executeWithInjectedRegistry(
    () => loadValidatorRegistryForTest({
      validatorsDir: options.validatorsDir,
      projectRoot: options.projectRoot
    }),
    transactionId,
    sanitizedOptions
  );
}

module.exports = { executeApprovedTransactionForTest };
