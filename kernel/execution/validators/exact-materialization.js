const { validateMaterialization } = require("./exact-materialization-check");

module.exports = {
  id: "exact-materialization",
  version: "1.0.0",
  validate: validateMaterialization
};
