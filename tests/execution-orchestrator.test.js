const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { sha256, appendEntry } = require("../kernel/lib/append-only-log");
const { recordTransaction } = require("../kernel/transactions/store");
const { computeWriteSetHash } = require("../kernel/transactions/validate");
const { recordApprovalDecision } = require("../kernel/approvals/decision-store");
const { executeApprovedTransaction } = require("../kernel/execution/orchestrator");
const { getExecutionAttempt, createExecutionAttempt, transitionExecutionAttempt } = require("../kernel/execution/ledger");
const { acquireExecutionLock, readExecutionLock } = require("../kernel/execution/exclusive-boundary");
const { recoverIncompleteExecution } = require("../kernel/execution/startup-recovery");
const { loadValidatorRegistry } = require("../kernel/execution/validators");
const { recordRuntimeIsolationBarrier } = require("../kernel/execution/runtime-isolation-barrier");
const { snapshotGovernedTree } = require("../kernel/runtime/governed-tree-guard");
const { loadFaultInjectedOrchestrator } = require("./support/orchestrator-fault-adapter");
const { executeApprovedTransactionForTest } = require("./support/orchestrator-test-harness");
const { buildValidatorClosure } = require("./support/validator-closure-test-core");
const { loadValidatorRegistryForTest } = require("./support/validator-test-harness");
const { resolveRegisteredAgent } = require("../kernel/runtime/agent-registry");
const { ISOLATION_ADAPTER_VERSION, reviewedSandboxHelperSourceHash } = require("../kernel/runtime/runtime-provenance");

const KERNEL_VALIDATORS_DIR = path.join(__dirname, "..", "kernel", "execution", "validators");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
  try { fs.chmodSync(filePath, 0o600); } catch (e) {}
}

const REQUIRED_SYSTEMS = [
  ["SYSTEM-INSTITUTION", "institution/"],
  ["SYSTEM-KERNEL", "kernel/"],
  ["SYSTEM-MEMORY", "memory/"],
  ["SYSTEM-WORKFORCE", "agents/"],
  ["SYSTEM-PLATFORM", "public/"],
  ["SYSTEM-AUDITS", "audits/"],
  ["SYSTEM-SCHEMAS", "schemas/"]
];

// Build a minimal, valid, isolated institution root.
function makeFixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase3-orch-"));
  const ledgerPath = path.join(root, "kernel", "execution", "state", "ledger.jsonl");

  const objects = (overrides.objects || REQUIRED_SYSTEMS.map(([id, p]) => ({
    id, type: "system", name: id, path: p, description: id, dependsOn: []
  })));
  if (!overrides.objects) {
    objects.push({ id: "REPORT-TARGET", type: "report", name: "Report Target", path: "public/data/", description: "report output", dependsOn: ["SYSTEM-PLATFORM"] });
  }
  for (const [, p] of REQUIRED_SYSTEMS) fs.mkdirSync(path.join(root, p), { recursive: true });
  fs.mkdirSync(path.join(root, "public", "data"), { recursive: true });

  writeJson(path.join(root, "kernel", "registry", "institution.json"), overrides.registry || { version: "1.0.0", updated: "2026-07-06", objects });
  writeJson(path.join(root, "agents", "registry.json"), overrides.agents || { agents: [{ id: "AGENT-REPAIR", status: "active", authorityLevel: 1, capabilities: ["write_report"], command: "node repair", runtime: { executable: process.execPath, arguments: ["-e", "process.exit(0)"] } }] });
  writeJson(path.join(root, "kernel", "authority", "approval-authorities.json"), { version: "1.0.0", authorities: [{ type: "human", id: "human-approver", status: "active", authorities: ["approve_execution", "clear_runtime_isolation_barrier"] }] });
  writeJson(path.join(root, "kernel", "permissions", "rules.json"), overrides.rules || { rules: [{ id: "RULE-WRITE-REPORT", action: "write_report", minimumAuthorityLevel: 1, requiresHumanApproval: false }] });
  writeJson(path.join(root, "kernel", "permissions", "authority-levels.json"), { levels: [{ level: 0 }, { level: 1 }] });
  const policy = overrides.policy || {
    version: "1.1.0", updated: "2026-07-07", warningPolicy: "nonfatal", requireAffectedObjectCoverage: true,
    requiredValidators: ["execution-plan", "exact-materialization", "institution-registry", "dependency-graph"],
    prohibitedPaths: [], prohibitedPrefixes: ["kernel/", "agents/", "schemas/", "institution/", "audits/", "memory/"],
    actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } }
  };
  if (!overrides.intentionalMissingSemantic && policy.actions && policy.actions.write_report && !policy.actions.write_report.semanticValidators) policy.actions.write_report.semanticValidators = ["write-report-semantics"];
  writeJson(path.join(root, "kernel", "execution", "policy.json"), policy);

  const transaction = overrides.transaction || {
    id: overrides.txId || "TX-001", version: "1.0.0", status: "approved", action: "write_report",
    actor: { type: "agent", id: "AGENT-REPAIR" }, requestedAt: "2026-07-06T10:00:00.000Z",
    affectedObjects: overrides.affectedObjects || ["REPORT-TARGET"],
    proposedWrites: overrides.proposedWrites || [{ operation: "write", path: "public/data/report.json", content: JSON.stringify({ generated: true }), encoding: "utf8" }]
  };
  if (transaction.status === "approved") {
    transaction.writeSetHash = transaction.writeSetHash || computeWriteSetHash(transaction.proposedWrites);
    const registered = resolveRegisteredAgent(root, transaction.actor.id, transaction.action);
    transaction.metadata = transaction.metadata || { agentRunId: `RUN-${transaction.id}`, reason: null, provenance: {
      ...registered.provenance,
      isolationAdapterVersion: ISOLATION_ADAPTER_VERSION,
      sandboxHelperSourceHash: reviewedSandboxHelperSourceHash(),
      sandboxHelperBinaryHash: "5".repeat(64)
    } };
    const decisionId = (transaction.approval && transaction.approval.decisionId) || `DEC-${transaction.id.slice(3)}`;
    if (!overrides.skipDecision) {
      const decision = recordApprovalDecision(root, { decisionId, decision: "approved", transactionId: transaction.id, writeSetHash: transaction.writeSetHash, actor: transaction.actor, action: transaction.action, approver: { type: "human", id: "human-approver" }, approverAuthority: "approve_execution", decidedAt: "2026-07-06T11:00:00.000Z" });
      transaction.approval = { approvedBy: decision.approver, approvedAt: decision.decidedAt, decisionId, approverAuthority: decision.approverAuthority, decisionRecordHash: decision.recordHash };
    }
  }

  if (overrides.rawTransactionEntry) {
    // Append a raw (schema-bypassing) log entry to exercise load-time rejection.
    appendEntry(path.join(root, "kernel", "transactions", "log.jsonl"), { recordType: "transaction.recorded", transaction: overrides.rawTransactionEntry }, { label: "transaction log" });
  } else if (overrides.skipRecord !== true) {
    recordTransaction(transaction, { rootDir: root });
  }

  return { root, ledgerPath, transaction, txId: transaction.id, targetPath: path.join(root, "public", "data", "report.json") };
}

function executeWithFault(transactionId, options, onStep) { return loadFaultInjectedOrchestrator(onStep, options)(transactionId, options); }

function cleanup(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

// Build an isolated validator tree with the production baseline validators plus
// any injected test validators. The full kernel subtree is copied so baseline
// validator relative imports resolve exactly as they do in production.
function testProjectRoot(dir) { return path.resolve(dir, "..", "..", ".."); }
function makeValidatorsDir(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase3-validators-"));
  fs.cpSync(path.join(__dirname, "..", "kernel"), path.join(root, "kernel"), { recursive: true });
  const dir = path.join(root, "kernel", "execution", "validators");
  const registryPath = path.join(dir, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  for (const entry of entries) {
    fs.writeFileSync(path.join(dir, `${entry.id}.js`), entry.source);
    try { fs.chmodSync(path.join(dir, `${entry.id}.js`), 0o600); } catch (e) {}
    const record = { id: entry.id, module: `${entry.id}.js`, version: entry.version || "1.0.0", supportedPhases: entry.supportedPhases };
    if (entry.semantic !== undefined) record.semantic = entry.semantic;
    if (entry.actions) record.actions = entry.actions;
    const index = registry.validators.findIndex((candidate) => candidate.id === entry.id);
    if (index === -1) registry.validators.push(record);
    else registry.validators[index] = record;
  }
  writeJson(registryPath, registry);
  return dir;
}

function cleanupValidatorsDir(dir) {
  fs.rmSync(path.resolve(dir, "..", "..", ".."), { recursive: true, force: true });
}

// ----------------------------------------------------------------------------
// 1. Valid approved transaction commits.
test("valid approved transaction commits", async () => {
  const fx = makeFixture();
  const result = await executeApprovedTransaction(fx.txId, { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "committed");
  assert.equal(fs.readFileSync(fx.targetPath, "utf8"), JSON.stringify({ generated: true }));
  assert.equal(getExecutionAttempt(result.attemptId, { ledgerPath: fx.ledgerPath }).state, "committed");
  assert.ok(result.validationResultHash && result.ledgerHash);
  cleanup(fx);
});

// 2. Unapproved transaction is rejected before mutation.
test("unapproved transaction is rejected before mutation", async () => {
  const fx = makeFixture({ transaction: {
    id: "TX-002", version: "1.0.0", status: "pending_review", action: "write_report",
    actor: { type: "agent", id: "AGENT-REPAIR" }, requestedAt: "2026-07-06T10:00:00.000Z",
    affectedObjects: ["REPORT-TARGET"],
    proposedWrites: [{ operation: "write", path: "public/data/report.json", content: "x", encoding: "utf8" }]
  } });
  const result = await executeApprovedTransaction("TX-002", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").includes("not approved"));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 3. Altered approved content is rejected (hash-chained transaction log detects tampering).
test("altered approved content is rejected", async () => {
  const fx = makeFixture({ txId: "TX-003" });
  const logPath = path.join(fx.root, "kernel", "transactions", "log.jsonl");
  const tampered = fs.readFileSync(logPath, "utf8").replace("generated", "GENERATED");
  fs.writeFileSync(logPath, tampered);
  const result = await executeApprovedTransaction("TX-003", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 4. Write-set hash mismatch is rejected.
test("write-set hash mismatch is rejected", async () => {
  const fx = makeFixture({ txId: "TX-004" });
  const logPath = path.join(fx.root, "kernel", "transactions", "log.jsonl");
  // Corrupt the stored writeSetHash inside the recorded entry.
  const line = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
  line.transaction.writeSetHash = "0".repeat(64);
  fs.writeFileSync(logPath, JSON.stringify(line) + "\n");
  const result = await executeApprovedTransaction("TX-004", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 5. Stale or revoked authority is rejected.
test("stale or revoked authority is rejected", async () => {
  const fx = makeFixture({ txId: "TX-005" });
  const registryPath = path.join(fx.root, "agents", "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.agents[0].status = "suspended";
  writeJson(registryPath, registry);
  const result = await executeApprovedTransaction("TX-005", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").toLowerCase().includes("authority") || result.problems.join(" ").toLowerCase().includes("registered agent"));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

test("registered executable identity drift is rejected before mutation", async () => {
  const fx = makeFixture({ txId: "TX-005B" });
  const registryPath = path.join(fx.root, "agents", "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.agents[0].runtime.arguments = ["-e", "process.exit(9)"];
  writeJson(registryPath, registry);
  const result = await executeApprovedTransaction("TX-005B", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /provenance no longer matches|registered agent identity/i.test(problem)));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 6. Current policy is loaded and bound at execution time.
test("current policy is loaded and bound at execution time", async () => {
  const fx = makeFixture({ txId: "TX-006" });
  const result = await executeApprovedTransaction("TX-006", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.ok(result.policyHash);
  assert.equal(getExecutionAttempt(result.attemptId, { ledgerPath: fx.ledgerPath }).policyHash, result.policyHash);
  cleanup(fx);
});

// 7. Changed validator registry is loaded and bound at execution time.
test("changed validator registry is loaded and bound at execution time", async () => {
  const fx = makeFixture({ txId: "TX-007" });
  const r1 = await executeApprovedTransaction("TX-007", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.ok(r1.validatorSetHash);
  assert.equal(getExecutionAttempt(r1.attemptId, { ledgerPath: fx.ledgerPath }).validatorSetHash, r1.validatorSetHash);
  // A different validator set yields a different bound hash.
  const dir = makeValidatorsDir([{ id: "execution-plan", supportedPhases: ["candidate", "post_write"], source: "module.exports={id:'execution-plan',version:'1.0.0',supportedPhases:['candidate','post_write'],validate:()=>({status:'passed',problems:[],warnings:[],checkedObjects:[],checkedPaths:[]})};" }]);
  const fx2 = makeFixture({ txId: "TX-007B", policy: { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["execution-plan"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } } });
  const r2 = await executeApprovedTransactionForTest("TX-007B", { rootDir: fx2.root, ledgerPath: fx2.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.notEqual(r1.validatorSetHash, r2.validatorSetHash);
  cleanupValidatorsDir(dir);
  cleanup(fx); cleanup(fx2);
});

test("production orchestrator rejects a caller-selected alternate root", async () => {
  const fx = makeFixture({ txId: "TX-007C" });
  const result = await executeApprovedTransaction("TX-007C", { rootDir: fx.root, ledgerPath: fx.ledgerPath, projectRoot: fx.root });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /caller-selected projectRoot/i.test(problem)));
  cleanup(fx);
});

test("production orchestrator rejects a caller-selected temporary root", async () => {
  const fx = makeFixture({ txId: "TX-007D" });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase3-prod-root-"));
  const result = await executeApprovedTransaction("TX-007D", { rootDir: fx.root, ledgerPath: fx.ledgerPath, projectRoot: tempRoot });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /caller-selected projectRoot/i.test(problem)));
  fs.rmSync(tempRoot, { recursive: true, force: true });
  cleanup(fx);
});

test("production orchestrator rejects a caller-selected validator directory inside the repository", async () => {
  const fx = makeFixture({ txId: "TX-007E" });
  const result = await executeApprovedTransaction("TX-007E", {
    rootDir: fx.root,
    ledgerPath: fx.ledgerPath,
    validatorsDir: path.join(__dirname, "support")
  });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /caller-selected validatorsDir/i.test(problem)));
  cleanup(fx);
});

test("production orchestrator rejects a caller-selected temporary validator directory", async () => {
  const fx = makeFixture({ txId: "TX-007F" });
  const dir = makeValidatorsDir([]);
  const result = await executeApprovedTransaction("TX-007F", {
    rootDir: fx.root,
    ledgerPath: fx.ledgerPath,
    validatorsDir: dir
  });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /caller-selected validatorsDir/i.test(problem)));
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

test("production orchestrator rejects a copied registry with the same validator ids", async () => {
  const fx = makeFixture({ txId: "TX-007G" });
  const dir = makeValidatorsDir([]);
  const result = await executeApprovedTransaction("TX-007G", {
    rootDir: fx.root,
    ledgerPath: fx.ledgerPath,
    validatorsDir: dir
  });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /caller-selected validatorsDir/i.test(problem)));
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

test("production orchestrator rejects an always-pass replacement validator registry", async () => {
  const fx = makeFixture({ txId: "TX-007H" });
  const dir = makeValidatorsDir([{
    id: "execution-plan",
    supportedPhases: ["candidate", "post_write"],
    source: "module.exports={id:'execution-plan',version:'1.0.0',supportedPhases:['candidate','post_write'],validate:()=>({status:'passed',problems:[],warnings:[],checkedObjects:[],checkedPaths:[]})};"
  }]);
  const result = await executeApprovedTransaction("TX-007H", {
    rootDir: fx.root,
    ledgerPath: fx.ledgerPath,
    validatorsDir: dir
  });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /caller-selected validatorsDir/i.test(problem)));
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

test("production registry loader rejects a caller-selected temporary validator root", () => {
  const dir = makeValidatorsDir([]);
  assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /caller-selected validatorsDir/i);
  cleanupValidatorsDir(dir);
});

test("test-only registry loader authorizes its own temporary validator root", () => {
  const dir = makeValidatorsDir([]);
  const registry = loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.ok(registry.validatorSetHash);
  cleanupValidatorsDir(dir);
});

test("test-only root authorization cannot leak into production loading", () => {
  const dir = makeValidatorsDir([]);
  const registry = loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.ok(registry.validatorSetHash);
  assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /caller-selected validatorsDir/i);
  cleanupValidatorsDir(dir);
});

test("production modules do not export test-only harness functions", () => {
  const orchestrator = require("../kernel/execution/orchestrator");
  const validators = require("../kernel/execution/validators");
  assert.equal(orchestrator.executeApprovedTransactionForTest, undefined);
  assert.equal(validators.loadValidatorRegistryForTest, undefined);
});

test("direct kernel imports do not expose configurable execution surfaces", () => {
  const modules = [
    ["../kernel/execution/orchestrator", require("../kernel/execution/orchestrator")],
    ["../kernel/execution/orchestrator-core", require("../kernel/execution/orchestrator-core")],
    ["../kernel/execution/validation-cycle", require("../kernel/execution/validation-cycle")],
    ["../kernel/execution/validators", require("../kernel/execution/validators")],
    ["../kernel/execution/validators/index.js", require("../kernel/execution/validators/index.js")],
    ["../kernel/execution/validators/registry-core.js", require("../kernel/execution/validators/registry-core.js")],
    ["../kernel/execution/validator-closure.js", require("../kernel/execution/validator-closure.js")]
  ];
  for (const [modulePath, exported] of modules) {
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "executeApprovedTransactionInternal"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "loadValidatorRegistryAtDirectory"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "executionSurface"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "allowProjectRootOverride"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "allowValidatorsDirOverride"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "buildValidatorClosure"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "resolveAuthoritativeRoot"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "inspectAndRead"), false, modulePath);
    assert.equal(Object.prototype.hasOwnProperty.call(exported, "runValidationPhaseWithDescriptors"), false, modulePath);
  }
});

test("direct kernel imports still reject alternate validator sources", async () => {
  const fx = makeFixture({ txId: "TX-007I" });
  const dir = makeValidatorsDir([]);
  try {
    const orchestratorCore = require("../kernel/execution/orchestrator-core");
    const result = await orchestratorCore.executeApprovedTransaction("TX-007I", {
      rootDir: fx.root,
      ledgerPath: fx.ledgerPath,
      validatorsDir: dir,
      projectRoot: testProjectRoot(dir)
    });
    assert.equal(result.disposition, "rejected");
    assert.ok(result.problems.some((problem) => /caller-selected (validatorsDir|projectRoot)/i.test(problem)));
    assert.throws(() => require("../kernel/execution/validators/registry-core").loadValidatorRegistry({ validatorsDir: dir }), /caller-selected validatorsDir/i);
    const validatorClosure = require("../kernel/execution/validator-closure.js");
    assert.equal(typeof validatorClosure.buildValidatorClosure, "undefined");
    assert.equal(typeof validatorClosure.resolveAuthoritativeRoot, "undefined");
    assert.equal(typeof validatorClosure.inspectAndRead, "undefined");
  } finally {
    cleanupValidatorsDir(dir);
    cleanup(fx);
  }
});

test("direct production imports cannot execute a fabricated external validator descriptor", async () => {
  const fx = makeFixture({ txId: "TX-007J" });
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase41-external-validator-"));
  const markerPath = path.join(externalRoot, "fabricated-marker.txt");
  const validatorPath = path.join(externalRoot, "always-pass.js");
  const validatorId = "fabricated-external-pass";
  writeJson(path.join(externalRoot, "package.json"), { private: true });
  fs.writeFileSync(
    validatorPath,
    `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");\nmodule.exports={id:${JSON.stringify(validatorId)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:()=>({status:"passed",problems:[],warnings:[]})};`
  );
  try { fs.chmodSync(validatorPath, 0o600); } catch (error) {}
  const closure = buildValidatorClosure(validatorPath, externalRoot);
  const fabricatedDescriptor = {
    id: validatorId,
    version: "1.0.0",
    modulePath: validatorPath,
    moduleHash: sha256(fs.readFileSync(validatorPath)),
    semantic: false,
    actions: [],
    supportedPhases: ["candidate"],
    closure: {
      closureRoot: closure.closureRoot,
      rootPolicy: closure.rootPolicy,
      entryRelPath: closure.entryRelPath,
      modules: closure.manifest,
      builtins: closure.builtins,
      closureHash: "0".repeat(64)
    },
    contract: {
      id: validatorId,
      version: "1.0.0",
      semantic: false,
      actions: [],
      supportedPhases: ["candidate"]
    }
  };

  const productionRegistry = loadValidatorRegistry();
  const validationCycle = require("../kernel/execution/validation-cycle");
  const validationResult = await validationCycle.runValidationPhase(
    "candidate",
    [fabricatedDescriptor],
    { rootDir: fx.root, transaction: fx.transaction, plan: { affectedObjects: [], writes: [] }, writeSetHash: "a".repeat(64) },
    { timeoutMs: 250, expectedValidatorSetHash: productionRegistry.validatorSetHash }
  );
  assert.equal(validationResult.status, "failed");
  assert.equal(fs.existsSync(markerPath), false);

  const orchestrator = require("../kernel/execution/orchestrator");
  const orchestratorResult = await orchestrator.executeApprovedTransaction("TX-007J", {
    rootDir: fx.root,
    ledgerPath: fx.ledgerPath,
    validatorsDir: externalRoot,
    projectRoot: externalRoot
  });
  assert.equal(orchestratorResult.disposition, "rejected");
  assert.equal(fs.existsSync(markerPath), false);

  const orchestratorCore = require("../kernel/execution/orchestrator-core");
  const orchestratorCoreResult = await orchestratorCore.executeApprovedTransaction("TX-007J", {
    rootDir: fx.root,
    ledgerPath: fx.ledgerPath,
    validatorsDir: externalRoot,
    projectRoot: externalRoot
  });
  assert.equal(orchestratorCoreResult.disposition, "rejected");
  assert.equal(fs.existsSync(markerPath), false);

  assert.throws(() => require("../kernel/execution/validators").loadValidatorRegistry({ validatorsDir: externalRoot }), /caller-selected validatorsDir/i);
  assert.throws(() => require("../kernel/execution/validators/index.js").loadValidatorRegistry({ validatorsDir: externalRoot }), /caller-selected validatorsDir/i);
  assert.throws(() => require("../kernel/execution/validators/registry-core.js").loadValidatorRegistry({ validatorsDir: externalRoot }), /caller-selected validatorsDir/i);
  assert.equal(fs.existsSync(markerPath), false);

  const validatorClosure = require("../kernel/execution/validator-closure.js");
  assert.equal(typeof validatorClosure.buildValidatorClosure, "undefined");
  assert.equal(typeof validatorClosure.resolveAuthoritativeRoot, "undefined");

  const validatorWorkerSource = fs.readFileSync(path.join(__dirname, "..", "kernel", "execution", "validator-worker.js"), "utf8");
  assert.doesNotMatch(validatorWorkerSource, /module\.exports\s*=/);
  assert.equal(fs.existsSync(markerPath), false);

  fs.rmSync(externalRoot, { recursive: true, force: true });
  cleanup(fx);
});

test("kernel import graph does not reach tests support", () => {
  const kernelRoot = path.join(__dirname, "..", "kernel");
  const forbidden = /(?:require\s*\(\s*["'][^"']*tests(?:\/|\\)|from\s+["'][^"']*tests(?:\/|\\))/;
  for (const relative of fs.readdirSync(kernelRoot, { recursive: true })) {
    if (!relative.endsWith(".js")) continue;
    const source = fs.readFileSync(path.join(kernelRoot, relative), "utf8");
    assert.doesNotMatch(source, forbidden, relative);
  }
});

// 8. Missing mandatory validator fails closed.
test("missing mandatory validator fails closed", async () => {
  const fx = makeFixture({ txId: "TX-008", policy: { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["execution-plan", "does-not-exist"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } } });
  const result = await executeApprovedTransaction("TX-008", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").includes("does-not-exist"));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 9. Uncovered affected object is rejected.
test("uncovered affected object is rejected", async () => {
  // Write to public/data but affectedObjects references only SYSTEM-PLATFORM (not REPORT-TARGET which owns public/data/).
  const fx = makeFixture({ txId: "TX-009", affectedObjects: ["SYSTEM-PLATFORM"] });
  const result = await executeApprovedTransaction("TX-009", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").toLowerCase().includes("affected object"));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 10. Candidate-state validator failure causes no live mutation.
test("candidate-state validator failure causes no live mutation", async () => {
  const dir = makeValidatorsDir([{ id: "candidate-guard", supportedPhases: ["candidate"], source: "module.exports={id:'candidate-guard',version:'1.0.0',supportedPhases:['candidate'],validate:()=>({status:'failed',problems:['candidate refused'],warnings:[],checkedObjects:[],checkedPaths:[]})};" }]);
  const fx = makeFixture({ txId: "TX-010", policy: { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["candidate-guard"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } } });
  const result = await executeApprovedTransactionForTest("TX-010", { rootDir: fx.root, ledgerPath: fx.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.equal(result.disposition, "rejected");
  assert.equal(fs.existsSync(fx.targetPath), false);
  assert.equal(result.attemptId, null); // no ledger attempt created pre-mutation
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

// 11. Post-write hash mismatch triggers rollback.
test("post-write hash mismatch triggers rollback", async () => {
  const fx = makeFixture({ txId: "TX-011" });
  const onStep = (point, ctx) => {
    if (point === "after_materialized") fs.writeFileSync(fx.targetPath, "corrupted-after-write");
  };
  const result = await executeWithFault("TX-011", { rootDir: fx.root, ledgerPath: fx.ledgerPath }, onStep);
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false); // created file removed on rollback
  assert.equal(getExecutionAttempt(result.attemptId, { ledgerPath: fx.ledgerPath }).state, "rolled_back");
  cleanup(fx);
});

// 12. Validator exception triggers rollback.
test("validator exception triggers rollback", async () => {
  const dir = makeValidatorsDir([{ id: "boom", supportedPhases: ["post_write"], source: "module.exports={id:'boom',version:'1.0.0',supportedPhases:['post_write'],validate:()=>{throw new Error('validator exploded');}};" }]);
  const fx = makeFixture({ txId: "TX-012", policy: { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["boom"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } } });
  const result = await executeApprovedTransactionForTest("TX-012", { rootDir: fx.root, ledgerPath: fx.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

// 13. Malformed validator result triggers rollback.
test("malformed validator result triggers rollback", async () => {
  const dir = makeValidatorsDir([{ id: "malformed", supportedPhases: ["post_write"], source: "module.exports={id:'malformed',version:'1.0.0',supportedPhases:['post_write'],validate:()=>({nonsense:true})};" }]);
  const fx = makeFixture({ txId: "TX-013", policy: { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["malformed"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } } });
  const result = await executeApprovedTransactionForTest("TX-013", { rootDir: fx.root, ledgerPath: fx.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

// 14. Validator timeout triggers rollback.
test("validator timeout triggers rollback", async () => {
  const dir = makeValidatorsDir([{ id: "hang", supportedPhases: ["post_write"], source: "module.exports={id:'hang',version:'1.0.0',supportedPhases:['post_write'],validate:()=>new Promise(()=>{})};" }]);
  const fx = makeFixture({ txId: "TX-014", policy: { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["hang"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } } });
  const result = await executeApprovedTransactionForTest("TX-014", { rootDir: fx.root, ledgerPath: fx.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir), timeoutMs: 1500 });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

// 15. Institution-registry invariant failure triggers rollback.
test("institution-registry invariant failure triggers rollback", async () => {
  // Registry missing a required system: valid enough to build a plan, but the
  // post-write institution-registry validator fails -> rollback.
  const objects = REQUIRED_SYSTEMS.slice(0, 6).map(([id, p]) => ({ id, type: "system", name: id, path: p, description: id, dependsOn: [] }));
  objects.push({ id: "REPORT-TARGET", type: "report", name: "Report Target", path: "public/data/", description: "t", dependsOn: [] });
  const fx = makeFixture({ txId: "TX-015", registry: { version: "1.0.0", updated: "2026-07-06", objects } });
  const result = await executeApprovedTransaction("TX-015", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 16. Invalid dependency reference triggers rollback.
test("invalid dependency reference triggers rollback", async () => {
  const objects = REQUIRED_SYSTEMS.map(([id, p]) => ({ id, type: "system", name: id, path: p, description: id, dependsOn: [] }));
  objects.push({ id: "REPORT-TARGET", type: "report", name: "Report Target", path: "public/data/", description: "t", dependsOn: ["OBJECT-DOES-NOT-EXIST"] });
  const fx = makeFixture({ txId: "TX-016", registry: { version: "1.0.0", updated: "2026-07-06", objects } });
  const result = await executeApprovedTransaction("TX-016", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 17. Dependency cycle triggers rollback.
test("dependency cycle triggers rollback", async () => {
  const objects = REQUIRED_SYSTEMS.map(([id, p]) => ({ id, type: "system", name: id, path: p, description: id, dependsOn: [] }));
  objects.push({ id: "REPORT-TARGET", type: "report", name: "Report Target", path: "public/data/", description: "t", dependsOn: ["SYSTEM-AUDITS"] });
  // Introduce a cycle: SYSTEM-AUDITS -> REPORT-TARGET -> SYSTEM-AUDITS
  objects.find((o) => o.id === "SYSTEM-AUDITS").dependsOn = ["REPORT-TARGET"];
  const fx = makeFixture({ txId: "TX-017", registry: { version: "1.0.0", updated: "2026-07-06", objects } });
  const result = await executeApprovedTransaction("TX-017", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 18. Newly created file is removed during rollback.
test("newly created file is removed during rollback", async () => {
  const fx = makeFixture({ txId: "TX-018" });
  const onStep = (point) => { if (point === "after_materialized") fs.writeFileSync(fx.targetPath, "corrupt"); };
  const result = await executeWithFault("TX-018", { rootDir: fx.root, ledgerPath: fx.ledgerPath }, onStep);
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 19. Updated file restores exact original bytes.
test("updated file restores exact original bytes", async () => {
  const fx = makeFixture({ txId: "TX-019" });
  fs.writeFileSync(fx.targetPath, "ORIGINAL-CONTENT");
  const onStep = (point) => { if (point === "after_materialized") fs.writeFileSync(fx.targetPath, "corrupt"); };
  const result = await executeWithFault("TX-019", { rootDir: fx.root, ledgerPath: fx.ledgerPath }, onStep);
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.readFileSync(fx.targetPath, "utf8"), "ORIGINAL-CONTENT");
  cleanup(fx);
});

// 20. Deleted file is restored exactly.
test("deleted file is restored exactly", async () => {
  const fx = makeFixture({ txId: "TX-020", proposedWrites: [{ operation: "delete", path: "public/data/report.json" }] });
  fs.writeFileSync(fx.targetPath, "TO-BE-DELETED");
  // Force post-write failure via injected validator so rollback restores the deleted file.
  const dir = makeValidatorsDir([{ id: "boom", supportedPhases: ["post_write"], source: "module.exports={id:'boom',version:'1.0.0',supportedPhases:['post_write'],validate:()=>{throw new Error('fail');}};" }]);
  // policy allowing delete + injected validator
  fs.writeFileSync(path.join(fx.root, "kernel", "execution", "policy.json"), JSON.stringify({ version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["boom"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } }, null, 2));
  const result = await executeApprovedTransactionForTest("TX-020", { rootDir: fx.root, ledgerPath: fx.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.readFileSync(fx.targetPath, "utf8"), "TO-BE-DELETED");
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

// 21. Original file mode is restored.
test("original file mode is restored", async () => {
  if (process.platform === "win32") return;
  const fx = makeFixture({ txId: "TX-021" });
  fs.writeFileSync(fx.targetPath, "MODE-ORIGINAL");
  fs.chmodSync(fx.targetPath, 0o640);
  const onStep = (point) => { if (point === "after_materialized") fs.writeFileSync(fx.targetPath, "corrupt"); };
  const result = await executeWithFault("TX-021", { rootDir: fx.root, ledgerPath: fx.ledgerPath }, onStep);
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.statSync(fx.targetPath).mode & 0o777, 0o640);
  cleanup(fx);
});

// 22. Duplicate execution cannot commit twice.
test("duplicate execution cannot commit twice", async () => {
  const fx = makeFixture({ txId: "TX-022" });
  const first = await executeApprovedTransaction("TX-022", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(first.disposition, "committed");
  const second = await executeApprovedTransaction("TX-022", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(second.disposition, "rejected");
  assert.ok(second.problems.join(" ").toLowerCase().includes("already committed"));
  cleanup(fx);
});

// 23. Concurrent execution attempts cannot both proceed.
test("concurrent execution attempts cannot both proceed", async () => {
  const fx = makeFixture({ txId: "TX-023" });
  // Simulate an in-flight attempt already holding the exclusive lock.
  acquireExecutionLock(fx.root, "ATTEMPT-INFLIGHT-0001");
  const result = await executeApprovedTransaction("TX-023", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").toLowerCase().includes("locked"));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 24. Existing recovery_required state blocks new execution.
test("existing recovery_required state blocks new execution", async () => {
  const fx = makeFixture({ txId: "TX-024" });
  // Create a recovery_required barrier attempt directly in the ledger.
  const h = "a".repeat(64);
  createExecutionAttempt({ id: "ATTEMPT-BARRIER-0001", transactionId: "TX-BARRIER", writeSetHash: h, actor: { type: "system", id: "sys" }, authorityStateHash: h, policyHash: h, validatorSetHash: h, planHash: h }, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "recovery_persisted", { preStateManifestHash: h }, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "applying", {}, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "rolling_back", {}, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "recovery_required", { rollbackResultHash: h }, { ledgerPath: fx.ledgerPath });
  const result = await executeApprovedTransaction("TX-024", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").toLowerCase().includes("recovery"));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

// 25. Rollback failure records recovery_required.
test("rollback failure records recovery_required", async () => {
  const fx = makeFixture({ txId: "TX-025" });
  fs.writeFileSync(fx.targetPath, "ORIGINAL-BYTES"); // pre-existing => snapshot blob created
  const { blobRoot } = require("../kernel/execution/recovery-paths");
  const dir = makeValidatorsDir([{ id: "boom", supportedPhases: ["post_write"], source: "module.exports={id:'boom',version:'1.0.0',supportedPhases:['post_write'],validate:()=>{throw new Error('force rollback');}};" }]);
  fs.writeFileSync(path.join(fx.root, "kernel", "execution", "policy.json"), JSON.stringify({ version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["boom"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } } }, null, 2));
  // Corrupt the snapshot blob right after the manifest is persisted so rollback cannot restore.
  const onStep = (point) => {
    if (point === "after_manifest") {
      const root = blobRoot(fx.root);
      for (const name of fs.readdirSync(root)) fs.writeFileSync(path.join(root, name), "tampered-blob");
    }
  };
  const result = await executeWithFault("TX-025", { rootDir: fx.root, ledgerPath: fx.ledgerPath, validatorsDir: dir, projectRoot: testProjectRoot(dir) }, onStep);
  assert.equal(result.disposition, "recovery_required");
  assert.equal(getExecutionAttempt(result.attemptId, { ledgerPath: fx.ledgerPath }).state, "recovery_required");
  cleanupValidatorsDir(dir);
  cleanup(fx);
});

// 26. Returned result matches the durable terminal ledger record.
test("returned result matches the durable terminal ledger record", async () => {
  const fx = makeFixture({ txId: "TX-026" });
  const result = await executeApprovedTransaction("TX-026", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  const durable = getExecutionAttempt(result.attemptId, { ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, durable.terminalDisposition);
  assert.equal(result.ledgerHash, durable.ledgerHash);
  assert.equal(result.validationResultHash, durable.validationResultHash);
  cleanup(fx);
});

// 27. Ledger tampering is detected.
test("ledger tampering is detected", async () => {
  const fx = makeFixture({ txId: "TX-027" });
  const first = await executeApprovedTransaction("TX-027", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(first.disposition, "committed");
  // Tamper the execution ledger, then attempt another execution.
  const tampered = fs.readFileSync(fx.ledgerPath, "utf8").replace('"committed"', '"validating"');
  fs.writeFileSync(fx.ledgerPath, tampered);
  assert.throws(() => getExecutionAttempt(first.attemptId, { ledgerPath: fx.ledgerPath }), /verification|chain|ledger|hash/i);
  cleanup(fx);
});

// 28. Undeclared path mutation is detected.
test("undeclared path mutation is detected", async () => {
  // Inject a validator that mutates an undeclared path and confirm exact-materialization + journal detection.
  // Here we directly assert the exact-materialization validator flags a journal entry for an undeclared path.
  const fx = makeFixture({ txId: "TX-028" });
  const result = await executeApprovedTransaction("TX-028", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "committed"); // baseline commit
  // Now verify the materialization validator would reject an undeclared journal entry.
  const validator = require("../kernel/execution/validators/exact-materialization");
  const badContext = {
    rootDir: fx.root,
    plan: { writes: [{ operation: "write", path: "public/data/report.json" }] },
    attemptId: result.attemptId
  };
  // Append an undeclared operation to the mutation journal to simulate an undeclared governed mutation.
  const { appendMutationRecord } = require("../kernel/execution/mutation-journal");
  // Re-create a fresh attempt journal scenario:
  const fx2 = makeFixture({ txId: "TX-028B" });
  // Build a minimal attempt + journal with an undeclared path.
  const h = "b".repeat(64);
  createExecutionAttempt({ id: "ATTEMPT-UNDECLARED-1", transactionId: "TX-028B", writeSetHash: h, actor: { type: "system", id: "s" }, authorityStateHash: h, policyHash: h, validatorSetHash: h, planHash: h }, { ledgerPath: fx2.ledgerPath });
  appendMutationRecord(fx2.root, "ATTEMPT-UNDECLARED-1", { recordType: "mutation.operation.started", operationId: "000001:public/data/other.json", index: 0, operation: "write", path: "public/data/other.json", plannedParentDirectories: [], contentHash: h });
  const out = validator.validate({ rootDir: fx2.root, plan: { writes: [{ operation: "write", path: "public/data/report.json" }] }, attemptId: "ATTEMPT-UNDECLARED-1" });
  assert.equal(out.status, "failed");
  assert.ok(out.problems.join(" ").toLowerCase().includes("undeclared"));
  cleanup(fx); cleanup(fx2);
});

// 29. Symlink target is rejected where applicable.
test("symlink target is rejected where applicable", async () => {
  const fx = makeFixture({ txId: "TX-029" });
  // Replace the write target with a symlink so path-safety rejects it.
  const outside = path.join(fx.root, "outside.txt");
  fs.writeFileSync(outside, "outside");
  try { fs.symlinkSync(outside, fx.targetPath); } catch (error) { if (error.code === "EPERM") { cleanup(fx); return; } throw error; }
  const result = await executeApprovedTransaction("TX-029", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.join(" ").toLowerCase().includes("link"));
  cleanup(fx);
});

// 30. Path traversal or institution-root escape is rejected.
test("path traversal or institution-root escape is rejected", async () => {
  // A raw (schema-bypassing) log entry with a traversal path must be rejected at load.
  const fx = makeFixture({ txId: "TX-030", skipRecord: true, rawTransactionEntry: {
    id: "TX-030", version: "1.0.0", status: "approved", action: "write_report",
    actor: { type: "agent", id: "AGENT-REPAIR" }, requestedAt: "2026-07-06T10:00:00.000Z",
    approval: { approvedBy: { type: "human", id: "h" }, approvedAt: "2026-07-06T11:00:00.000Z", decisionId: "D" },
    affectedObjects: ["REPORT-TARGET"],
    proposedWrites: [{ operation: "write", path: "../escape.json", content: "x", encoding: "utf8" }]
  } });
  const result = await executeApprovedTransaction("TX-030", { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.equal(fs.existsSync(path.join(fx.root, "..", "escape.json")), false);
  cleanup(fx);
});


// 31. Mandatory post-write validators cannot be removed by a weakened policy.
test("baseline mandatory validators cannot be removed by policy", async () => {
  const weakPolicy = {
    version: "1.0.0",
    updated: "2026-07-06",
    warningPolicy: "nonfatal",
    requireAffectedObjectCoverage: true,
    requiredValidators: ["execution-plan"],
    prohibitedPaths: [],
    prohibitedPrefixes: ["kernel/", "agents/", "schemas/", "institution/", "audits/", "memory/"],
    actions: {
      write_report: {
        allowedPaths: [],
        allowedPrefixes: ["public/data/"],
        allowDelete: true
      }
    }
  };
  const fx = makeFixture({ txId: "TX-031", policy: weakPolicy });
  const result = await executeWithFault("TX-031", { rootDir: fx.root, ledgerPath: fx.ledgerPath }, (point) => {
    if (point === "after_operation_completed") fs.writeFileSync(fx.targetPath, "tampered-after-write");
  });
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.existsSync(fx.targetPath), false);
  assert.ok(result.validationResults.post_write.problems.join(" ").includes("exact-materialization"));
  cleanup(fx);
});

// 32. Validator-set binding includes validator implementation bytes.
test("validator set hash changes when validator source changes", () => {
  const dir = makeValidatorsDir([]);
  const first = loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  fs.appendFileSync(path.join(dir, "execution-plan.js"), "\n// implementation changed without version bump\n");
  const second = loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: testProjectRoot(dir) });
  assert.notEqual(first.validatorSetHash, second.validatorSetHash);
  const entry = second.entries.find((item) => item.id === "execution-plan");
  assert.match(entry.moduleHash, /^[a-f0-9]{64}$/);
  cleanupValidatorsDir(dir);
});

// 33. A lock-release failure after durable commit never enters rollback.
test("post-commit lock release failure preserves committed disposition for startup reconciliation", async () => {
  const fx = makeFixture({ txId: "TX-033" });
  const lockPath = path.join(fx.root, "kernel", "execution", "state", "lock.json");
  const result = await executeWithFault("TX-033", { rootDir: fx.root, ledgerPath: fx.ledgerPath }, (point) => {
    if (point === "after_committed") {
      const owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      owner.token = "tampered-after-commit";
      fs.writeFileSync(lockPath, `${JSON.stringify(owner)}\n`);
    }
  });
  assert.equal(result.disposition, "committed");
  assert.equal(result.rollbackResults, null);
  assert.ok(result.operationalWarnings.some((warning) => warning.includes("startup reconciliation")));
  assert.ok(readExecutionLock(fx.root));
  const recovery = recoverIncompleteExecution(fx.root, { ledgerPath: fx.ledgerPath, assumeOwnerDead: true });
  assert.equal(recovery.status, "committed");
  assert.equal(readExecutionLock(fx.root), null);
  cleanup(fx);
});


test("durable runtime isolation barrier blocks direct orchestrator execution", async () => {
  const fx = makeFixture({ txId: "TX-RUNTIME-BARRIER-001" });
  const expectedManifest = snapshotGovernedTree(fx.root);
  recordRuntimeIsolationBarrier(fx.root, {
    runId: "RUN-ISOLATION-BARRIER-001",
    expectedManifest,
    beforeHash: "a".repeat(64),
    afterHash: null,
    problems: ["exact restoration could not be proven"]
  });
  const result = await executeApprovedTransaction(fx.txId, { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.match(result.problems.join(" "), /runtime isolation recovery barrier/i);
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

function semanticPolicy(validatorId) {
  return {
    version: "1.1.0",
    updated: "2026-07-07",
    requireAffectedObjectCoverage: true,
    requiredValidators: ["execution-plan", "exact-materialization", "institution-registry", "dependency-graph"],
    prohibitedPaths: [],
    prohibitedPrefixes: ["kernel/"],
    actions: {
      write_report: {
        allowedPaths: [],
        allowedPrefixes: ["public/data/"],
        allowDelete: true,
        ...(validatorId === null ? {} : { semanticValidators: [validatorId] })
      }
    }
  };
}

function semanticValidatorSource(id, body, supportedPhases = ["candidate", "post_write"]) {
  return `module.exports={id:${JSON.stringify(id)},version:'1.0.0',semantic:true,actions:['write_report'],supportedPhases:${JSON.stringify(supportedPhases)},validate:${body}};`;
}

test("active governed action without a semantic validator fails closed", async () => {
  const fx = makeFixture({ txId: "TX-SEM-MISSING", policy: semanticPolicy(null), intentionalMissingSemantic: true });
  const result = await executeApprovedTransaction(fx.txId, { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /no action-specific semantic validator/i.test(problem)));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

test("unavailable or incorrectly bound action semantic validator fails closed", async () => {
  const fx = makeFixture({ txId: "TX-SEM-UNAVAILABLE", policy: semanticPolicy("missing-semantic") });
  const result = await executeApprovedTransaction(fx.txId, { rootDir: fx.root, ledgerPath: fx.ledgerPath });
  assert.equal(result.disposition, "rejected");
  assert.ok(result.problems.some((problem) => /unavailable mandatory validator|semantic validator is unavailable/i.test(problem)));
  assert.equal(fs.existsSync(fx.targetPath), false);
  cleanup(fx);
});

test("action semantic validator implementation bytes change validator-set hash", () => {
  const first = makeValidatorsDir([{ id: "semantic-bytes", semantic: true, actions: ["write_report"], supportedPhases: ["candidate"], source: semanticValidatorSource("semantic-bytes", "()=>({status:'passed',problems:[],warnings:[]})", ["candidate"]) }]);
  const firstHash = loadValidatorRegistryForTest({ validatorsDir: first, projectRoot: testProjectRoot(first) }).validatorSetHash;
  fs.appendFileSync(path.join(first, "semantic-bytes.js"), "\n// byte-level semantic change\n");
  const secondHash = loadValidatorRegistryForTest({ validatorsDir: first, projectRoot: testProjectRoot(first) }).validatorSetHash;
  assert.notEqual(firstHash, secondHash);
  cleanupValidatorsDir(first);
});

for (const scenario of [
  {
    name: "throwing",
    id: "semantic-throws",
    body: "()=>{throw new Error('semantic explosion')} ",
    timeoutMs: 5000,
    match: /semantic explosion|threw/i
  },
  {
    name: "timing-out",
    id: "semantic-timeout",
    body: "()=>new Promise(()=>{})",
    timeoutMs: 25,
    match: /timed out/i
  },
  {
    name: "malformed",
    id: "semantic-malformed",
    body: "()=>({nonsense:true})",
    timeoutMs: 5000,
    match: /invalid status|malformed problems/i
  },
  {
    name: "semantically failing",
    id: "semantic-fails",
    body: "()=>({status:'failed',problems:['semantic rule failed'],warnings:[]})",
    timeoutMs: 5000,
    match: /semantic rule failed/i
  }
]) {
  test(`${scenario.name} action semantic validator fails closed`, async () => {
    const dir = makeValidatorsDir([{
      id: scenario.id,
      semantic: true,
      actions: ["write_report"],
      supportedPhases: ["candidate", "post_write"],
      source: semanticValidatorSource(scenario.id, scenario.body)
    }]);
    const fx = makeFixture({ txId: `TX-${scenario.id.toUpperCase()}`, policy: semanticPolicy(scenario.id) });
    const result = await executeApprovedTransactionForTest(fx.txId, {
      rootDir: fx.root,
      ledgerPath: fx.ledgerPath,
      validatorsDir: dir, projectRoot: testProjectRoot(dir),
      timeoutMs: scenario.timeoutMs
    });
    assert.notEqual(result.disposition, "committed");
    assert.ok(result.problems.some((problem) => scenario.match.test(problem)), result.problems.join("\n"));
    assert.equal(fs.existsSync(fx.targetPath), false);
    cleanupValidatorsDir(dir);
    cleanup(fx);
  });
}
