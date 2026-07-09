const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../../lib/canonical-json");
const { sha256 } = require("../../lib/append-only-log");
const { VALIDATION_PHASES } = require("../validation-results");
const { buildValidatorClosure, resolveAuthoritativeRoot, REPO_ROOT } = require("../validator-closure");

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
  // ONE authoritative project root. Validators and all local dependencies must
  // resolve inside it. Defaults to the reviewed repo root; an explicit override
  // (e.g. an authorized temporary test root) is validated (not overly broad) by
  // resolveAuthoritativeRoot. A caller cannot widen acceptance with `/` etc.
  const projectRoot = resolveAuthoritativeRoot(options.projectRoot || REPO_ROOT);
  const realValidatorsDir = fs.realpathSync(validatorsDir);
  if (realValidatorsDir !== projectRoot && path.relative(projectRoot, realValidatorsDir).startsWith("..")) {
    throw new Error(`Validators directory is outside the authoritative project root: ${validatorsDir}.`);
  }
  const registryPath = path.join(validatorsDir, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry.validators)) throw new Error("Validator registry validators must be an array.");

  const loaded = new Map();
  const descriptors = new Map();
  const canonicalEntries = [];
  for (const entry of registry.validators) {
    if (!entry || typeof entry.id !== "string" || typeof entry.module !== "string") throw new Error("Validator registry contains an invalid entry.");
    if (typeof entry.version !== "string" || !SEMVER.test(entry.version)) throw new Error(`Validator registry entry omits a semantic version: ${entry.id}.`);
    assertSupportedPhases(entry.supportedPhases, `Validator registry entry ${entry.id}`);
    if (entry.semantic !== undefined && typeof entry.semantic !== "boolean") throw new Error(`Validator semantic flag is invalid: ${entry.id}.`);
    if (entry.semantic && (!Array.isArray(entry.actions) || entry.actions.length === 0 || entry.actions.some((action) => typeof action !== "string" || !action))) throw new Error(`Semantic validator must declare actions: ${entry.id}.`);
    if (loaded.has(entry.id)) throw new Error(`Duplicate validator id: ${entry.id}.`);

    const modulePath = path.resolve(validatorsDir, entry.module);
    if (path.dirname(modulePath) !== validatorsDir) throw new Error(`Validator module escapes validator directory: ${entry.module}.`);

    let validator;
    let moduleHash;
    try {
      // Reject symlinked or non-regular module files: the path-escape check above
      // only constrains the entry path, but a symlink inside the directory can
      // still redirect require()/readFile to code outside the reviewed set.
      const moduleStat = fs.lstatSync(modulePath);
      if (!moduleStat.isFile()) throw new Error("validator module is not a regular file");
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
    if (Boolean(validator.semantic) !== Boolean(entry.semantic)) throw new Error(`Validator semantic flag mismatch: ${entry.id}.`);
    if (entry.semantic && canonicalStringify([...(validator.actions || [])].sort()) !== canonicalStringify([...entry.actions].sort())) throw new Error(`Validator action binding mismatch: ${entry.id}.`);
    if (canonicalStringify([...validator.supportedPhases].sort()) !== canonicalStringify([...entry.supportedPhases].sort())) {
      throw new Error(`Validator supportedPhases mismatch: ${entry.id}.`);
    }

    loaded.set(entry.id, validator);
    const closure = buildValidatorClosure(modulePath, projectRoot);
    descriptors.set(entry.id, Object.freeze({
      id: entry.id, version: entry.version, modulePath, moduleHash,
      semantic: Boolean(entry.semantic), actions: [...(entry.actions || [])].sort(),
      supportedPhases: [...entry.supportedPhases].sort(),
      closure: Object.freeze({ closureRoot: closure.closureRoot, rootPolicy: closure.rootPolicy, entryRelPath: closure.entryRelPath, modules: closure.manifest, builtins: closure.builtins, closureHash: closure.closureHash })
    }));
    canonicalEntries.push({ id: entry.id, version: entry.version, module: entry.module, moduleHash, closureHash: closure.closureHash, rootPolicyVersion: closure.rootPolicy.version, semantic: Boolean(entry.semantic), actions: [...(entry.actions || [])].sort(), supportedPhases: [...entry.supportedPhases].sort() });
  }

  canonicalEntries.sort((a, b) => a.id.localeCompare(b.id));
  const validatorSetHash = sha256(canonicalStringify({ version: registry.version || null, rootPolicyVersion: (canonicalEntries[0] && canonicalEntries[0].rootPolicyVersion) || null, validators: canonicalEntries }));
  return { loaded, descriptors, validatorSetHash, entries: canonicalEntries };
}

// Resolve the policy-required validator DESCRIPTORS, failing closed if any is
// unavailable. Descriptors carry the modulePath + moduleHash so the execution
// boundary can prove the exact hashed bytes are executed.
function selectRequiredValidators(policy, descriptors) {
  if (!Array.isArray(policy.requiredValidators) || policy.requiredValidators.length === 0) throw new Error("Execution policy must declare requiredValidators.");
  return policy.requiredValidators.map((id) => {
    const descriptor = descriptors.get(id);
    if (!descriptor) throw new Error(`Execution policy references an unavailable mandatory validator: ${id}.`);
    return descriptor;
  });
}

// Descriptors (from the required set) that support a given phase.
function validatorsForPhase(required, phase) {
  return required.filter((descriptor) => descriptor.supportedPhases.includes(phase));
}

module.exports = { loadValidatorRegistry, selectRequiredValidators, validatorsForPhase };
