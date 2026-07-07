const fs = require("fs");
const { sha256 } = require("../../lib/append-only-log");
const { decodeWriteContent } = require("../../transactions/validate");
const { institutionFile } = require("../path-safety");
const { readMutationJournal } = require("../mutation-journal");

// Exact write-set materialization validator (post-write only).
// Verifies live state exactly matches the declared write set, and that no
// undeclared path was mutated inside the governed execution boundary.
function validate(context) {
  const problems = [];
  const checkedPaths = [];
  const rootDir = context.rootDir;
  const writes = (context.plan && context.plan.writes) || [];
  const declaredPaths = new Set(writes.map((write) => write.path));

  for (const write of writes) {
    checkedPaths.push(write.path);
    let target;
    try {
      target = institutionFile(rootDir, write.path);
    } catch (error) {
      problems.push(`${write.path}: ${error.message}`);
      continue;
    }
    if (write.operation === "delete") {
      if (fs.existsSync(target)) problems.push(`${write.path}: declared delete but path still exists.`);
      continue;
    }
    if (!fs.existsSync(target)) {
      problems.push(`${write.path}: declared write is not materialized.`);
      continue;
    }
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      problems.push(`${write.path}: materialized path is not a regular file.`);
      continue;
    }
    let declaredBytes;
    try {
      declaredBytes = decodeWriteContent(write);
    } catch (error) {
      problems.push(`${write.path}: declared content is invalid (${error.message}).`);
      continue;
    }
    const liveHash = sha256(fs.readFileSync(target));
    if (liveHash !== sha256(declaredBytes)) problems.push(`${write.path}: materialized content hash does not match the declared write.`);
  }

  // Undeclared-mutation detection: every completed governed operation in the
  // mutation journal must correspond to a declared write path.
  if (context.attemptId) {
    try {
      const journal = readMutationJournal(rootDir, context.attemptId);
      for (const [, entry] of journal.started) {
        if (!declaredPaths.has(entry.path)) problems.push(`Undeclared path mutated inside execution boundary: ${entry.path}.`);
      }
    } catch (error) {
      problems.push(`Mutation journal could not be verified: ${error.message}`);
    }
  }

  return {
    status: problems.length ? "failed" : "passed",
    problems: problems.sort(),
    warnings: [],
    checkedObjects: [],
    checkedPaths
  };
}

module.exports = { id: "exact-materialization", version: "1.0.0", supportedPhases: ["post_write"], validate };
