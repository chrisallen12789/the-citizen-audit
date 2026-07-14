const fs = require("fs");
const { authorityPaths, repositoryRoot } = require("./paths");
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function loadAuthorityState(options = {}) {
  const paths = authorityPaths(options.rootDir || repositoryRoot);
  return {
    registry: readJson(options.registryPath || paths.registryPath),
    rules: readJson(options.rulesPath || paths.rulesPath),
    levels: readJson(options.levelsPath || paths.levelsPath)
  };
}
module.exports = { loadAuthorityState, readJson };
