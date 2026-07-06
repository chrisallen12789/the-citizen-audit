const fs = require("fs");
const path = require("path");
const { durableInstitutionWrite } = require("./durable-institution-write");
const { institutionFile } = require("./path-safety");
const { preserveArtifact } = require("./preserve-artifact");

function restoreExistingFile(rootDir, snapshot) {
  if (!snapshot.existed) throw new Error(`Cannot restore a missing preimage: ${snapshot.path}.`);
  const target = institutionFile(rootDir, snapshot.path);
  if (fs.existsSync(target)) preserveArtifact(target, `rollback-prior-${path.basename(target)}`);
  return durableInstitutionWrite(rootDir, snapshot.path, snapshot.bytes, snapshot.mode || 0o600);
}

module.exports = { restoreExistingFile };
