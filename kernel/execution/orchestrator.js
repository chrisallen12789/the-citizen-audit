const { loadValidatorRegistry } = require("./validators");
const { BASELINE_REQUIRED_VALIDATORS, executeApprovedTransactionInternal } = require("./orchestrator-core");

async function executeApprovedTransaction(transactionId, options = {}) {
  return executeApprovedTransactionInternal(transactionId, options, {
    loadValidatorRegistry,
    allowProjectRootOverride: false,
    allowValidatorsDirOverride: false
  });
}

module.exports = { BASELINE_REQUIRED_VALIDATORS, executeApprovedTransaction };
