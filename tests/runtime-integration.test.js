const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { computeWriteSetHash } = require("../kernel/transactions/validate");
const { recordApprovalDecision } = require("../kernel/approvals/decision-store");
const { recordTransaction, getTransaction } = require("../kernel/transactions/store");
const { executeApprovedTransaction } = require("../kernel/execution/orchestrator");
const { getExecutionAttempt, readExecutionLedger, createExecutionAttempt } = require("../kernel/execution/ledger");
const { acquireExecutionLock } = require("../kernel/execution/exclusive-boundary");
const { recoverIncompleteExecution } = require("../kernel/execution/startup-recovery");

const { runTransactionalAgent } = require("../kernel/runtime/transactional-runtime");
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
  writeJson(path.join(root, "agents", "registry.json"), { agents: [{ id: "AGENT-REPAIR", status: "active", authorityLevel: 1, capabilities: ["write_report"], command: "node repair", runtime: { executable: "node", arguments: ["-e", "process.exit(0)"] } }] });
  writeJson(path.join(root, "kernel", "authority", "approval-authorities.json"), { version: "1.0.0", authorities: [{ type: "human", id: "human-approver", status: "active", authorities: ["approve_execution"] }] });
  writeJson(path.join(root, "kernel", "permissions", "rules.json"), { rules: [{ id: "RULE-WRITE-REPORT", action: "write_report", minimumAuthorityLevel: 1, requiresHumanApproval: false }] });
  writeJson(path.join(root, "kernel", "permissions", "authority-levels.json"), { levels: [{ level: 0 }, { level: 1 }] });
  const policy = overrides.policy || {
    version: "1.1.0", updated: "2026-07-07", warningPolicy: "nonfatal", requireAffectedObjectCoverage: true,
    requiredValidators: ["execution-plan", "exact-materialization", "institution-registry", "dependency-graph"],
    prohibitedPaths: [], prohibitedPrefixes: ["kernel/", "agents/", "schemas/", "institution/", "audits/", "memory/"],
    actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true, semanticValidators: ["write-report-semantics"] } }
  };
  if (policy.actions && policy.actions.write_report && !policy.actions.write_report.semanticValidators) policy.actions.write_report.semanticValidators = ["write-report-semantics"];
  writeJson(path.join(root, "kernel", "execution", "policy.json"), policy);

  return { root, ledgerPath, targetPath: path.join(root, "public", "data", "report.json") };
}

function cleanup(fx) { fs.rmSync(fx.root, { recursive: true, force: true }); }

function externalNodeAgent(source, extra = {}) {
  return { command: process.execPath, args: ["-e", source], ...extra };
}

// An external agent that writes one report file under its isolated workspace.
function reportAgent(content = { generated: true }) {
  const text = JSON.stringify(content);
  const encoded = JSON.stringify(text);
  return externalNodeAgent(`
    const fs = require("fs");
    const path = require("path");
    const outputDir = process.env.CITIZEN_AUDIT_OUTPUT_DIR;
    fs.mkdirSync(path.join(outputDir, "public", "data"), { recursive: true });
    fs.writeFileSync(path.join(outputDir, "public", "data", "report.json"), ${encoded});
  `, { expectedWrites: [{ operation: "write", path: "public/data/report.json", content: text, encoding: "utf8" }] });
}

function baseRun(fx, extra = {}) {
  const testAgent = extra.testAgent || extra.agent || reportAgent();
  const registryPath = path.join(fx.root, "agents", "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.agents[0].runtime = { executable: testAgent.command, arguments: [...(testAgent.args || [])] };
  writeJson(registryPath, registry);
  const runId = extra.runId || "RUN-TEST-0001";
  let approvalDecisionId;
  const expectedWrites = extra.expectedWrites || testAgent.expectedWrites;
  if (expectedWrites && extra.omitApproval !== true) {
    const captured = expectedWrites.map((write) => {
      if (write.operation === "delete") return { operation: "delete", path: write.path };
      const exists = fs.existsSync(path.join(fx.root, write.path));
      const bytes = Buffer.from(write.content, write.encoding || "utf8");
      return { operation: exists ? "update" : "create", path: write.path, content: bytes.toString("base64"), encoding: "base64" };
    });
    const normalized = validateProposedWrites(fx.root, captured);
    if (normalized.problems.length) throw new Error(normalized.problems.join("; "));
    const writeSetHash = computeWriteSetHash(normalized.writes);
    const transactionId = deriveTransactionId(runId, writeSetHash);
    approvalDecisionId = extra.approvalDecisionId || `DEC-${runId.replace(/^RUN-/, "").replace(/[^A-Z0-9-]/g, "-")}`;
    const approvalPath = path.join(fx.root, "kernel", "execution", "state", "approval-decisions", `${approvalDecisionId}.json`);
    if (!fs.existsSync(approvalPath)) recordApprovalDecision(fx.root, {
      decisionId: approvalDecisionId,
      decision: extra.denyApproval ? "denied" : "approved",
      transactionId,
      writeSetHash,
      actor: { type: "agent", id: "AGENT-REPAIR" },
      action: "write_report",
      approver: { type: "human", id: "human-approver" },
      approverAuthority: "approve_execution",
      decidedAt: "2026-07-07T12:00:00.000Z"
    });
  }
  const options = {
    rootDir: fx.root, runId, agentId: "AGENT-REPAIR", action: "write_report", affectedObjects: ["REPORT-TARGET"],
    approvalDecisionId
  };
  for (const [key, value] of Object.entries(extra)) {
    if (!["agent","testAgent","expectedWrites","denyApproval","omitApproval","approvalDecisionId","runId"].includes(key)) options[key] = value;
  }
  return options;
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
    fs.writeFileSync(path.join(outputDir, "public", "data", "report.json"), JSON.stringify({ workspaceIsSandbox: process.env.CITIZEN_AUDIT_WORKSPACE === "/workspace" }));
  `, { expectedWrites: [{ operation: "write", path: "public/data/report.json", content: JSON.stringify({ workspaceIsSandbox: true }), encoding: "utf8" }] });
  const result = await runTransactionalAgent(baseRun(fx, { testAgent: agent }));
  assert.equal(result.institutionalResult, "committed");
  const payload = JSON.parse(fs.readFileSync(fx.targetPath, "utf8"));
  assert.equal(payload.workspaceIsSandbox, true);
  cleanup(fx);
});

// 2. Agent output becomes proposed writes without modifying live governed state
//    until the approved transaction commits.
test("agent output does not mutate governed state before commit", async () => {
  const fx = makeFixture();
  // Deny approval: the agent still runs and proposes, but nothing is committed.
  const denied = await runTransactionalAgent(baseRun(fx, { runId: "RUN-NOCOMMIT-1", denyApproval: true }));
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
  `.replace("${JSON.stringify(protectedPath)}", JSON.stringify(protectedPath)), { expectedWrites: [{ operation: "write", path: "public/data/report.json", content: JSON.stringify({ denied: true }), encoding: "utf8" }] });
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-DIRECT-1", testAgent: agent }));
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
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-DENY-1", denyApproval: true }));
  assert.equal(result.institutionalResult, "not_approved");
  assert.equal(result.approval.status, "denied");
  assert.ok(!fs.existsSync(fx.targetPath));
  assert.ok(!fs.existsSync(fx.ledgerPath), "no execution attempt recorded");
  cleanup(fx);
});

// 12. Missing approval (default deny) causes no mutation.
test("missing approval causes no mutation", async () => {
  const fx = makeFixture();
  const opts = baseRun(fx, { runId: "RUN-NOAPPROVE-1", omitApproval: true });
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
  const attempt = getExecutionAttempt(result.execution.attemptId, { ledgerPath: fx.ledgerPath });
  assert.equal(attempt.state, "committed");
  const provenance = attempt.metadata.runtimeProvenance;
  for (const field of ["registeredAgentId", "executableRealPath", "executableDigest", "argumentsDigest", "runtimeVersion", "isolationAdapterVersion", "sandboxHelperSourceHash", "sandboxHelperBinaryHash"]) {
    assert.ok(provenance[field], `durable attempt binds ${field}`);
  }
  assert.equal(provenance.registeredAgentId, "AGENT-REPAIR");
  assert.equal(provenance.executableRealPath, fs.realpathSync(process.execPath));
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
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-INVALID-1", testAgent: agent }));
  assert.equal(result.agentProcess.status, 0, "agent process exited zero");
  assert.equal(result.institutionalResult, "proposal_rejected");
  assert.equal(result.transactionId, null, "prohibited proposal is rejected before transaction recording");
  cleanup(fx);
});

// 15. Agent process failure causes no governed mutation.
test("agent process failure causes no mutation", async () => {
  const fx = makeFixture();
  const agent = externalNodeAgent(`process.stderr.write("agent crashed\\n"); process.exit(7);`);
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-FAIL-1", testAgent: agent }));
  assert.equal(result.institutionalResult, "agent_failed");
  assert.equal(result.agentProcess.status, 7);
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("production runtime rejects in-process function agents before execution", async () => {
  const fx = makeFixture();
  let ran = false;
  const options = baseRun(fx, { runId: "RUN-INPROCESS-1" });
  options.agent = { fn: () => { ran = true; } };
  const result = await runTransactionalAgent(options);
  assert.equal(ran, false);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.ok(result.problems.some((problem) => /caller-controlled option: agent|executable caller option/i.test(problem)));
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("production runtime never executes approvalProvider mutation callbacks", async () => {
  const fx = makeFixture();
  const protectedPath = path.join(fx.root, "institution", "charter.md");
  fs.writeFileSync(protectedPath, "ORIGINAL");
  let ran = false;
  const options = baseRun(fx, { runId: "RUN-CALLBACK-1" });
  options.approvalProvider = () => {
    ran = true;
    fs.writeFileSync(protectedPath, "MUTATED");
    return { approved: true };
  };
  const result = await runTransactionalAgent(options);
  assert.equal(ran, false);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.equal(fs.readFileSync(protectedPath, "utf8"), "ORIGINAL");
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("production runtime never executes post-commit callbacks", async () => {
  const fx = makeFixture();
  const protectedPath = path.join(fx.root, "institution", "charter.md");
  fs.writeFileSync(protectedPath, "ORIGINAL");
  let ran = false;
  const options = baseRun(fx, { runId: "RUN-POSTCALLBACK-1" });
  options.onStep = () => {
    ran = true;
    fs.writeFileSync(protectedPath, "MUTATED");
  };
  const result = await runTransactionalAgent(options);
  assert.equal(ran, false);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.equal(fs.readFileSync(protectedPath, "utf8"), "ORIGINAL");
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("production runtime rejects caller-selected validator and ledger paths", async () => {
  const fx = makeFixture();
  for (const [key, value] of [["validatorsDir", fx.root], ["policyPath", fx.root], ["ledgerPath", fx.root]]) {
    const options = baseRun(fx, { runId: `RUN-OVERRIDE-${key.toUpperCase()}` });
    options[key] = value;
    const result = await runTransactionalAgent(options);
    assert.equal(result.institutionalResult, "agent_rejected");
    assert.ok(result.problems.some((problem) => problem.includes(key)));
  }
  cleanup(fx);
});



test("production runtime rejects undeclared caller options", async () => {
  const fx = makeFixture();
  const options = baseRun(fx, { runId: "RUN-UNKNOWN-OPTION" });
  options.futureBypass = { enabled: true };
  const result = await runTransactionalAgent(options);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.ok(result.problems.some((problem) => /undeclared caller option: futureBypass/i.test(problem)));
  assert.equal(result.agentProcess.ran, false);
  cleanup(fx);
});

test("duplicate registered agent identities are rejected before execution", async () => {
  const fx = makeFixture();
  const registryPath = path.join(fx.root, "agents", "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.agents.push(JSON.parse(JSON.stringify(registry.agents[0])));
  writeJson(registryPath, registry);
  const options = {
    rootDir: fx.root, runId: "RUN-DUPLICATE-AGENT", agentId: "AGENT-REPAIR", action: "write_report",
    affectedObjects: ["REPORT-TARGET"], approvalDecisionId: "DEC-NOT-REACHED"
  };
  const result = await runTransactionalAgent(options);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.equal(result.agentProcess.ran, false);
  assert.ok(result.problems.some((problem) => /duplicate authoritative identities/i.test(problem)));
  cleanup(fx);
});

test("unregistered agent identity is rejected before execution", async () => {
  const fx = makeFixture();
  const options = baseRun(fx, { runId: "RUN-UNKNOWN-AGENT" });
  options.agentId = "AGENT-UNKNOWN";
  const result = await runTransactionalAgent(options);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.equal(result.agentProcess.ran, false);
  assert.ok(result.problems.some((problem) => /unknown registered agent/i.test(problem)));
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("caller cannot claim a registered agent while supplying another executable", async () => {
  const fx = makeFixture();
  const options = baseRun(fx, { runId: "RUN-COMMAND-MISMATCH" });
  options.command = "/bin/sh";
  options.args = ["-c", "exit 0"];
  const result = await runTransactionalAgent(options);
  assert.equal(result.institutionalResult, "agent_rejected");
  assert.equal(result.agentProcess.ran, false);
  assert.ok(result.problems.some((problem) => /caller-controlled option: command/i.test(problem)));
  cleanup(fx);
});

// Runtime result matches the durable ledger disposition.
test("runtime result matches durable ledger disposition", async () => {
  const fx = makeFixture();
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-MATCH-1" }));
  const attempt = getExecutionAttempt(result.execution.attemptId, { ledgerPath: fx.ledgerPath });
  assert.equal(result.institutionalResult, attempt.state);
  assert.equal(result.execution.disposition, attempt.state);
  cleanup(fx);
});

test("approval decision bound to a different transaction is rejected", async () => {
  const fx = makeFixture();
  const options = baseRun(fx, { runId: "RUN-MISMATCH-1", omitApproval: true });
  const writes = reportAgent().expectedWrites;
  recordApprovalDecision(fx.root, {
    decisionId: "DEC-MISMATCH-TX",
    decision: "approved",
    transactionId: "TX-DIFFERENT",
    writeSetHash: computeWriteSetHash(writes),
    actor: { type: "agent", id: "AGENT-REPAIR" },
    action: "write_report",
    approver: { type: "human", id: "human-approver" },
    approverAuthority: "approve_execution",
    decidedAt: "2026-07-07T12:00:00.000Z"
  });
  options.approvalDecisionId = "DEC-MISMATCH-TX";
  const result = await runTransactionalAgent(options);
  assert.equal(result.institutionalResult, "not_approved");
  assert.ok(result.problems.some((problem) => /exact intent.*transaction id/i.test(problem)));
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

test("approval decision bound to a different write set, actor, or action is rejected", async () => {
  const variants = [
    { id: "WRITESET", patch: { writeSetHash: "b".repeat(64) }, match: /write-set hash/i },
    { id: "ACTOR", patch: { actor: { type: "agent", id: "OTHER-AGENT" } }, match: /actor/i },
    { id: "ACTION", patch: { action: "other_action" }, match: /action/i }
  ];
  for (const variant of variants) {
    const fx = makeFixture();
    const runId = `RUN-MISMATCH-${variant.id}`;
    const options = baseRun(fx, { runId, omitApproval: true });
    const writes = reportAgent().expectedWrites;
    const writeSetHash = computeWriteSetHash(writes);
    const input = {
      decisionId: `DEC-MISMATCH-${variant.id}`,
      decision: "approved",
      transactionId: deriveTransactionId(runId, writeSetHash),
      writeSetHash,
      actor: { type: "agent", id: "AGENT-REPAIR" },
      action: "write_report",
      approver: { type: "human", id: "human-approver" },
      approverAuthority: "approve_execution",
      decidedAt: "2026-07-07T12:00:00.000Z",
      ...variant.patch
    };
    if (variant.id === "ACTION") {
      const authorities = JSON.parse(fs.readFileSync(path.join(fx.root, "kernel", "authority", "approval-authorities.json"), "utf8"));
      authorities.authorities[0].actions = ["other_action", "write_report"];
      writeJson(path.join(fx.root, "kernel", "authority", "approval-authorities.json"), authorities);
    }
    recordApprovalDecision(fx.root, input);
    options.approvalDecisionId = input.decisionId;
    const result = await runTransactionalAgent(options);
    assert.equal(result.institutionalResult, "not_approved");
    assert.ok(result.problems.some((problem) => variant.match.test(problem)));
    assert.ok(!fs.existsSync(fx.targetPath));
    cleanup(fx);
  }
});

test("tampered approval decision record is rejected", async () => {
  const fx = makeFixture();
  const options = baseRun(fx, { runId: "RUN-TAMPER-DECISION" });
  const decisionPath = path.join(fx.root, "kernel", "execution", "state", "approval-decisions", `${options.approvalDecisionId}.json`);
  const record = JSON.parse(fs.readFileSync(decisionPath, "utf8"));
  record.transactionId = "TX-TAMPERED";
  fs.writeFileSync(decisionPath, `${JSON.stringify(record)}\n`);
  const result = await runTransactionalAgent(options);
  assert.equal(result.institutionalResult, "not_approved");
  assert.ok(result.problems.some((problem) => /record hash verification failed/i.test(problem)));
  assert.ok(!fs.existsSync(fx.targetPath));
  cleanup(fx);
});

// Existing recovery barrier blocks runtime execution.
test("recovery barrier blocks runtime execution", async () => {
  const fx = makeFixture();
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

// Concurrent runtime executions cannot both mutate.
test("held execution lock blocks a concurrent runtime run", async () => {
  const fx = makeFixture();
  const lock = acquireExecutionLock(fx.root, "ATTEMPT-HOLDER-0001");
  assert.ok(lock);
  const result = await runTransactionalAgent(baseRun(fx, { runId: "RUN-LOCKED-1" }));
  assert.notEqual(result.institutionalResult, "committed");
  assert.ok(!fs.existsSync(fx.targetPath), "no mutation while lock held");
  cleanup(fx);
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
