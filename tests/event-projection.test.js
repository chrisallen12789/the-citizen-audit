const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runTransactionalAgent } = require("../kernel/runtime/transactional-runtime");
const { readExecutionLedger } = require("../kernel/execution/ledger");
const { projectExecutionEvents, projectionIsDeterministic } = require("../kernel/events/projection");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

const REQUIRED_SYSTEMS = [
  ["SYSTEM-INSTITUTION", "institution/"], ["SYSTEM-KERNEL", "kernel/"], ["SYSTEM-MEMORY", "memory/"],
  ["SYSTEM-WORKFORCE", "agents/"], ["SYSTEM-PLATFORM", "public/"], ["SYSTEM-AUDITS", "audits/"], ["SYSTEM-SCHEMAS", "schemas/"]
];

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-ev-"));
  const objects = REQUIRED_SYSTEMS.map(([id, p]) => ({ id, type: "system", name: id, path: p, description: id, dependsOn: [] }));
  objects.push({ id: "REPORT-TARGET", type: "report", name: "t", path: "public/data/", description: "t", dependsOn: ["SYSTEM-PLATFORM"] });
  for (const [, p] of REQUIRED_SYSTEMS) fs.mkdirSync(path.join(root, p), { recursive: true });
  fs.mkdirSync(path.join(root, "public", "data"), { recursive: true });
  writeJson(path.join(root, "kernel", "registry", "institution.json"), { version: "1.0.0", updated: "2026-07-06", objects });
  writeJson(path.join(root, "agents", "registry.json"), { agents: [{ id: "AGENT-REPAIR", status: "active", authorityLevel: 1, capabilities: ["write_report"], command: "node x" }] });
  writeJson(path.join(root, "kernel", "permissions", "rules.json"), { rules: [{ id: "R", action: "write_report", minimumAuthorityLevel: 1, requiresHumanApproval: false }] });
  writeJson(path.join(root, "kernel", "permissions", "authority-levels.json"), { levels: [{ level: 0 }, { level: 1 }] });
  writeJson(path.join(root, "kernel", "execution", "policy.json"), { version: "1.0.0", updated: "2026-07-06", requireAffectedObjectCoverage: true, requiredValidators: ["execution-plan", "exact-materialization", "institution-registry", "dependency-graph"], prohibitedPaths: [], prohibitedPrefixes: ["kernel/", "agents/", "schemas/", "institution/", "audits/", "memory/"], actions: { write_report: { allowedPaths: [], allowedPrefixes: ["public/data/"], allowDelete: true } } });
  return { root, ledgerPath: path.join(root, "kernel", "execution", "state", "ledger.jsonl") };
}
function cleanup(fx) { fs.rmSync(fx.root, { recursive: true, force: true }); }

async function populate(fx) {
  const approve = () => ({ approved: true, approvedBy: { type: "human", id: "h" }, decisionId: "D" });
  const agent = { command: process.execPath, args: ["-e", `
    const fs=require("fs"); const path=require("path");
    const outputDir=process.env.CITIZEN_AUDIT_OUTPUT_DIR;
    fs.mkdirSync(path.join(outputDir,"public","data"),{recursive:true});
    fs.writeFileSync(path.join(outputDir,"public","data","report.json"),JSON.stringify({g:true}));
  `] };
  return runTransactionalAgent({ rootDir: fx.root, runId: "RUN-EV-0001", agent, actor: { type: "agent", id: "AGENT-REPAIR" }, action: "write_report", affectedObjects: ["REPORT-TARGET"], approvalProvider: approve, ledgerPath: fx.ledgerPath });
}

// 25. Event projection matches execution ledger entries.
test("event projection matches execution ledger entries", async () => {
  const fx = makeFixture();
  const run = await populate(fx);
  assert.equal(run.institutionalResult, "committed");
  const ledger = readExecutionLedger({ ledgerPath: fx.ledgerPath });
  const projection = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  assert.equal(projection.count, ledger.entries.length, "one event per ledger entry");
  // Every event correlates to a transaction id and an attempt id present in the ledger.
  for (const event of projection.events) {
    assert.ok(event.transactionId && event.attemptId);
    assert.ok(event.relatedRecords.includes(event.transactionId));
    assert.ok(event.relatedRecords.includes(event.attemptId));
  }
  // A committed transition event exists for the committed transaction.
  assert.ok(projection.events.some((e) => e.type === "execution.attempt.committed" && e.transactionId === run.transactionId));
  cleanup(fx);
});

// 26. Event projection rebuild is deterministic.
test("event projection rebuild is deterministic", async () => {
  const fx = makeFixture();
  await populate(fx);
  const a = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  const b = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  assert.equal(a.projectionHash, b.projectionHash);
  assert.deepEqual(a.events.map((e) => e.id), b.events.map((e) => e.id));
  assert.equal(projectionIsDeterministic({ ledgerPath: fx.ledgerPath }), true);
  cleanup(fx);
});

// 27. Ledger tampering prevents event projection.
test("ledger tampering prevents event projection", async () => {
  const fx = makeFixture();
  await populate(fx);
  const tampered = fs.readFileSync(fx.ledgerPath, "utf8").replace('"committed"', '"validating"');
  fs.writeFileSync(fx.ledgerPath, tampered);
  assert.throws(() => projectExecutionEvents({ ledgerPath: fx.ledgerPath }), /verification|chain|hash|ledger/i);
  cleanup(fx);
});

// 28. Event IDs are derived from the verified ledger sequence, not unlocked
//     append-file scanning.
test("event ids derive from verified ledger sequence", async () => {
  const fx = makeFixture();
  await populate(fx);
  const projection = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  const ledger = readExecutionLedger({ ledgerPath: fx.ledgerPath });
  projection.events.forEach((event, index) => {
    const expected = `EXEC-EVENT-${String(ledger.entries[index].sequence).padStart(8, "0")}`;
    assert.equal(event.id, expected);
    assert.equal(event.ledgerSequence, ledger.entries[index].sequence);
    assert.equal(event.ledgerHash, ledger.entries[index].hash);
  });
  // IDs are unique and monotonic in ledger sequence.
  const ids = projection.events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  cleanup(fx);
});
