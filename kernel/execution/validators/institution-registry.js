const { validateRegistryAtRoot } = require("../../registry/validate");

module.exports = {
  id: "institution-registry",
  validate({ rootDir }) {
    return validateRegistryAtRoot(rootDir);
  }
};
