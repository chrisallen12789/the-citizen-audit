const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const registryPath = path.join(root, "agents", "registry.json");
const authorityPath = path.join(root, "kernel", "permissions", "authority-levels.json");
const rulesPath = path.join(root, "kernel", "permissions", "rules.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const problems = [];
const warnings = [];

const registry = readJson(registryPath);
const authority = readJson(authorityPath);
const rules = readJson(rulesPath);
const levels = new Set((authority.levels || []).map((item) => item.level));
const ruleActions = new Set((rules.rules || []).map((item) => item.action));

for (const agent of registry.agents || []) {
  if (!agent.id) problems.push("Agent missing id.");
  if (!agent.name) problems.push(`${agent.id}: missing name.`);
  if (!levels.has(agent.authorityLevel)) problems.push(`${agent.id}: invalid authority level ${agent.authorityLevel}.`);
  if (!agent.command) problems.push(`${agent.id}: missing command.`);
  if (!agent.reportPath) problems.push(`${agent.id}: missing reportPath.`);
  if (!Array.isArray(agent.allowedActions) || !agent.allowedActions.length) problems.push(`${agent.id}: missing allowed actions.`);
  if (!Array.isArray(agent.forbiddenActions) || !agent.forbiddenActions.length) problems.push(`${agent.id}: missing forbidden actions.`);

  if (agent.status === "active") {
    const scriptMatch = String(agent.command).match(/node\s+([^\s]+)/);
    if (scriptMatch && !exists(scriptMatch[1])) {
      problems.push(`${agent.id}: active command references missing script ${scriptMatch[1]}.`);
    }
  }
}

if (!ruleActions.has("change_claim_meaning")) warnings.push("Permission rules do not explicitly cover claim-meaning changes.");
if (!ruleActions.has("mark_source_verified")) warnings.push("Permission rules do not explicitly cover source verification changes.");
if (!ruleActions.has("change_publication_readiness")) warnings.push("Permission rules do not explicitly cover publication readiness changes.");

const activeAgents = (registry.agents || []).filter((item) => item.status === "active");
const plannedAgents = (registry.agents || []).filter((item) => item.status === "planned");

console.log("Citizen Audit Kernel Status");
console.log("");
console.log(`Agents registered: ${registry.agents.length}`);
console.log(`Agents active: ${activeAgents.length}`);
console.log(`Agents planned: ${plannedAgents.length}`);
console.log(`Authority levels: ${authority.levels.length}`);
console.log(`Permission rules: ${rules.rules.length}`);
console.log(`Problems: ${problems.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log("");

if (problems.length) {
  console.log("Problems:");
  for (const problem of problems) console.log(`- ${problem}`);
  console.log("");
}

if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
  console.log("");
}

if (!problems.length) console.log("Kernel status: PASS");
else console.log("Kernel status: FAIL");

if (problems.length) process.exit(1);
