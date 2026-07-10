"use strict";

const path = require("path");
const { Worker } = require("worker_threads");

const { normalizeValidationResult } = require("../../kernel/execution/validation-results");
const { canonicalStringify } = require("../../kernel/lib/canonical-json");
const { sha256 } = require("../../kernel/lib/append-only-log");

const DEFAULT_TIMEOUT_MS = 5000;
const WORKER_PATH = path.join(__dirname, "validator-worker-test-core.js");
const LIMITS = { maxResultBytes: 262144, maxArrayLen: 10000, maxStdBytes: 65536 };
const TRANSPORT_RESULT_FIELDS = Object.freeze(["status", "problems", "warnings", "checkedObjects", "checkedPaths"]);
const FAILURE_CODES = new Set([
  "VALIDATOR_THROW",
  "VALIDATOR_REJECTION",
  "VALIDATOR_RESULT_INVALID",
  "VALIDATOR_TIMEOUT",
  "REGISTRY_MISMATCH",
  "CLOSURE_VERIFICATION_FAILURE",
  "WORKER_INTERNAL_FAILURE"
]);

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

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function formatFailure(code, diagnostic) {
  if (!diagnostic) return code;
  return `${code}: ${diagnostic}`;
}

function parseTransportedValidatorResult(message) {
  if (typeof message !== "string") {
    return { ok: false, error: "WORKER_INTERNAL_FAILURE: malformed worker envelope" };
  }
  const serializedBytes = Buffer.byteLength(message, "utf8");
  if (serializedBytes > LIMITS.maxResultBytes) {
    return { ok: false, error: "WORKER_INTERNAL_FAILURE: worker envelope exceeds reviewed transport bound" };
  }
  let envelope;
  try {
    envelope = JSON.parse(message);
  } catch (error) {
    return { ok: false, error: "WORKER_INTERNAL_FAILURE: worker transported invalid JSON" };
  }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { ok: false, error: "WORKER_INTERNAL_FAILURE: worker transported malformed envelope" };
  }
  if (envelope.ok !== true) {
    const keys = Object.keys(envelope);
    const hasOnlyFailureKeys = keys.every((key) => key === "ok" || key === "code" || key === "diagnostic");
    const diagnosticOk = envelope.diagnostic === undefined || typeof envelope.diagnostic === "string";
    if (
      envelope.ok === false
      && hasOnlyFailureKeys
      && typeof envelope.code === "string"
      && FAILURE_CODES.has(envelope.code)
      && diagnosticOk
    ) {
      return { ok: false, error: formatFailure(envelope.code, envelope.diagnostic) };
    }
    return { ok: false, error: "WORKER_INTERNAL_FAILURE: worker transported malformed failure envelope" };
  }
  const envelopeKeys = Object.keys(envelope);
  if (
    envelopeKeys.length !== 2
    || !Object.prototype.hasOwnProperty.call(envelope, "ok")
    || !Object.prototype.hasOwnProperty.call(envelope, "result")
  ) {
    return { ok: false, error: "WORKER_INTERNAL_FAILURE: worker transported malformed success envelope" };
  }
  const parsed = envelope.result;
  const keys = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [];
  const knownKeysOnly = keys.length === TRANSPORT_RESULT_FIELDS.length
    && TRANSPORT_RESULT_FIELDS.every((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  if (
    !parsed
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || !knownKeysOnly
    || (parsed.status !== "passed" && parsed.status !== "failed")
    || !isStringArray(parsed.problems)
    || !isStringArray(parsed.warnings)
    || !isStringArray(parsed.checkedObjects)
    || !isStringArray(parsed.checkedPaths)
  ) {
    return { ok: false, error: "VALIDATOR_RESULT_INVALID: validator transported malformed normalized content" };
  }
  return { ok: true, raw: parsed };
}

function runValidatorBoundary(descriptor, phase, context, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let stdBytes = 0;
    let worker;
    const cleanupStream = (stream) => {
      if (!stream) return;
      try { stream.removeAllListeners("data"); } catch (error) {}
      try { stream.destroy(); } catch (error) {}
    };
    const finish = (outcome, options = {}) => {
      if (settled) return;
      settled = true;
      const terminateWorker = options.terminateWorker !== false;
      (async () => {
        if (timer) clearTimeout(timer);
        if (worker) {
          cleanupStream(worker.stdout);
          cleanupStream(worker.stderr);
          if (terminateWorker) {
            try { await worker.terminate(); } catch (error) {}
          }
        }
        resolve(outcome);
      })();
    };
    const timer = setTimeout(() => finish({ ok: false, error: "VALIDATOR_TIMEOUT: validator timed out" }), timeoutMs);

    try {
      worker = new Worker(WORKER_PATH, {
        workerData: {
          closure: descriptor.closure,
          expectedContract: descriptor.contract,
          validatorId: descriptor.id,
          phase,
          context: serializableContext(context),
          limits: LIMITS
        },
        stdout: true,
        stderr: true
      });
    } catch (error) {
      finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator worker startup failed" });
      return;
    }

    const capture = (stream) => stream.on("data", (chunk) => {
      stdBytes += chunk.length;
      if (stdBytes > LIMITS.maxStdBytes) finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator exceeded reviewed stdio bound" });
    });
    capture(worker.stdout);
    capture(worker.stderr);
    worker.on("message", (msg) => finish(parseTransportedValidatorResult(msg)));
    worker.on("error", () => finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator worker crashed" }));
    worker.on("exit", () => finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator worker exited without a result" }, { terminateWorker: false }));
  });
}

function coverageProblems(descriptor, raw, context) {
  if (!descriptor.semantic || !raw || typeof raw !== "object") return [];
  const problems = [];
  const affected = (context.plan && context.plan.affectedObjects) || [];
  const writePaths = ((context.plan && context.plan.writes) || []).map((write) => write.path);
  const checkedObjects = Array.isArray(raw.checkedObjects) ? raw.checkedObjects.map(String) : null;
  const checkedPaths = Array.isArray(raw.checkedPaths) ? raw.checkedPaths.map(String) : null;
  if (checkedObjects === null) problems.push("semantic validator did not return a checkedObjects array");
  else for (const objectId of affected) if (!checkedObjects.includes(String(objectId))) problems.push(`semantic validator omitted affected object from coverage: ${objectId}`);
  if (checkedPaths === null) problems.push("semantic validator did not return a checkedPaths array");
  else for (const writePath of writePaths) if (!checkedPaths.includes(String(writePath))) problems.push(`semantic validator omitted governed write path from coverage: ${writePath}`);
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

async function runValidationPhase(phase, descriptors, context, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const ordered = [...descriptors].sort((left, right) => left.id.localeCompare(right.id));
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
