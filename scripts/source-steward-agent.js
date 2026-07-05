const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publication = require("./publication-data");
const reportPath = path.join(root, "docs", "agent-reports", "source-steward.md");
const now = new Date();

function daysSince(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now - date) / 86400000);
}

function line(value) {
  return value == null || value === "" ? "Not recorded" : String(value);
}

const findings = [];

for (const source of publication.sources) {
  const sourceFindings = [];
  const retrievalAge = daysSince(source.retrievalDate);

  if (source.citationPriority === "high" && !source.canonicalUrl) {
    sourceFindings.push("High-priority source lacks canonical URL.");
  }

  if (source.archiveStatus === "available" && !source.archiveUrl) {
    sourceFindings.push("Archive status says available, but archive URL is missing.");
  }

  if (source.archiveUrl && source.archiveStatus === "not-available") {
    sourceFindings.push("Archive URL exists, but archive status says not available.");
  }

  if (source.citationPriority === "high" && !source.archiveUrl) {
    sourceFindings.push("High-priority source lacks archive URL.");
  }

  if (!source.retrievalDate) {
    sourceFindings.push("Retrieval date is missing.");
  } else if (retrievalAge !== null && retrievalAge > 180) {
    sourceFindings.push(`Retrieval date is stale by ${retrievalAge} days.`);
  }

  if (!source.verificationStatus || source.verificationStatus !== "verified") {
    sourceFindings.push(`Verification status is ${line(source.verificationStatus)}.`);
  }

  if (!source.urlVerificationNote || !source.urlVerificationNote.trim()) {
    sourceFindings.push("URL verification note is missing.");
  }

  if (sourceFindings.length) {
    findings.push({
      id: source.id,
      title: source.title,
      citationPriority: source.citationPriority || "not recorded",
      verificationStatus: source.verificationStatus || "not recorded",
      archiveStatus: source.archiveStatus || "not recorded",
      canonicalUrl: source.canonicalUrl || null,
      archiveUrl: source.archiveUrl || null,
      retrievalDate: source.retrievalDate || null,
      findings: sourceFindings
    });
  }
}

const lines = [];
lines.push("# Source Steward Report");
lines.push("");
lines.push(`Generated: ${now.toISOString()}`);
lines.push(`Sources inspected: ${publication.sources.length}`);
lines.push(`Sources flagged: ${findings.length}`);
lines.push("");

if (!findings.length) {
  lines.push("No source stewardship findings.");
} else {
  for (const item of findings) {
    lines.push(`## ${item.id} — ${item.title}`);
    lines.push("");
    lines.push(`Citation priority: ${item.citationPriority}`);
    lines.push(`Verification status: ${item.verificationStatus}`);
    lines.push(`Archive status: ${item.archiveStatus}`);
    lines.push(`Retrieval date: ${line(item.retrievalDate)}`);
    lines.push("");
    for (const finding of item.findings) {
      lines.push(`- ${finding}`);
    }
    lines.push("");
  }
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Source Steward report written to ${path.relative(root, reportPath)}`);

if (findings.length) {
  process.exitCode = 1;
}
