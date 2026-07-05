const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const registryPath = path.join(root, "registry", "audits.json");
const reportPath = path.join(root, "docs", "agent-reports", "ads-steward.md");
const dryRun = process.argv.includes("--dry-run");
const now = new Date();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

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

function auditRecordPaths(registry) {
  const paths = [];
  for (const audit of registry.audits || []) {
    if (audit.record) paths.push(audit.record);
    try {
      const auditRecord = readJson(path.join(root, audit.record));
      for (const relativePath of Object.values(auditRecord.records || {})) {
        paths.push(relativePath);
      }
    } catch (error) {
      // validation will report this; do not hide it here
    }
  }
  return [...new Set(paths)].sort();
}

const beforeRegistry = fs.existsSync(registryPath) ? readJson(registryPath) : null;
const beforePaths = beforeRegistry ? auditRecordPaths(beforeRegistry) : [];

const exportResult = dryRun
  ? { name: "ADS export", status: 0, stdout: "Dry run: ADS export skipped.", stderr: "", error: null }
  : run("ADS export", "npm", ["run", "ads:export"]);

const validationResult = run("ADS validation", "npm", ["run", "ads:validate"]);
const afterRegistry = fs.existsSync(registryPath) ? readJson(registryPath) : null;
const afterPaths = afterRegistry ? auditRecordPaths(afterRegistry) : [];

const findings = [];

if (!afterRegistry) {
  findings.push("ADS registry is missing.");
} else {
  const ids = new Set();
  for (const audit of afterRegistry.audits || []) {
    if (ids.has(audit.id)) findings.push(`Duplicate audit ID: ${audit.id}`);
    ids.add(audit.id);
    if (!audit.record) findings.push(`${audit.id}: missing registry record path.`);
    if (audit.record && !fs.existsSync(path.join(root, audit.record))) {
      findings.push(`${audit.id}: registry record path does not exist: ${audit.record}`);
    }
  }

  const sorted = [...(afterRegistry.audits || [])].sort((left, right) => left.id.localeCompare(right.id));
  const isSorted = JSON.stringify(sorted.map((item) => item.id)) === JSON.stringify((afterRegistry.audits || []).map((item) => item.id));
  if (!isSorted) findings.push("Audit registry is not sorted by ADS ID.");
}

const newPaths = afterPaths.filter((item) => !beforePaths.includes(item));
const missingPaths = beforePaths.filter((item) => !afterPaths.includes(item));

const lines = [];
lines.push("# ADS Steward Report");
lines.push("");
lines.push(`Generated: ${now.toISOString()}`);
lines.push(`Mode: ${dryRun ? "dry run" : "active"}`);
lines.push("");
lines.push("## Commands");
lines.push("");
for (const result of [exportResult, validationResult]) {
  lines.push(`### ${result.name}`);
  lines.push("");
  lines.push(`Status: ${result.status === 0 ? "passed" : "failed"}`);
  if (result.error) lines.push(`Error: ${result.error}`);
  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (output) {
    lines.push("");
    lines.push("```text");
    lines.push(output.slice(-4000));
    lines.push("```");
  }
  lines.push("");
}

lines.push("## Registry summary");
lines.push("");
lines.push(`Audits before: ${beforeRegistry ? beforeRegistry.audits.length : 0}`);
lines.push(`Audits after: ${afterRegistry ? afterRegistry.audits.length : 0}`);
lines.push(`Record paths before: ${beforePaths.length}`);
lines.push(`Record paths after: ${afterPaths.length}`);
lines.push(`New record paths: ${newPaths.length}`);
lines.push(`Missing previous paths: ${missingPaths.length}`);
lines.push("");

if (newPaths.length) {
  lines.push("### New paths");
  lines.push("");
  for (const item of newPaths) lines.push(`- ${item}`);
  lines.push("");
}

if (missingPaths.length) {
  lines.push("### Missing previous paths");
  lines.push("");
  for (const item of missingPaths) lines.push(`- ${item}`);
  lines.push("");
}

lines.push("## Findings");
lines.push("");
if (!findings.length) {
  lines.push("No ADS stewardship findings.");
} else {
  for (const finding of findings) lines.push(`- ${finding}`);
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`ADS Steward report written to ${path.relative(root, reportPath)}`);

if (validationResult.status !== 0 || findings.length) {
  process.exitCode = 1;
}
