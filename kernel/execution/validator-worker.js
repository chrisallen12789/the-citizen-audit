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
const { loadValidatorRegistry } = require("./validators");
const { REVIEWED_VALIDATOR_LIMITS } = require("./validator-limits");


const MAX_RESULT_BYTES = REVIEWED_VALIDATOR_LIMITS.maxResultBytes;
const MAX_ARRAY_LEN = REVIEWED_VALIDATOR_LIMITS.maxArrayLen;
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";
const UNSAFE_VALIDATOR_IDS = new Set(["__proto__", "prototype", "constructor"]);

const ALLOWED_BUILTINS = {
  path: require("path"), crypto: require("crypto"), util: require("util"),
  assert: require("assert"), buffer: require("buffer"), os: require("os"), fs: require("fs")
};
const TRANSPORT_PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "bigint", "undefined"]);

function fail(reason) { try { parentPort.postMessage({ ok: false, error: reason }); } catch (e) { /* parent gone */ } }
function canonicalArray(value) { return Array.isArray(value) ? [...value].map(String).sort() : []; }
function boundArray(value, label, problems) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { problems.push(`${label} is not an array`); return []; }
  if (value.length > MAX_ARRAY_LEN) { problems.push(`${label} exceeds ${MAX_ARRAY_LEN} entries`); return value.slice(0, MAX_ARRAY_LEN); }
  return value;
}

function readOwnDataProperty(object, label, problems) {
  const descriptor = Object.getOwnPropertyDescriptor(object, label);
  if (!descriptor) return undefined;
  if (Object.prototype.hasOwnProperty.call(descriptor, "get") || Object.prototype.hasOwnProperty.call(descriptor, "set")) {
    problems.push(`${label} uses an accessor property`);
    return undefined;
  }
  return descriptor.value;
}

function safeTransportString(value) {
  if (value === null) return "null";
  if (TRANSPORT_PRIMITIVE_TYPES.has(typeof value)) return String(value);
  return null;
}

function boundTransportStringArray(raw, label, problems, options = {}) {
  const value = readOwnDataProperty(raw, label, problems);
  if (value === undefined) {
    if (options.required) problems.push(`${label} is not an array`);
    return [];
  }
  if (!Array.isArray(value)) {
    problems.push(`${label} is not an array`);
    return [];
  }
  const normalized = [];
  const limit = value.length > MAX_ARRAY_LEN ? MAX_ARRAY_LEN : value.length;
  if (value.length > MAX_ARRAY_LEN) problems.push(`${label} exceeds ${MAX_ARRAY_LEN} entries`);
  for (let index = 0; index < limit; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) {
      normalized.push("undefined");
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(descriptor, "get") || Object.prototype.hasOwnProperty.call(descriptor, "set")) {
      problems.push(`${label}[${index}] uses an accessor property`);
      continue;
    }
    const rendered = safeTransportString(descriptor.value);
    if (rendered === null) {
      problems.push(`${label}[${index}] is not a transport-safe primitive`);
      continue;
    }
    normalized.push(rendered);
  }
  return normalized;
}

function normalizeTransportedResult(raw) {
  const transportProblems = [];
  const statusValue = readOwnDataProperty(raw, "status", transportProblems);
  const problems = boundTransportStringArray(raw, "problems", transportProblems, { required: true });
  const warnings = boundTransportStringArray(raw, "warnings", transportProblems);
  const checkedObjects = boundTransportStringArray(raw, "checkedObjects", transportProblems);
  const checkedPaths = boundTransportStringArray(raw, "checkedPaths", transportProblems);
  if (statusValue !== "passed" && statusValue !== "failed") transportProblems.push("status is invalid");
  const status = transportProblems.length > 0 ? "failed" : statusValue;
  return {
    status: status === "failed" ? "failed" : "passed",
    problems: transportProblems.length > 0 ? [...problems, ...transportProblems] : problems,
    warnings,
    checkedObjects,
    checkedPaths
  };
}

function loadClosureEntry(closure) {
  const ROOT = closure.closureRoot;
  const expected = new Map(); // relPath -> {hash,size,mode,uid,gid,dev,ino,nlink}
  for (const m of closure.modules) expected.set(m.relPath, m);
  const compiledCache = new Map(); // relPath -> module.exports

  // Open no-follow, then use the SAME fd to fstat, read, and hash — no separate
  // path check followed by an unprotected reopen. Verify the full recorded
  // manifest (hash/size/mode/nlink/dev/ino) so replacement, inode swap, mode or
  // ownership change, hard-linking, or group/world-writability between build and
  // execution all fail closed.
  function readVerified(relPath) {
    const want = expected.get(relPath);
    if (!want) throw new Error(`undeclared closure module: ${relPath}`);
    const abs = path.join(ROOT, relPath);
    if (path.relative(ROOT, abs).split(path.sep).join("/").startsWith("..")) throw new Error(`closure path escape: ${relPath}`);
    let fd;
    try { fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch (e) { if (e.code === "ELOOP") throw new Error(`closure module is a symlink: ${relPath}`); throw e; }
    try {
      const st = fs.fstatSync(fd);
      if (!st.isFile()) throw new Error(`closure module is not a regular file: ${relPath}`);
      if (st.nlink > 1) throw new Error(`closure module is hard-linked at execution: ${relPath}`);
      if (ENFORCE_POSIX_WRITE_BITS && (st.mode & 0o022)) throw new Error(`closure module is group/world-writable at execution: ${relPath}`);
      if (st.size !== want.size) throw new Error(`closure module size mismatch at execution: ${relPath}`);
      if ((st.mode & 0o777) !== want.mode) throw new Error(`closure module mode change at execution: ${relPath}`);
      if (String(st.dev) !== String(want.dev) || String(st.ino) !== String(want.ino)) throw new Error(`closure module inode replacement at execution: ${relPath}`);
      if (st.uid !== want.uid || st.gid !== want.gid) throw new Error(`closure module ownership change at execution: ${relPath}`);
      const real = fs.realpathSync(abs);
      if (real !== abs || path.relative(ROOT, real).startsWith("..")) throw new Error(`closure module resolves outside root at execution: ${relPath}`);
      const bytes = Buffer.alloc(st.size);
      let off = 0;
      while (off < st.size) { const n = fs.readSync(fd, bytes, off, st.size - off, off); if (n <= 0) break; off += n; }
      const data = bytes.subarray(0, off);
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      if (hash !== want.hash) throw new Error(`closure module hash mismatch at execution: ${relPath}`);
      return data.toString("utf8");
    } finally { fs.closeSync(fd); }
  }

  function resolveLocal(fromRel, spec) {
    const dir = path.posix.dirname(fromRel);
    const base = path.posix.normalize(path.posix.join(dir, spec));
    for (const cand of [base, `${base}.js`, `${base}/index.js`]) {
      if (expected.has(cand)) return cand;
    }
    throw new Error(`undeclared closure dependency: ${spec} from ${fromRel}`);
  }

  function requireFrom(fromRel, spec) {
    if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
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

function loadAuthoritativeDescriptor(workerPayload) {
  const validatorId = workerPayload && workerPayload.validatorId;
  const expectedValidatorSetHash = workerPayload && workerPayload.expectedValidatorSetHash;
  if (typeof validatorId !== "string" || !validatorId) throw new Error("validator worker requires a non-empty validatorId");
  if (UNSAFE_VALIDATOR_IDS.has(validatorId)) throw new Error(`validator worker rejected unsafe validator id: ${validatorId}`);
  if (typeof expectedValidatorSetHash !== "string" || !expectedValidatorSetHash) throw new Error(`validator worker requires an expected validatorSetHash: ${validatorId}`);

  const registry = loadValidatorRegistry();
  if (registry.validatorSetHash !== expectedValidatorSetHash) {
    throw new Error(`validatorSetHash mismatch in worker: ${validatorId}`);
  }
  const descriptor = registry.descriptors.get(validatorId);
  if (!descriptor) throw new Error(`authoritative validator is unavailable in worker: ${validatorId}`);
  return descriptor;
}

try {
  const { validatorId, phase, context } = workerData;
  const descriptor = loadAuthoritativeDescriptor(workerData);
  const closure = descriptor.closure;
  if (!closure || !Array.isArray(closure.modules) || !closure.entryRelPath) {
    fail(`missing authoritative validator closure: ${validatorId}`);
  } else {
    const validator = loadClosureEntry(closure);
    const expectedContract = descriptor.contract;
    if (
      !validator
      || validator.id !== descriptor.id
      || !expectedContract
      || validator.version !== expectedContract.version
      || Boolean(validator.semantic) !== Boolean(expectedContract.semantic)
      || JSON.stringify(canonicalArray(validator.actions)) !== JSON.stringify(canonicalArray(expectedContract.actions))
      || JSON.stringify(canonicalArray(validator.supportedPhases)) !== JSON.stringify(canonicalArray(expectedContract.supportedPhases))
      || typeof validator.validate !== "function"
    ) {
      fail(`validator contract mismatch in worker: ${descriptor.id}`);
    } else if (!Array.isArray(validator.supportedPhases) || !validator.supportedPhases.includes(phase)) {
      fail(`validator does not support phase ${phase}: ${descriptor.id}`);
    } else {
      Promise.resolve()
        .then(() => validator.validate({ ...context, phase }))
        .then((raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(`validator returned a non-object result: ${descriptor.id}`);
          const normalized = normalizeTransportedResult(raw);
          let serialized;
          try { serialized = JSON.stringify(normalized); } catch (e) { return fail(`validator result is not serializable (circular/deep): ${descriptor.id}`); }
          const serializedBytes = Buffer.byteLength(serialized, "utf8");
          if (serializedBytes > MAX_RESULT_BYTES) return fail(`validator result exceeds ${MAX_RESULT_BYTES} bytes: ${descriptor.id}`);
          parentPort.postMessage({ ok: true, serializedResult: serialized });
        })
        .catch((error) => fail(`validator threw: ${(error && error.message) || String(error)}`));
    }
  }
} catch (error) {
  fail(`validator worker failure: ${(error && error.message) || String(error)}`);
}
