const { decodeWriteContent } = require("../../transactions/validate");
function validate(context) {
  const problems = [];
  if (!context.transaction || context.transaction.action !== "regenerate_derived_files") problems.push("derived-files semantic validator received the wrong action.");
  for (const write of (context.plan && context.plan.writes) || []) {
    if (write.operation !== "write") { problems.push(`Derived-file action may not delete ${write.path}.`); continue; }
    const text = decodeWriteContent(write).toString("utf8");
    if (write.path.endsWith(".json")) { try { JSON.parse(text); } catch { problems.push(`Derived JSON is malformed: ${write.path}.`); } }
    else if (write.path.endsWith(".html") && !/<(?:!doctype\s+html|html)[\s>]/i.test(text)) problems.push(`Derived HTML lacks a document root: ${write.path}.`);
    else if (!text.trim()) problems.push(`Derived output is empty: ${write.path}.`);
  }
  return { status: problems.length ? "failed" : "passed", problems, warnings: [], checkedObjects: context.plan ? context.plan.affectedObjects : [], checkedPaths: context.plan ? context.plan.writes.map((w) => w.path) : [] };
}
module.exports = { id: "derived-files-semantics", version: "1.0.0", semantic: true, actions: ["regenerate_derived_files"], supportedPhases: ["candidate", "post_write"], validate };
