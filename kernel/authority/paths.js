const path = require("path");
const repositoryRoot = path.resolve(__dirname, "..", "..");
function authorityPaths(rootDir = repositoryRoot) {
  return {
    registryPath: path.join(rootDir, "agents", "registry.json"),
    rulesPath: path.join(rootDir, "kernel", "permissions", "rules.json"),
    levelsPath: path.join(rootDir, "kernel", "permissions", "authority-levels.json")
  };
}
module.exports = { authorityPaths, repositoryRoot };
