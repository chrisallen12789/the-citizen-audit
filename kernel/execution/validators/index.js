const fs = require("fs");
const path = require("path");

function loadValidatorRegistry(options = {}) {
  const validatorsDir = path.resolve(options.validatorsDir || __dirname);
  const registryPath = path.join(validatorsDir, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry.validators)) throw new Error("Validator registry validators must be an array.");
  const loaded = new Map();
  for (const entry of registry.validators) {
    if (!entry || typeof entry.id !== "string" || typeof entry.module !== "string") throw new Error("Validator registry contains an invalid entry.");
    if (loaded.has(entry.id)) throw new Error(`Duplicate validator id: ${entry.id}.`);
    const modulePath = path.resolve(validatorsDir, entry.module);
    if (path.dirname(modulePath) !== validatorsDir) throw new Error(`Validator module escapes validator directory: ${entry.module}.`);
    const validator = require(modulePath);
    if (!validator || validator.id !== entry.id || typeof validator.validate !== "function") throw new Error(`Validator module contract mismatch: ${entry.id}.`);
    loaded.set(entry.id, validator);
  }
  return loaded;
}

function selectValidators(policy, loaded) {
  if (!Array.isArray(policy.requiredValidators) || policy.requiredValidators.length === 0) throw new Error("Execution policy must declare requiredValidators.");
  return policy.requiredValidators.map((id) => {
    const validator = loaded.get(id);
    if (!validator) throw new Error(`Execution policy references unknown validator: ${id}.`);
    return validator;
  });
}

module.exports = { loadValidatorRegistry, selectValidators };
