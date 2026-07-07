const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createExecutionAttempt, readExecutionLedger, transitionExecutionAttempt } = require("../kernel/execution/ledger");
const { projectExecutionEvents, projectionIsDeterministic } = require("../kernel/events/projection");
const { validateExecutionEvent, validateExecutionProjection } = require("../kernel/events/validate");

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase41-events-"));
  return {
    root,
    ledgerPath: path.join(root, "kernel", "execution", "state", "ledger.jsonl")
  };
}

function populate(fx, suffix = "0001") {
  const attemptId = `ATTEMPT-EVENT-${suffix}`;
  const transactionId = `TX-EVENT-${suffix}`;
  createExecutionAttempt({
    id: attemptId,
    transactionId,
    writeSetHash: HASH_A,
    actor: { type: "agent", id: "AGENT-EVENT" },
    authorityStateHash: HASH_B,
    policyHash: HASH_C,
    validatorSetHash: HASH_D,
    planHash: HASH_E,
    metadata: { authoritativeSource: "execution-ledger" }
  }, {
    ledgerPath: fx.ledgerPath,
    createdAt: "2026-07-07T12:00:00.000Z",
    recordedAt: "2026-07-07T12:00:00.000Z"
  });
  transitionExecutionAttempt(attemptId, "recovery_persisted", { preStateManifestHash: HASH_B }, { ledgerPath: fx.ledgerPath, transitionedAt: "2026-07-07T12:00:01.000Z", recordedAt: "2026-07-07T12:00:01.000Z" });
  transitionExecutionAttempt(attemptId, "applying", {}, { ledgerPath: fx.ledgerPath, transitionedAt: "2026-07-07T12:00:02.000Z", recordedAt: "2026-07-07T12:00:02.000Z" });
  transitionExecutionAttempt(attemptId, "validating", {}, { ledgerPath: fx.ledgerPath, transitionedAt: "2026-07-07T12:00:03.000Z", recordedAt: "2026-07-07T12:00:03.000Z" });
  transitionExecutionAttempt(attemptId, "committed", { validationResultHash: HASH_C }, { ledgerPath: fx.ledgerPath, transitionedAt: "2026-07-07T12:00:04.000Z", recordedAt: "2026-07-07T12:00:04.000Z" });
  return { attemptId, transactionId };
}

function cleanup(fx) {
  fs.rmSync(fx.root, { recursive: true, force: true });
}

function projectInChild(ledgerPath) {
  const projectionPath = require.resolve("../kernel/events/projection");
  const source = `const {projectExecutionEvents}=require(${JSON.stringify(projectionPath)});process.stdout.write(projectExecutionEvents({ledgerPath:${JSON.stringify(ledgerPath)}}).projectionHash);`;
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(process.execPath, ["-e", source], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `child exited ${code}`)));
  });
}

test("event projection is a one-to-one schema-valid view of verified ledger entries", () => {
  const fx = makeFixture();
  const run = populate(fx);
  const ledger = readExecutionLedger({ ledgerPath: fx.ledgerPath });
  const projection = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  assert.equal(projection.count, ledger.entries.length);
  assert.equal(validateExecutionProjection(projection.events), true);
  for (const event of projection.events) {
    assert.equal(validateExecutionEvent(event).valid, true);
    assert.ok(event.relatedRecords.includes(event.transactionId));
    assert.ok(event.relatedRecords.includes(event.attemptId));
  }
  assert.ok(projection.events.some((event) => event.type === "execution.attempt.committed" && event.transactionId === run.transactionId));
  cleanup(fx);
});

test("event projection replay is deterministic and does not write a second source of truth", () => {
  const fx = makeFixture();
  populate(fx);
  const beforeFiles = fs.readdirSync(path.dirname(fx.ledgerPath)).sort();
  const first = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  const second = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  assert.equal(first.projectionHash, second.projectionHash);
  assert.deepEqual(first.events, second.events);
  assert.equal(projectionIsDeterministic({ ledgerPath: fx.ledgerPath }), true);
  assert.deepEqual(fs.readdirSync(path.dirname(fx.ledgerPath)).sort(), beforeFiles);
  assert.equal(fs.existsSync(path.join(fx.root, "kernel", "events", "events.jsonl")), false);
  cleanup(fx);
});

test("ledger tampering prevents event projection", () => {
  const fx = makeFixture();
  populate(fx);
  const tampered = fs.readFileSync(fx.ledgerPath, "utf8").replace('"committed"', '"validating"');
  fs.writeFileSync(fx.ledgerPath, tampered);
  assert.throws(() => projectExecutionEvents({ ledgerPath: fx.ledgerPath }), /verification|chain|hash|ledger/i);
  cleanup(fx);
});

test("event identity is derived only from verified ledger sequence and hash", () => {
  const fx = makeFixture();
  populate(fx);
  const projection = projectExecutionEvents({ ledgerPath: fx.ledgerPath });
  const ledger = readExecutionLedger({ ledgerPath: fx.ledgerPath });
  projection.events.forEach((event, index) => {
    assert.equal(event.id, `EXEC-EVENT-${String(ledger.entries[index].sequence).padStart(8, "0")}`);
    assert.equal(event.ledgerSequence, ledger.entries[index].sequence);
    assert.equal(event.ledgerHash, ledger.entries[index].hash);
  });
  assert.equal(new Set(projection.events.map((event) => event.id)).size, projection.events.length);
  cleanup(fx);
});

test("duplicate event IDs and replayed sequences fail projection validation", () => {
  const fx = makeFixture();
  populate(fx);
  const events = projectExecutionEvents({ ledgerPath: fx.ledgerPath }).events.map((event) => JSON.parse(JSON.stringify(event)));
  events[1] = { ...events[1], id: events[0].id };
  assert.throws(() => validateExecutionProjection(events), /hash verification|duplicate execution event id/i);

  const replay = projectExecutionEvents({ ledgerPath: fx.ledgerPath }).events.map((event) => JSON.parse(JSON.stringify(event)));
  replay[1] = { ...replay[1], ledgerSequence: replay[0].ledgerSequence };
  assert.throws(() => validateExecutionProjection(replay), /hash verification|sequence mismatch/i);
  cleanup(fx);
});

test("malformed event schema and event-hash tampering fail closed", () => {
  const fx = makeFixture();
  populate(fx);
  const original = projectExecutionEvents({ ledgerPath: fx.ledgerPath }).events[0];
  const malformed = { ...original, unexpected: true };
  const malformedResult = validateExecutionEvent(malformed);
  assert.equal(malformedResult.valid, false);
  assert.ok(malformedResult.problems.some((problem) => /undeclared field/i.test(problem)));

  const tampered = { ...original, transactionId: "TX-TAMPERED" };
  const tamperedResult = validateExecutionEvent(tampered);
  assert.equal(tamperedResult.valid, false);
  assert.ok(tamperedResult.problems.some((problem) => /hash verification failed/i.test(problem)));
  cleanup(fx);
});

test("concurrent projection readers observe the same ledger-derived identity without allocating IDs", async () => {
  const fx = makeFixture();
  populate(fx);
  const before = fs.readFileSync(fx.ledgerPath);
  const hashes = await Promise.all(Array.from({ length: 6 }, () => projectInChild(fx.ledgerPath)));
  assert.equal(new Set(hashes).size, 1);
  assert.deepEqual(fs.readFileSync(fx.ledgerPath), before);
  assert.equal(fs.existsSync(path.join(path.dirname(fx.ledgerPath), "events.jsonl")), false);
  cleanup(fx);
});
