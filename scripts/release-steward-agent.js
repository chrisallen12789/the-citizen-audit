const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "docs", "agent-reports", "release-steward.md");

function run(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  return {
    name,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const checks = [
  run("Kernel status", "npm", ["run", "kernel:status"]),
  run("Constitution Guardian", "npm", ["run", "guardian:constitution"]),
  run("ADS validation", "npm", ["run", "ads:validate"]),
  run("Memory status", "npm", ["run", "memory:status"]),
  run("Proposal status", "npm", ["run", "proposal:status"])
];

const requiredArtifacts = [
  "README.md",
  "institution/vision.md",
  "institution/operating-principles.md",
  "kernel/README.md",
  "agents/registry.json",
  "registry/audits.json",
  "public/index.html",
  "public/audits.html",
  "public/data/publication-manifest.json"
];

const missingArtifacts = requiredArtifacts.filter((item) => !exists(item));
const failedChecks = checks.filter((check) => check.status !== 0);
const recommendation = failedChecks.length || missingArtifacts.length ? "NOT READY" : "READY FOR HUMAN RELEASE REVIEW";

const lines = [];
lines.push("# Release Steward Report");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Recommendation: ${recommendation}`);
lines.push("");
lines.push("## Checks");
lines.push("");
for (const check of checks) {
  lines.push(`### ${check.name}`);
  lines.push("");
  lines.push(`Status: ${check.status === 0 ? "passed" : "failed"}`);
  if (check.error) lines.push(`Error: ${check.error}`);
  const output = `${check.stdout}\n${check.stderr}`.trim();
  if (output) {
    lines.push("");
    lines.push("```text");
    lines.push(output.slice(-2500));
    lines.push("```");
  }
  lines.push("");
}

lines.push("## Required artifacts");
lines.push("");
for (const artifact of requiredArtifacts) {
  lines.push(`- ${exists(artifact) ? "present" : "missing"}: ${artifact}`);
}
lines.push("");

lines.push("## Missing artifacts");
lines.push("");
if (!missingArtifacts.length) lines.push("No required release artifacts missing.");
else for (const artifact of missingArtifacts) lines.push(`- ${artifact}`);
lines.push("");

lines.push("## Governance note");
lines.push("");
lines.push("Release Steward may recommend readiness for human release review. It may not publish, change readiness gates, edit evidence, or override failed institutional checks.");
lines.push("");

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Release Steward report written to ${path.relative(root, reportPath)}`);

if (recommendation !== "READY FOR HUMAN RELEASE REVIEW") process.exit(1);
