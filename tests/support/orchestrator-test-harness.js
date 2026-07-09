const { executeApprovedTransactionInternal } = require("../../kernel/execution/orchestrator-core");
const { loadValidatorRegistryForTest } = require("./validator-test-harness");

async function executeApprovedTransactionForTest(transactionId, options = {}) {
  return executeApprovedTransactionInternal(transactionId, options, {
    loadValidatorRegistry: loadValidatorRegistryForTest,
    allowProjectRootOverride: true,
    allowValidatorsDirOverride: true
  });
}

module.exports = { executeApprovedTransactionForTest };
