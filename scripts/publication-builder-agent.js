const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const publication = require("./publication-data");
const reportPath = path.join(root, "docs", "agent-reports", "publication-builder.md");
const dryRun = process.argv.includes("--dry-run");
const now = new Date();

function run(name, command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...env }
  });

  return {
    name,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null
  };
}

function walk(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(next, predicate));
    } else if (!predicate || predicate(next)) {
      output.push(next);
    }
  }
  return output;
}

const beforeHtml = walk(publicDir, (file) => file.endsWith(".html")).length;
const beforeJson = walk(path.join(publicDir, "data"), (file) => file.endsWith(".json")).length;

const buildResult = dryRun
  ? { name: "Publication build", status: 0, stdout: "Dry run: publication build skipped.", stderr: "", error: null }
  : run("Publication build", "npm", ["run", "build:publication"], {
      CANONICAL_PDF_PATH: path.join(publicDir, "downloads", "the-citizen-audit-v1.0.pdf")
    });

const afterHtml = walk(publicDir, (file) => file.endsWith(".html")).length;
const afterJson = walk(path.join(publicDir, "data"), (file) => file.endsWith(".json")).length;

const findings = [];
const expectedCounts = {
  claims: publication.claims.length,
  sources: publication.sources.length,
  decisions: publication.decisions.length,
  openQuestions: publication.openQuestions.length,
  pages: publication.pages.length,
  sections: publication.sections.filter((item) => /^Section \d+$/.test(item.id)).length
};

const expectedFiles = [
  "public/data/claim-database.json",
  "public/data/cross-reference-tables.json",
  "public/data/evidence-graph.json",
  "public/data/platform-metrics.json",
  "public/data/platform-status.json",
  "public/data/publication-manifest.json",
  "public/data/publication-search.json",
  "public/data/research-state.json",
  "public/data/trace-records.json"
];

for (const file of expectedFiles) {
  if (!fs.existsSync(path.join(root, file))) findings.push(`Missing generated file: ${file}`);
}

const sampleExpectedPages = [
  "public/claims.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/platform.html",
  "public/status.html"
];

for (const file of sampleExpectedPages) {
  if (!fs.existsSync(path.join(root, file))) findings.push(`Missing generated page: ${file}`);
}

const lines = [];
lines.push("# Publication Builder Report");
lines.push("");
lines.push(`Generated: ${now.toISOString()}`);
lines.push(`Mode: ${dryRun ? "dry run" : "active"}`);
lines.push("");
lines.push("## Build command");
lines.push("");
lines.push(`Status: ${buildResult.status === 0 ? "passed" : "failed"}`);
if (buildResult.error) lines.push(`Error: ${buildResult.error}`);
const output = `${buildResult.stdout}\n${buildResult.stderr}`.trim();
if (output) {
  lines.push("");
  lines.push("```text");
  lines.push(output.slice(-5000));
  lines.push("```");
}
lines.push("");
lines.push("## Output counts");
lines.push("");
lines.push(`HTML files before: ${beforeHtml}`);
lines.push(`HTML files after: ${afterHtml}`);
lines.push(`Data JSON files before: ${beforeJson}`);
lines.push(`Data JSON files after: ${afterJson}`);
lines.push("");
lines.push("## Model counts");
lines.push("");
for (const [key, value] of Object.entries(expectedCounts)) {
  lines.push(`- ${key}: ${value}`);
}
lines.push("");
lines.push("## Findings");
lines.push("");
if (!findings.length) {
  lines.push("No publication builder findings.");
} else {
  for (const finding of findings) lines.push(`- ${finding}`);
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Publication Builder report written to ${path.relative(root, reportPath)}`);

if (buildResult.status !== 0 || findings.length) {
  process.exitCode = 1;
}
