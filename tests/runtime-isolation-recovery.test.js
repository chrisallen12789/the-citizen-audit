const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { recordRecoveryDecision } = require("../kernel/approvals/recovery-decision-store");
const {
  readRuntimeIsolationBarrier,
  recordRuntimeIsolationBarrier,
  runtimeIsolationBarrierPath
} = require("../kernel/execution/runtime-isolation-barrier");
const { snapshotGovernedTree } = require("../kernel/runtime/governed-tree-guard");
const { acquireExecutionLock, releaseExecutionLock } = require("../kernel/execution/exclusive-boundary");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase41-recovery-"));
  fs.mkdirSync(path.join(root, "institution"), { recursive: true });
  fs.writeFileSync(path.join(root, "institution", "charter.md"), "RESTORED");
  writeJson(path.join(root, "kernel", "authority", "approval-authorities.json"), {
    version: "1.0.0",
    authorities: [{
      type: "human",
      id: "recovery-officer",
      status: "active",
      authorities: ["clear_runtime_isolation_barrier"]
    }]
  });
  return { root, charter: path.join(root, "institution", "charter.md") };
}

function createBarrier(fx) {
  const expectedManifest = snapshotGovernedTree(fx.root);
  return recordRuntimeIsolationBarrier(fx.root, {
    runId: "RUN-RECOVERY-SOURCE",
    beforeHash: expectedManifest.manifestHash,
    afterHash: null,
    expectedManifest,
    problems: ["recovery verification required"]
  });
}

function createDecision(fx, barrier, overrides = {}) {
  return recordRecoveryDecision(fx.root, {
    decisionId: overrides.decisionId || "REC-DEC-CLEAR-001",
    barrierHash: overrides.barrierHash || barrier.barrierHash,
    recoveryActor: overrides.recoveryActor || { type: "human", id: "recovery-officer" },
    recoveryAuthority: overrides.recoveryAuthority || "clear_runtime_isolation_barrier",
    approver: overrides.approver || { type: "human", id: "recovery-officer" },
    decidedAt: overrides.decidedAt || "2026-07-07T12:00:00.000Z"
  });
}

function loadRecoveryModuleFresh() {
  const modulePath = require.resolve("../kernel/execution/runtime-isolation-recovery");
  delete require.cache[modulePath];
  return require(modulePath);
}

function cleanup(fx) {
  fs.rmSync(fx.root, { recursive: true, force: true });
}

test("barrier clearance is not exposed as an unauthenticated barrier API", () => {
  const barrierApi = require("../kernel/execution/runtime-isolation-barrier");
  assert.equal(barrierApi.clearRuntimeIsolationBarrier, undefined);
  assert.equal(barrierApi.clearRuntimeIsolationBarrierAuthorized, undefined);
});

test("barrier clearance requires an authoritative recovery decision", () => {
  const fx = fixture();
  createBarrier(fx);
  const { clearRuntimeIsolationBarrierAuthorized } = loadRecoveryModuleFresh();
  assert.throws(() => clearRuntimeIsolationBarrierAuthorized(fx.root, "REC-DEC-MISSING"), /ENOENT|no such file/i);
  assert.ok(fs.existsSync(runtimeIsolationBarrierPath(fx.root)));
  cleanup(fx);
});

test("recovery decision rejects an unauthorized recovery actor even when the approver is authorized", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  assert.throws(() => createDecision(fx, barrier, {
    recoveryActor: { type: "human", id: "unauthorized-operator" },
    decisionId: "REC-DEC-UNAUTHORIZED-ACTOR"
  }), /lacks authority/i);
  cleanup(fx);
});

test("barrier clearance is serialized by the authoritative execution lock", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  const decision = createDecision(fx, barrier);
  const lock = acquireExecutionLock(fx.root, "ATTEMPT-HELD-FOR-RECOVERY");
  const { clearRuntimeIsolationBarrierAuthorized } = loadRecoveryModuleFresh();
  try {
    assert.throws(() => clearRuntimeIsolationBarrierAuthorized(fx.root, decision.decisionId), /already locked/i);
    assert.ok(fs.existsSync(runtimeIsolationBarrierPath(fx.root)));
  } finally {
    releaseExecutionLock(fx.root, lock);
  }
  cleanup(fx);
});

test("barrier clearance rejects a decision bound to another barrier", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  createDecision(fx, barrier, { barrierHash: "f".repeat(64) });
  const { clearRuntimeIsolationBarrierAuthorized } = loadRecoveryModuleFresh();
  assert.throws(() => clearRuntimeIsolationBarrierAuthorized(fx.root, "REC-DEC-CLEAR-001"), /not bound to the current barrier/i);
  assert.ok(fs.existsSync(runtimeIsolationBarrierPath(fx.root)));
  cleanup(fx);
});

test("barrier clearance rejects a tampered recovery decision", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  const decision = createDecision(fx, barrier);
  const record = JSON.parse(fs.readFileSync(decision.filePath, "utf8"));
  record.barrierHash = "e".repeat(64);
  fs.writeFileSync(decision.filePath, JSON.stringify(record));
  const { clearRuntimeIsolationBarrierAuthorized } = loadRecoveryModuleFresh();
  assert.throws(() => clearRuntimeIsolationBarrierAuthorized(fx.root, decision.decisionId), /hash verification failed/i);
  assert.ok(fs.existsSync(runtimeIsolationBarrierPath(fx.root)));
  cleanup(fx);
});

test("barrier clearance fails closed when governed restoration cannot be proven", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  const decision = createDecision(fx, barrier);
  fs.writeFileSync(fx.charter, "NOT RESTORED");
  const { clearRuntimeIsolationBarrierAuthorized } = loadRecoveryModuleFresh();
  assert.throws(() => clearRuntimeIsolationBarrierAuthorized(fx.root, decision.decisionId), /does not match the expected restoration manifest/i);
  assert.ok(fs.existsSync(runtimeIsolationBarrierPath(fx.root)));
  cleanup(fx);
});

test("authorized verified clearance writes append-only evidence before unlink", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  const decision = createDecision(fx, barrier);
  const durableIo = require("../kernel/execution/durable-io");
  const originalUnlink = durableIo.unlinkDurable;
  durableIo.unlinkDurable = () => { throw new Error("injected unlink failure"); };
  const recovery = loadRecoveryModuleFresh();
  try {
    assert.throws(() => recovery.clearRuntimeIsolationBarrierAuthorized(fx.root, decision.decisionId, { clearedAt: "2026-07-07T13:00:00.000Z" }), /injected unlink failure/);
  } finally {
    durableIo.unlinkDurable = originalUnlink;
  }
  const ledger = recovery.readClearanceLedger(fx.root);
  const clearedEntries = ledger.entries.filter((entry) => entry.recordType === "runtime.isolation.barrier.cleared");
  const raisedEntries = ledger.entries.filter((entry) => entry.recordType === "runtime.isolation.barrier.raised");
  assert.equal(raisedEntries.length, 1, "barrier raise is durably recorded for reconciliation");
  assert.equal(raisedEntries[0].barrierHash, barrier.barrierHash);
  assert.equal(clearedEntries.length, 1);
  assert.equal(clearedEntries[0].originalBarrierHash, barrier.barrierHash);
  assert.equal(clearedEntries[0].clearanceDecisionId, decision.decisionId);
  assert.equal(clearedEntries[0].verification.verified, true);
  assert.ok(readRuntimeIsolationBarrier(fx.root), "barrier remains when durable unlink fails");

  const finalRecovery = loadRecoveryModuleFresh();
  const result = finalRecovery.clearRuntimeIsolationBarrierAuthorized(fx.root, decision.decisionId, { clearedAt: "2026-07-07T13:01:00.000Z" });
  assert.equal(result.cleared, true);
  assert.equal(fs.existsSync(runtimeIsolationBarrierPath(fx.root)), false);
  assert.equal(finalRecovery.readClearanceLedger(fx.root).entries.filter((entry) => entry.recordType === "runtime.isolation.barrier.cleared").length, 1, "retry does not duplicate clearance evidence");
  cleanup(fx);
});

test("direct-delete of the barrier file without authorized clearance keeps execution blocked", () => {
  const fx = fixture();
  const barrier = createBarrier(fx);
  const { assertNoRuntimeIsolationBarrier, runtimeIsolationBarrierPath: barrierPathFn } = require("../kernel/execution/runtime-isolation-barrier");
  assert.throws(() => assertNoRuntimeIsolationBarrier(fx.root), /EXECUTION_RECOVERY_REQUIRED|blocked/i);
  // administrative shortcut: remove the barrier file directly, no clearance record
  fs.rmSync(barrierPathFn(fx.root), { force: true });
  assert.equal(fs.existsSync(barrierPathFn(fx.root)), false);
  assert.throws(() => assertNoRuntimeIsolationBarrier(fx.root), /removed without an authorized clearance|EXECUTION_RECOVERY_REQUIRED/i,
    "reconciliation must detect an unauthorized direct-delete and stay failed closed");
  void barrier;
  cleanup(fx);
});
