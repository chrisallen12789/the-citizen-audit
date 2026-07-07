const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { appendEntry, readVerifiedLog, sha256 } = require("../lib/append-only-log");
const { writeCanonicalJsonAtomic } = require("./durable-io");
const { defaultExecutionStateRoot } = require("./exclusive-boundary");

const BARRIER_VERSION = "1.0.0";

function runtimeIsolationBarrierPath(rootDir) {
  if (!rootDir) throw new Error("Runtime isolation barrier requires the institution root directory.");
  return path.join(defaultExecutionStateRoot(rootDir), "runtime-isolation-barrier.json");
}

function barrierClearanceLedgerPath(rootDir) {
  return path.join(defaultExecutionStateRoot(rootDir), "runtime-isolation-clearance-ledger.jsonl");
}

// Reconcile the append-only clearance ledger: every barrier that was durably
// RAISED must have a matching authorized CLEARED record. A barrier hash that was
// raised but never cleared is "open" — if the barrier file has been removed
// without an authorized clearance (a direct-delete / administrative shortcut),
// this open state is what detects it and keeps execution failed closed.
function openBarrierHashes(rootDir) {
  let entries;
  try { entries = readVerifiedLog(barrierClearanceLedgerPath(rootDir), "runtime isolation clearance ledger").entries; }
  catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  const raised = new Set();
  const cleared = new Set();
  for (const entry of entries) {
    if (entry.recordType === "runtime.isolation.barrier.raised" && entry.barrierHash) raised.add(entry.barrierHash);
    else if (entry.recordType === "runtime.isolation.barrier.cleared" && entry.originalBarrierHash) cleared.add(entry.originalBarrierHash);
  }
  return [...raised].filter((hash) => !cleared.has(hash));
}

function readRuntimeIsolationBarrier(rootDir) {
  const barrierPath = runtimeIsolationBarrierPath(rootDir);
  if (!fs.existsSync(barrierPath)) return null;
  const stat = fs.lstatSync(barrierPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    const error = new Error("Runtime isolation barrier is not a regular file.");
    error.code = "INVALID_RUNTIME_ISOLATION_BARRIER";
    throw error;
  }
  const record = JSON.parse(fs.readFileSync(barrierPath, "utf8"));
  const { barrierHash, ...body } = record;
  if (!record || record.version !== BARRIER_VERSION || typeof record.runId !== "string" || typeof barrierHash !== "string") {
    const error = new Error("Runtime isolation barrier is malformed.");
    error.code = "INVALID_RUNTIME_ISOLATION_BARRIER";
    throw error;
  }
  if (sha256(canonicalStringify(body)) !== barrierHash) {
    const error = new Error("Runtime isolation barrier hash verification failed.");
    error.code = "INVALID_RUNTIME_ISOLATION_BARRIER";
    throw error;
  }
  return Object.freeze({ ...record, barrierPath });
}

function assertNoRuntimeIsolationBarrier(rootDir) {
  const record = readRuntimeIsolationBarrier(rootDir);
  if (record) {
    const error = new Error(`Execution is blocked by runtime isolation recovery barrier from ${record.runId}.`);
    error.code = "EXECUTION_RECOVERY_REQUIRED";
    error.runtimeIsolationBarrier = record;
    throw error;
  }
  // The barrier file is absent. Reconcile against the append-only clearance
  // ledger: if a barrier was raised but never cleared through the authorized
  // protocol, the file was removed by an unauthorized direct delete. Fail closed.
  const open = openBarrierHashes(rootDir);
  if (open.length) {
    const error = new Error(`Runtime isolation barrier ${open[0]} was removed without an authorized clearance record; execution remains blocked.`);
    error.code = "EXECUTION_RECOVERY_REQUIRED";
    error.openBarrierHashes = open;
    throw error;
  }
  return true;
}

function recordRuntimeIsolationBarrier(rootDir, details = {}) {
  if (typeof details.runId !== "string" || !details.runId) throw new Error("Runtime isolation barrier requires a run id.");
  if (!details.expectedManifest || typeof details.expectedManifest.manifestHash !== "string") throw new Error("Runtime isolation barrier requires an expected restoration manifest.");
  const body = {
    version: BARRIER_VERSION,
    runId: details.runId,
    detectedAt: details.detectedAt || new Date().toISOString(),
    beforeHash: details.beforeHash || null,
    afterHash: details.afterHash || null,
    expectedManifestHash: details.expectedManifest.manifestHash,
    expectedManifest: details.expectedManifest,
    changes: Array.isArray(details.changes) ? details.changes : [],
    problems: Array.isArray(details.problems) ? details.problems : []
  };
  const record = { ...body, barrierHash: sha256(canonicalStringify(body)) };
  // Append a durable, append-only "raised" record BEFORE writing the barrier
  // file, so that a later unauthorized direct-delete of the file is detectable by
  // reconciliation (raised-without-cleared). Idempotent for the same barrier hash.
  let priorRaised = [];
  try { priorRaised = readVerifiedLog(barrierClearanceLedgerPath(rootDir), "runtime isolation clearance ledger").entries; }
  catch (error) { if (!error || error.code !== "ENOENT") throw error; }
  const alreadyRaised = priorRaised.some((entry) => entry.recordType === "runtime.isolation.barrier.raised" && entry.barrierHash === record.barrierHash);
  if (!alreadyRaised) {
    appendEntry(barrierClearanceLedgerPath(rootDir), {
      recordType: "runtime.isolation.barrier.raised",
      barrierHash: record.barrierHash,
      runId: record.runId,
      expectedManifestHash: record.expectedManifestHash
    }, { label: "runtime isolation clearance ledger", recordedAt: body.detectedAt });
  }
  const barrierPath = runtimeIsolationBarrierPath(rootDir);
  writeCanonicalJsonAtomic(barrierPath, record, { mode: 0o600 });
  return Object.freeze({ ...record, barrierPath });
}

module.exports = {
  BARRIER_VERSION,
  assertNoRuntimeIsolationBarrier,
  readRuntimeIsolationBarrier,
  recordRuntimeIsolationBarrier,
  runtimeIsolationBarrierPath
};
