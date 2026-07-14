const { canonicalStringify } = require("../../lib/canonical-json");
const { sha256 } = require("../../lib/append-only-log");
const { computeWriteSetHash } = require("../../transactions/validate");

function checkExecutionPlan(transaction, plan) {
  const problems = [];
  if (!plan || !Array.isArray(plan.writes) || plan.writes.length === 0) problems.push("Execution plan has no declared writes.");
  if (!plan || plan.transactionId !== transaction.id) problems.push("Execution plan transaction binding is invalid.");
  const writeSetHash = computeWriteSetHash(transaction.proposedWrites);
  if (!plan || plan.writeSetHash !== writeSetHash || transaction.writeSetHash !== writeSetHash) problems.push("Execution plan write-set binding is invalid.");
  if (!plan || canonicalStringify(plan.writes.map(({ registeredObjectId, ...write }) => write)) !== canonicalStringify(transaction.proposedWrites)) problems.push("Execution plan writes do not match the recorded transaction.");
  if (plan) {
    const { planHash, ...body } = plan;
    if (sha256(canonicalStringify(body)) !== planHash) problems.push("Execution plan hash is invalid.");
  }
  return problems;
}

module.exports = { checkExecutionPlan };
