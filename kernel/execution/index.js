const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkAction } = require("../authority/engine");
const { createEventWriter } = require("../events/write");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { getTransaction } = require("../transactions/store");
const { assertValidTransaction, computeWriteSetHash, decodeWriteContent } = require("../transactions/validate");
const { applyDeclaredChange } = require("./apply-change");
const { assessPlan } = require("./assurance");
const { createCandidateState } = require("./candidate-state");
const { enterMutationBoundary } = require("./exclusion");
const { buildExecutionPlan, loadInstitutionRegistry, readJson } = require("./plan");
const { appendExecutionHistory, previousSuccessfulExecution } = require("./records");
const { preserveRecoveryRecord } = require("./recovery-record");
const { restoreExistingFile } = require("./restore-existing");
const { snapshotWrites, verifyRestoration, verifySnapshot } = require("./snapshots");

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

module.exports = { defaultBoundaryPath, defaultHistoryPath, defaultPolicy, nextExecutionId };
