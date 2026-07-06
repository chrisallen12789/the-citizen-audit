const fs = require("fs");
const path = require("path");

const FORBIDDEN_EXECUTION_IMPORTS = Object.freeze([
  "applyJournaledWrites",
  "beginRecoveryAttempt",
  "writeInstitutionFile",
  "atomicReplaceFile"
]);

function auditPackageScripts(rootDir, packageDocument) {
  const problems = [];
  for (const [name, command] of Object.entries(packageDocument.scripts || {})) {
    if (!name.startsWith("agent:") || name === "agents:list") continue;
    if (!String(command).startsWith("node kernel/runtime/run.js")) problems.push(`${name}: agent package script bypasses the isolated runtime.`);
  }
  return problems;
}

function auditExecutionImports(rootDir) {
  const problems = [];
  const allowedPrefixes = ["kernel/execution/", "kernel/runtime/", "tests/"];
  function walk(directory) {
    for (const child of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, child.name);
      const relative = path.relative(rootDir, target).split(path.sep).join("/");
      if (relative === "node_modules" || relative.startsWith("node_modules/") || relative === ".git" || relative.startsWith(".git/")) continue;
      if (child.isDirectory()) {
        walk(target);
        continue;
      }
      if (!child.isFile() || !relative.endsWith(".js") || allowedPrefixes.some((prefix) => relative.startsWith(prefix))) continue;
      const source = fs.readFileSync(target, "utf8");
      for (const token of FORBIDDEN_EXECUTION_IMPORTS) if (source.includes(token)) problems.push(`${relative}: references governed mutation primitive ${token}.`);
    }
  }
  walk(rootDir);
  return problems;
}

function auditRegistryCommands(registry) {
  const problems = [];
  for (const agent of registry.agents || []) {
    if (agent.status !== "active") continue;
    if (typeof agent.command !== "string" || !agent.command.trim()) problems.push(`${agent.id}: active agent has no command.`);
    if (/[<>|;]/.test(agent.command || "")) problems.push(`${agent.id}: registry command contains unsupported shell control syntax.`);
  }
  return problems;
}

function auditMutationBypasses(rootDir) {
  const packageDocument = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(rootDir, "agents", "registry.json"), "utf8"));
  const problems = [
    ...auditPackageScripts(rootDir, packageDocument),
    ...auditExecutionImports(rootDir),
    ...auditRegistryCommands(registry)
  ];
  return { valid: problems.length === 0, problems };
}

function main() {
  const rootDir = path.resolve(__dirname, "..", "..");
  const result = auditMutationBypasses(rootDir);
  console.log("Institution OS Mutation Bypass Audit");
  console.log("");
  console.log(`Problems: ${result.problems.length}`);
  for (const problem of result.problems) console.log(`- ${problem}`);
  if (!result.valid) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  FORBIDDEN_EXECUTION_IMPORTS,
  auditExecutionImports,
  auditMutationBypasses,
  auditPackageScripts,
  auditRegistryCommands
};
