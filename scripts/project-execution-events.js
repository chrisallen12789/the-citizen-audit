const path = require("path");
const { projectExecutionEvents } = require("../kernel/events/projection");

// Project canonical execution events from the authoritative execution ledger and
// print them as JSON. Execution events are a projection of the hash-chained
// ledger, never a competing source of truth. A tampered ledger fails
// verification and prevents projection (non-zero exit).
function main() {
  const rootDir = path.resolve(__dirname, "..");
  try {
    const projection = projectExecutionEvents({ rootDir });
    process.stdout.write(`${JSON.stringify({ count: projection.count, projectionHash: projection.projectionHash, ledgerHead: projection.ledgerHead, events: projection.events }, null, 2)}\n`);
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Execution event projection failed: ${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { main };
