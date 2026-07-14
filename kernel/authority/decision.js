const { findAgent, findRule, hashAuthorityState, loadAuthorityState } = require("./state");

function approvalSatisfiesRule(rule, approval) {
  if (!rule.requiresHumanApproval) return true;
  return Boolean(
    approval && approval.approvedBy && approval.approvedBy.type === "human" &&
    typeof approval.approvedBy.id === "string" && approval.approvedBy.id.trim() &&
    typeof approval.decisionId === "string" && approval.decisionId.trim()
  );
}

function evaluateAuthority(agent, rule, action, options = {}) {
  const base = { allowed: false, agentId: agent ? agent.id : options.agentId, action, ruleId: rule ? rule.id : undefined };
  if (!agent) return { ...base, reason: "unknown agent" };
  if (!rule) return { ...base, reason: "unknown permission rule" };
  if (agent.status !== "active") return { ...base, reason: `agent status is ${agent.status}` };
  if (!new Set(agent.capabilities || []).has(action)) return { ...base, reason: "agent does not declare capability" };
  if (agent.authorityLevel < rule.minimumAuthorityLevel) return { ...base, reason: `agent authority level ${agent.authorityLevel} is below required level ${rule.minimumAuthorityLevel}` };
  if (!approvalSatisfiesRule(rule, options.approval)) return { ...base, reason: "action requires human approval" };
  return { ...base, allowed: true, reason: "authorized" };
}

function checkAction(agentId, action, options = {}) {
  const state = options.state || loadAuthorityState(options);
  return evaluateAuthority(findAgent(state, agentId), findRule(state, action), action, { agentId, approval: options.approval });
}

function evaluateTransactionAuthority(transaction, options = {}) {
  const state = options.state || loadAuthorityState(options);
  const authorityStateHash = hashAuthorityState(state);
  if (!transaction || !transaction.actor || transaction.actor.type !== "agent") {
    return {
      allowed: false,
      actor: transaction && transaction.actor,
      action: transaction && transaction.action,
      transactionId: transaction && transaction.id,
      writeSetHash: transaction && transaction.writeSetHash,
      authorityStateHash,
      reason: "governed execution currently requires a registered agent actor"
    };
  }
  const decision = evaluateAuthority(findAgent(state, transaction.actor.id), findRule(state, transaction.action), transaction.action, {
    agentId: transaction.actor.id,
    approval: transaction.approval
  });
  return { ...decision, actor: { ...transaction.actor }, transactionId: transaction.id, writeSetHash: transaction.writeSetHash, authorityStateHash };
}

module.exports = { approvalSatisfiesRule, checkAction, evaluateAuthority, evaluateTransactionAuthority };
