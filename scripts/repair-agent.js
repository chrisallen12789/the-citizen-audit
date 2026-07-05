const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const reportPath = path.join(root, "docs", "repair-agent-report.md");
const dryRun = process.argv.includes("--dry-run");

const commands = [
  { name: "ADS export", command: "npm", args: ["run", "ads:export"] },
  { name: "ADS validation", command: "npm", args: ["run", "ads:validate"] },
  { name: "Publication build", command: "npm", args: ["run", "build:publication"] },
  { name: "Institutional QA", command: "npm", args: ["run", "qa"] }
];

function run(commandSpec) {
  const result = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  return {
    ...commandSpec,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null
  };
}

function classify(result) {
  const output = `${result.stdout}\n${result.stderr}`;
  const findings = [];

  const patterns = [
    ["missing generated file", /required generated file missing|generated .* missing|ENOENT/i],
    ["ADS structure", /ADS validation failed|ADS .* missing|metric mismatch|duplicate id|invalid audit id/i],
    ["archive manifest", /archive_manifest|archive manifest/i],
    ["metadata", /missing meta|canonical|Open Graph|Twitter|favicon|manifest link/i],
    ["internal links", /broken internal link/i],
    ["source metadata", /required source metadata|high-priority source|verification/i],
    ["publication readiness", /readiness statement|publication recommendation|NOT READY/i],
    ["build script", /Canonical PDF not found|copyFile|build-publication-assets/i]
  ];

  for (const [label, pattern] of patterns) {
    if (pattern.test(output)) findings.push(label);
  }

  if (!findings.length && result.status !== 0) findings.push("unclassified failure");
  return findings;
}

function safeFixes(results) {
  const actions = [];
  const failedText = results.map((item) => `${item.stdout}\n${item.stderr}`).join("\n");

  if (/ADS validation failed|metric mismatch|registry\/audits\.json|audits\/001/i.test(failedText)) {
    actions.push({
      name: "Regenerate ADS records",
      command: "npm",
      args: ["run", "ads:export"]
    });
  }

  if (/required generated file missing|generated .* missing|publication-manifest|platform-metrics|trace-records/i.test(failedText)) {
    actions.push({
      name: "Rebuild publication assets",
      command: "npm",
      args: ["run", "build:publication"]
    });
  }

  return actions;
}

function writeReport(initialResults, repairResults, finalResults) {
  const lines = [];
  lines.push("# Repair Agent Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Mode: ${dryRun ? "dry run" : "repair"}`);
  lines.push("");

  function section(title, results) {
    lines.push(`## ${title}`);
    lines.push("");
    for (const result of results) {
      lines.push(`### ${result.name}`);
      lines.push("");
      lines.push(`Status: ${result.status === 0 ? "passed" : "failed"}`);
      const findings = classify(result);
      if (findings.length) lines.push(`Classification: ${findings.join(", ")}`);
      if (result.error) lines.push(`Error: ${result.error}`);
      const output = `${result.stdout}\n${result.stderr}`.trim();
      if (output) {
        lines.push("");
        lines.push("```text");
        lines.push(output.slice(-6000));
        lines.push("```");
      }
      lines.push("");
    }
  }

  section("Initial check", initialResults);
  if (repairResults.length) section("Safe repair actions", repairResults);
  if (finalResults.length) section("Final check", finalResults);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}

const initialResults = [];
for (const command of commands) {
  const result = run(command);
  initialResults.push(result);
  if (result.status !== 0) break;
}

let repairResults = [];
let finalResults = [];

if (initialResults.some((item) => item.status !== 0)) {
  const actions = safeFixes(initialResults);
  if (!dryRun) {
    repairResults = actions.map(run);
    finalResults = commands.map(run);
  }
}

writeReport(initialResults, repairResults, finalResults);

const finalSet = finalResults.length ? finalResults : initialResults;
const failed = finalSet.filter((item) => item.status !== 0);

console.log(`Repair agent report written to ${path.relative(root, reportPath)}`);

if (failed.length) {
  console.error("Repair agent stopped with unresolved failures:");
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}

console.log("Repair agent completed without unresolved failures.");
