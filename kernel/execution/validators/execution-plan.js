const { checkExecutionPlan } = require("./execution-plan-check");

module.exports = {
  id: "execution-plan",
  version: "1.0.0",
  validate({ transaction, plan }) {
    const problems = checkExecutionPlan(transaction, plan);
    return {
      status: problems.length ? "failed" : "passed",
      problems,
      warnings: [],
      checkedObjects: plan && Array.isArray(plan.affectedObjects) ? plan.affectedObjects : [],
      checkedPaths: plan && Array.isArray(plan.writes) ? plan.writes.map((write) => write.path) : []
    };
  }
};
