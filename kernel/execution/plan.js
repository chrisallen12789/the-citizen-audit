const fs = require("fs");
const path = require("path");
const { computeWriteSetHash } = require("../transactions/validate");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadInstitutionRegistry(rootDir) {
  const registry = readJson(path.join(rootDir, "kernel", "registry", "institution.json"));
  if (!Array.isArray(registry.objects)) throw new Error("Institution registry objects must be an array.");
  return registry;
}

function normalizePrefix(prefix) {
  if (typeof prefix !== "string" || !prefix) throw new Error("Execution policy contains an invalid path prefix.");
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function pathMatches(relativePath, exactPaths = [], prefixes = []) {
  return exactPaths.includes(relativePath) || prefixes.some((prefix) => relativePath.startsWith(normalizePrefix(prefix)));
}

function downstreamImpact(registry, affectedObjects) {
  const reverse = new Map();
  for (const object of registry.objects) {
    for (const dependency of Array.isArray(object.dependsOn) ? object.dependsOn : []) {
      if (!reverse.has(dependency)) reverse.set(dependency, []);
      reverse.get(dependency).push(object.id);
    }
  }
  const impacted = new Set(affectedObjects);
  const queue = [...affectedObjects];
  while (queue.length) {
    const current = queue.shift();
    for (const dependent of (reverse.get(current) || []).sort()) {
      if (!impacted.has(dependent)) {
        impacted.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return [...impacted].sort();
}

function objectForPath(registry, relativePath) {
  const matches = registry.objects
    .filter((object) => typeof object.path === "string")
    .filter((object) => relativePath === object.path || relativePath.startsWith(object.path.endsWith("/") ? object.path : `${object.path}/`))
    .sort((a, b) => b.path.length - a.path.length);
  return matches[0] || null;
}

function buildExecutionPlan(transaction, policy, registry) {
  const actionPolicy = policy.actions && policy.actions[transaction.action];
  if (!actionPolicy) throw new Error(`Execution policy does not authorize action: ${transaction.action}.`);
  const registryIds = new Set(registry.objects.map((object) => object.id));
  for (const objectId of transaction.affectedObjects) if (!registryIds.has(objectId)) throw new Error(`Transaction references unknown affected object: ${objectId}.`);

  const writes = transaction.proposedWrites.map((write) => {
    if (pathMatches(write.path, policy.prohibitedPaths || [], policy.prohibitedPrefixes || [])) throw new Error(`Prohibited execution path: ${write.path}.`);
    if (!pathMatches(write.path, actionPolicy.allowedPaths || [], actionPolicy.allowedPrefixes || [])) throw new Error(`Path is outside action policy: ${write.path}.`);
    if (write.operation === "delete" && !actionPolicy.allowDelete) throw new Error(`Delete is not authorized for action ${transaction.action}: ${write.path}.`);
    const registeredObject = objectForPath(registry, write.path);
    if (policy.requireAffectedObjectCoverage && (!registeredObject || !transaction.affectedObjects.includes(registeredObject.id))) {
      throw new Error(`Write path is not covered by the transaction affected objects: ${write.path}.`);
    }
    return Object.freeze({ ...write, registeredObjectId: registeredObject ? registeredObject.id : null });
  });

  return Object.freeze({
    action: transaction.action,
    affectedObjects: Object.freeze([...transaction.affectedObjects].sort()),
    impactedObjects: Object.freeze(downstreamImpact(registry, transaction.affectedObjects)),
    validatorIds: Object.freeze([...(policy.requiredValidators || [])]),
    writeSetHash: computeWriteSetHash(transaction.proposedWrites),
    writes: Object.freeze(writes)
  });
}

module.exports = { buildExecutionPlan, downstreamImpact, loadInstitutionRegistry, pathMatches, readJson };
