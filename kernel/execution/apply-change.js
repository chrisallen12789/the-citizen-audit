const fs = require("fs");
const path = require("path");
const { decodeWriteContent } = require("../transactions/validate");
const { durableInstitutionWrite } = require("./durable-institution-write");
const { institutionFile } = require("./path-safety");
const { missingParentDirectories } = require("./parent-directories");
const { preserveArtifact } = require("./preserve-artifact");

function applyDeclaredChange(rootDir, write) {
  const target = institutionFile(rootDir, write.path);
  const createdDirectories = missingParentDirectories(rootDir, write.path);
  if (fs.existsSync(target)) preserveArtifact(target, `promotion-prior-${path.basename(target)}`);
  durableInstitutionWrite(rootDir, write.path, decodeWriteContent(write), 0o600);
  return { createdDirectories };
}

module.exports = { applyDeclaredChange };
