const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { writeCanonicalJsonAtomic } = require("./durable-io");
const { defaultExecutionStateRoot } = require("./exclusive-boundary");

const BARRIER_VERSION = "1.0.0";

function runtimeIsolationBarrierPath(rootDir) {
  if (!rootDir) throw new Error("Runtime isolation barrier requires the institution root directory.");
  return path.join(defaultExecutionStateRoot(rootDir), "runtime-isolation-barrier.json");
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
  if (!record) return true;
  const error = new Error(`Execution is blocked by runtime isolation recovery barrier from ${record.runId}.`);
  error.code = "EXECUTION_RECOVERY_REQUIRED";
  error.runtimeIsolationBarrier = record;
  throw error;
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
