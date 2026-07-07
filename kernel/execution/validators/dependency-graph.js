const fs = require("fs");
const path = require("path");
const { dependencyCycles } = require("../../registry/dependency-checks");

// Dependency validity validator.
// Verifies that every dependency reference resolves to a registered object and
// that the dependency graph contains no cycles. Deterministic traversal and
// deterministic error ordering. Supported in both phases.
function validate(context) {
  const problems = [];
  const registryFile = path.join(context.rootDir, "kernel", "registry", "institution.json");
  if (!fs.existsSync(registryFile)) {
    return { status: "failed", problems: ["Institution registry not found for dependency validation."], warnings: [], checkedObjects: [], checkedPaths: [] };
  }
  let objects;
  try {
    const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
    objects = Array.isArray(registry.objects) ? registry.objects : [];
  } catch (error) {
    return { status: "failed", problems: [`Institution registry is not valid JSON: ${error.message}.`], warnings: [], checkedObjects: [], checkedPaths: [] };
  }

  const ids = new Set(objects.map((object) => object.id));
  const dangling = [];
  for (const object of objects) {
    for (const dependency of Array.isArray(object.dependsOn) ? object.dependsOn : []) {
      if (!ids.has(dependency)) dangling.push(`${object.id} -> ${dependency}`);
    }
  }
  for (const reference of [...new Set(dangling)].sort()) problems.push(`Unresolved dependency reference: ${reference}.`);

  const cycles = dependencyCycles(objects).map((cycle) => cycle.join(" -> ")).sort();
  for (const cycle of cycles) problems.push(`Dependency cycle detected: ${cycle}.`);

  return {
    status: problems.length ? "failed" : "passed",
    problems,
    warnings: [],
    checkedObjects: [...ids].sort(),
    checkedPaths: ["kernel/registry/institution.json"]
  };
}

module.exports = { id: "dependency-graph", version: "1.0.0", supportedPhases: ["post_write"], validate };
