const { decodeWriteContent } = require("../../transactions/validate");
function validate(context) {
  const problems = [];
  if (!context.transaction || context.transaction.action !== "sort_registry") problems.push("registry-sort semantic validator received the wrong action.");
  for (const write of (context.plan && context.plan.writes) || []) {
    try {
      const value = JSON.parse(decodeWriteContent(write).toString("utf8"));
      const records = Array.isArray(value) ? value : value.audits;
      if (!Array.isArray(records)) problems.push(`Sorted registry must contain an audit array: ${write.path}.`);
      else {
        const ids = records.map((item) => item && item.id);
        if (ids.some((id) => typeof id !== "string")) problems.push(`Sorted registry contains a record without an id: ${write.path}.`);
        if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) problems.push(`Registry is not sorted by id: ${write.path}.`);
      }
    } catch { problems.push(`Sorted registry JSON is malformed: ${write.path}.`); }
  }
  return { status: problems.length ? "failed" : "passed", problems, warnings: [], checkedObjects: context.plan ? context.plan.affectedObjects : [], checkedPaths: context.plan ? context.plan.writes.map((w) => w.path) : [] };
}
module.exports = { id: "sort-registry-semantics", version: "1.0.0", semantic: true, actions: ["sort_registry"], supportedPhases: ["candidate", "post_write"], validate };
