const fs = require("fs");
const path = require("path");
const { checkAction } = require("../authority/engine");

const root = path.resolve(__dirname, "..", "..");
const registryPath = path.join(root, "agents", "registry.json");
const runAll = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");
const requestedAgentId = process.argv.find((arg) => arg.startsWith("AGENT-"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertAgentExecutionAllowed(agent) {
  const reportAuthority = checkAction(agent.id, "write_report");
  return reportAuthority;
}

function runAgent(agent) {
  const authorityDecision = assertAgentExecutionAllowed(agent);
  if (!authorityDecision.allowed) {
    return {
      agent,
      status: 1,
      stdout: "",
      stderr: `Authority denied: ${authorityDecision.reason}`,
      error: authorityDecision.reason,
      dryRun
    };
  }

  if (dryRun) {
    return {
      agent,
      status: 0,
      stdout: `Dry run: ${agent.command}`,
      stderr: "",
      dryRun: true
    };
  }

  // Active legacy execution is permanently disabled. The legacy runtime may
  // display dry-run diagnostics, but it contains no operator flag or process
  // spawn path that can execute an agent against the live repository.
  return {
    agent,
    status: 1,
    stdout: "",
    stderr: "Legacy active agent execution is disabled. Use kernel/runtime/run-transactional.js.",
    error: "legacy active execution disabled",
    dryRun: false
  };
}

function writeDashboard(results) {
  const passed = results.filter((result) => result.status === 0);
  const failed = results.filter((result) => result.status !== 0);
  const lines = [];

  lines.push("# Kernel Dashboard");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Mode: ${dryRun ? "dry run" : "active"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`Agents run: ${results.length}`);
  lines.push(`Passed: ${passed.length}`);
  lines.push(`Failed: ${failed.length}`);
  lines.push("");
  lines.push("## Agent results");
  lines.push("");

  for (const result of results) {
    lines.push(`### ${result.agent.id} — ${result.agent.name}`);
    lines.push("");
    lines.push(`Status: ${result.status === 0 ? "passed" : "failed"}`);
    lines.push(`Command: ${result.agent.command}`);
    lines.push(`Authority level: ${result.agent.authorityLevel}`);
    lines.push(`Capabilities: ${(result.agent.capabilities || []).join(", ") || "None declared"}`);
    lines.push(`Report path: ${result.agent.reportPath || "Not declared"}`);
    if (result.error) lines.push(`Error: ${result.error}`);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (output) {
      lines.push("");
      lines.push("```text");
      lines.push(output.slice(-3000));
      lines.push("```");
    }
    lines.push("");
  }

  lines.push("Execution events are projected from the authoritative execution ledger; the legacy runtime writes no events or files.");
  console.log(`${lines.join("\n")}\n`);
}

const registry = readJson(registryPath);
const activeAgents = (registry.agents || []).filter((agent) => agent.status === "active");
let agentsToRun = [];

if (runAll) {
  agentsToRun = activeAgents;
} else if (requestedAgentId) {
  const agent = (registry.agents || []).find((item) => item.id === requestedAgentId);
  if (!agent) {
    console.error(`Unknown agent: ${requestedAgentId}`);
    process.exit(1);
  }
  if (agent.status !== "active") {
    console.error(`Agent is not active: ${requestedAgentId}`);
    process.exit(1);
  }
  agentsToRun = [agent];
} else {
  console.error("Usage: node kernel/runtime/run.js AGENT-ID | --all [--dry-run]");
  process.exit(1);
}

const results = agentsToRun.map(runAgent);
writeDashboard(results);

const failed = results.filter((result) => result.status !== 0);
if (failed.length) process.exit(1);
