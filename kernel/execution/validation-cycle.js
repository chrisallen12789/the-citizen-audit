"use strict";

const path = require("path");
const { Worker } = require("worker_threads");

const { normalizeValidationResult } = require("./validation-results");
const { DEFAULT_TIMEOUT_MS, REVIEWED_VALIDATOR_LIMITS } = require("./validator-limits");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { loadValidatorRegistry, selectRequiredValidators, validatorsForPhase } = require("./validators");

const WORKER_PATH = path.join(__dirname, "validator-worker.js");
const HARNESS_CHANNEL_TYPE = "validator-harness-channel-v1";
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

function validationFailure(phase, validatorIds, message) {
  const orderedIds = [...validatorIds].map(String).sort((left, right) => left.localeCompare(right));
  const results = orderedIds.map((validatorId) => normalizeValidationResult({ id: validatorId }, phase, null, new Error(message)));
  const problems = results.flatMap((result) => result.problems.map((problem) => `${result.validatorId}: ${problem}`));
  const warnings = results.flatMap((result) => result.warnings.map((warning) => `${result.validatorId}: ${warning}`));
  const body = { phase, status: "failed", results };
  return {
    phase,
    status: "failed",
    results,
    problems,
    warnings,
    resultHash: sha256(canonicalStringify(body))
  };
}

function invalidValidatorIds(validatorIds) {
  return !Array.isArray(validatorIds) || validatorIds.some((validatorId) => typeof validatorId !== "string" || !validatorId);
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
  if (serializedBytes > REVIEWED_VALIDATOR_LIMITS.maxResultBytes) {
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

function runValidatorBoundary(descriptor, expectedValidatorSetHash, phase, context, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let stdBytes = 0;
    let worker;
    let resultPort = null;
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
        if (resultPort) {
          try { resultPort.removeAllListeners(); } catch (error) {}
          try { resultPort.close(); } catch (error) {}
        }
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
          validatorId: descriptor.id,
          expectedValidatorSetHash,
          phase,
          context: serializableContext(context)
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
      if (stdBytes > REVIEWED_VALIDATOR_LIMITS.maxStdBytes) finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator exceeded reviewed stdio bound" });
    });
    capture(worker.stdout);
    capture(worker.stderr);
    worker.on("message", (msg) => {
      if (
        !resultPort
        && msg
        && typeof msg === "object"
        && msg.type === HARNESS_CHANNEL_TYPE
        && msg.port
        && typeof msg.port.on === "function"
      ) {
        resultPort = msg.port;
        resultPort.on("message", (resultMessage) => finish(parseTransportedValidatorResult(resultMessage)));
        resultPort.on("close", () => finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator harness channel closed without a result" }));
        resultPort.start();
        return;
      }
      finish({ ok: false, error: "WORKER_INTERNAL_FAILURE: validator sent an unauthorized parentPort message" });
    });
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

async function runValidator(descriptor, expectedValidatorSetHash, phase, context, timeoutMs) {
  if (!Array.isArray(descriptor.supportedPhases) || !descriptor.supportedPhases.includes(phase)) {
    return normalizeValidationResult(descriptor, phase, null, new Error(`does not support phase ${phase}`));
  }
  const outcome = await runValidatorBoundary(descriptor, expectedValidatorSetHash, phase, context, timeoutMs);
  if (!outcome.ok) return normalizeValidationResult(descriptor, phase, null, new Error(outcome.error));
  const raw = outcome.raw;
  const extraProblems = coverageProblems(descriptor, raw, context);
  if (extraProblems.length && raw && typeof raw === "object") {
    raw.problems = [...(Array.isArray(raw.problems) ? raw.problems : []), ...extraProblems];
  }
  return normalizeValidationResult(descriptor, phase, raw, null);
}

async function runAuthoritativeDescriptorPhase(phase, descriptors, expectedValidatorSetHash, context, timeoutMs) {
  const ordered = [...descriptors].sort((left, right) => left.id.localeCompare(right.id));
  const results = [];
  for (const descriptor of ordered) {
    results.push(await runValidator(descriptor, expectedValidatorSetHash, phase, context, timeoutMs));
  }
  const problems = results.flatMap((result) => result.problems.map((problem) => `${result.validatorId}: ${problem}`));
  const warnings = results.flatMap((result) => result.warnings.map((warning) => `${result.validatorId}: ${warning}`));
  const status = results.every((result) => result.status === "passed") ? "passed" : "failed";
  const body = { phase, status, results };
  return { phase, status, results, problems, warnings, resultHash: sha256(canonicalStringify(body)) };
}

async function runValidationPhase(phase, validatorIds, context, options = {}) {
  if (invalidValidatorIds(validatorIds)) {
    return validationFailure(phase, [], "production validation cycle accepts only authoritative validator ids");
  }
  if (typeof options.expectedValidatorSetHash !== "string" || !options.expectedValidatorSetHash) {
    return validationFailure(phase, validatorIds, "production validation cycle requires an authoritative validatorSetHash");
  }

  let registry;
  try {
    registry = loadValidatorRegistry();
  } catch (error) {
    return validationFailure(phase, validatorIds, `validator registry is invalid: ${error.message}`);
  }
  if (registry.validatorSetHash !== options.expectedValidatorSetHash) {
    return validationFailure(phase, validatorIds, "validatorSetHash mismatch for authoritative validation phase");
  }

  let required;
  try {
    required = selectRequiredValidators({ requiredValidators: [...new Set(validatorIds)] }, registry.descriptors);
  } catch (error) {
    return validationFailure(phase, validatorIds, error.message);
  }

  return runAuthoritativeDescriptorPhase(
    phase,
    validatorsForPhase(required, phase),
    options.expectedValidatorSetHash,
    context,
    options.timeoutMs || DEFAULT_TIMEOUT_MS
  );
}

module.exports = { DEFAULT_TIMEOUT_MS, runValidationPhase };
