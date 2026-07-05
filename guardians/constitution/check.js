const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const reportPath = path.join(root, "guardians", "constitution", "reports", "status.md");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const requiredFiles = [
  "institution/vision.md",
  "institution/operating-principles.md",
  "institution/2035.md",
  "kernel/permissions/authority-levels.json",
  "kernel/permissions/rules.json",
  "agents/registry.json",
  "proposals/registry.json",
  "memory/graph/nodes.json"
];

const problems = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!exists(file)) problems.push(`Missing required institutional file: ${file}`);
}

const agents = exists("agents/registry.json") ? readJson("agents/registry.json").agents || [] : [];
const rules = exists("kernel/permissions/rules.json") ? readJson("kernel/permissions/rules.json").rules || [] : [];
const proposals = exists("proposals/registry.json") ? readJson("proposals/registry.json").proposals || [] : [];
const memoryNodes = exists("memory/graph/nodes.json") ? readJson("memory/graph/nodes.json").nodes || [] : [];

for (const agent of agents) {
  if (agent.status === "active") {
    if (!Array.isArray(agent.allowedActions) || !agent.allowedActions.length) {
      problems.push(`${agent.id}: active agent lacks allowed actions.`);
    }
    if (!Array.isArray(agent.forbiddenActions) || !agent.forbiddenActions.length) {
      problems.push(`${agent.id}: active agent lacks forbidden actions.`);
    }
    if (typeof agent.authorityLevel !== "number") {
      problems.push(`${agent.id}: active agent lacks numeric authority level.`);
    }
  }
}

for (const rule of rules) {
  if (rule.minimumAuthorityLevel === 4 && !rule.requiresHumanApproval) {
    problems.push(`${rule.id}: Level 4 permission rule must require human approval.`);
  }
}

for (const proposal of proposals) {
  if (proposal.requiredAuthorityLevel >= 3 && proposal.humanApprovalRequired !== true) {
    problems.push(`${proposal.id}: high-authority proposal must require human approval.`);
  }
  if (proposal.status === "implemented" && !proposal.decisionRecord) {
    warnings.push(`${proposal.id}: implemented proposal lacks decision record.`);
  }
}

const memoryIds = new Set(memoryNodes.map((node) => node.id));
for (const requiredMemoryId of ["DOC-VISION", "DOC-2035", "DOC-OPERATING-PRINCIPLES", "KERNEL-001"]) {
  if (!memoryIds.has(requiredMemoryId)) warnings.push(`Memory graph lacks required doctrine node: ${requiredMemoryId}`);
}

const lines = [];
lines.push("# Constitution Guardian Report");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Problems: ${problems.length}`);
lines.push(`Warnings: ${warnings.length}`);
lines.push("");
lines.push("## Problems");
lines.push("");
if (!problems.length) lines.push("No constitutional gate problems.");
else for (const problem of problems) lines.push(`- ${problem}`);
lines.push("");
lines.push("## Warnings");
lines.push("");
if (!warnings.length) lines.push("No constitutional warnings.");
else for (const warning of warnings) lines.push(`- ${warning}`);
lines.push("");

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Constitution Guardian report written to ${path.relative(root, reportPath)}`);

if (problems.length) process.exit(1);
