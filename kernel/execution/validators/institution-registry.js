const { validateRegistryAtRoot } = require("../../registry/validate");

// Institution registry validity validator.
// Validates the live institution registry under the governed root. Supported in
// both phases (the registry tree is a prohibited write target, so candidate and
// live state are identical, and this enforces the registry invariant).
function validate(context) {
  const result = validateRegistryAtRoot(context.rootDir);
  return {
    status: result.problems.length ? "failed" : "passed",
    problems: [...result.problems].sort(),
    warnings: [...result.warnings].sort(),
    checkedObjects: [],
    checkedPaths: ["kernel/registry/institution.json"]
  };
}

module.exports = { id: "institution-registry", version: "1.0.0", supportedPhases: ["post_write"], validate };
