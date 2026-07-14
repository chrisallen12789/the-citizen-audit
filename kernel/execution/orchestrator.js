const { generateAttemptId } = require("./orchestrator-errors");
const { prepareApprovedExecution } = require("./orchestrator-prepare");
const { executePreparedSession } = require("./orchestrator-session");
const { verifyApprovedTransaction } = require("./transaction-contract");

async function executeApprovedTransaction(transactionId, options = {}) {
  return executePreparedSession(await prepareApprovedExecution(transactionId, options));
}

module.exports = { executeApprovedTransaction, generateAttemptId, verifyApprovedTransaction };
