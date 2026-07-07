// Execution-plan consistency validator.
// Proves the deterministic execution plan matches the authoritative approved
// transaction and its write-set hash. Supported in both phases.
function validate(context) {
  const problems = [];
  const plan = context && context.plan;
  const transaction = context && context.transaction;
  const expectedWriteSetHash = context && context.writeSetHash;

  if (!plan || !Array.isArray(plan.writes) || plan.writes.length === 0) problems.push("Execution plan has no declared writes.");
  if (!plan || typeof plan.writeSetHash !== "string" || plan.writeSetHash.length !== 64) problems.push("Execution plan write-set hash is invalid.");
  if (!plan || !Array.isArray(plan.affectedObjects) || plan.affectedObjects.length === 0) problems.push("Execution plan has no affected objects.");

  if (plan && transaction) {
    if (plan.writeSetHash !== transaction.writeSetHash) problems.push("Execution plan write-set hash does not match the approved transaction.");
    if (expectedWriteSetHash && plan.writeSetHash !== expectedWriteSetHash) problems.push("Execution plan write-set hash does not match the bound write-set hash.");
    if (plan.action !== transaction.action) problems.push("Execution plan action does not match the approved transaction.");
    const planObjects = [...plan.affectedObjects].sort();
    const txObjects = [...transaction.affectedObjects].sort();
    if (JSON.stringify(planObjects) !== JSON.stringify(txObjects)) problems.push("Execution plan affected objects do not match the approved transaction.");
    const planPaths = plan.writes.map((write) => write.path).sort();
    const txPaths = transaction.proposedWrites.map((write) => write.path).sort();
    if (JSON.stringify(planPaths) !== JSON.stringify(txPaths)) problems.push("Execution plan write paths do not match the approved transaction.");
  }

  return {
    status: problems.length ? "failed" : "passed",
    problems: problems.sort(),
    warnings: [],
    checkedObjects: plan && Array.isArray(plan.affectedObjects) ? [...plan.affectedObjects] : [],
    checkedPaths: plan && Array.isArray(plan.writes) ? plan.writes.map((write) => write.path) : []
  };
}

module.exports = { id: "execution-plan", version: "1.0.0", supportedPhases: ["candidate", "post_write"], validate };
