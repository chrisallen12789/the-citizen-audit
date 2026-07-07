const { decodeWriteContent } = require("../../transactions/validate");
function validate(context) {
  const problems = [];
  if (!context.transaction || context.transaction.action !== "export_ads_records") problems.push("ADS semantic validator received the wrong action.");
  for (const write of (context.plan && context.plan.writes) || []) {
    if (write.operation !== "write" || !write.path.endsWith(".json")) { problems.push(`ADS export must write JSON: ${write.path}.`); continue; }
    try { const value = JSON.parse(decodeWriteContent(write).toString("utf8")); if (value === null || typeof value !== "object") problems.push(`ADS export must contain structured JSON: ${write.path}.`); }
    catch { problems.push(`ADS export JSON is malformed: ${write.path}.`); }
  }
  return { status: problems.length ? "failed" : "passed", problems, warnings: [], checkedObjects: context.plan ? context.plan.affectedObjects : [], checkedPaths: context.plan ? context.plan.writes.map((w) => w.path) : [] };
}
module.exports = { id: "ads-records-semantics", version: "1.0.0", semantic: true, actions: ["export_ads_records"], supportedPhases: ["candidate", "post_write"], validate };
