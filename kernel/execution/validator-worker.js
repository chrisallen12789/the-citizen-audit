"use strict";

// Validator execution worker.
//
// Executes ONLY the bytes of the validator's verified code closure. Every module
// in the closure is re-read from disk, checked for symlink/non-regular status,
// re-hashed against the manifest bound into validatorSetHash, and compiled from
// those exact bytes through a private in-memory module system. There is no
// path-based require() fallback: local dependencies resolve only within the
// closure (undeclared/dynamic/escape are rejected), and built-ins are limited to
// an explicit allowlist. This proves the executed transitive code matches the
// bound closureHash. A synchronous infinite loop simply never posts; the parent
// enforces the hard deadline via worker.terminate().

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { parentPort, workerData } = require("worker_threads");


const LIMITS = workerData.limits || {};
const MAX_RESULT_BYTES = LIMITS.maxResultBytes || 262144;
const MAX_ARRAY_LEN = LIMITS.maxArrayLen || 10000;

const ALLOWED_BUILTINS = {
  path: require("path"), crypto: require("crypto"), util: require("util"),
  assert: require("assert"), buffer: require("buffer"), os: require("os"), fs: require("fs")
};

function fail(reason) { try { parentPort.postMessage({ ok: false, error: reason }); } catch (e) { /* parent gone */ } }
function boundArray(value, label, problems) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { problems.push(`${label} is not an array`); return []; }
  if (value.length > MAX_ARRAY_LEN) { problems.push(`${label} exceeds ${MAX_ARRAY_LEN} entries`); return value.slice(0, MAX_ARRAY_LEN); }
  return value;
}

function loadClosureEntry(closure) {
  const ROOT = closure.closureRoot;
  const manifest = new Map(); // relPath -> expectedHash
  for (const m of closure.modules) manifest.set(m.relPath, m.hash);
  const compiledCache = new Map(); // relPath -> module.exports

  function readVerified(relPath) {
    const abs = path.join(ROOT, relPath);
    const rel2 = path.relative(ROOT, abs).split(path.sep).join("/");
    if (rel2.startsWith("..")) throw new Error(`closure path escape: ${relPath}`);
    const lst = fs.lstatSync(abs);
    if (lst.isSymbolicLink()) throw new Error(`closure module is a symlink: ${relPath}`);
    if (!lst.isFile()) throw new Error(`closure module is not a regular file: ${relPath}`);
    const bytes = fs.readFileSync(abs);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (hash !== manifest.get(relPath)) throw new Error(`closure module hash mismatch at execution: ${relPath}`);
    return bytes.toString("utf8");
  }

  function resolveLocal(fromRel, spec) {
    const dir = path.posix.dirname(fromRel);
    const base = path.posix.normalize(path.posix.join(dir, spec));
    for (const cand of [base, `${base}.js`, `${base}/index.js`]) {
      if (manifest.has(cand)) return cand;
    }
    throw new Error(`undeclared closure dependency: ${spec} from ${fromRel}`);
  }

  function requireFrom(fromRel, spec) {
    if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
      const target = resolveLocal(fromRel, spec);
      return loadModule(target);
    }
    const builtin = spec.startsWith("node:") ? spec.slice(5) : spec;
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_BUILTINS, builtin)) throw new Error(`non-allowlisted builtin required in closure: ${spec}`);
    return ALLOWED_BUILTINS[builtin];
  }

  function loadModule(relPath) {
    if (compiledCache.has(relPath)) return compiledCache.get(relPath);
    const source = readVerified(relPath);
    const module = { exports: {} };
    compiledCache.set(relPath, module.exports); // seed for cycles
    const absFile = path.join(ROOT, relPath);
    const wrapper = vm.compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename: absFile });
    wrapper(module.exports, (spec) => requireFrom(relPath, spec), module, absFile, path.dirname(absFile));
    compiledCache.set(relPath, module.exports);
    return module.exports;
  }

  return loadModule(closure.entryRelPath);
}

try {
  const { closure, expectedVersion, validatorId, phase, context } = workerData;
  if (!closure || !Array.isArray(closure.modules) || !closure.entryRelPath) { fail(`missing validator closure: ${validatorId}`); }
  else {
    const validator = loadClosureEntry(closure);
    if (!validator || validator.id !== validatorId || validator.version !== expectedVersion || typeof validator.validate !== "function") {
      fail(`validator contract mismatch in worker: ${validatorId}`);
    } else if (!Array.isArray(validator.supportedPhases) || !validator.supportedPhases.includes(phase)) {
      fail(`validator does not support phase ${phase}: ${validatorId}`);
    } else {
      Promise.resolve()
        .then(() => validator.validate({ ...context, phase }))
        .then((raw) => {
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
          try { serialized = JSON.stringify(normalized); } catch (e) { return fail(`validator result is not serializable (circular/deep): ${validatorId}`); }
          if (serialized.length > MAX_RESULT_BYTES) return fail(`validator result exceeds ${MAX_RESULT_BYTES} bytes: ${validatorId}`);
          parentPort.postMessage({ ok: true, raw: normalized });
        })
        .catch((error) => fail(`validator threw: ${(error && error.message) || String(error)}`));
    }
  }
} catch (error) {
  fail(`validator worker failure: ${(error && error.message) || String(error)}`);
}
