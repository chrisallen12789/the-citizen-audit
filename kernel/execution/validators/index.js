const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../../lib/canonical-json");
const { sha256 } = require("../../lib/append-only-log");
const { VALIDATION_PHASES } = require("../validation-results");

const SEMVER = /^\d+\.\d+\.\d+$/;

function assertSupportedPhases(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must declare supportedPhases.`);
  for (const phase of value) {
    if (!VALIDATION_PHASES.includes(phase)) throw new Error(`${label} declares an unsupported phase: ${phase}.`);
  }
}

// Deterministic validator-registry loader. Rejects duplicate ids, path escape,
// contract mismatch, unsupported/omitted phases, and version omission. The
// canonical hash of the registry is bound into the execution attempt.
function loadValidatorRegistry(options = {}) {
  const validatorsDir = path.resolve(options.validatorsDir || __dirname);
  const registryPath = path.join(validatorsDir, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry.validators)) throw new Error("Validator registry validators must be an array.");

  const loaded = new Map();
  const canonicalEntries = [];
  for (const entry of registry.validators) {
    if (!entry || typeof entry.id !== "string" || typeof entry.module !== "string") throw new Error("Validator registry contains an invalid entry.");
    if (typeof entry.version !== "string" || !SEMVER.test(entry.version)) throw new Error(`Validator registry entry omits a semantic version: ${entry.id}.`);
    assertSupportedPhases(entry.supportedPhases, `Validator registry entry ${entry.id}`);
    if (loaded.has(entry.id)) throw new Error(`Duplicate validator id: ${entry.id}.`);

    const modulePath = path.resolve(validatorsDir, entry.module);
    if (path.dirname(modulePath) !== validatorsDir) throw new Error(`Validator module escapes validator directory: ${entry.module}.`);

    let validator;
    let moduleHash;
    try {
      moduleHash = sha256(fs.readFileSync(modulePath));
      const resolvedModule = require.resolve(modulePath);
      delete require.cache[resolvedModule];
      validator = require(resolvedModule);
    } catch (error) {
      throw new Error(`Validator module is unavailable: ${entry.id} (${error.message}).`);
    }
    if (!validator || validator.id !== entry.id || typeof validator.validate !== "function") throw new Error(`Validator module contract mismatch: ${entry.id}.`);
    if (validator.version !== entry.version) throw new Error(`Validator version mismatch: ${entry.id}.`);
    assertSupportedPhases(validator.supportedPhases, `Validator module ${entry.id}`);
    if (canonicalStringify([...validator.supportedPhases].sort()) !== canonicalStringify([...entry.supportedPhases].sort())) {
      throw new Error(`Validator supportedPhases mismatch: ${entry.id}.`);
    }

    loaded.set(entry.id, validator);
    canonicalEntries.push({ id: entry.id, version: entry.version, module: entry.module, moduleHash, supportedPhases: [...entry.supportedPhases].sort() });
  }

  canonicalEntries.sort((a, b) => a.id.localeCompare(b.id));
  const validatorSetHash = sha256(canonicalStringify({ version: registry.version || null, validators: canonicalEntries }));
  return { loaded, validatorSetHash, entries: canonicalEntries };
}

// Resolve the policy-required validators, failing closed if any is unavailable.
function selectRequiredValidators(policy, loaded) {
  if (!Array.isArray(policy.requiredValidators) || policy.requiredValidators.length === 0) throw new Error("Execution policy must declare requiredValidators.");
  return policy.requiredValidators.map((id) => {
    const validator = loaded.get(id);
    if (!validator) throw new Error(`Execution policy references an unavailable mandatory validator: ${id}.`);
    return validator;
  });
}

// Validators (from the required set) that support a given phase.
function validatorsForPhase(required, phase) {
  return required.filter((validator) => validator.supportedPhases.includes(phase));
}

module.exports = { loadValidatorRegistry, selectRequiredValidators, validatorsForPhase };
