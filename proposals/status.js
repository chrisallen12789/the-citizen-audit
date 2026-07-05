const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "proposals", "registry.json"), "utf8"));
const outputPath = path.join(root, "proposals", "reports", "status.md");
const proposals = registry.proposals || [];
const ids = new Set();
const problems = [];

for (const proposal of proposals) {
  if (ids.has(proposal.id)) problems.push(`Duplicate proposal ID: ${proposal.id}`);
  ids.add(proposal.id);
  if (proposal.requiredAuthorityLevel === 4 && !proposal.humanApprovalRequired) {
    problems.push(`${proposal.id}: Level 4 proposal must require human approval.`);
  }
}

const lines = [];
lines.push("# Proposal Status Report");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Proposals: ${proposals.length}`);
lines.push(`Problems: ${problems.length}`);
lines.push("");

for (const proposal of proposals) {
  lines.push(`## ${proposal.id} — ${proposal.title}`);
  lines.push("");
  lines.push(`Status: ${proposal.status}`);
  lines.push(`Type: ${proposal.proposalType}`);
  lines.push(`Authority: L${proposal.requiredAuthorityLevel}`);
  lines.push(`Human approval required: ${proposal.humanApprovalRequired ? "yes" : "no"}`);
  lines.push("");
  lines.push(proposal.summary);
  lines.push("");
}

lines.push("## Problems");
lines.push("");
if (!problems.length) lines.push("No proposal registry problems.");
else for (const problem of problems) lines.push(`- ${problem}`);
lines.push("");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Proposal status report written to ${path.relative(root, outputPath)}`);

if (problems.length) process.exit(1);
