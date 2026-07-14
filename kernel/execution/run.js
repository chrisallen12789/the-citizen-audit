const { executeApprovedTransaction } = require("./orchestrator");

// Narrow Phase 3 CLI.
// Accepts a transaction ID (never arbitrary transaction JSON), invokes the sole
// authoritative orchestrator, emits a structured result, and exits nonzero for
// any non-committed disposition. It bypasses nothing: policy, approval,
// authority, validation, locking, snapshots, and ledger recording all apply.
// This is NOT runtime integration; the execution engine remains on HOLD.
async function main() {
  const transactionId = process.argv[2];
  if (!transactionId) {
    console.error("Usage: node kernel/execution/run.js <transaction-id>");
    process.exitCode = 2;
    return;
  }
  try {
    const result = await executeApprovedTransaction(transactionId);
    console.log(JSON.stringify(result, null, 2));
    if (result.disposition !== "committed") process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ disposition: "error", transactionId, message: error.message }, null, 2));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main };
