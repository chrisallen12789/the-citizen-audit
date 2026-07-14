const { executeApprovedTransaction } = require("./orchestrator");

async function main() {
  const transactionId = process.argv[2];
  if (!transactionId) {
    console.error("Usage: node kernel/execution/execute.js <transaction-id>");
    process.exitCode = 1;
    return;
  }
  try {
    const result = await executeApprovedTransaction(transactionId);
    console.log(JSON.stringify(result, null, 2));
    if (result.disposition !== "committed") process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ code: error.code || "EXECUTION_FAILED", message: error.message, problems: error.problems || [] }, null, 2));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main };
