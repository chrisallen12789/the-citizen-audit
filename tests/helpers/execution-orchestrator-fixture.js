const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { canonicalStringify } = require("../../kernel/lib/canonical-json");
const { appendEntry, sha256 } = require("../../kernel/lib/append-only-log");
const { computeWriteSetHash } = require("../../kernel/transactions/validate");
const { executeApprovedTransaction } = require("../../kernel/execution/orchestrator");
const { getExecutionAttempt } = require("../../kernel/execution/ledger");
const { loadPreStateManifest, validationResultPath } = require("../../kernel/execution/recovery-store");
const { readExecutionLock } = require("../../kernel/execution/exclusive-boundary");

const BASE_ROOT = path.resolve(__dirname, "..", "..");
const VALIDATOR_IDS = [
  "execution-plan",
  "institution-registry",
  "dependency-cycles",
  "exact-materialization"
];

function copyTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true, filter: (entry) => {
    const relative = path.relative(source, entry).split(path.sep).join("/");
    return relative !== "kernel/execution/state" && !relative.startsWith("kernel/execution/state/");
  }});
}

function withExecutionRoot(fn) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase3-orchestrator-test-"));
  copyTree(BASE_ROOT, rootDir);
  const ledgerPath = path.join(rootDir, "kernel", "execution", "state", "ledger.jsonl");
  const transactionLogPath = path.join(rootDir, "kernel", "transactions", "state", "transactions.jsonl");
  try {
    return fn({ rootDir, ledgerPath, transactionLogPath });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

function write(relativePath, content) {
  const bytes = Buffer.from(content, "utf8");
  return { operation: "write", path: relativePath, content, encoding: "utf8", contentHash: sha256(bytes) };
}

function appendApprovedTransaction(rootDir, transactionLogPath, options = {}) {
  const proposedWrites = options.proposedWrites || [write("docs/repair-agent-report.md", "governed output\n")];
  const transaction = {
    version: "1.0.0",
    id: options.id || "TX-ORCH-001",
    createdAt: options.createdAt || "2026-07-06T15:00:00.000Z",
    actor: options.actor || { type: "agent", id: "repair-agent" },
    action: options.action || "write_report",
    affectedObjects: options.affectedObjects || ["repair-reports"],
    preconditions: [],
    proposedWrites,
    justification: "Approved orchestrator contract test.",
    status: "approved",
    approval: options.approval || {
      approvedBy: { type: "human", id: "TEST-APPROVER" },
      approvedAt: "2026-07-06T15:01:00.000Z",
      decisionId: "D-TEST-ORCH-001",
      rationale: "Test approval."
    },
    writeSetHash: computeWriteSetHash(proposedWrites),
    metadata: {}
  };
  appendEntry(transactionLogPath, { recordType: "transaction.approved", schemaVersion: "1.0.0", transaction }, { label: "transaction log", recordedAt: transaction.createdAt });
  return transaction;
}

function addValidator(rootDir, options) {
  const validatorDirectory = path.join(rootDir, "kernel", "execution", "validators");
  const moduleName = `${options.id}.js`;
  fs.writeFileSync(path.join(validatorDirectory, moduleName), options.source, "utf8");
  const registryPath = path.join(validatorDirectory, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.validators.push({
    id: options.id,
    version: "1.0.0",
    module: moduleName,
    phases: options.phases,
    scope: options.scope || "test",
    deterministic: true,
    timeoutMs: options.timeoutMs || 500
  });
  registry.validators.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return options.id;
}

function addSemanticValidator(rootDir, action, validatorId) {
  const policyPath = path.join(rootDir, "kernel", "execution", "policy.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  policy.actions[action].semanticValidators.push(validatorId);
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
}

function readValidationArtifact(rootDir, attemptId) {
  const filePath = validationResultPath(rootDir, attemptId);
  const artifact = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const { validationResultHash, ...body } = artifact;
  assert.equal(validationResultHash, sha256(canonicalStringify(body)));
  return artifact;
}

function cloneValidatorFiles(sourceRoot, destinationRoot, registryDocument) {
  const sourceDirectory = path.dirname(sourceRoot);
  const destinationDirectory = path.dirname(destinationRoot);
  fs.mkdirSync(destinationDirectory, { recursive: true });
  for (const validator of registryDocument.validators) {
    fs.copyFileSync(path.join(sourceDirectory, validator.module), path.join(destinationDirectory, validator.module));
  }
}

function replaceValidatorRegistry(rootDir, registryDocument, sourceRoot = path.join(BASE_ROOT, "kernel", "execution", "validators", "registry.json")) {
  const destination = path.join(rootDir, "kernel", "execution", "validators", "registry.json");
  cloneValidatorFiles(sourceRoot, destination, registryDocument);
  fs.writeFileSync(destination, `${JSON.stringify(registryDocument, null, 2)}\n`, "utf8");
}

function contractValidatorRegistry(rootDir, overrides = {}) {
  const registryPath = path.join(BASE_ROOT, "kernel", "execution", "validators", "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.validators = registry.validators.filter((item) => VALIDATOR_IDS.includes(item.id));
  for (const validator of registry.validators) Object.assign(validator, overrides[validator.id] || {});
  replaceValidatorRegistry(rootDir, registry, registryPath);
  return registry;
}

function executionOptions(rootDir, ledgerPath, transactionLogPath, attemptId) {
  return {
    rootDir,
    ledgerPath,
    transactionLogPath,
    attemptId,
    createdAt: "2026-07-06T15:02:00.000Z",
    recoveryCreatedAt: "2026-07-06T15:03:00.000Z",
    transitionedAt: "2026-07-06T15:04:00.000Z",
    recordedAt: "2026-07-06T15:04:00.000Z"
  };
}

module.exports = {
  assert,
  fs,
  path,
  test,
  sha256,
  executeApprovedTransaction,
  getExecutionAttempt,
  loadPreStateManifest,
  readExecutionLock,
  readValidationArtifact,
  withExecutionRoot,
  write,
  appendApprovedTransaction,
  addValidator,
  addSemanticValidator,
  contractValidatorRegistry,
  executionOptions
};
