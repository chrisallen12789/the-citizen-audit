const validatorsModulePath = require.resolve("../../kernel/execution/validators");
const orchestratorModulePath = require.resolve("../../kernel/execution/orchestrator");
const orchestratorCoreModulePath = require.resolve("../../kernel/execution/orchestrator-core");
const validatorsModuleExports = require("../../kernel/execution/validators");

function executeWithInjectedRegistry(loader, transactionId, options = {}) {
  const originalValidatorsModule = require.cache[validatorsModulePath];
  require.cache[validatorsModulePath] = {
    id: validatorsModulePath,
    filename: validatorsModulePath,
    loaded: true,
    exports: {
      ...validatorsModuleExports,
      loadValidatorRegistry: loader
    }
  };

  delete require.cache[orchestratorModulePath];
  delete require.cache[orchestratorCoreModulePath];

  const { executeApprovedTransaction } = require("../../kernel/execution/orchestrator");
  return Promise.resolve()
    .then(() => executeApprovedTransaction(transactionId, options))
    .finally(() => {
      delete require.cache[orchestratorModulePath];
      delete require.cache[orchestratorCoreModulePath];
      if (originalValidatorsModule) require.cache[validatorsModulePath] = originalValidatorsModule;
      else delete require.cache[validatorsModulePath];
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
