const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { assertValidTransaction, computeWriteSetHash } = require("../transactions/validate");
const { recordTransaction } = require("../transactions/store");
const { verifyApprovalDecisionForIntent } = require("../approvals/decision-store");

function deriveTransactionId(agentRunId, writeSetHash) {
  return `TX-${sha256(canonicalStringify({ agentRunId, writeSetHash })).slice(0, 40).toUpperCase()}`;
}
function buildTransactionIntent(input) {
  const { actor, action, agentRunId, proposedWrites, affectedObjects } = input;
  if (!Array.isArray(proposedWrites) || proposedWrites.length === 0) throw new Error("Transaction intent requires at least one proposed write.");
  if (!actor || !actor.type || !actor.id) throw new Error("Transaction intent requires an actor.");
  if (typeof action !== "string" || !action.trim()) throw new Error("Transaction intent requires an action.");
  if (!Array.isArray(affectedObjects) || affectedObjects.length === 0) throw new Error("Transaction intent requires affected objects.");
  const writeSetHash = computeWriteSetHash(proposedWrites);
  const transaction = {
    id: input.id || deriveTransactionId(agentRunId, writeSetHash), version: "1.0.0", status: "pending_review", action,
    actor: { type: actor.type, id: actor.id }, requestedAt: input.requestedAt || new Date().toISOString(),
    affectedObjects: [...affectedObjects], proposedWrites: proposedWrites.map((write) => ({ ...write })),
    metadata: { agentRunId, reason: input.reason || null, provenance: input.provenance || {} }, writeSetHash
  };
  transaction.proposedWrites.forEach(Object.freeze); Object.freeze(transaction.proposedWrites); Object.freeze(transaction.actor); Object.freeze(transaction.metadata.provenance); Object.freeze(transaction.metadata); Object.freeze(transaction);
  return Object.freeze({ transaction, writeSetHash });
}
function recordApprovedTransaction(rootDir, intent, decisionId, options = {}) {
  const decision = verifyApprovalDecisionForIntent(rootDir, decisionId, intent);
  const approved = {
    ...intent.transaction,
    status: "approved",
    approval: {
      approvedBy: { type: decision.approver.type, id: decision.approver.id },
      approvedAt: decision.decidedAt,
      decisionId: decision.decisionId,
      approverAuthority: decision.approverAuthority,
      decisionRecordHash: decision.recordHash
    }
  };
  if (computeWriteSetHash(approved.proposedWrites) !== intent.writeSetHash) throw new Error("Approval write-set hash mismatch; refusing to record.");
  assertValidTransaction(approved);
  recordTransaction(approved, { rootDir, recordedAt: options.recordedAt });
  return approved.id;
}
module.exports = { buildTransactionIntent, deriveTransactionId, recordApprovedTransaction };
