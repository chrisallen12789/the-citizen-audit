const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const TRANSACTION_STATUSES = new Set(["draft", "pending_review", "approved", "denied", "abandoned"]);
const ACTOR_TYPES = new Set(["human", "agent", "system", "external"]);
const WRITE_OPERATIONS = new Set(["write", "delete"]);
const TOP_LEVEL_FIELDS = new Set(["id", "version", "status", "action", "actor", "requestedAt", "approval", "authorityEvaluation", "affectedObjects", "proposedWrites", "metadata", "writeSetHash"]);
const WRITE_FIELDS = new Set(["operation", "path", "content", "encoding", "contentHash"]);
const APPROVAL_FIELDS = new Set(["approvedBy", "approvedAt", "decisionId", "approverAuthority", "decisionRecordHash"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function normalizeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("write path must be a non-empty string");
  if (value.includes("\0")) throw new Error("write path contains a null byte");
  if (value.includes("\\")) throw new Error("write path must use forward slashes");
  if (path.posix.isAbsolute(value)) throw new Error("write path must be relative");
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) throw new Error("write path escapes the institution root");
  if (normalized !== value || value.endsWith("/")) throw new Error("write path must already be normalized and name a file");
  return normalized;
}

function decodeWriteContent(write) {
  if (write.operation !== "write") return null;
  const encoding = write.encoding || "utf8";
  if (!new Set(["utf8", "base64"]).has(encoding)) throw new Error(`unsupported write encoding: ${encoding}`);
  if (typeof write.content !== "string") throw new Error("write operation requires string content");
  return Buffer.from(write.content, encoding);
}

function computeWriteSetHash(proposedWrites) {
  const normalized = proposedWrites.map((write) => {
    const record = { operation: write.operation, path: write.path };
    if (write.operation === "write") {
      const bytes = decodeWriteContent(write);
      record.contentHash = sha256(bytes);
      record.encoding = write.encoding || "utf8";
    }
    return record;
  });
  return sha256(canonicalStringify(normalized));
}

function validateActor(actor, label, problems) {
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
    problems.push(`${label} must be an object.`);
    return;
  }
  if (!ACTOR_TYPES.has(actor.type)) problems.push(`${label}.type is invalid.`);
  if (typeof actor.id !== "string" || !actor.id.trim()) problems.push(`${label}.id is required.`);
}

function validateTransaction(transaction) {
  const problems = [];
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) return { valid: false, problems: ["Transaction must be an object."], writeSetHash: null };

  for (const key of Object.keys(transaction)) if (!TOP_LEVEL_FIELDS.has(key)) problems.push(`Transaction contains undeclared field: ${key}.`);
  if (typeof transaction.id !== "string" || !/^TX-[A-Z0-9][A-Z0-9-]{2,63}$/.test(transaction.id)) problems.push("Transaction id must match TX-[A-Z0-9-].");
  if (typeof transaction.version !== "string" || !/^\d+\.\d+\.\d+$/.test(transaction.version)) problems.push("Transaction version must be semantic version text.");
  if (!TRANSACTION_STATUSES.has(transaction.status)) problems.push("Transaction status is invalid.");
  if (typeof transaction.action !== "string" || !transaction.action.trim()) problems.push("Transaction action is required.");
  validateActor(transaction.actor, "Transaction actor", problems);
  if (!isIsoDate(transaction.requestedAt)) problems.push("Transaction requestedAt must be an ISO timestamp.");

  if (transaction.status === "approved") {
    if (!transaction.approval || typeof transaction.approval !== "object" || Array.isArray(transaction.approval)) {
      problems.push("Approved transaction requires approval metadata.");
    } else {
      for (const key of Object.keys(transaction.approval)) if (!APPROVAL_FIELDS.has(key)) problems.push(`Transaction approval contains undeclared field: ${key}.`);
      validateActor(transaction.approval.approvedBy, "Transaction approval.approvedBy", problems);
      if (!isIsoDate(transaction.approval.approvedAt)) problems.push("Transaction approval.approvedAt must be an ISO timestamp.");
      if (typeof transaction.approval.decisionId !== "string" || !transaction.approval.decisionId.trim()) problems.push("Transaction approval.decisionId is required.");
      if (typeof transaction.approval.approverAuthority !== "string" || !transaction.approval.approverAuthority.trim()) problems.push("Transaction approval.approverAuthority is required.");
      if (!HASH_PATTERN.test(transaction.approval.decisionRecordHash || "")) problems.push("Transaction approval.decisionRecordHash must be a SHA-256 hash.");
    }
  }

  if (!Array.isArray(transaction.affectedObjects) || transaction.affectedObjects.length === 0) {
    problems.push("Transaction affectedObjects must contain at least one registered object id.");
  } else {
    const unique = new Set();
    for (const objectId of transaction.affectedObjects) {
      if (typeof objectId !== "string" || !objectId.trim()) problems.push("Transaction affectedObjects contains an invalid id.");
      if (unique.has(objectId)) problems.push(`Transaction affectedObjects contains duplicate id: ${objectId}.`);
      unique.add(objectId);
    }
  }

  if (!Array.isArray(transaction.proposedWrites) || transaction.proposedWrites.length === 0) {
    problems.push("Transaction proposedWrites must contain at least one write.");
  } else {
    const paths = new Set();
    transaction.proposedWrites.forEach((write, index) => {
      const label = `Transaction proposedWrites[${index}]`;
      if (!write || typeof write !== "object" || Array.isArray(write)) {
        problems.push(`${label} must be an object.`);
        return;
      }
      for (const key of Object.keys(write)) if (!WRITE_FIELDS.has(key)) problems.push(`${label} contains undeclared field: ${key}.`);
      if (!WRITE_OPERATIONS.has(write.operation)) problems.push(`${label}.operation is invalid.`);
      try {
        const normalized = normalizeRelativePath(write.path);
        if (paths.has(normalized)) problems.push(`${label}.path duplicates another proposed write: ${normalized}.`);
        paths.add(normalized);
      } catch (error) {
        problems.push(`${label}.path ${error.message}.`);
      }
      if (write.operation === "write") {
        try {
          const bytes = decodeWriteContent(write);
          if (write.contentHash && write.contentHash !== sha256(bytes)) problems.push(`${label}.contentHash does not match content.`);
        } catch (error) {
          problems.push(`${label}: ${error.message}.`);
        }
      } else if (write.operation === "delete" && (write.content !== undefined || write.encoding !== undefined || write.contentHash !== undefined)) {
        problems.push(`${label}: delete operation may not declare content fields.`);
      }
    });
  }

  let writeSetHash = null;
  if (Array.isArray(transaction.proposedWrites) && transaction.proposedWrites.length > 0) {
    try {
      writeSetHash = computeWriteSetHash(transaction.proposedWrites);
      if (transaction.writeSetHash && transaction.writeSetHash !== writeSetHash) problems.push("Transaction writeSetHash does not match proposedWrites.");
    } catch (error) {
      if (!problems.some((problem) => problem.includes(error.message))) problems.push(`Transaction write set is invalid: ${error.message}.`);
    }
  }
  return { valid: problems.length === 0, problems, writeSetHash };
}

function assertValidTransaction(transaction) {
  const result = validateTransaction(transaction);
  if (!result.valid) {
    const error = new Error(`Invalid transaction:\n- ${result.problems.join("\n- ")}`);
    error.code = "INVALID_TRANSACTION";
    error.problems = result.problems;
    throw error;
  }
  return result;
}

module.exports = { ACTOR_TYPES, TRANSACTION_STATUSES, WRITE_OPERATIONS, assertValidTransaction, computeWriteSetHash, decodeWriteContent, normalizeRelativePath, validateTransaction };
