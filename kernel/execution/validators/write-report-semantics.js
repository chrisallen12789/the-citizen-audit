const { decodeWriteContent } = require("../../transactions/validate");
function validate(context) {
  const problems = [];
  if (!context.transaction || context.transaction.action !== "write_report") problems.push("write-report semantic validator received the wrong action.");
  for (const write of (context.plan && context.plan.writes) || []) {
    if (write.operation === "delete") continue;
    if (write.operation !== "write") { problems.push(`Report action contains an unsupported operation for ${write.path}.`); continue; }
    const text = decodeWriteContent(write).toString("utf8");
    if (!text.trim()) problems.push(`Report output is empty: ${write.path}.`);
    if (write.path.endsWith(".json")) { try { JSON.parse(text); } catch { problems.push(`Report JSON is malformed: ${write.path}.`); } }
  }
  return { status: problems.length ? "failed" : "passed", problems, warnings: [], checkedObjects: context.plan ? context.plan.affectedObjects : [], checkedPaths: context.plan ? context.plan.writes.map((w) => w.path) : [] };
}
module.exports = { id: "write-report-semantics", version: "1.0.0", semantic: true, actions: ["write_report"], supportedPhases: ["candidate", "post_write"], validate };
