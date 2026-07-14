const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const MANDATORY_VALIDATORS = Object.freeze(["execution-plan", "exact-materialization", "institution-registry", "dependency-references", "dependency-cycles"]);

function defaultPolicyPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "execution", "policy.json");
}

function validateExecutionPolicy(policy) {
  const problems = [];
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return { valid: false, problems: ["Execution policy must be an object."] };
  if (typeof policy.version !== "string" || !/^\d+\.\d+\.\d+$/.test(policy.version)) problems.push("Execution policy version is invalid.");
  if (policy.requireAffectedObjectCoverage !== true) problems.push("Execution policy must enable affected-object coverage.");
  if (!Array.isArray(policy.requiredValidators) || !policy.requiredValidators.length) problems.push("Execution policy must declare required validators.");
  else {
    const unique = new Set(policy.requiredValidators);
    if (unique.size !== policy.requiredValidators.length || policy.requiredValidators.some((id) => typeof id !== "string" || !id)) problems.push("Execution policy requiredValidators must contain unique validator ids.");
    for (const id of MANDATORY_VALIDATORS) if (!unique.has(id)) problems.push(`Execution policy is missing mandatory validator: ${id}.`);
  }
  if (!policy.actions || typeof policy.actions !== "object" || Array.isArray(policy.actions)) problems.push("Execution policy actions must be an object.");
  for (const [action, rule] of Object.entries(policy.actions || {})) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      problems.push(`Execution action policy is invalid: ${action}.`);
      continue;
    }
    if (!Array.isArray(rule.allowedPaths)) problems.push(`Execution action ${action} allowedPaths must be an array.`);
    if (!Array.isArray(rule.allowedPrefixes)) problems.push(`Execution action ${action} allowedPrefixes must be an array.`);
    if (typeof rule.allowDelete !== "boolean") problems.push(`Execution action ${action} allowDelete must be boolean.`);
    if (rule.semanticValidators !== undefined && !Array.isArray(rule.semanticValidators)) problems.push(`Execution action ${action} semanticValidators must be an array.`);
  }
  return { valid: problems.length === 0, problems };
}

function loadExecutionPolicy(options = {}) {
  const policyPath = options.policyPath || defaultPolicyPath(options.rootDir || repositoryRoot);
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const validation = validateExecutionPolicy(policy);
  if (!validation.valid) {
    const error = new Error(`Invalid execution policy:\n- ${validation.problems.join("\n- ")}`);
    error.code = "INVALID_EXECUTION_POLICY";
    error.problems = validation.problems;
    throw error;
  }
  return Object.freeze({ policy: Object.freeze(policy), policyPath, policyHash: sha256(canonicalStringify(policy)) });
}

module.exports = { MANDATORY_VALIDATORS, defaultPolicyPath, loadExecutionPolicy, validateExecutionPolicy };
