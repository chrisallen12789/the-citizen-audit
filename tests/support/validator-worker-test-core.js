"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { MessagePort, parentPort, workerData } = require("worker_threads");

const SafeMessagePortClose = Function.call.bind(MessagePort.prototype.close);
const SafeMessagePortPostMessage = Function.call.bind(MessagePort.prototype.postMessage);
const SafeMessagePortRef = Function.call.bind(MessagePort.prototype.ref);
SafeMessagePortRef(parentPort);

const LIMITS = workerData.limits || {};
const MAX_RESULT_BYTES = LIMITS.maxResultBytes || 262144;
const MAX_ARRAY_LEN = LIMITS.maxArrayLen || 10000;
const MAX_DIAGNOSTIC_BYTES = 512;
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";
const TRANSPORT_PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "bigint", "undefined"]);
const FAILURE_CODES = new Set([
  "VALIDATOR_THROW",
  "VALIDATOR_REJECTION",
  "VALIDATOR_RESULT_INVALID",
  "VALIDATOR_TIMEOUT",
  "REGISTRY_MISMATCH",
  "CLOSURE_VERIFICATION_FAILURE",
  "WORKER_INTERNAL_FAILURE"
]);

const ALLOWED_BUILTINS = {
  path: require("path"),
  crypto: require("crypto"),
  util: require("util"),
  assert: require("assert"),
  buffer: require("buffer"),
  os: require("os"),
  fs: require("fs")
};

class WorkerFailure extends Error {
  constructor(code, diagnostic) {
    super(code);
    this.failureCode = code;
    this.diagnostic = diagnostic;
  }
}

function workerFailure(code, diagnostic) {
  return new WorkerFailure(code, diagnostic);
}

function safeFailureCode(code) {
  return FAILURE_CODES.has(code) ? code : "WORKER_INTERNAL_FAILURE";
}

function truncateUtf8(text, maxBytes) {
  if (typeof text !== "string") return undefined;
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  let truncated = Buffer.from(text, "utf8").subarray(0, maxBytes).toString("utf8");
  while (Buffer.byteLength(truncated, "utf8") > maxBytes) truncated = truncated.slice(0, -1);
  return truncated;
}

function failureEnvelope(code, diagnostic) {
  const envelope = { ok: false, code: safeFailureCode(code) };
  const boundedDiagnostic = truncateUtf8(diagnostic, MAX_DIAGNOSTIC_BYTES);
  if (boundedDiagnostic) envelope.diagnostic = boundedDiagnostic;
  return envelope;
}

function compactFallbackEnvelope(code) {
  return failureEnvelope(code, "worker response exceeded reviewed transport bound");
}

function checkedEnvelopeString(envelope) {
  let serialized;
  try {
    serialized = JSON.stringify(envelope);
  } catch (error) {
    serialized = JSON.stringify(compactFallbackEnvelope("WORKER_INTERNAL_FAILURE"));
  }
  if (Buffer.byteLength(serialized, "utf8") <= MAX_RESULT_BYTES) return serialized;
  const fallbackCode = envelope && envelope.ok === true ? "VALIDATOR_RESULT_INVALID" : "WORKER_INTERNAL_FAILURE";
  return JSON.stringify(compactFallbackEnvelope(fallbackCode));
}

function postEnvelope(envelope) {
  try {
    SafeMessagePortPostMessage(parentPort, checkedEnvelopeString(envelope));
  } catch (error) {}
  finally {
    try { SafeMessagePortClose(parentPort); } catch (error) {}
  }
}

function fail(code, diagnostic) {
  postEnvelope(failureEnvelope(code, diagnostic));
}

function failFromCaught(error, fallbackCode, diagnostic) {
  if (error instanceof WorkerFailure) return fail(error.failureCode, error.diagnostic);
  return fail(fallbackCode, diagnostic);
}

function succeed(result) {
  postEnvelope({ ok: true, result });
}

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
  const root = closure.closureRoot;
  const expected = new Map();
  for (const moduleEntry of closure.modules) expected.set(moduleEntry.relPath, moduleEntry);
  const compiledCache = new Map();

  function readVerified(relPath) {
    const want = expected.get(relPath);
    if (!want) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "undeclared closure module");
    const abs = path.join(root, relPath);
    if (path.relative(root, abs).split(path.sep).join("/").startsWith("..")) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure path escape");
    let fd;
    try { fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch (error) {
      if (error && error.code === "ELOOP") throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is a symlink");
      throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module open failed");
    }
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is not a regular file");
      if (stat.nlink > 1) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is hard-linked at execution");
      if (ENFORCE_POSIX_WRITE_BITS && (stat.mode & 0o022)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is group/world-writable at execution");
      if (stat.size !== want.size) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module size mismatch at execution");
      if ((stat.mode & 0o777) !== want.mode) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module mode change at execution");
      if (String(stat.dev) !== String(want.dev) || String(stat.ino) !== String(want.ino)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module inode replacement at execution");
      if (stat.uid !== want.uid || stat.gid !== want.gid) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module ownership change at execution");
      const real = fs.realpathSync(abs);
      if (real !== abs || path.relative(root, real).startsWith("..")) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module resolves outside root at execution");
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < stat.size) {
        const read = fs.readSync(fd, bytes, offset, stat.size - offset, offset);
        if (read <= 0) break;
        offset += read;
      }
      const data = bytes.subarray(0, offset);
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      if (hash !== want.hash) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module hash mismatch at execution");
      return data.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  }

  function resolveLocal(fromRel, spec) {
    const dir = path.posix.dirname(fromRel);
    const base = path.posix.normalize(path.posix.join(dir, spec));
    for (const candidate of [base, `${base}.js`, `${base}/index.js`]) {
      if (expected.has(candidate)) return candidate;
    }
    throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "undeclared closure dependency");
  }

  function requireFrom(fromRel, spec) {
    if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
      return loadModule(resolveLocal(fromRel, spec));
    }
    const builtin = spec.startsWith("node:") ? spec.slice(5) : spec;
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_BUILTINS, builtin)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "non-allowlisted builtin required in closure");
    return ALLOWED_BUILTINS[builtin];
  }

  function loadModule(relPath) {
    if (compiledCache.has(relPath)) return compiledCache.get(relPath);
    const source = readVerified(relPath);
    const module = { exports: {} };
    compiledCache.set(relPath, module.exports);
    const absFile = path.join(root, relPath);
    let wrapper;
    try {
      wrapper = vm.compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename: absFile });
    } catch (error) {
      throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "validator module compilation failed");
    }
    try {
      wrapper(module.exports, (spec) => requireFrom(relPath, spec), module, absFile, path.dirname(absFile));
    } catch (error) {
      if (error instanceof WorkerFailure) throw error;
      throw workerFailure("VALIDATOR_THROW");
    }
    compiledCache.set(relPath, module.exports);
    return module.exports;
  }

  return loadModule(closure.entryRelPath);
}

try {
  const { closure, expectedContract, validatorId, phase, context } = workerData;
  if (!closure || !Array.isArray(closure.modules) || !closure.entryRelPath) {
    fail("CLOSURE_VERIFICATION_FAILURE", "missing validator closure");
  } else {
    let validator;
    let validatorLoaded = false;
    try {
      validator = loadClosureEntry(closure);
      validatorLoaded = true;
    } catch (error) {
      failFromCaught(error, "CLOSURE_VERIFICATION_FAILURE");
    }
    if (
      validatorLoaded
      && (
      !validator
      || validator.id !== validatorId
      || !expectedContract
      || validator.version !== expectedContract.version
      || Boolean(validator.semantic) !== Boolean(expectedContract.semantic)
      || JSON.stringify(canonicalArray(validator.actions)) !== JSON.stringify(canonicalArray(expectedContract.actions))
      || JSON.stringify(canonicalArray(validator.supportedPhases)) !== JSON.stringify(canonicalArray(expectedContract.supportedPhases))
      || typeof validator.validate !== "function"
      )
    ) {
      fail("VALIDATOR_RESULT_INVALID", "validator contract mismatch in worker");
    } else if (validatorLoaded && (!Array.isArray(validator.supportedPhases) || !validator.supportedPhases.includes(phase))) {
      fail("VALIDATOR_RESULT_INVALID", "validator does not support requested phase");
    } else if (validatorLoaded) {
      Promise.resolve()
        .then(() => {
          let validationResult;
          try {
            validationResult = validator.validate({ ...context, phase });
          } catch (error) {
            fail("VALIDATOR_THROW");
            return undefined;
          }
          return Promise.resolve(validationResult)
            .then((raw) => ({ raw }))
            .catch(() => {
              fail("VALIDATOR_REJECTION");
              return undefined;
            });
        })
        .then((outcome) => {
          if (!outcome) return undefined;
          const raw = outcome.raw;
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("VALIDATOR_RESULT_INVALID", "validator returned a non-object result");
          const normalized = normalizeTransportedResult(raw);
          succeed(normalized);
        })
        .catch((error) => failFromCaught(error, "WORKER_INTERNAL_FAILURE"));
    }
  }
} catch (error) {
  failFromCaught(error, "WORKER_INTERNAL_FAILURE");
}
