const { dependencyCycles } = require("../../registry/dependency-checks");

module.exports = {
  id: "dependency-cycles",
  version: "1.0.0",
  validate({ state }) {
    const registryPath = "kernel/registry/institution.json";
    const registry = JSON.parse(state.readFile(registryPath, "utf8"));
    const objects = Array.isArray(registry.objects) ? registry.objects : [];
    const cycles = dependencyCycles(objects);
    const problems = cycles.map((cycle) => `Dependency cycle: ${cycle.join(" -> ")}.`);
    return {
      status: problems.length ? "failed" : "passed",
      problems,
      warnings: [],
      checkedObjects: objects.map((item) => item.id),
      checkedPaths: [registryPath]
    };
  }
};
