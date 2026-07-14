const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const { canonicalStringify } = require("../../lib/canonical-json");
const { sha256 } = require("../../lib/append-only-log");
const { VALIDATION_PHASES } = require("../validation-results");

const SEMVER = /^\d+\.\d+\.\d+$/;
const VALIDATOR_RUNNER_VERSION = "2.0.0";
const VALIDATOR_REGISTRY_LOADER_VERSION = "2.0.0";
const PRODUCTION_ROOT_POLICY_ID = "authoritative-reviewed-repository-root";
const PRODUCTION_VALIDATORS_DIR = __dirname;
const VALIDATOR_RUNNER_PATH = path.join(__dirname, "..", "validator-worker.js");
const VALIDATOR_CLOSURE_IMPLEMENTATION_PATH = __filename;
const UNSAFE_VALIDATOR_IDS = new Set(["__proto__", "prototype", "constructor"]);
const ROOT_POLICY_VERSION = "1.0.0";
const BUILTIN_ALLOWLIST = new Set(["path", "crypto", "util", "assert", "buffer", "os"]);
const STRUCTURAL_FS = "fs";
const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, "..", "..", ".."));
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";
const OVERLY_BROAD_ROOTS = new Set(["/", "/usr", "/bin", "/sbin", "/lib", "/etc", "/home", "/root", "/tmp", "/var", "/opt", "/mnt", "/proc", "/sys", "/dev"]);

function assertSafeValidatorId(id, label) {
  if (typeof id !== "string" || !id) throw new Error(`${label} must be a non-empty string.`);
  if (UNSAFE_VALIDATOR_IDS.has(id)) throw new Error(`${label} uses an unsafe validator id: ${id}.`);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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

function resolveAuthoritativeRoot(root) {
  if (!root || typeof root !== "string") throw fail("CLOSURE_ROOT_INVALID", "Authoritative project root is required.");
  let real;
  try { real = fs.realpathSync(path.resolve(root)); } catch (error) { throw fail("CLOSURE_ROOT_INVALID", `Authoritative root does not exist: ${root}`); }
  const stat = fs.lstatSync(real);
  if (!stat.isDirectory()) throw fail("CLOSURE_ROOT_INVALID", `Authoritative root is not a directory: ${real}`);
  if (OVERLY_BROAD_ROOTS.has(real)) throw fail("CLOSURE_ROOT_TOO_BROAD", `Authoritative root is overly broad: ${real}`);
  const segments = real.split(path.sep).filter(Boolean);
  if (segments.length < 2) throw fail("CLOSURE_ROOT_TOO_BROAD", `Authoritative root is too shallow: ${real}`);
  return real;
}

function isLocalSpecifier(spec) {
  return typeof spec === "string" && (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/"));
}

function extractRequires(source, label) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true, locations: true });
  const specifiers = [];
  (function walk(node) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && node.callee.name === "require") {
      const arg = node.arguments && node.arguments[0];
      if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") throw fail("CLOSURE_DYNAMIC_REQUIRE", `${label}: dynamic or non-literal require is not permitted in validator closures.`);
      specifiers.push(arg.value);
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach((candidate) => candidate && typeof candidate.type === "string" && walk(candidate));
      else if (child && typeof child.type === "string") walk(child);
    }
  })(ast);
  return specifiers;
}

function inspectAndRead(absLexical, realRoot) {
  const relLex = path.relative(realRoot, absLexical);
  if (relLex === "" || relLex.startsWith("..") || path.isAbsolute(relLex)) throw fail("CLOSURE_ESCAPE", `Dependency escapes authoritative root: ${absLexical}`);
  let fd;
  try { fd = fs.openSync(absLexical, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (error) { if (error.code === "ELOOP") throw fail("CLOSURE_SYMLINK", `Validator closure module is a symlink: ${absLexical}`); throw error; }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw fail("CLOSURE_NONREGULAR", `Validator closure module is not a regular file: ${absLexical}`);
    if (stat.nlink > 1) throw fail("CLOSURE_HARDLINK", `Validator closure module is hard-linked (nlink=${stat.nlink}): ${absLexical}`);
    if (ENFORCE_POSIX_WRITE_BITS && (stat.mode & 0o022)) throw fail("CLOSURE_WRITABLE", `Validator closure module is group/world-writable (mode=${(stat.mode & 0o777).toString(8)}): ${absLexical}`);
    const real = fs.realpathSync(absLexical);
    if (real !== absLexical || path.relative(realRoot, real).startsWith("..")) throw fail("CLOSURE_ESCAPE", `Dependency resolves outside authoritative root via symlink: ${absLexical}`);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < stat.size) {
      const read = fs.readSync(fd, bytes, offset, stat.size - offset, offset);
      if (read <= 0) break;
      offset += read;
    }
    const data = bytes.subarray(0, offset);
    return {
      bytes: data,
      hash: sha256(data),
      meta: { size: stat.size, mode: stat.mode & 0o777, uid: stat.uid, gid: stat.gid, dev: String(stat.dev), ino: String(stat.ino), nlink: stat.nlink }
    };
  } finally {
    fs.closeSync(fd);
  }
}

function resolveLocal(fromDir, spec, realRoot) {
  if (spec.startsWith("/")) throw fail("CLOSURE_ABSOLUTE", `Absolute dependency specifier is not permitted: ${spec}`);
  const base = path.resolve(fromDir, spec);
  const candidates = base.endsWith(".js") ? [base] : [base, `${base}.js`, path.join(base, "index.js")];
  for (const candidate of candidates) {
    const rel = path.relative(realRoot, candidate);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw fail("CLOSURE_ESCAPE", `Dependency escapes authoritative root: ${spec} from ${fromDir}`);
    let exists = false;
    try { exists = fs.lstatSync(candidate) && true; } catch { exists = false; }
    if (exists) return candidate;
  }
  throw fail("CLOSURE_MISSING", `Validator closure dependency not found inside root: ${spec} from ${fromDir}`);
}

function buildValidatorClosure(entryModulePath, projectRoot = REPO_ROOT) {
  const realRoot = resolveAuthoritativeRoot(projectRoot);
  const entryAbs = path.resolve(entryModulePath);
  const collected = new Map();
  const builtins = new Set();
  let usesFs = false;

  const visit = (absPath) => {
    if (collected.has(absPath)) return;
    const { bytes, hash, meta } = inspectAndRead(absPath, realRoot);
    const source = bytes.toString("utf8");
    collected.set(absPath, { hash, source, meta });
    for (const spec of extractRequires(source, absPath)) {
      if (isLocalSpecifier(spec)) visit(resolveLocal(path.dirname(absPath), spec, realRoot));
      else {
        const builtin = spec.startsWith("node:") ? spec.slice(5) : spec;
        if (builtin === STRUCTURAL_FS) { usesFs = true; builtins.add("fs"); }
        else if (BUILTIN_ALLOWLIST.has(builtin)) builtins.add(builtin);
        else throw fail("CLOSURE_BUILTIN_DENIED", `Validator closure requires a non-allowlisted module: ${spec} (in ${absPath})`);
      }
    }
  };

  if (path.relative(realRoot, entryAbs).startsWith("..")) throw fail("CLOSURE_ESCAPE", `Validator entry module is outside authoritative root: ${entryAbs}`);
  visit(entryAbs);

  const toRel = (absPath) => path.relative(realRoot, absPath).split(path.sep).join("/");
  const modules = [...collected.keys()]
    .map((absPath) => ({ relPath: toRel(absPath), absPath, hash: collected.get(absPath).hash, source: collected.get(absPath).source, meta: collected.get(absPath).meta }))
    .sort((left, right) => left.relPath.localeCompare(right.relPath));
  const fullManifest = modules.map((moduleEntry) => ({ relPath: moduleEntry.relPath, hash: moduleEntry.hash, ...moduleEntry.meta }));
  const boundManifest = modules.map((moduleEntry) => ({ relPath: moduleEntry.relPath, hash: moduleEntry.hash, size: moduleEntry.meta.size, mode: moduleEntry.meta.mode }));
  const rootPolicy = {
    version: ROOT_POLICY_VERSION,
    enforced: ["authoritative-root", "root-relative", "no-absolute-spec", "no-parent-escape", "no-symlink", "regular-file", "nlink==1", ...(ENFORCE_POSIX_WRITE_BITS ? ["not-group-world-writable"] : []), "no-overly-broad-root"]
  };
  const closureHash = sha256(canonicalStringify({ rootPolicy, builtins: [...builtins].sort(), modules: boundManifest }));
  return {
    closureRoot: realRoot,
    rootPolicy,
    entryRelPath: toRel(entryAbs),
    modules,
    manifest: fullManifest,
    builtins: [...builtins].sort(),
    usesFs,
    closureHash
  };
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
    hash: sha256(fs.readFileSync(VALIDATOR_CLOSURE_IMPLEMENTATION_PATH))
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

function loadValidatorRegistry(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "validatorsDir")) {
    throw new Error("Production validator registry rejects caller-selected validatorsDir.");
  }
  if (Object.prototype.hasOwnProperty.call(options, "projectRoot")) {
    throw new Error("Production validator registry rejects caller-selected projectRoot.");
  }
  if (Object.prototype.hasOwnProperty.call(options, "mode")) {
    throw new Error("Production validator registry rejects test-mode selection.");
  }
  if (Object.keys(options).length !== 0) {
    throw new Error("Production validator registry accepts no source-location overrides.");
  }
  return buildValidatorRegistry(PRODUCTION_VALIDATORS_DIR, REPO_ROOT);
}

function selectRequiredValidators(policy, descriptors) {
  if (!Array.isArray(policy.requiredValidators) || policy.requiredValidators.length === 0) throw new Error("Execution policy must declare requiredValidators.");
  return deepFreeze(policy.requiredValidators.map((id) => {
    const descriptor = descriptors.get(id);
    if (!descriptor) throw new Error(`Execution policy references an unavailable mandatory validator: ${id}.`);
    return descriptor;
  }));
}

function validatorsForPhase(required, phase) {
  return deepFreeze(required.filter((descriptor) => descriptor.supportedPhases.includes(phase)));
}

module.exports = {
  PRODUCTION_ROOT_POLICY_ID,
  VALIDATOR_REGISTRY_LOADER_VERSION,
  VALIDATOR_RUNNER_VERSION,
  extractStaticValidatorContract,
  loadValidatorRegistry,
  selectRequiredValidators,
  validatorsForPhase
};
