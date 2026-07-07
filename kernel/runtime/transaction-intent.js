const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { assertValidTransaction, computeWriteSetHash } = require("../transactions/validate");
const { recordTransaction } = require("../transactions/store");

function deriveTransactionId(agentRunId, writeSetHash) {
  return `TX-${sha256(canonicalStringify({ agentRunId, writeSetHash })).slice(0, 40).toUpperCase()}`;
}

// Build immutable transaction intent from validated proposed writes. The intent
// is constructed through authoritative Institution OS code and binds actor,
// action, agent run id, the proposed write set, the write-set hash, affected
// objects, reason, provenance, and creation time. Agent-emitted transaction
// JSON is never trusted or used.
function buildTransactionIntent(input) {
  const { actor, action, agentRunId, proposedWrites, affectedObjects } = input;
  if (!Array.isArray(proposedWrites) || proposedWrites.length === 0) throw new Error("Transaction intent requires at least one proposed write.");
  if (!actor || !actor.type || !actor.id) throw new Error("Transaction intent requires an actor.");
  if (typeof action !== "string" || !action.trim()) throw new Error("Transaction intent requires an action.");
  if (!Array.isArray(affectedObjects) || affectedObjects.length === 0) throw new Error("Transaction intent requires affected objects.");

  const writeSetHash = computeWriteSetHash(proposedWrites);
  const transaction = {
    id: input.id || deriveTransactionId(agentRunId, writeSetHash),
    version: "1.0.0",
    status: "pending_review",
    action,
    actor: { type: actor.type, id: actor.id },
    requestedAt: input.requestedAt || new Date().toISOString(),
    affectedObjects: [...affectedObjects],
    proposedWrites: proposedWrites.map((write) => ({ ...write })),
    metadata: {
      agentRunId,
      reason: input.reason || null,
      provenance: input.provenance || {}
    },
    writeSetHash
  };
  transaction.proposedWrites.forEach((write) => Object.freeze(write));
  Object.freeze(transaction.proposedWrites);
  Object.freeze(transaction.actor);
  Object.freeze(transaction.metadata);
  Object.freeze(transaction);
  return Object.freeze({ transaction, writeSetHash });
}

// Given an explicit approval decision, produce and record the approved
// transaction — bound to the exact transaction id and write-set hash — through
// the authoritative transaction store. The write set is copied verbatim from the
// intent, so approval cannot silently change it. Never auto-approves.
function recordApprovedTransaction(rootDir, intent, approval, options = {}) {
  if (!approval || approval.approved !== true) throw new Error("Cannot record an unapproved transaction.");
  if (!approval.approvedBy || !approval.approvedBy.type || !approval.approvedBy.id) throw new Error("Approval requires an approver identity.");
  if (typeof approval.decisionId !== "string" || !approval.decisionId.trim()) throw new Error("Approval requires a decision id.");

  const approved = {
    ...intent.transaction,
    status: "approved",
    approval: {
      approvedBy: { type: approval.approvedBy.type, id: approval.approvedBy.id },
      approvedAt: approval.approvedAt || new Date().toISOString(),
      decisionId: approval.decisionId
    }
  };
  // The recomputed write-set hash must still match the approved intent.
  if (computeWriteSetHash(approved.proposedWrites) !== intent.writeSetHash) {
    throw new Error("Approval write-set hash mismatch; refusing to record.");
  }
  assertValidTransaction(approved);
  recordTransaction(approved, { rootDir, recordedAt: options.recordedAt });
  return approved.id;
}

module.exports = { buildTransactionIntent, deriveTransactionId, recordApprovedTransaction };
