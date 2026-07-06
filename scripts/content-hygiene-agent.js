const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "docs", "agent-reports", "content-hygiene.md");

const inspectedRoots = [
  "institution",
  "kernel",
  "memory",
  "proposals",
  "guardians",
  "docs/architecture"
];

function walk(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const next = path.join(absolute, entry.name);
    const rel = path.relative(root, next).replaceAll(path.sep, "/");
    if (entry.isDirectory()) files.push(...walk(rel));
    else files.push(rel);
  }
  return files;
}

const files = inspectedRoots.flatMap(walk).filter((file) => /\.(md|json|js)$/.test(file));
const findings = [];
const titles = new Map();

for (const file of files) {
  const absolute = path.join(root, file);
  const text = fs.readFileSync(absolute, "utf8");
  const lines = text.split(/\r?\n/);

  if (!text.endsWith("\n")) findings.push(`${file}: missing final newline.`);
  if (/\t/.test(text)) findings.push(`${file}: contains tab characters.`);
  if (/ +$/m.test(text)) findings.push(`${file}: contains trailing spaces.`);

  if (file.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (error) {
      findings.push(`${file}: invalid JSON: ${error.message}`);
    }
  }

  if (file.endsWith(".md")) {
    const title = lines.find((line) => line.startsWith("# "));
    if (!title) findings.push(`${file}: missing H1 title.`);
    else {
      const normalized = title.slice(2).trim().toLowerCase();
      if (titles.has(normalized)) findings.push(`${file}: duplicate H1 title also used by ${titles.get(normalized)}.`);
      else titles.set(normalized, file);
    }
  }
}

const agentRegistryPath = path.join(root, "agents", "registry.json");
if (fs.existsSync(agentRegistryPath)) {
  const registry = JSON.parse(fs.readFileSync(agentRegistryPath, "utf8"));
  for (const agent of registry.agents || []) {
    if (!agent.reportPath) findings.push(`${agent.id}: missing reportPath.`);
    if (agent.status === "active" && agent.reportPath && !fs.existsSync(path.join(root, agent.reportPath))) {
      findings.push(`${agent.id}: report has not been generated yet: ${agent.reportPath}`);
    }
  }
}

const lines = [];
lines.push("# Content Hygiene Report");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Files inspected: ${files.length}`);
lines.push(`Findings: ${findings.length}`);
lines.push("");
lines.push("## Findings");
lines.push("");
if (!findings.length) lines.push("No content hygiene findings.");
else for (const finding of findings) lines.push(`- ${finding}`);
lines.push("");
lines.push("## Governance note");
lines.push("");
lines.push("Content Hygiene reports consistency issues. It does not rewrite institutional language or modify truth-bearing records.");
lines.push("");

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Content Hygiene report written to ${path.relative(root, reportPath)}`);

if (findings.length) process.exitCode = 1;
