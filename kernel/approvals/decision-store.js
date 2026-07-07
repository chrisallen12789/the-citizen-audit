const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { defaultExecutionStateRoot } = require("../execution/exclusive-boundary");
const { ensureDirectory, fsyncDirectory } = require("../execution/durable-io");

const DECISION_VERSION = "1.0.0";
const DECISION_ID_PATTERN = /^DEC-[A-Z0-9][A-Z0-9-]{2,63}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function decisionDirectory(rootDir) {
  return path.join(defaultExecutionStateRoot(rootDir), "approval-decisions");
}
function decisionPath(rootDir, decisionId) {
  if (!DECISION_ID_PATTERN.test(decisionId || "")) throw new Error(`Invalid approval decision id: ${decisionId}.`);
  return path.join(decisionDirectory(rootDir), `${decisionId}.json`);
}
function authorityRegistryPath(rootDir) {
  return path.join(rootDir, "kernel", "authority", "approval-authorities.json");
}
function readRegularJson(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} is not a regular file.`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
function isIso(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}
function loadAuthorityRegistry(rootDir) {
  const registry = readRegularJson(authorityRegistryPath(rootDir), "Approval authority registry");
  if (!registry || registry.version !== "1.0.0" || !Array.isArray(registry.authorities)) throw new Error("Approval authority registry is malformed.");
  return registry;
}
function findAuthority(rootDir, identity, authority, action) {
  const match = loadAuthorityRegistry(rootDir).authorities.find((entry) =>
    entry && entry.status === "active" && entry.type === identity.type && entry.id === identity.id &&
    Array.isArray(entry.authorities) && entry.authorities.includes(authority) &&
    (!Array.isArray(entry.actions) || entry.actions.includes(action))
  );
  if (!match) throw new Error(`Approver ${identity.type}:${identity.id} lacks current authority ${authority} for ${action}.`);
  return match;
}
function decisionBody(input) {
  return {
    version: DECISION_VERSION,
    decisionId: input.decisionId,
    decision: input.decision,
    transactionId: input.transactionId,
    writeSetHash: input.writeSetHash,
    actor: { type: input.actor.type, id: input.actor.id },
    action: input.action,
    approver: { type: input.approver.type, id: input.approver.id },
    approverAuthority: input.approverAuthority,
    decidedAt: input.decidedAt
  };
}
function assertDecisionShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Approval decision must be an object.");
  const allowed = new Set(["version","decisionId","decision","transactionId","writeSetHash","actor","action","approver","approverAuthority","decidedAt","recordHash"]);
  for (const key of Object.keys(record)) if (!allowed.has(key)) throw new Error(`Approval decision contains undeclared field: ${key}.`);
  if (record.version !== DECISION_VERSION) throw new Error(`Approval decision version must be ${DECISION_VERSION}.`);
  if (!DECISION_ID_PATTERN.test(record.decisionId || "")) throw new Error("Approval decision id is invalid.");
  if (!['approved','denied'].includes(record.decision)) throw new Error("Approval decision must be approved or denied.");
  if (typeof record.transactionId !== "string" || !record.transactionId) throw new Error("Approval decision transactionId is required.");
  if (!HASH_PATTERN.test(record.writeSetHash || "")) throw new Error("Approval decision writeSetHash is invalid.");
  for (const [label, value] of [["actor",record.actor],["approver",record.approver]]) {
    if (!value || typeof value.type !== "string" || !value.type || typeof value.id !== "string" || !value.id) throw new Error(`Approval decision ${label} is invalid.`);
  }
  if (typeof record.action !== "string" || !record.action) throw new Error("Approval decision action is required.");
  if (typeof record.approverAuthority !== "string" || !record.approverAuthority) throw new Error("Approval decision approverAuthority is required.");
  if (!isIso(record.decidedAt)) throw new Error("Approval decision decidedAt must be an ISO timestamp.");
  if (!HASH_PATTERN.test(record.recordHash || "")) throw new Error("Approval decision recordHash is invalid.");
  const { recordHash, ...body } = record;
  if (sha256(canonicalStringify(body)) !== recordHash) throw new Error("Approval decision record hash verification failed.");
  return record;
}
function recordApprovalDecision(rootDir, input) {
  const normalized = decisionBody({ ...input, decidedAt: input.decidedAt || new Date().toISOString() });
  normalized.recordHash = sha256(canonicalStringify(normalized));
  assertDecisionShape(normalized);
  findAuthority(rootDir, normalized.approver, normalized.approverAuthority, normalized.action);
  const filePath = decisionPath(rootDir, normalized.decisionId);
  ensureDirectory(path.dirname(filePath), 0o700);
  let fd;
  try {
    fd = fs.openSync(filePath, "wx", 0o600);
    fs.writeFileSync(fd, `${canonicalStringify(normalized)}\n`, "utf8");
    fs.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  fsyncDirectory(path.dirname(filePath));
  return Object.freeze({ ...normalized, filePath });
}
function loadApprovalDecision(rootDir, decisionId) {
  const filePath = decisionPath(rootDir, decisionId);
  const record = assertDecisionShape(readRegularJson(filePath, "Approval decision"));
  if (record.decisionId !== decisionId) throw new Error("Approval decision filename/id mismatch.");
  findAuthority(rootDir, record.approver, record.approverAuthority, record.action);
  return Object.freeze({ ...record, filePath });
}
function verifyApprovalDecisionForIntent(rootDir, decisionId, intent) {
  const record = loadApprovalDecision(rootDir, decisionId);
  const tx = intent.transaction || intent;
  const expected = {
    transactionId: tx.id,
    writeSetHash: intent.writeSetHash || tx.writeSetHash,
    actor: tx.actor,
    action: tx.action
  };
  const mismatches = [];
  if (record.transactionId !== expected.transactionId) mismatches.push("transaction id");
  if (record.writeSetHash !== expected.writeSetHash) mismatches.push("write-set hash");
  if (record.actor.type !== expected.actor.type || record.actor.id !== expected.actor.id) mismatches.push("actor");
  if (record.action !== expected.action) mismatches.push("action");
  if (mismatches.length) throw new Error(`Approval decision is not bound to the exact intent (${mismatches.join(", ")}).`);
  if (record.decision !== "approved") throw new Error("Approval decision denies this transaction.");
  return record;
}
module.exports = {
  DECISION_ID_PATTERN,
  DECISION_VERSION,
  decisionPath,
  loadApprovalDecision,
  recordApprovalDecision,
  verifyApprovalDecisionForIntent
};
