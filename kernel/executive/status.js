const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const agents = JSON.parse(fs.readFileSync(path.join(root, "agents", "registry.json"), "utf8"));
const departments = JSON.parse(fs.readFileSync(path.join(root, "kernel", "executive", "departments.json"), "utf8"));
const outputPath = path.join(root, "docs", "agent-reports", "executive-status.md");

const agentMap = new Map(agents.agents.map((agent) => [agent.id, agent]));
const problems = [];
const lines = [];

lines.push("# Executive Status Report");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push(`Registered agents: ${agents.agents.length}`);
lines.push(`Active agents: ${agents.agents.filter((agent) => agent.status === "active").length}`);
lines.push(`Departments: ${departments.departments.length}`);
lines.push("");

for (const department of departments.departments) {
  lines.push(`## ${department.name}`);
  lines.push("");
  lines.push(`Director: ${department.director}`);
  lines.push(`Mission: ${department.mission}`);
  lines.push("");

  if (!department.agents.length) {
    lines.push("No worker agents assigned yet.");
    lines.push("");
    continue;
  }

  for (const agentId of department.agents) {
    const agent = agentMap.get(agentId);
    if (!agent) {
      problems.push(`${department.id} references missing agent ${agentId}`);
      continue;
    }
    lines.push(`- ${agent.id} — ${agent.name} (${agent.status}, L${agent.authorityLevel})`);
  }
  lines.push("");
}

lines.push("## Findings");
lines.push("");
if (!problems.length) lines.push("No executive structure findings.");
else for (const problem of problems) lines.push(`- ${problem}`);
lines.push("");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Executive status report written to ${path.relative(root, outputPath)}`);

if (problems.length) process.exit(1);
