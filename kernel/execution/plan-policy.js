function normalizePrefix(prefix) {
  if (typeof prefix !== "string" || !prefix) throw new Error("Execution policy contains an invalid path prefix.");
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}
function pathMatches(relativePath, exactPaths = [], prefixes = []) {
  return exactPaths.includes(relativePath) || prefixes.some((prefix) => relativePath.startsWith(normalizePrefix(prefix)));
}
function validatePlannedWrite(transaction, policy, actionPolicy, registry, objectForPath, write) {
  if (pathMatches(write.path, policy.prohibitedPaths || [], policy.prohibitedPrefixes || [])) throw new Error(`Prohibited execution path: ${write.path}.`);
  if (!pathMatches(write.path, actionPolicy.allowedPaths || [], actionPolicy.allowedPrefixes || [])) throw new Error(`Path is outside action policy: ${write.path}.`);
  if (write.operation !== "write" && !actionPolicy.allowDelete) throw new Error(`Non-file operation is not authorized for action ${transaction.action}: ${write.path}.`);
  const registeredObject = objectForPath(registry, write.path);
  if (policy.requireAffectedObjectCoverage && (!registeredObject || !transaction.affectedObjects.includes(registeredObject.id))) throw new Error(`Write path is not covered by the transaction affected objects: ${write.path}.`);
  return { ...write, registeredObjectId: registeredObject ? registeredObject.id : null };
}
module.exports = { normalizePrefix, pathMatches, validatePlannedWrite };
