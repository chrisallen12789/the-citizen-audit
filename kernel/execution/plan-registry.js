const fs = require("fs");
const path = require("path");
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function loadInstitutionRegistry(rootDir) {
  const registry = readJson(path.join(rootDir, "kernel", "registry", "institution.json"));
  if (!Array.isArray(registry.objects)) throw new Error("Institution registry objects must be an array.");
  return registry;
}
function downstreamImpact(registry, affectedObjects) {
  const reverse = new Map();
  for (const object of registry.objects) for (const dependency of Array.isArray(object.dependsOn) ? object.dependsOn : []) {
    if (!reverse.has(dependency)) reverse.set(dependency, []);
    reverse.get(dependency).push(object.id);
  }
  const impacted = new Set(affectedObjects);
  const queue = [...affectedObjects];
  while (queue.length) {
    const current = queue.shift();
    for (const dependent of (reverse.get(current) || []).sort()) if (!impacted.has(dependent)) { impacted.add(dependent); queue.push(dependent); }
  }
  return [...impacted].sort();
}
function objectForPath(registry, relativePath) {
  return registry.objects
    .filter((object) => typeof object.path === "string")
    .filter((object) => relativePath === object.path || relativePath.startsWith(object.path.endsWith("/") ? object.path : `${object.path}/`))
    .sort((a, b) => b.path.length - a.path.length || a.id.localeCompare(b.id))[0] || null;
}
module.exports = { downstreamImpact, loadInstitutionRegistry, objectForPath, readJson };
