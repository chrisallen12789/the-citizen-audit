const path = require("path");
const { appendEntry, readVerifiedLog, sha256 } = require("../lib/append-only-log");
const { canonicalStringify } = require("../lib/canonical-json");
const { loadRecoveryDecision } = require("../approvals/recovery-decision-store");
const { snapshotGovernedTree } = require("../runtime/governed-tree-guard");
const { acquireExecutionLock, defaultExecutionStateRoot, releaseExecutionLock } = require("./exclusive-boundary");
const { unlinkDurable } = require("./durable-io");
const { readRuntimeIsolationBarrier, runtimeIsolationBarrierPath } = require("./runtime-isolation-barrier");

const TRANSIENT_RECOVERY_PATHS = Object.freeze([
  "kernel/execution/state/runtime-isolation-barrier.json",
  "kernel/execution/state/lock.json",
  "kernel/execution/state/runtime-isolation-clearance-ledger.jsonl",
  "kernel/execution/state/recovery-decisions"
]);

function clearanceLedgerPath(rootDir) {
  return path.join(defaultExecutionStateRoot(rootDir), "runtime-isolation-clearance-ledger.jsonl");
}

function readClearanceLedger(rootDir) {
  return readVerifiedLog(clearanceLedgerPath(rootDir), "runtime isolation clearance ledger");
}

function isTransient(relativePath) {
  return TRANSIENT_RECOVERY_PATHS.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
}

function verificationView(expected, actual) {
  const expectedPaths = new Set(expected.entries.map((entry) => entry.path));
  const entries = actual.entries.filter((entry) => !isTransient(entry.path)).map((entry) => ({ ...entry }));

  // Barrier and decision creation can introduce otherwise-empty parent directories.
  // Prune only directories absent from the expected manifest and containing no
  // non-pruned descendant. Never prune files or expected directories.
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.type !== "directory" || expectedPaths.has(entry.path)) continue;
      const prefix = `${entry.path}/`;
      if (!entries.some((candidate, candidateIndex) => candidateIndex !== index && candidate.path.startsWith(prefix))) {
        entries.splice(index, 1);
        changed = true;
      }
    }
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  const body = { version: actual.version, prefixes: actual.prefixes, entries };
  return Object.freeze({ ...body, manifestHash: sha256(canonicalStringify(body)) });
}

function clearRuntimeIsolationBarrierAuthorized(rootDir, decisionId, options = {}) {
  const lockId = `ATTEMPT-RECOVERY-${sha256(decisionId).slice(0, 40).toUpperCase()}`;
  const lock = acquireExecutionLock(rootDir, lockId, { acquiredAt: options.startedAt });
  try {
    const barrier = readRuntimeIsolationBarrier(rootDir);
    if (!barrier) throw new Error("No runtime isolation barrier exists.");

    const decision = loadRecoveryDecision(rootDir, decisionId);
    if (decision.barrierHash !== barrier.barrierHash) throw new Error("Recovery decision is not bound to the current barrier.");
    if (!barrier.expectedManifest || barrier.expectedManifest.manifestHash !== barrier.expectedManifestHash) {
      throw new Error("Barrier lacks a verified expected restoration manifest.");
    }

    const rawActual = snapshotGovernedTree(rootDir, { prefixes: barrier.expectedManifest.prefixes });
    const actual = verificationView(barrier.expectedManifest, rawActual);
    const expectedBody = {
      version: barrier.expectedManifest.version,
      prefixes: barrier.expectedManifest.prefixes,
      entries: barrier.expectedManifest.entries
    };
    const actualBody = { version: actual.version, prefixes: actual.prefixes, entries: actual.entries };
    const verified = canonicalStringify(actualBody) === canonicalStringify(expectedBody);
    if (!verified) {
      throw new Error(`Governed state does not match the expected restoration manifest (${actual.manifestHash}).`);
    }

    const prior = readClearanceLedger(rootDir).entries.find((entry) =>
      entry.recordType === "runtime.isolation.barrier.cleared" && entry.clearanceDecisionId === decisionId
    );
    if (!prior) {
      appendEntry(clearanceLedgerPath(rootDir), {
        recordType: "runtime.isolation.barrier.cleared",
        originalBarrierHash: barrier.barrierHash,
        recoveryActor: decision.recoveryActor,
        recoveryAuthority: decision.recoveryAuthority,
        verification: {
          verified: true,
          expectedManifestHash: barrier.expectedManifestHash,
          actualManifestHash: actual.manifestHash,
          rawActualManifestHash: rawActual.manifestHash
        },
        clearanceDecisionId: decision.decisionId,
        clearanceDecisionHash: decision.recordHash
      }, {
        label: "runtime isolation clearance ledger",
        recordedAt: options.clearedAt || new Date().toISOString()
      });
    }

    // Removal is private to this authorized operation and occurs only after the
    // append-only clearance record is durable while the execution lock is held.
    unlinkDurable(runtimeIsolationBarrierPath(rootDir));
    return Object.freeze({
      cleared: true,
      originalBarrierHash: barrier.barrierHash,
      decisionId,
      verified: true,
      actualManifestHash: actual.manifestHash
    });
  } finally {
    releaseExecutionLock(rootDir, lock);
  }
}

module.exports = {
  TRANSIENT_RECOVERY_PATHS,
  clearanceLedgerPath,
  clearRuntimeIsolationBarrierAuthorized,
  readClearanceLedger,
  verificationView
};
