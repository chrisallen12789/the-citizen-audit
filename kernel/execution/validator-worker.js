"use strict";

// Validator execution worker.
//
// Runs a single validator inside a terminable worker thread. It proves that the
// EXACT bytes hashed into validatorSetHash are the bytes executed (re-read +
// re-hash + compile-those-bytes, not a path-based require that could be swapped
// between verification and execution), reconstructs the validator context from
// serializable authoritative inputs, and enforces output/resource bounds. A
// synchronous infinite loop here simply never posts a result; the parent thread
// enforces the hard deadline via worker.terminate().

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Module = require("module");
const { parentPort, workerData } = require("worker_threads");

const LIMITS = workerData.limits || {};
const MAX_RESULT_BYTES = LIMITS.maxResultBytes || 262144; // 256 KiB serialized
const MAX_ARRAY_LEN = LIMITS.maxArrayLen || 10000;

function fail(reason) {
  try { parentPort.postMessage({ ok: false, error: reason }); } catch (e) { /* parent gone */ }
}

function boundArray(value, label, problems) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { problems.push(`${label} is not an array`); return []; }
  if (value.length > MAX_ARRAY_LEN) { problems.push(`${label} exceeds ${MAX_ARRAY_LEN} entries`); return value.slice(0, MAX_ARRAY_LEN); }
  return value;
}

try {
  const { modulePath, expectedHash, expectedVersion, validatorId, phase, context } = workerData;

  // 1. Prove exact-bytes execution: reject symlink/non-regular, re-hash, compile
  //    the verified bytes (not a re-read via require()).
  const stat = fs.lstatSync(modulePath);
  if (!stat.isFile()) { fail(`validator module is not a regular file: ${validatorId}`); }
  else {
    const bytes = fs.readFileSync(modulePath);
    const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) {
      fail(`validator module hash mismatch at execution (${validatorId}): expected ${expectedHash.slice(0, 12)} got ${actualHash.slice(0, 12)}`);
    } else {
      const compiled = new Module(modulePath, null);
      compiled.filename = modulePath;
      compiled.paths = Module._nodeModulePaths(path.dirname(modulePath));
      compiled._compile(bytes.toString("utf8"), modulePath);
      const validator = compiled.exports;

      if (!validator || validator.id !== validatorId || validator.version !== expectedVersion || typeof validator.validate !== "function") {
        fail(`validator contract mismatch in worker: ${validatorId}`);
      } else if (!Array.isArray(validator.supportedPhases) || !validator.supportedPhases.includes(phase)) {
        fail(`validator does not support phase ${phase}: ${validatorId}`);
      } else {
        // 2. Execute against the reconstructed, serializable context.
        Promise.resolve()
          .then(() => validator.validate({ ...context, phase }))
          .then((raw) => {
            // 3. Enforce output bounds and structural sanity; fail closed otherwise.
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(`validator returned a non-object result: ${validatorId}`);
            const problems = [];
            const normalized = {
              status: raw.status,
              problems: boundArray(raw.problems, "problems", problems),
              warnings: boundArray(raw.warnings, "warnings", problems),
              checkedObjects: boundArray(raw.checkedObjects, "checkedObjects", problems),
              checkedPaths: boundArray(raw.checkedPaths, "checkedPaths", problems)
            };
            if (problems.length) normalized.problems = [...normalized.problems, ...problems];
            let serialized;
            try { serialized = JSON.stringify(normalized); }
            catch (e) { return fail(`validator result is not serializable (circular/deep): ${validatorId}`); }
            if (serialized.length > MAX_RESULT_BYTES) return fail(`validator result exceeds ${MAX_RESULT_BYTES} bytes: ${validatorId}`);
            parentPort.postMessage({ ok: true, raw: normalized });
          })
          .catch((error) => fail(`validator threw: ${(error && error.message) || String(error)}`));
      }
    }
  }
} catch (error) {
  fail(`validator worker failure: ${(error && error.message) || String(error)}`);
}
