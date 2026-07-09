const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const { canonicalStringify } = require("../../kernel/lib/canonical-json");
const { sha256 } = require("../../kernel/lib/append-only-log");
const { VALIDATION_PHASES } = require("../../kernel/execution/validation-results");
const {
  buildValidatorClosure,
  inspectAndRead,
  resolveAuthoritativeRoot,
  REPO_ROOT,
  ROOT_POLICY_VERSION
} = require("../../kernel/execution/validator-closure");

const SEMVER = /^\d+\.\d+\.\d+$/;
const VALIDATOR_RUNNER_VERSION = "2.0.0";
const VALIDATOR_REGISTRY_LOADER_VERSION = "2.0.0";
const PRODUCTION_ROOT_POLICY_ID = "authoritative-reviewed-repository-root";
const PRODUCTION_VALIDATORS_DIR = path.join(__dirname, "..", "..", "kernel", "execution", "validators");
const VALIDATOR_RUNNER_PATH = path.join(__dirname, "..", "..", "kernel", "execution", "validator-worker.js");
const VALIDATOR_CLOSURE_LOADER_PATH = path.join(__dirname, "..", "..", "kernel", "execution", "validator-closure.js");
const UNSAFE_VALIDATOR_IDS = new Set(["__proto__", "prototype", "constructor"]);

function assertSafeValidatorId(id, label) {
  if (typeof id !== "string" || !id) throw new Error(`${label} must be a non-empty string.`);
  if (UNSAFE_VALIDATOR_IDS.has(id)) throw new Error(`${label} uses an unsafe validator id: ${id}.`);
}

function assertSupportedPhases(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must declare supportedPhases.`);
  for (const phase of value) {
    if (!VALIDATION_PHASES.includes(phase)) throw new Error(`${label} declares an unsupported phase: ${phase}.`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return value;
  }
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function sameSet(left, right) {
  return canonicalStringify([...left].sort()) === canonicalStringify([...right].sort());
}

function readStaticString(node, label) {
  if (!node || node.type !== "Literal" || typeof node.value !== "string" || !node.value) {
    throw new Error(`${label} must be a static non-empty string literal.`);
  }
  return node.value;
}

function readStaticBoolean(node, label) {
  if (!node || node.type !== "Literal" || typeof node.value !== "boolean") {
    throw new Error(`${label} must be a static boolean literal.`);
  }
  return node.value;
}

function readStaticStringArray(node, label) {
  if (!node || node.type !== "ArrayExpression") throw new Error(`${label} must be a static string-literal array.`);
  return node.elements.map((element, index) => {
    if (!element || element.type !== "Literal" || typeof element.value !== "string" || !element.value) {
      throw new Error(`${label}[${index}] must be a static non-empty string literal.`);
    }
    return element.value;
  });
}

function isModuleExportsTarget(node) {
  return Boolean(
    node
    && node.type === "MemberExpression"
    && node.computed === false
    && node.object
    && node.object.type === "Identifier"
    && node.object.name === "module"
    && node.property
    && node.property.type === "Identifier"
    && node.property.name === "exports"
  );
}

function extractStaticValidatorContract(source, label) {
  let ast;
  try {
    ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true });
  } catch (error) {
    throw new Error(`Validator contract is not valid JavaScript: ${label} (${error.message}).`);
  }

  let contractObject = null;
  for (const statement of ast.body) {
    if (!statement || statement.type !== "ExpressionStatement") continue;
    const expression = statement.expression;
    if (!expression || expression.type !== "AssignmentExpression" || expression.operator !== "=") continue;
    if (!isModuleExportsTarget(expression.left)) continue;
    if (expression.right.type !== "ObjectExpression") {
      throw new Error(`Validator contract must assign a static object literal to module.exports: ${label}.`);
    }
    contractObject = expression.right;
  }
  if (!contractObject) throw new Error(`Validator contract must assign a static object literal to module.exports: ${label}.`);

  const fields = new Map();
  for (const property of contractObject.properties) {
    if (!property || property.type !== "Property" || property.computed || property.kind !== "init") {
      throw new Error(`Validator contract uses unsupported dynamic property syntax: ${label}.`);
    }
    const key = property.key.type === "Identifier"
      ? property.key.name
      : property.key.type === "Literal" && typeof property.key.value === "string"
        ? property.key.value
        : null;
    if (!key) throw new Error(`Validator contract property names must be static literals: ${label}.`);
    if (fields.has(key)) throw new Error(`Validator contract declares duplicate property ${key}: ${label}.`);
    fields.set(key, property.value);
  }

  const id = readStaticString(fields.get("id"), `${label} id`);
  assertSafeValidatorId(id, `${label} id`);
  const version = readStaticString(fields.get("version"), `${label} version`);
  if (!SEMVER.test(version)) throw new Error(`${label} version must be semantic (x.y.z).`);
  const semantic = fields.has("semantic") ? readStaticBoolean(fields.get("semantic"), `${label} semantic`) : false;
  const actions = fields.has("actions") ? readStaticStringArray(fields.get("actions"), `${label} actions`) : [];
  const supportedPhases = readStaticStringArray(fields.get("supportedPhases"), `${label} supportedPhases`);
  assertSupportedPhases(supportedPhases, `${label} contract`);
  if (semantic && actions.length === 0) throw new Error(`${label} semantic validator must declare static actions.`);
  if (!fields.has("validate")) throw new Error(`${label} must export validate.`);

  return deepFreeze({
    id,
    version,
    semantic,
    actions: [...actions].sort(),
    supportedPhases: [...supportedPhases].sort()
  });
}

function validatorRuntimeIdentity() {
  return deepFreeze({
    version: VALIDATOR_RUNNER_VERSION,
    hash: sha256(fs.readFileSync(VALIDATOR_RUNNER_PATH))
  });
}

function closureLoaderIdentity() {
  return deepFreeze({
    version: VALIDATOR_REGISTRY_LOADER_VERSION,
    hash: sha256(fs.readFileSync(VALIDATOR_CLOSURE_LOADER_PATH))
  });
}

function createImmutableLookup(map) {
  const byId = Object.create(null);
  for (const [key, value] of map.entries()) byId[key] = value;
  deepFreeze(byId);
  const keys = Object.freeze(Object.keys(byId));
  const values = Object.freeze(keys.map((key) => byId[key]));
  const entries = Object.freeze(keys.map((key) => Object.freeze([key, byId[key]])));
  const api = {
    size: keys.length,
    get(id) {
      return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : undefined;
    },
    has(id) {
      return Object.prototype.hasOwnProperty.call(byId, id);
    },
    keys() {
      return keys;
    },
    values() {
      return values;
    },
    entries() {
      return entries;
    },
    forEach(callback, thisArg) {
      for (const [key, value] of entries) callback.call(thisArg, value, key, api);
    }
  };
  Object.defineProperty(api, Symbol.iterator, {
    value: function* iterator() {
      yield* entries;
    }
  });
  return Object.freeze(api);
}

function buildValidatorRegistry(validatorsDir, projectRoot) {
  const realValidatorsDir = fs.realpathSync(validatorsDir);
  if (realValidatorsDir !== projectRoot && path.relative(projectRoot, realValidatorsDir).startsWith("..")) {
    throw new Error(`Validators directory is outside the authoritative project root: ${validatorsDir}.`);
  }
  const registryPath = path.join(validatorsDir, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry.validators)) throw new Error("Validator registry validators must be an array.");

  const contracts = new Map();
  const descriptors = new Map();
  const canonicalEntries = [];
  const runner = validatorRuntimeIdentity();
  const loader = closureLoaderIdentity();

  for (const entry of registry.validators) {
    if (!entry || typeof entry.id !== "string" || typeof entry.module !== "string") throw new Error("Validator registry contains an invalid entry.");
    assertSafeValidatorId(entry.id, "Validator registry entry id");
    if (typeof entry.version !== "string" || !SEMVER.test(entry.version)) throw new Error(`Validator registry entry omits a semantic version: ${entry.id}.`);
    assertSupportedPhases(entry.supportedPhases, `Validator registry entry ${entry.id}`);
    if (entry.semantic !== undefined && typeof entry.semantic !== "boolean") throw new Error(`Validator semantic flag is invalid: ${entry.id}.`);
    if (entry.semantic && (!Array.isArray(entry.actions) || entry.actions.length === 0 || entry.actions.some((action) => typeof action !== "string" || !action))) throw new Error(`Semantic validator must declare actions: ${entry.id}.`);
    if (contracts.has(entry.id)) throw new Error(`Duplicate validator id: ${entry.id}.`);

    const modulePath = path.resolve(validatorsDir, entry.module);
    if (path.dirname(modulePath) !== validatorsDir) throw new Error(`Validator module escapes validator directory: ${entry.module}.`);

    let closure;
    let moduleHash;
    let source;
    try {
      closure = buildValidatorClosure(modulePath, projectRoot);
      const inspected = inspectAndRead(modulePath, projectRoot);
      moduleHash = inspected.hash;
      source = inspected.bytes.toString("utf8");
    } catch (error) {
      throw new Error(`Validator module is unavailable: ${entry.id} (${error.message}).`);
    }

    const contract = extractStaticValidatorContract(source, `Validator module ${entry.id}`);
    if (contract.id !== entry.id) throw new Error(`Validator contract id mismatch: ${entry.id}.`);
    if (contract.version !== entry.version) throw new Error(`Validator version mismatch: ${entry.id}.`);
    if (Boolean(contract.semantic) !== Boolean(entry.semantic)) throw new Error(`Validator semantic flag mismatch: ${entry.id}.`);
    if (entry.semantic && !sameSet(contract.actions, entry.actions || [])) throw new Error(`Validator action binding mismatch: ${entry.id}.`);
    if (!sameSet(contract.supportedPhases, entry.supportedPhases || [])) throw new Error(`Validator supportedPhases mismatch: ${entry.id}.`);

    contracts.set(entry.id, contract);
    const descriptor = deepFreeze({
      id: contract.id,
      version: contract.version,
      modulePath,
      moduleHash,
      semantic: contract.semantic,
      actions: [...contract.actions],
      supportedPhases: [...contract.supportedPhases],
      closure: {
        closureRoot: closure.closureRoot,
        rootPolicy: deepFreeze({ ...closure.rootPolicy }),
        entryRelPath: closure.entryRelPath,
        modules: closure.manifest.map((moduleEntry) => deepFreeze({ ...moduleEntry })),
        builtins: [...closure.builtins],
        closureHash: closure.closureHash
      },
      contract
    });
    descriptors.set(entry.id, descriptor);
    canonicalEntries.push(deepFreeze({
      id: contract.id,
      version: contract.version,
      module: entry.module,
      moduleHash,
      contract,
      closureHash: closure.closureHash,
      closurePolicyVersion: closure.rootPolicy.version
    }));
  }

  canonicalEntries.sort((a, b) => a.id.localeCompare(b.id));
  const immutableContracts = createImmutableLookup(contracts);
  const immutableDescriptors = createImmutableLookup(descriptors);
  const validatorSetHash = sha256(canonicalStringify({
    version: registry.version || null,
    authoritativeRootPolicyId: PRODUCTION_ROOT_POLICY_ID,
    closurePolicyVersion: ROOT_POLICY_VERSION,
    validatorRunner: runner,
    closureLoader: loader,
    validators: canonicalEntries
  }));

  return deepFreeze({
    contracts: immutableContracts,
    descriptors: immutableDescriptors,
    validatorSetHash,
    entries: canonicalEntries,
    validatorRuntime: runner,
    closureLoaderRuntime: loader,
    authoritativeRootPolicyId: PRODUCTION_ROOT_POLICY_ID
  });
}

function loadValidatorRegistryAtDirectory(options = {}) {
  if (options.mode && options.mode !== "test") {
    throw new Error(`Unsupported test loader mode: ${options.mode}.`);
  }
  const validatorsDir = path.resolve(options.validatorsDir || PRODUCTION_VALIDATORS_DIR);
  const projectRoot = resolveAuthoritativeRoot(options.projectRoot || REPO_ROOT);
  return buildValidatorRegistry(validatorsDir, projectRoot);
}

module.exports = {
  PRODUCTION_ROOT_POLICY_ID,
  VALIDATOR_REGISTRY_LOADER_VERSION,
  VALIDATOR_RUNNER_VERSION,
  extractStaticValidatorContract,
  loadValidatorRegistryAtDirectory
};
