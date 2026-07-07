const path = require("path");
const { runTransactionalAgent } = require("./transactional-runtime");

function parseArgs(argv) {
  const args = { objects: [], agentArgs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--run") args.runId = argv[++i];
    else if (token === "--agent") args.agentId = argv[++i];
    else if (token === "--action") args.action = argv[++i];
    else if (token === "--object") args.objects.push(argv[++i]);
    else if (token === "--command") args.command = argv[++i];
    else if (token === "--arg") args.agentArgs.push(argv[++i]);
  }
  return args;
}

async function main() {
  const rootDir = path.resolve(__dirname, "..", "..");
  const args = parseArgs(process.argv.slice(2));
  if (!args.runId || !args.agentId || !args.action || !args.command || args.objects.length === 0) {
    process.stderr.write("Usage: run-transactional.js --run RUN-ID --agent AGENT-ID --action ACTION --object OBJECT-ID --command EXECUTABLE [--arg VALUE ...]\n");
    process.exit(2);
  }

  // The CLI deliberately supplies no approval provider. It may execute an
  // external agent only inside the approved isolation adapter, then fails closed
  // at approval unless a governance integration invokes the runtime
  // programmatically with an explicit decision.
  const result = await runTransactionalAgent({
    rootDir,
    runId: args.runId,
    agent: { command: args.command, args: args.agentArgs },
    actor: { type: "agent", id: args.agentId },
    action: args.action,
    affectedObjects: args.objects
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.institutionalResult === "committed" ? 0 : 1);
}

if (require.main === module) main();
module.exports = { parseArgs };
