const path = require("path");
const { Worker } = require("worker_threads");
const { normalizeValidationResult } = require("./validation-results");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const DEFAULT_TIMEOUT_MS = 5000;
const WORKER_PATH = path.join(__dirname, "validator-worker.js");
const LIMITS = { maxResultBytes: 262144, maxArrayLen: 10000, maxStdBytes: 65536 };

// Only serializable, authoritative inputs cross the boundary. Function closures
// (e.g. candidate-state) are never sent; validators that need candidate reads
// reconstruct them from the serialized plan/proposed writes, and post-write
// validators read live state from rootDir inside the worker.
function serializableContext(context) {
  return {
    rootDir: context.rootDir,
    transaction: context.transaction,
    plan: context.plan,
    writeSetHash: context.writeSetHash,
    attemptId: context.attemptId,
    manifest: context.manifest
  };
}

// Run one validator inside a terminable worker with a hard deadline. Every
// abnormal outcome (timeout, crash, startup failure, no result, oversized
// output, late result) fails closed.
function runValidatorBoundary(descriptor, phase, context, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let stdBytes = 0;
    let worker;
    const finish = (outcome) => {
      if (settled) return; // ignore late results after the deadline/first outcome
      settled = true;
      if (timer) clearTimeout(timer);
      if (worker) { try { worker.terminate(); } catch (e) { /* already gone */ } }
      resolve(outcome);
    };
    const timer = setTimeout(() => finish({ ok: false, error: `validator timed out after ${timeoutMs}ms` }), timeoutMs);

    try {
      worker = new Worker(WORKER_PATH, {
        workerData: {
          modulePath: descriptor.modulePath, expectedHash: descriptor.moduleHash,
          expectedVersion: descriptor.version, validatorId: descriptor.id,
          phase, context: serializableContext(context), limits: LIMITS
        },
        stdout: true, stderr: true
      });
    } catch (error) {
      finish({ ok: false, error: `validator worker startup failed: ${error.message}` });
      return;
    }
    const capture = (stream) => stream.on("data", (chunk) => {
      stdBytes += chunk.length;
      if (stdBytes > LIMITS.maxStdBytes) finish({ ok: false, error: `validator exceeded ${LIMITS.maxStdBytes} bytes of stdio` });
    });
    capture(worker.stdout); capture(worker.stderr);
    worker.on("message", (msg) => finish(msg && typeof msg === "object" ? msg : { ok: false, error: "validator produced a malformed worker message" }));
    worker.on("error", (error) => finish({ ok: false, error: `validator worker crashed: ${error.message}` }));
    worker.on("exit", (code) => finish({ ok: false, error: `validator worker exited without a result (code ${code})` }));
  });
}

// Enforce semantic-validator coverage BEFORE normalization so a violation
// becomes a fail-closed problem. Structural (non-semantic) validators are not
// required to claim object/path coverage.
function coverageProblems(descriptor, raw, context) {
  if (!descriptor.semantic || !raw || typeof raw !== "object") return [];
  const problems = [];
  const affected = (context.plan && context.plan.affectedObjects) || [];
  const writePaths = ((context.plan && context.plan.writes) || []).map((w) => w.path);
  const checkedObjects = Array.isArray(raw.checkedObjects) ? raw.checkedObjects.map(String) : null;
  const checkedPaths = Array.isArray(raw.checkedPaths) ? raw.checkedPaths.map(String) : null;
  if (checkedObjects === null) problems.push("semantic validator did not return a checkedObjects array");
  else for (const obj of affected) if (!checkedObjects.includes(String(obj))) problems.push(`semantic validator omitted affected object from coverage: ${obj}`);
  if (checkedPaths === null) problems.push("semantic validator did not return a checkedPaths array");
  else for (const p of writePaths) if (!checkedPaths.includes(String(p))) problems.push(`semantic validator omitted governed write path from coverage: ${p}`);
  return problems;
}

async function runValidator(descriptor, phase, context, timeoutMs) {
  if (!Array.isArray(descriptor.supportedPhases) || !descriptor.supportedPhases.includes(phase)) {
    return normalizeValidationResult(descriptor, phase, null, new Error(`does not support phase ${phase}`));
  }
  const outcome = await runValidatorBoundary(descriptor, phase, context, timeoutMs);
  if (!outcome.ok) return normalizeValidationResult(descriptor, phase, null, new Error(outcome.error));
  const raw = outcome.raw;
  const extraProblems = coverageProblems(descriptor, raw, context);
  if (extraProblems.length && raw && typeof raw === "object") {
    raw.problems = [...(Array.isArray(raw.problems) ? raw.problems : []), ...extraProblems];
  }
  return normalizeValidationResult(descriptor, phase, raw, null);
}

// Run one validation phase deterministically (validators sorted by id). Every
// abnormal outcome is a failure (fail-closed). Results are serializable.
async function runValidationPhase(phase, descriptors, context, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const ordered = [...descriptors].sort((a, b) => a.id.localeCompare(b.id));
  const results = [];
  for (const descriptor of ordered) {
    results.push(await runValidator(descriptor, phase, context, timeoutMs));
  }
  const problems = results.flatMap((result) => result.problems.map((problem) => `${result.validatorId}: ${problem}`));
  const warnings = results.flatMap((result) => result.warnings.map((warning) => `${result.validatorId}: ${warning}`));
  const status = results.every((result) => result.status === "passed") ? "passed" : "failed";
  const body = { phase, status, results };
  return { phase, status, results, problems, warnings, resultHash: sha256(canonicalStringify(body)) };
}

module.exports = { DEFAULT_TIMEOUT_MS, LIMITS, runValidationPhase };
