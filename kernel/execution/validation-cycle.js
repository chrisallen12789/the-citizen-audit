"use strict";

const path = require("path");
const { Worker } = require("worker_threads");

const { normalizeValidationResult } = require("./validation-results");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { loadValidatorRegistry, selectRequiredValidators, validatorsForPhase } = require("./validators");

const DEFAULT_TIMEOUT_MS = 5000;
const WORKER_PATH = path.join(__dirname, "validator-worker.js");
const LIMITS = { maxResultBytes: 262144, maxArrayLen: 10000, maxStdBytes: 65536 };

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

function runValidatorBoundary(descriptor, expectedValidatorSetHash, phase, context, timeoutMs) {
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
          validatorId: descriptor.id,
          expectedValidatorSetHash,
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
    worker.on("message", (msg) => finish(msg && typeof msg === "object" ? msg : { ok: false, error: "validator produced a malformed worker message" }));
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

module.exports = { DEFAULT_TIMEOUT_MS, LIMITS, runValidationPhase };
