const { canonicalStringify } = require("../lib/canonical-json");

const ATTEMPT_SCHEMA_VERSION = "1.0.0";
const ATTEMPT_ID_PATTERN = /^ATTEMPT-[A-Z0-9][A-Z0-9-]{2,63}$/;
const TRANSACTION_ID_PATTERN = /^TX-[A-Z0-9][A-Z0-9-]{2,63}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const ACTOR_TYPES = new Set(["human", "agent", "system", "external"]);
const ATTEMPT_FIELDS = new Set([
  "id",
  "version",
  "transactionId",
  "state",
  "writeSetHash",
  "actor",
  "authorityStateHash",
  "policyHash",
  "validatorSetHash",
  "planHash",
  "preStateManifestHash",
  "validationResultHash",
  "rollbackResultHash",
  "terminalDisposition",
  "createdAt",
  "metadata"
]);
const TRANSITION_FIELDS = new Set([
  "version",
  "attemptId",
  "transactionId",
  "from",
  "to",
  "transitionedAt",
  "data"
]);
const TRANSITION_DATA_FIELDS = new Set([
  "preStateManifestHash",
  "validationResultHash",
  "rollbackResultHash",
  "problems",
  "warnings",
  "metadata"
]);

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function validateHash(value, label, problems, options = {}) {
  if (options.nullable && value === null) return;
  if (!HASH_PATTERN.test(value || "")) problems.push(`${label} must be a lowercase SHA-256 hash.`);
}

function validateActor(actor, problems) {
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
    problems.push("Execution attempt actor must be an object.");
    return;
  }
  const fields = new Set(["type", "id"]);
  for (const key of Object.keys(actor)) if (!fields.has(key)) problems.push(`Execution attempt actor contains undeclared field: ${key}.`);
  if (!ACTOR_TYPES.has(actor.type)) problems.push("Execution attempt actor.type is invalid.");
  if (typeof actor.id !== "string" || !actor.id.trim()) problems.push("Execution attempt actor.id is required.");
}

function validateMetadata(value, label, problems) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) problems.push(`${label} must be an object.`);
}

function validateExecutionAttempt(attempt) {
  const problems = [];
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) {
    return { valid: false, problems: ["Execution attempt must be an object."] };
  }
  for (const key of Object.keys(attempt)) if (!ATTEMPT_FIELDS.has(key)) problems.push(`Execution attempt contains undeclared field: ${key}.`);
  if (!ATTEMPT_ID_PATTERN.test(attempt.id || "")) problems.push("Execution attempt id is invalid.");
  if (attempt.version !== ATTEMPT_SCHEMA_VERSION) problems.push(`Execution attempt version must be ${ATTEMPT_SCHEMA_VERSION}.`);
  if (!TRANSACTION_ID_PATTERN.test(attempt.transactionId || "")) problems.push("Execution attempt transactionId is invalid.");
  if (attempt.state !== "prepared") problems.push("New execution attempt state must be prepared.");
  validateHash(attempt.writeSetHash, "Execution attempt writeSetHash", problems);
  validateActor(attempt.actor, problems);
  validateHash(attempt.authorityStateHash, "Execution attempt authorityStateHash", problems);
  validateHash(attempt.policyHash, "Execution attempt policyHash", problems);
  validateHash(attempt.validatorSetHash, "Execution attempt validatorSetHash", problems);
  validateHash(attempt.planHash, "Execution attempt planHash", problems);
  validateHash(attempt.preStateManifestHash, "Execution attempt preStateManifestHash", problems, { nullable: true });
  validateHash(attempt.validationResultHash, "Execution attempt validationResultHash", problems, { nullable: true });
  validateHash(attempt.rollbackResultHash, "Execution attempt rollbackResultHash", problems, { nullable: true });
  if (attempt.terminalDisposition !== null) problems.push("New execution attempt terminalDisposition must be null.");
  if (!isIsoDate(attempt.createdAt)) problems.push("Execution attempt createdAt must be an ISO timestamp.");
  validateMetadata(attempt.metadata, "Execution attempt metadata", problems);
  return { valid: problems.length === 0, problems };
}

function assertValidExecutionAttempt(attempt) {
  const result = validateExecutionAttempt(attempt);
  if (!result.valid) {
    const error = new Error(`Invalid execution attempt:\n- ${result.problems.join("\n- ")}`);
    error.code = "INVALID_EXECUTION_ATTEMPT";
    error.problems = result.problems;
    throw error;
  }
  return result;
}

function validateStringArray(value, label, problems) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) problems.push(`${label} must be an array of strings.`);
}

function validateTransitionData(data, problems) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    problems.push("Execution transition data must be an object.");
    return;
  }
  for (const key of Object.keys(data)) if (!TRANSITION_DATA_FIELDS.has(key)) problems.push(`Execution transition data contains undeclared field: ${key}.`);
  if (data.preStateManifestHash !== undefined) validateHash(data.preStateManifestHash, "Execution transition preStateManifestHash", problems);
  if (data.validationResultHash !== undefined) validateHash(data.validationResultHash, "Execution transition validationResultHash", problems);
  if (data.rollbackResultHash !== undefined) validateHash(data.rollbackResultHash, "Execution transition rollbackResultHash", problems);
  validateStringArray(data.problems, "Execution transition problems", problems);
  validateStringArray(data.warnings, "Execution transition warnings", problems);
  validateMetadata(data.metadata, "Execution transition metadata", problems);
}

function validateExecutionTransition(transition) {
  const problems = [];
  if (!transition || typeof transition !== "object" || Array.isArray(transition)) {
    return { valid: false, problems: ["Execution transition must be an object."] };
  }
  for (const key of Object.keys(transition)) if (!TRANSITION_FIELDS.has(key)) problems.push(`Execution transition contains undeclared field: ${key}.`);
  if (transition.version !== ATTEMPT_SCHEMA_VERSION) problems.push(`Execution transition version must be ${ATTEMPT_SCHEMA_VERSION}.`);
  if (!ATTEMPT_ID_PATTERN.test(transition.attemptId || "")) problems.push("Execution transition attemptId is invalid.");
  if (!TRANSACTION_ID_PATTERN.test(transition.transactionId || "")) problems.push("Execution transition transactionId is invalid.");
  if (typeof transition.from !== "string" || !transition.from) problems.push("Execution transition from is required.");
  if (typeof transition.to !== "string" || !transition.to) problems.push("Execution transition to is required.");
  if (!isIsoDate(transition.transitionedAt)) problems.push("Execution transition transitionedAt must be an ISO timestamp.");
  validateTransitionData(transition.data, problems);
  return { valid: problems.length === 0, problems };
}

function assertValidExecutionTransition(transition) {
  const result = validateExecutionTransition(transition);
  if (!result.valid) {
    const error = new Error(`Invalid execution transition:\n- ${result.problems.join("\n- ")}`);
    error.code = "INVALID_EXECUTION_TRANSITION";
    error.problems = result.problems;
    throw error;
  }
  return result;
}

function normalizeExecutionAttempt(input, options = {}) {
  const createdAt = input.createdAt || options.createdAt || new Date().toISOString();
  const normalized = JSON.parse(canonicalStringify({
    id: input.id,
    version: input.version || ATTEMPT_SCHEMA_VERSION,
    transactionId: input.transactionId,
    state: "prepared",
    writeSetHash: input.writeSetHash,
    actor: input.actor,
    authorityStateHash: input.authorityStateHash,
    policyHash: input.policyHash,
    validatorSetHash: input.validatorSetHash,
    planHash: input.planHash,
    preStateManifestHash: null,
    validationResultHash: null,
    rollbackResultHash: null,
    terminalDisposition: null,
    createdAt,
    metadata: input.metadata || {}
  }));
  assertValidExecutionAttempt(normalized);
  return normalized;
}

function normalizeExecutionTransition(input, options = {}) {
  const data = input.data || {};
  const normalized = JSON.parse(canonicalStringify({
    version: input.version || ATTEMPT_SCHEMA_VERSION,
    attemptId: input.attemptId,
    transactionId: input.transactionId,
    from: input.from,
    to: input.to,
    transitionedAt: input.transitionedAt || options.transitionedAt || new Date().toISOString(),
    data: {
      ...data,
      problems: data.problems ? data.problems.map(String) : [],
      warnings: data.warnings ? data.warnings.map(String) : [],
      metadata: data.metadata || {}
    }
  }));
  assertValidExecutionTransition(normalized);
  return normalized;
}

module.exports = {
  ACTOR_TYPES,
  ATTEMPT_SCHEMA_VERSION,
  HASH_PATTERN,
  assertValidExecutionAttempt,
  assertValidExecutionTransition,
  normalizeExecutionAttempt,
  normalizeExecutionTransition,
  validateExecutionAttempt,
  validateExecutionTransition
};
