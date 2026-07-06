const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { checkAction } = require("../authority/engine");

const root = path.resolve(__dirname, "..", "..");
const registryPath = path.join(root, "agents", "registry.json");
const eventLogPath = path.join(root, "kernel", "events", "log.jsonl");
const dashboardPath = path.join(root, "docs", "agent-reports", "kernel-dashboard.md");
const runAll = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");
const requestedAgentId = process.argv.find((arg) => arg.startsWith("AGENT-"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nextEventId() {
  if (!fs.existsSync(eventLogPath)) return "EVENT-00000001";
  const lines = fs.readFileSync(eventLogPath, "utf8").split(/\r?\n/).filter(Boolean);
  return `EVENT-${String(lines.length + 1).padStart(8, "0")}`;
}

function writeEvent(type, agent, summary, extra = {}) {
  ensureDir(path.dirname(eventLogPath));
  const event = {
    id: nextEventId(),
    type,
    timestamp: new Date().toISOString(),
    actor: {
      type: "system",
      id: "KERNEL-RUNTIME"
    },
    summary,
    relatedRecords: agent ? [agent.id] : [],
    authorityLevel: agent ? agent.authorityLevel : 0,
    reportPath: agent ? agent.reportPath : undefined,
    ...extra
  };
  fs.appendFileSync(eventLogPath, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

function commandToParts(command) {
  const parts = command.trim().split(/\s+/);
  return {
    command: parts[0],
    args: parts.slice(1)
  };
}

function assertAgentExecutionAllowed(agent) {
  const reportAuthority = checkAction(agent.id, "write_report");
  if (!reportAuthority.allowed) {
    writeEvent("authority.denied", agent, `${agent.id} denied before execution.`, { authorityDecision: reportAuthority });
    return reportAuthority;
  }

  writeEvent("authority.allowed", agent, `${agent.id} authorized for report-writing execution.`, { authorityDecision: reportAuthority });
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

  writeEvent("agent.started", agent, `${agent.id} started.`);

  if (dryRun) {
    writeEvent("agent.completed", agent, `${agent.id} dry run completed.`);
    return {
      agent,
      status: 0,
      stdout: `Dry run: ${agent.command}`,
      stderr: "",
      dryRun: true
    };
  }

  const selectedCommand = agent.command;
  const parsed = commandToParts(selectedCommand);
  const result = spawnSync(parsed.command, parsed.args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  const record = {
    agent,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null,
    dryRun: false
  };

  if (record.status === 0) {
    writeEvent("agent.completed", agent, `${agent.id} completed successfully.`);
    if (agent.reportPath) writeEvent("report.created", agent, `${agent.id} report created.`, { reportPath: agent.reportPath });
  } else {
    writeEvent("agent.failed", agent, `${agent.id} failed.`, { exitCode: record.status });
  }

  return record;
}

function writeDashboard(results) {
  ensureDir(path.dirname(dashboardPath));
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

  lines.push("## Kernel event log");
  lines.push("");
  lines.push("Event log path: `kernel/events/log.jsonl`");
  lines.push("");

  fs.writeFileSync(dashboardPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Kernel dashboard written to ${path.relative(root, dashboardPath)}`);
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
