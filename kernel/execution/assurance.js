function assessPlan(plan, phase) {
  const problems = [];
  if (!plan || !Array.isArray(plan.writes) || plan.writes.length === 0) problems.push("Execution plan has no declared writes.");
  if (!plan || typeof plan.writeSetHash !== "string" || plan.writeSetHash.length !== 64) problems.push("Execution plan write-set hash is invalid.");
  if (!plan || !Array.isArray(plan.affectedObjects) || plan.affectedObjects.length === 0) problems.push("Execution plan has no affected objects.");
  return {
    validatorId: "execution-plan",
    phase,
    status: problems.length ? "failed" : "passed",
    problems,
    warnings: [],
    checkedObjects: plan && Array.isArray(plan.affectedObjects) ? plan.affectedObjects : [],
    checkedPaths: plan && Array.isArray(plan.writes) ? plan.writes.map((write) => write.path) : []
  };
}

module.exports = { assessPlan };
