const { validateRegistry } = require("../../registry/validate");
const { dependencyReferenceProblems } = require("../../registry/dependency-checks");

module.exports = {
  id: "institution-registry",
  version: "1.0.0",
  validate({ rootDir, state }) {
    const registryPath = "kernel/registry/institution.json";
    let registry;
    try {
      registry = JSON.parse(state.readFile(registryPath, "utf8"));
    } catch (error) {
      return { status: "failed", problems: [`Institution registry is unreadable: ${error.message}`], warnings: [], checkedObjects: [], checkedPaths: [registryPath] };
    }
    const result = validateRegistry(registry, { rootDir, exists: (relativePath) => state.exists(relativePath.endsWith("/") ? relativePath.slice(0, -1) : relativePath) });
    result.problems.push(...dependencyReferenceProblems(Array.isArray(registry.objects) ? registry.objects : []));
    return {
      status: result.problems.length ? "failed" : "passed",
      problems: result.problems,
      warnings: result.warnings,
      checkedObjects: Array.isArray(registry.objects) ? registry.objects.map((item) => item.id) : [],
      checkedPaths: [registryPath]
    };
  }
};
