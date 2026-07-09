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

function parseTransportedValidatorResult(message) {
  if (!message || typeof message !== "object") {
    return { ok: false, error: "validator produced a malformed worker message" };
  }
  if (message.ok !== true) {
    return {
      ok: false,
      error: typeof message.error === "string" && message.error ? message.error : "validator produced a malformed worker message"
    };
  }
  if (typeof message.serializedResult !== "string") {
    return { ok: false, error: "validator produced a malformed serialized result" };
  }
  const serializedBytes = Buffer.byteLength(message.serializedResult, "utf8");
  if (serializedBytes > LIMITS.maxResultBytes) {
    return { ok: false, error: `validator result exceeds ${LIMITS.maxResultBytes} bytes` };
  }
  let parsed;
  try {
    parsed = JSON.parse(message.serializedResult);
  } catch (error) {
    return { ok: false, error: "validator transported invalid JSON" };
  }
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
    return { ok: false, error: "validator transported malformed normalized content" };
  }
  return { ok: true, raw: parsed };
}

function runValidatorBoundary(descriptor, phase, context, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let stdBytes = 0;
    let worker;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (worker) {
        try { worker.terminate(); } catch (error) {}
      }
      resolve(outcome);
    };
    const timer = setTimeout(() => finish({ ok: false, error: `validator timed out after ${timeoutMs}ms` }), timeoutMs);

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
      finish({ ok: false, error: `validator worker startup failed: ${error.message}` });
      return;
    }

    const capture = (stream) => stream.on("data", (chunk) => {
      stdBytes += chunk.length;
      if (stdBytes > LIMITS.maxStdBytes) finish({ ok: false, error: `validator exceeded ${LIMITS.maxStdBytes} bytes of stdio` });
    });
    capture(worker.stdout);
    capture(worker.stderr);
    worker.on("message", (msg) => finish(parseTransportedValidatorResult(msg)));
    worker.on("error", (error) => finish({ ok: false, error: `validator worker crashed: ${error.message}` }));
    worker.on("exit", (code) => finish({ ok: false, error: `validator worker exited without a result (code ${code})` }));
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
