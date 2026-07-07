const { normalizeValidationResult } = require("./validation-results");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const DEFAULT_TIMEOUT_MS = 5000;

async function runValidator(validator, phase, context, timeoutMs) {
  if (!Array.isArray(validator.supportedPhases) || !validator.supportedPhases.includes(phase)) {
    return normalizeValidationResult(validator, phase, null, new Error(`does not support phase ${phase}`));
  }
  let timer;
  try {
    const outcome = await Promise.race([
      Promise.resolve().then(() => validator.validate({ ...context, phase })),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`validator timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
    return normalizeValidationResult(validator, phase, outcome, null);
  } catch (error) {
    return normalizeValidationResult(validator, phase, null, error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Run one validation phase deterministically. Every abnormal outcome is a
// failure (fail-closed). Results are sorted by validator id and serializable.
async function runValidationPhase(phase, validators, context, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const ordered = [...validators].sort((a, b) => a.id.localeCompare(b.id));
  const results = [];
  for (const validator of ordered) {
    results.push(await runValidator(validator, phase, context, timeoutMs));
  }
  const problems = results.flatMap((result) => result.problems.map((problem) => `${result.validatorId}: ${problem}`));
  const warnings = results.flatMap((result) => result.warnings.map((warning) => `${result.validatorId}: ${warning}`));
  const status = results.every((result) => result.status === "passed") ? "passed" : "failed";
  const body = { phase, status, results };
  return { phase, status, results, problems, warnings, resultHash: sha256(canonicalStringify(body)) };
}

module.exports = { DEFAULT_TIMEOUT_MS, runValidationPhase };
