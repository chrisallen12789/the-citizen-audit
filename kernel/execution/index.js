const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkAction } = require("../authority/engine");
const { createEventWriter } = require("../events/write");
const { appendEntry, readVerifiedLog, sha256 } = require("../lib/append-only-log");
const { getTransaction } = require("../transactions/store");
const { assertValidTransaction, computeWriteSetHash, decodeWriteContent } = require("../transactions/validate");
const { createCandidateState } = require("./candidate-state");
const { enterMutationBoundary } = require("./exclusion");
const { fileState } = require("./file-state");
const { institutionFile } = require("./path-safety");
const { buildExecutionPlan, loadInstitutionRegistry, readJson } = require("./plan");
const { preserveArtifact } = require("./preserve-artifact");
const { snapshotWrites, verifyRestoration, verifySnapshot } = require("./snapshots");
const { loadValidatorRegistry, selectValidators } = require("./validators");
const { writeInstitutionFile } = require("./write-file");
const executionPlanValidator = require("./validators/execution-plan");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function defaultPolicy(rootDir = repositoryRoot) {
  return readJson(path.join(rootDir, "kernel", "execution", "policy.json"));
}

function defaultHistoryPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "execution", "history.jsonl");
}

function defaultBoundaryPath(rootDir) {
  return path.join(os.tmpdir(), "institution-os-boundaries", `${sha256(path.resolve(rootDir)).slice(0, 24)}.jsonl`);
}

function nextExecutionId(now = new Date()) {
  return `EXEC-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function temporaryPath(relativePath, executionId, index) {
  const directory = path.posix.dirname(relativePath);
  const name = path.posix.basename(relativePath);
  const temporaryName = `.${name}.${executionId}.${index}.tmp`;
  return directory === "." ? temporaryName : `${directory}/${temporaryName}`;
}

module.exports = { defaultBoundaryPath, defaultHistoryPath, defaultPolicy, nextExecutionId, temporaryPath, executionPlanValidator };
