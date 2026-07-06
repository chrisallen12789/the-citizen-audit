const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const VALID_PHASES = new Set(["candidate", "post_write"]);

function defaultValidatorRegistryPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "execution", "validators", "registry.json");
}

function validateRegistryDocument(document) {
  const problems = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { valid: false, problems: ["Validator registry must be an object."] };
  if (typeof document.version !== "string" || !/^\d+\.\d+\.\d+$/.test(document.version)) problems.push("Validator registry version is invalid.");
  if (!Array.isArray(document.validators) || !document.validators.length) problems.push("Validator registry must contain validators.");
  const ids = new Set();
  for (const item of document.validators || []) {
    const label = item && item.id ? item.id : "UNKNOWN";
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      problems.push("Validator registration must be an object.");
      continue;
    }
    if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(item.id)) problems.push(`${label}: invalid id.`);
    if (ids.has(item.id)) problems.push(`${label}: duplicate id.`);
    ids.add(item.id);
    if (typeof item.version !== "string" || !/^\d+\.\d+\.\d+$/.test(item.version)) problems.push(`${label}: invalid version.`);
    if (typeof item.module !== "string" || !item.module.endsWith(".js") || item.module.includes("\\") || path.posix.normalize(item.module) !== item.module || item.module.startsWith("../") || item.module.startsWith("/")) problems.push(`${label}: invalid module path.`);
    if (!Array.isArray(item.phases) || !item.phases.length || item.phases.some((phase) => !VALID_PHASES.has(phase))) problems.push(`${label}: invalid phases.`);
    if (typeof item.scope !== "string" || !item.scope.trim()) problems.push(`${label}: scope is required.`);
    if (item.deterministic !== true) problems.push(`${label}: validator must be deterministic.`);
    if (!Number.isInteger(item.timeoutMs) || item.timeoutMs < 1 || item.timeoutMs > 60000) problems.push(`${label}: timeoutMs must be an integer from 1 to 60000.`);
  }
  return { valid: problems.length === 0, problems };
}

function loadValidatorRegistry(options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const registryPath = options.validatorRegistryPath || defaultValidatorRegistryPath(rootDir);
  const document = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const validation = validateRegistryDocument(document);
  if (!validation.valid) {
    const error = new Error(`Invalid validator registry:\n- ${validation.problems.join("\n- ")}`);
    error.code = "INVALID_VALIDATOR_REGISTRY";
    error.problems = validation.problems;
    throw error;
  }
  const baseDirectory = path.dirname(registryPath);
  const validators = [...document.validators]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => {
      const modulePath = path.resolve(baseDirectory, item.module);
      const relative = path.relative(baseDirectory, modulePath);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Validator module escapes registry directory: ${item.id}.`);
      const stat = fs.lstatSync(modulePath);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Validator module is not a regular file: ${item.id}.`);
      const moduleHash = sha256(fs.readFileSync(modulePath));
      const resolvedModulePath = require.resolve(modulePath);
      delete require.cache[resolvedModulePath];
      const implementation = require(resolvedModulePath);
      if (!implementation || implementation.id !== item.id || implementation.version !== item.version || typeof implementation.validate !== "function") throw new Error(`Validator module contract mismatch: ${item.id}.`);
      return Object.freeze({ ...item, modulePath, moduleHash, implementation });
    });
  const binding = {
    version: document.version,
    validators: validators.map(({ implementation, modulePath, ...item }) => item)
  };
  return Object.freeze({
    document: Object.freeze(document),
    validators: Object.freeze(validators),
    registryPath,
    validatorSetHash: sha256(canonicalStringify(binding))
  });
}

module.exports = { VALID_PHASES, defaultValidatorRegistryPath, loadValidatorRegistry, validateRegistryDocument };
