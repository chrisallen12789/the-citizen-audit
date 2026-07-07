const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { computeWriteSetHash } = require("../kernel/transactions/validate");
const { recordTransaction, getTransaction } = require("../kernel/transactions/store");
const { executeApprovedTransaction } = require("../kernel/execution/orchestrator");
const { getExecutionAttempt, readExecutionLedger, createExecutionAttempt } = require("../kernel/execution/ledger");
const { acquireExecutionLock } = require("../kernel/execution/exclusive-boundary");
const { recoverIncompleteExecution } = require("../kernel/execution/startup-recovery");

const { runTransactionalAgent, DENY_BY_DEFAULT } = require("../kernel/runtime/transactional-runtime");
const { validateProposedWrites } = require("../kernel/runtime/proposed-writes");
const { buildTransactionIntent, deriveTransactionId } = require("../kernel/runtime/transaction-intent");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
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

// Build a minimal, valid, isolated institution root. The runtime records its own
// transactions, so (unlike the orchestrator fixture) none is pre-recorded.
function makeFixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-rt-"));
  const ledgerPath = path.join(root, "kernel", "execution", "state", "ledger.jsonl");
  const objects = REQUIRED_SYSTEMS.map(([id, p]) => ({ id, type: "system", name: id, path: p, description: id, dependsOn: [] }));
  objects.push({ id: "REPORT-TARGET", type: "report", name: "Report Target", path: "public/data/", description: "report output", dependsOn: ["SYSTEM-PLATFORM"] });
  for (const [, p] of REQUIRED_SYSTEMS) fs.mkdirSync(path.join(root, p), { recursive: true });
  fs.mkdirSync(path.join(root, "public", "data"), { recursive: true });

  writeJson(path.join(root, "kernel", "registry", "institution.json"), { version: "1.0.0", updated: "2026-07-06", objects });
  writeJson(path.join(root, "agents", "registry.json"), { agents: [{ id: "AGENT-REPAIR", status: "active", authorityLevel: 1, capabilities: ["write_report"], command: "node repair" }] });
  writeJson(path.join(root, "kernel", "permissions", "rules.json"), { rules: [{ id: "RULE-WRITE-REPORT", action: "write_report", minimumAuthorityLevel: 1, requiresHumanApproval: false }] });
  writeJson(path.join(root, "kernel", "permissions", "authority-levels.json"), { levels: [{ level: 0 }, { level: 1 }] });
  writeJson(path.join(root, "kernel", "execution", "policy.json"), overrides.policy || {
    version: "1.0.0", updated: "2026-07-06", warningPolicy: "nonfatal", requireAffectedObjectCoverage: true,
    requiredValidators: ["execution-plan", "exact-materialization", "institution-registry", "dependency-graph"],
    prohibitedPaths: [], prohibitedPrefixes: ["kernel/", "agents/", "schemas/", "institution/", "audits/", "memory/"],
    actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true } }
  });

  return { root, ledgerPath, targetPath: path.join(root, "public", "data", "report.json") };
}

function cleanup(fx) { fs.rmSync(fx.root, { recursive: true, force: true }); }

// An explicit approval decision standing in for a human/governance approver.
// This is NOT auto-approval: the runtime denies by default and only proceeds
// when a caller supplies an explicit decision.
function humanApproval(decisionId = "DEC-RT-1") {
  return () => ({ approved: true, approvedBy: { type: "human", id: "human-approver" }, decisionId });
}

function externalNodeAgent(source, extra = {}) {
  return { command: process.execPath, args: ["-e", source], ...extra };
}

// An external agent that writes one report file under its isolated workspace.
function reportAgent(content = { generated: true }) {
  const encoded = JSON.stringify(JSON.stringify(content));
  return externalNodeAgent(`
    const fs = require("fs");
    const path = require("path");
    const outputDir = process.env.CITIZEN_AUDIT_OUTPUT_DIR;
    fs.mkdirSync(path.join(outputDir, "public", "data"), { recursive: true });
    fs.writeFileSync(path.join(outputDir, "public", "data", "report.json"), ${encoded});
  `);
}

function baseRun(fx, extra = {}) {
  return Object.assign({
    rootDir: fx.root, runId: extra.runId || "RUN-TEST-0001", agent: reportAgent(),
    actor: { type: "agent", id: "AGENT-REPAIR" }, action: "write_report", affectedObjects: ["REPORT-TARGET"],
    approvalProvider: humanApproval(), ledgerPath: fx.ledgerPath
  }, extra);
}

function makeValidatorsDir(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-val-"));
  fs.cpSync(path.join(__dirname, "..", "kernel"), path.join(root, "kernel"), { recursive: true });
  const dir = path.join(root, "kernel", "execution", "validators");
  const registryPath = path.join(dir, "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  for (const entry of entries) {
    fs.writeFileSync(path.join(dir, `${entry.id}.js`), entry.source);
    const record = { id: entry.id, module: `${entry.id}.js`, version: entry.version || "1.0.0", supportedPhases: entry.supportedPhases };
    const index = registry.validators.findIndex((candidate) => candidate.id === entry.id);
    if (index === -1) registry.validators.push(record); else registry.validators[index] = record;
  }
  writeJson(registryPath, registry);
  return dir;
}
function cleanupValidatorsDir(dir) { fs.rmSync(path.resolve(dir, "..", "..", ".."), { recursive: true, force: true }); }

// ---------------------------------------------------------------------------
// 1. Agent runs in an isolated workspace.
test("agent runs in an isolated workspace outside the live root", async () => {
  const fx = makeFixture();
  const agent = externalNodeAgent(`
    const fs = require("fs");
    const path = require("path");
    const outputDir = process.env.CITIZEN_AUDIT_OUTPUT_DIR;
    fs.mkdirSync(path.join(outputDir, "public", "data"), { recursive: true });
    fs.writeFileSync(path.join(outputDir, "public", "data", "report.json"), JSON.stringify({ workspace: process.env.CITIZEN_AUDIT_WORKSPACE }));
  `);
  const result = await runTransactionalAgent(baseRun(fx, { agent }));
  assert.equal(result.institutionalResult, "committed");
  const payload = JSON.parse(fs.readFileSync(fx.targetPath, "utf8"));
  assert.ok(path.isAbsolute(payload.workspace));
  assert.ok(!payload.workspace.startsWith(`${fx.root}${path.sep}`), "workspace is outside the live root");
  assert.ok(!fs.existsSync(payload.workspace), "workspace cleaned after run");
  cleanup(fx);
});

// 2. Agent output becomes proposed writes without modifying live governed state
//    until the approved transaction commits.
test("agent output does not mutate governed state before commit", async () => {
  const fx = makeFixture();
  // Deny approval: the agent still runs and proposes, but nothing is committed.
  const denied = await runTransactionalAgent(baseRun(fx, { runId: "RUN-NOCOMMIT-1", approvalProvider: () => ({ approved: false, reason: "held" }) }));
  assert.equal(denied.proposal.status, "created");
  assert.equal(denied.proposal.writeCount, 1);
  assert.equal(denied.institutionalResult, "not_approved");
  assert.ok(!fs.existsSync(fx.targetPath), "no governed file created without approval");
  cleanup(fx);
});

// 3 & 16. Agent attempting a direct out-of-workspace governed write is detected.
test("external absolute-path governed write is prevented by chroot isolation", async () => {
  const fx = makeFixture();
  const protectedPath = path.join(fx.root, "institution", "charter.md");
  fs.writeFileSync(protectedPath, "ORIGINAL CHARTER");
  const agent = externalNodeAgent(`
    const fs = require("fs");
    const path = require("path");
    const protectedPath = ${JSON.stringify(protectedPath)};
    let denied = false;
    try { fs.writeFileSync(protectedPath, "DIRECTLY-TAMPERED"); } catch (error) { denied = true; }
    const outputDir = process.env.CITIZEN_AUDIT_OUTPUT_DIR;
    fs.mkdirSync(path.join(outputDir, "public", "data"), { recursive: true });
    fs.writeFileSync(path.join(outputDir, "public", "data", "report.json"), JSON.stringify({ denied }));
  `.replace("${JSON.stringify(protectedPath)}", JSON.stringify(protectedPath)));
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-DIRECT-1", agent }));
  assert.equal(result.institutionalResult, "committed");
  assert.equal(fs.readFileSync(protectedPath, "utf8"), "ORIGINAL CHARTER");
  assert.equal(JSON.parse(fs.readFileSync(fx.targetPath, "utf8")).denied, true);
  cleanup(fx);
});

// 4. Absolute-path write proposal is rejected.
test("absolute-path proposal is rejected", () => {
  const fx = makeFixture();
  const { problems, writes } = validateProposedWrites(fx.root, [{ operation: "create", path: "/etc/passwd", content: "x", encoding: "utf8" }]);
  assert.equal(writes.length, 0);
  assert.ok(problems.some((p) => /absolute|traversal|invalid|escape|relative/i.test(p)));
  cleanup(fx);
});

// 5. Path traversal is rejected.
test("path traversal is rejected", () => {
  const fx = makeFixture();
  const { problems, writes } = validateProposedWrites(fx.root, [{ operation: "create", path: "../escape.json", content: "x", encoding: "utf8" }]);
  assert.equal(writes.length, 0);
  assert.ok(problems.length > 0);
  cleanup(fx);
});

// 6. Symlink escape is rejected.
test("symlink component is rejected", () => {
  const fx = makeFixture();
  fs.mkdirSync(path.join(fx.root, "public", "data", "real"), { recursive: true });
  fs.symlinkSync(path.join(fx.root, "public", "data", "real"), path.join(fx.root, "public", "data", "link"));
  const { problems, writes } = validateProposedWrites(fx.root, [{ operation: "create", path: "public/data/link/x.json", content: "x", encoding: "utf8" }]);
  assert.equal(writes.length, 0);
  assert.ok(problems.length > 0);
  cleanup(fx);
});

// 7 & 8. Duplicate / conflicting operations on one path are rejected.
test("duplicate and conflicting operations are rejected", () => {
  const fx = makeFixture();
  fs.writeFileSync(fx.targetPath, "exists");
  const { problems, writes } = validateProposedWrites(fx.root, [
    { operation: "update", path: "public/data/report.json", content: "a", encoding: "utf8" },
    { operation: "delete", path: "public/data/report.json" }
  ]);
  assert.ok(problems.some((p) => /duplicate or conflicting/i.test(p)));
  assert.equal(writes.length, 1, "only the first op is kept; the conflicting one is rejected");
  cleanup(fx);
});

// 9 & 10. Proposed writes become an immutable transaction whose write-set hash
//         matches the captured bytes.
test("proposed writes become an immutable transaction with matching write-set hash", () => {
  const fx = makeFixture();
  const { writes } = validateProposedWrites(fx.root, [{ operation: "create", path: "public/data/report.json", content: "hello", encoding: "utf8" }]);
  const intent = buildTransactionIntent({ actor: { type: "agent", id: "AGENT-REPAIR" }, action: "write_report", agentRunId: "RUN-X", proposedWrites: writes, affectedObjects: ["REPORT-TARGET"] });
  assert.equal(intent.writeSetHash, computeWriteSetHash(writes));
  assert.equal(intent.transaction.writeSetHash, intent.writeSetHash);
  assert.equal(intent.transaction.id, deriveTransactionId("RUN-X", intent.writeSetHash));
  assert.ok(Object.isFrozen(intent) && Object.isFrozen(intent.transaction), "intent is frozen");
  cleanup(fx);
});

// 11. Denied approval causes no mutation.
test("denied approval causes no mutation", async () => {
  const fx = makeFixture();
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-DENY-1", approvalProvider: () => ({ approved: false, reason: "denied by governance" }) }));
  assert.equal(result.institutionalResult, "not_approved");
  assert.equal(result.approval.status, "denied");
  assert.ok(!fs.existsSync(fx.targetPath));
  assert.ok(!fs.existsSync(fx.ledgerPath), "no execution attempt recorded");
  cleanup(fx);
});

// 12. Missing approval (default deny) causes no mutation.
test("missing approval causes no mutation", async () => {
  const fx = makeFixture();
  const opts = baseRun(fx, { runId: "RUN-NOAPPROVE-1" });
  delete opts.approvalProvider; // fall back to DENY_BY_DEFAULT
  const result = await runTransactionalAgent(opts);
  assert.equal(result.institutionalResult, "not_approved");
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

// 13. Approved execution commits through executeApprovedTransaction.
test("approved execution commits through the orchestrator", async () => {
  const fx = makeFixture();
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-COMMIT-1" }));
  assert.equal(result.institutionalResult, "committed");
  assert.equal(result.execution.disposition, "committed");
  assert.ok(fs.existsSync(fx.targetPath));
  const recorded = getTransaction(result.transactionId, { rootDir: fx.root });
  assert.equal(recorded.status, "approved");
  assert.equal(getExecutionAttempt(result.execution.attemptId, { ledgerPath: fx.ledgerPath }).state, "committed");
  cleanup(fx);
});

// 14. Agent exit zero with invalid output does not produce institutional success.
test("agent exit zero with prohibited output does not succeed", async () => {
  const fx = makeFixture();
  const agent = externalNodeAgent(`
    const fs = require("fs");
    const path = require("path");
    const outputDir = process.env.CITIZEN_AUDIT_OUTPUT_DIR;
    fs.mkdirSync(path.join(outputDir, "kernel", "registry"), { recursive: true });
    fs.writeFileSync(path.join(outputDir, "kernel", "registry", "institution.json"), "{}");
  `);
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-INVALID-1", agent }));
  assert.equal(result.agentProcess.status, 0, "agent process exited zero");
  assert.equal(result.institutionalResult, "proposal_rejected");
  assert.equal(result.transactionId, null, "prohibited proposal is rejected before transaction recording");
  cleanup(fx);
});

// 15. Agent process failure causes no governed mutation.
test("agent process failure causes no mutation", async () => {
  const fx = makeFixture();
  const agent = externalNodeAgent(`process.stderr.write("agent crashed\\n"); process.exit(7);`);
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-FAIL-1", agent }));
  assert.equal(result.institutionalResult, "agent_failed");
  assert.equal(result.agentProcess.status, 7);
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("production runtime rejects in-process function agents before execution", async () => {
  const fx = makeFixture();
  let ran = false;
  const result = await runTransactionalAgent(baseRun(fx, {
    runId: "RUN-INPROCESS-1",
    agent: { fn: () => { ran = true; } }
  }));
  assert.equal(ran, false);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.ok(result.problems.some((problem) => /in-process/i.test(problem)));
  cleanup(fx);
});

// 17. Runtime result matches the durable ledger disposition.
test("runtime result matches durable ledger disposition", async () => {
  const fx = makeFixture();
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-MATCH-1" }));
  const attempt = getExecutionAttempt(result.execution.attemptId, { ledgerPath: fx.ledgerPath });
  assert.equal(result.institutionalResult, attempt.state);
  assert.equal(result.execution.disposition, attempt.state);
  cleanup(fx);
});

// 18. Runtime cannot report committed when the durable ledger shows rollback.
test("runtime does not report committed on rollback", async () => {
  const fx = makeFixture();
  const dir = makeValidatorsDir([{ id: "boom", supportedPhases: ["post_write"], source: "module.exports={id:'boom',version:'1.0.0',supportedPhases:['post_write'],validate:()=>{throw new Error('post-write fail');}};" }]);
  writeJson(path.join(fx.root, "kernel", "execution", "policy.json"), { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["boom"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true } } });
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-NOCOMMIT-2", validatorsDir: dir }));
  assert.notEqual(result.institutionalResult, "committed");
  assert.equal(result.execution.disposition, "rolled_back");
  const committed = readExecutionLedger({ ledgerPath: fx.ledgerPath }).committedTransactions;
  assert.ok(!(result.transactionId in committed), "ledger shows no committed record");
  cleanupValidatorsDir(dir); cleanup(fx);
});

// 19. Existing recovery barrier blocks runtime execution.
test("recovery barrier blocks runtime execution", async () => {
  const fx = makeFixture();
  // Create a recovery_required barrier attempt directly in the ledger.
  const { transitionExecutionAttempt } = require("../kernel/execution/ledger");
  const h = "a".repeat(64);
  createExecutionAttempt({ id: "ATTEMPT-BARRIER-0001", transactionId: "TX-BARRIER", writeSetHash: h, actor: { type: "system", id: "sys" }, authorityStateHash: h, policyHash: h, validatorSetHash: h, planHash: h }, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "recovery_persisted", { preStateManifestHash: h }, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "applying", {}, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "rolling_back", {}, { ledgerPath: fx.ledgerPath });
  transitionExecutionAttempt("ATTEMPT-BARRIER-0001", "recovery_required", { rollbackResultHash: h }, { ledgerPath: fx.ledgerPath });
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-BARRIER-1" }));
  assert.notEqual(result.institutionalResult, "committed");
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

// 20. Concurrent runtime executions cannot both mutate (lock is exclusive).
test("held execution lock blocks a concurrent runtime run", async () => {
  const fx = makeFixture();
  const lock = acquireExecutionLock(fx.root, "ATTEMPT-HOLDER-0001");
  assert.ok(lock);
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-LOCKED-1" }));
  assert.notEqual(result.institutionalResult, "committed");
  assert.ok(!fs.existsSync(fx.targetPath), "no mutation while lock held");
  cleanup(fx);
});

// 21. Crash recovery works through the runtime entry point.
test("crash mid-execution is recoverable through startup recovery", async () => {
  const fx = makeFixture();
  const onStep = (point) => { if (point === "after_materialized") { const e = new Error("simulated crash"); e.code = "INJECTED_CRASH"; throw e; } };
  let threw = false;
  try {
    await runTransactionalAgent(baseRun(fx, { runId: "RUN-CRASH-1", onStep }));
  } catch (error) { threw = /INJECTED_CRASH|crash/i.test(error.message); }
  // The runtime surfaces the crash (institutionalResult error) or throws; either
  // way the durable ledger has an incomplete attempt that startup recovery resolves.
  const recovery = recoverIncompleteExecution(fx.root, { ledgerPath: fx.ledgerPath, assumeOwnerDead: true });
  assert.ok(recovery, "recovery ran");
  const ledger = readExecutionLedger({ ledgerPath: fx.ledgerPath });
  assert.ok(!ledger.committedTransactions.length, "crashed attempt did not commit");
  cleanup(fx);
});

// 22. Post-write validator failure rolls back through the runtime.
test("post-write validator failure rolls back through the runtime", async () => {
  const fx = makeFixture();
  const dir = makeValidatorsDir([{ id: "boom", supportedPhases: ["post_write"], source: "module.exports={id:'boom',version:'1.0.0',supportedPhases:['post_write'],validate:()=>{throw new Error('validator exploded');}};" }]);
  writeJson(path.join(fx.root, "kernel", "execution", "policy.json"), { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["boom"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true } } });
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-ROLLBACK-1", validatorsDir: dir }));
  assert.equal(result.institutionalResult, "rolled_back");
  assert.ok(!fs.existsSync(fx.targetPath), "created file rolled back");
  cleanupValidatorsDir(dir); cleanup(fx);
});

// 23. Rollback failure produces recovery_required.
test("rollback failure produces recovery_required", async () => {
  const fx = makeFixture();
  fs.writeFileSync(fx.targetPath, "ORIGINAL-BYTES"); // pre-existing => snapshot blob created
  const { blobRoot } = require("../kernel/execution/recovery-paths");
  const dir = makeValidatorsDir([{ id: "boom", supportedPhases: ["post_write"], source: "module.exports={id:'boom',version:'1.0.0',supportedPhases:['post_write'],validate:()=>{throw new Error('force rollback');}};" }]);
  writeJson(path.join(fx.root, "kernel", "execution", "policy.json"), { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["boom"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true } } });
  const onStep = (point) => {
    if (point === "after_manifest") {
      const rootDir = blobRoot(fx.root);
      for (const name of fs.readdirSync(rootDir)) fs.writeFileSync(path.join(rootDir, name), "tampered-blob");
    }
  };
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-RECOVERY-1", agent: reportAgent({ updated: true }), validatorsDir: dir, onStep }));
  assert.equal(result.institutionalResult, "recovery_required");
  cleanupValidatorsDir(dir); cleanup(fx);
});

// 24. Duplicate runtime execution cannot commit the same transaction twice.
test("duplicate runtime execution cannot commit the same transaction twice", async () => {
  const fx = makeFixture();
  const first = await runTransactionalAgent(baseRun(fx, { runId: "RUN-DUP-1" }));
  assert.equal(first.institutionalResult, "committed");
  // Same runId + identical write set => identical transaction id => second commit is refused.
  const second = await runTransactionalAgent(baseRun(fx, { runId: "RUN-DUP-1" }));
  assert.notEqual(second.institutionalResult, "committed");
  const committed = readExecutionLedger({ ledgerPath: fx.ledgerPath }).committedTransactions;
  assert.equal(Object.keys(committed).filter((id) => id === first.transactionId).length, 1, "transaction committed exactly once");
  cleanup(fx);
});
