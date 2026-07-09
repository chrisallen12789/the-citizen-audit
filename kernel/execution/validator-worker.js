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
const { MessageChannel, parentPort, workerData } = require("worker_threads");
const { loadValidatorRegistry } = require("./validators");
const { REVIEWED_VALIDATOR_LIMITS } = require("./validator-limits");


const HOST_PROCESS = process;
const HOST_GLOBAL = globalThis;
const SafeArrayIncludes = Function.call.bind(Array.prototype.includes);
const SafeArrayIsArray = Array.isArray;
const SafeArrayJoin = Function.call.bind(Array.prototype.join);
const SafeArraySlice = Function.call.bind(Array.prototype.slice);
const SafeArraySort = Function.call.bind(Array.prototype.sort);
const SafeBufferByteLength = Buffer.byteLength.bind(Buffer);
const SafeBufferFrom = Buffer.from.bind(Buffer);
const SafeBufferSubarray = Function.call.bind(Buffer.prototype.subarray);
const SafeBufferToString = Function.call.bind(Buffer.prototype.toString);
const SafeJSONStringify = JSON.stringify;
const SafeObjectCreate = Object.create;
const SafeObjectDefineProperty = Object.defineProperty;
const SafeObjectFreeze = Object.freeze;
const SafeObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const SafeObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
const SafeObjectGetPrototypeOf = Object.getPrototypeOf;
const SafeObjectHasOwn = Function.call.bind(Object.prototype.hasOwnProperty);
const SafeObjectSetPrototypeOf = Object.setPrototypeOf;
const SafeMapGet = Function.call.bind(Map.prototype.get);
const SafeMapHas = Function.call.bind(Map.prototype.has);
const SafeMapSet = Function.call.bind(Map.prototype.set);
const SafePromiseCatch = Function.call.bind(Promise.prototype.catch);
const SafePromiseResolve = Promise.resolve.bind(Promise);
const SafePromiseThen = Function.call.bind(Promise.prototype.then);
const SafeReflectOwnKeys = Reflect.ownKeys;
const SafeSetHas = Function.call.bind(Set.prototype.has);
const SafeStringSlice = Function.call.bind(String.prototype.slice);
const SafeStringSplit = Function.call.bind(String.prototype.split);
const SafeStringStartsWith = Function.call.bind(String.prototype.startsWith);
const SafeString = String;

const HARNESS_CHANNEL_TYPE = "validator-harness-channel-v1";
const { port1: HARNESS_RESULT_PORT, port2: PARENT_RESULT_PORT } = new MessageChannel();
parentPort.postMessage({ type: HARNESS_CHANNEL_TYPE, port: PARENT_RESULT_PORT }, [PARENT_RESULT_PORT]);

const MAX_RESULT_BYTES = REVIEWED_VALIDATOR_LIMITS.maxResultBytes;
const MAX_ARRAY_LEN = REVIEWED_VALIDATOR_LIMITS.maxArrayLen;
const MAX_DIAGNOSTIC_BYTES = 512;
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";
const UNSAFE_VALIDATOR_IDS = new Set(["__proto__", "prototype", "constructor"]);
const FAILURE_CODES = new Set([
  "VALIDATOR_THROW",
  "VALIDATOR_REJECTION",
  "VALIDATOR_RESULT_INVALID",
  "VALIDATOR_TIMEOUT",
  "REGISTRY_MISMATCH",
  "CLOSURE_VERIFICATION_FAILURE",
  "WORKER_INTERNAL_FAILURE"
]);

function defineReadOnly(target, key, value) {
  SafeObjectDefineProperty(target, key, { value, enumerable: true, writable: false, configurable: false });
}

function frozenRecord(entries) {
  const record = SafeObjectCreate(null);
  for (let index = 0; index < entries.length; index += 1) {
    defineReadOnly(record, entries[index][0], entries[index][1]);
  }
  return SafeObjectFreeze(record);
}

function safeCallable(fn, receiver) {
  const callable = fn.bind(receiver);
  try { SafeObjectSetPrototypeOf(callable, null); } catch (error) {}
  defineReadOnly(callable, "constructor", undefined);
  return SafeObjectFreeze(callable);
}

function makeReadOnlyFacade(source, receiver = source, seen = new Map()) {
  if (source === null || (typeof source !== "object" && typeof source !== "function")) return source;
  if (SafeMapHas(seen, source)) return SafeMapGet(seen, source);
  const facade = typeof source === "function" ? source.bind(receiver) : SafeObjectCreate(null);
  if (typeof facade === "function") {
    try { SafeObjectSetPrototypeOf(facade, null); } catch (error) {}
  }
  SafeMapSet(seen, source, facade);
  for (const key of SafeReflectOwnKeys(source)) {
    if (key === "prototype" || key === "constructor") continue;
    const descriptor = SafeObjectGetOwnPropertyDescriptor(source, key);
    if (!descriptor || !SafeObjectHasOwn(descriptor, "value")) continue;
    defineReadOnly(facade, key, makeReadOnlyFacade(descriptor.value, source, seen));
  }
  defineReadOnly(facade, "constructor", undefined);
  return SafeObjectFreeze(facade);
}

const SAFE_BUFFER_FACADE = frozenRecord([
  ["from", safeCallable(Buffer.from, Buffer)],
  ["byteLength", safeCallable(Buffer.byteLength, Buffer)],
  ["isBuffer", safeCallable(Buffer.isBuffer, Buffer)],
  ["concat", safeCallable(Buffer.concat, Buffer)],
  ["alloc", safeCallable(Buffer.alloc, Buffer)],
  ["allocUnsafe", safeCallable(Buffer.allocUnsafe, Buffer)]
]);
const SAFE_BUFFER_MODULE = frozenRecord([["Buffer", SAFE_BUFFER_FACADE]]);
const SAFE_JSON_FACADE = frozenRecord([
  ["parse", safeCallable(JSON.parse, JSON)],
  ["stringify", safeCallable(JSON.stringify, JSON)]
]);
const ALLOWED_BUILTINS = frozenRecord([
  ["path", makeReadOnlyFacade(require("path"))],
  ["crypto", makeReadOnlyFacade(require("crypto"))],
  ["util", makeReadOnlyFacade(require("util"))],
  ["assert", makeReadOnlyFacade(require("assert"))],
  ["buffer", SAFE_BUFFER_MODULE],
  ["os", makeReadOnlyFacade(require("os"))],
  ["fs", makeReadOnlyFacade(require("fs"))]
]);
const TRANSPORT_PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "bigint", "undefined"]);

function addIntrinsicTarget(targets, target) {
  if (target && (typeof target === "object" || typeof target === "function")) targets[targets.length] = target;
}

function addPrototypeChain(targets, target) {
  let current = target;
  while (current && (typeof current === "object" || typeof current === "function")) {
    addIntrinsicTarget(targets, current);
    current = SafeObjectGetPrototypeOf(current);
  }
}

function addIteratorPrototype(targets, iterator) {
  try { addPrototypeChain(targets, SafeObjectGetPrototypeOf(iterator)); } catch (error) {}
}

function hardenValidatorIntrinsics() {
  const targets = [];
  const constructors = [
    Object, Array, String, Function, Promise, Map, Set, WeakMap, WeakSet,
    Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError,
    RegExp, Symbol, Number, Boolean, BigInt, Date, ArrayBuffer, DataView,
    Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array,
    BigUint64Array, Buffer
  ];
  if (typeof AggregateError === "function") constructors[constructors.length] = AggregateError;
  if (typeof SharedArrayBuffer === "function") constructors[constructors.length] = SharedArrayBuffer;
  for (let index = 0; index < constructors.length; index += 1) {
    const ctor = constructors[index];
    addIntrinsicTarget(targets, ctor);
    try { addPrototypeChain(targets, ctor.prototype); } catch (error) {}
  }
  addIntrinsicTarget(targets, JSON);
  addIntrinsicTarget(targets, Math);
  addIntrinsicTarget(targets, Reflect);
  try { addIteratorPrototype(targets, [][Symbol.iterator]()); } catch (error) {}
  try { addIteratorPrototype(targets, ""[Symbol.iterator]()); } catch (error) {}
  try { addIteratorPrototype(targets, new Map()[Symbol.iterator]()); } catch (error) {}
  try { addIteratorPrototype(targets, new Set()[Symbol.iterator]()); } catch (error) {}
  for (let index = 0; index < targets.length; index += 1) {
    try { SafeObjectFreeze(targets[index]); } catch (error) {}
  }
}

function setGlobalValue(name, value) {
  try {
    SafeObjectDefineProperty(HOST_GLOBAL, name, { value, writable: false, configurable: false });
  } catch (error) {}
}

function setProcessValue(name, value) {
  try {
    SafeObjectDefineProperty(HOST_PROCESS, name, { value, writable: false, configurable: false });
  } catch (error) {}
}

function lockValidatorHostAccess() {
  hardenValidatorIntrinsics();
  setProcessValue("getBuiltinModule", undefined);
  setProcessValue("binding", undefined);
  setProcessValue("_linkedBinding", undefined);
  setProcessValue("dlopen", undefined);
  setGlobalValue("process", undefined);
  setGlobalValue("global", undefined);
  setGlobalValue("Function", undefined);
  setGlobalValue("eval", undefined);
  setGlobalValue("require", undefined);
  setGlobalValue("module", undefined);
  setGlobalValue("exports", undefined);
  setGlobalValue("Buffer", SAFE_BUFFER_FACADE);
  setGlobalValue("JSON", SAFE_JSON_FACADE);
}

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
  return SafeSetHas(FAILURE_CODES, code) ? code : "WORKER_INTERNAL_FAILURE";
}

function truncateUtf8(text, maxBytes) {
  if (typeof text !== "string") return undefined;
  if (SafeBufferByteLength(text, "utf8") <= maxBytes) return text;
  let truncated = SafeBufferToString(SafeBufferSubarray(SafeBufferFrom(text, "utf8"), 0, maxBytes), "utf8");
  while (SafeBufferByteLength(truncated, "utf8") > maxBytes) truncated = SafeStringSlice(truncated, 0, -1);
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
    serialized = SafeJSONStringify(envelope);
  } catch (error) {
    serialized = SafeJSONStringify(compactFallbackEnvelope("WORKER_INTERNAL_FAILURE"));
  }
  if (SafeBufferByteLength(serialized, "utf8") <= MAX_RESULT_BYTES) return serialized;
  const fallbackCode = envelope && envelope.ok === true ? "VALIDATOR_RESULT_INVALID" : "WORKER_INTERNAL_FAILURE";
  return SafeJSONStringify(compactFallbackEnvelope(fallbackCode));
}

function postEnvelope(envelope) {
  try {
    HARNESS_RESULT_PORT.postMessage(checkedEnvelopeString(envelope));
    HARNESS_RESULT_PORT.close();
  } catch (error) { /* parent gone */ }
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

function canonicalArray(value) {
  if (!SafeArrayIsArray(value)) return [];
  const copy = [];
  for (let index = 0; index < value.length; index += 1) copy[index] = SafeString(value[index]);
  SafeArraySort(copy);
  return copy;
}
function boundArray(value, label, problems) {
  if (value === undefined) return [];
  if (!SafeArrayIsArray(value)) { problems[problems.length] = `${label} is not an array`; return []; }
  if (value.length > MAX_ARRAY_LEN) { problems[problems.length] = `${label} exceeds ${MAX_ARRAY_LEN} entries`; return SafeArraySlice(value, 0, MAX_ARRAY_LEN); }
  return value;
}

function readOwnDataProperty(object, label, problems) {
  const descriptor = SafeObjectGetOwnPropertyDescriptor(object, label);
  if (!descriptor) return undefined;
  if (SafeObjectHasOwn(descriptor, "get") || SafeObjectHasOwn(descriptor, "set")) {
    problems[problems.length] = `${label} uses an accessor property`;
    return undefined;
  }
  return descriptor.value;
}

function safeTransportString(value) {
  if (value === null) return "null";
  if (SafeSetHas(TRANSPORT_PRIMITIVE_TYPES, typeof value)) return SafeString(value);
  return null;
}

function boundTransportStringArray(raw, label, problems, options = {}) {
  const value = readOwnDataProperty(raw, label, problems);
  if (value === undefined) {
    if (options.required) problems[problems.length] = `${label} is not an array`;
    return [];
  }
  if (!SafeArrayIsArray(value)) {
    problems[problems.length] = `${label} is not an array`;
    return [];
  }
  const normalized = [];
  const limit = value.length > MAX_ARRAY_LEN ? MAX_ARRAY_LEN : value.length;
  if (value.length > MAX_ARRAY_LEN) problems[problems.length] = `${label} exceeds ${MAX_ARRAY_LEN} entries`;
  for (let index = 0; index < limit; index += 1) {
    const descriptor = SafeObjectGetOwnPropertyDescriptor(value, SafeString(index));
    if (!descriptor) {
      normalized[normalized.length] = "undefined";
      continue;
    }
    if (SafeObjectHasOwn(descriptor, "get") || SafeObjectHasOwn(descriptor, "set")) {
      problems[problems.length] = `${label}[${index}] uses an accessor property`;
      continue;
    }
    const rendered = safeTransportString(descriptor.value);
    if (rendered === null) {
      problems[problems.length] = `${label}[${index}] is not a transport-safe primitive`;
      continue;
    }
    normalized[normalized.length] = rendered;
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
  if (statusValue !== "passed" && statusValue !== "failed") transportProblems[transportProblems.length] = "status is invalid";
  const status = transportProblems.length > 0 ? "failed" : statusValue;
  return {
    status: status === "failed" ? "failed" : "passed",
    problems: transportProblems.length > 0 ? concatStringArrays(problems, transportProblems) : problems,
    warnings,
    checkedObjects,
    checkedPaths
  };
}

function concatStringArrays(left, right) {
  const combined = [];
  for (let index = 0; index < left.length; index += 1) combined[combined.length] = left[index];
  for (let index = 0; index < right.length; index += 1) combined[combined.length] = right[index];
  return combined;
}

function relativePathEscapes(root, target) {
  const relative = path.relative(root, target);
  const normalized = SafeArrayJoin(SafeStringSplit(relative, path.sep), "/");
  return path.isAbsolute(relative) || SafeStringStartsWith(normalized, "..");
}

function loadClosureEntry(closure) {
  const ROOT = closure.closureRoot;
  const expected = new Map(); // relPath -> {hash,size,mode,uid,gid,dev,ino,nlink}
  for (const m of closure.modules) SafeMapSet(expected, m.relPath, m);
  const compiledCache = new Map(); // relPath -> module.exports

  // Open no-follow, then use the SAME fd to fstat, read, and hash — no separate
  // path check followed by an unprotected reopen. Verify the full recorded
  // manifest (hash/size/mode/nlink/dev/ino) so replacement, inode swap, mode or
  // ownership change, hard-linking, or group/world-writability between build and
  // execution all fail closed.
  function readVerified(relPath) {
    const want = SafeMapGet(expected, relPath);
    if (!want) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "undeclared closure module");
    const abs = path.join(ROOT, relPath);
    if (relativePathEscapes(ROOT, abs)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure path escape");
    let fd;
    try { fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch (e) {
      if (e && e.code === "ELOOP") throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is a symlink");
      throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module open failed");
    }
    try {
      const st = fs.fstatSync(fd);
      if (!st.isFile()) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is not a regular file");
      if (st.nlink > 1) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is hard-linked at execution");
      if (ENFORCE_POSIX_WRITE_BITS && (st.mode & 0o022)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module is group/world-writable at execution");
      if (st.size !== want.size) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module size mismatch at execution");
      if ((st.mode & 0o777) !== want.mode) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module mode change at execution");
      if (SafeString(st.dev) !== SafeString(want.dev) || SafeString(st.ino) !== SafeString(want.ino)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module inode replacement at execution");
      if (st.uid !== want.uid || st.gid !== want.gid) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module ownership change at execution");
      const real = fs.realpathSync(abs);
      if (real !== abs || relativePathEscapes(ROOT, real)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module resolves outside root at execution");
      const bytes = Buffer.alloc(st.size);
      let off = 0;
      while (off < st.size) { const n = fs.readSync(fd, bytes, off, st.size - off, off); if (n <= 0) break; off += n; }
      const data = SafeBufferSubarray(bytes, 0, off);
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      if (hash !== want.hash) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module hash mismatch at execution");
      return SafeBufferToString(data, "utf8");
    } finally { fs.closeSync(fd); }
  }

  function resolveLocal(fromRel, spec) {
    const dir = path.posix.dirname(fromRel);
    const base = path.posix.normalize(path.posix.join(dir, spec));
    const candidates = [base, `${base}.js`, `${base}/index.js`];
    for (let index = 0; index < candidates.length; index += 1) {
      const cand = candidates[index];
      if (SafeMapHas(expected, cand)) return cand;
    }
    throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "undeclared closure dependency");
  }

  function requireFrom(fromRel, spec) {
    if (spec === "." || spec === ".." || SafeStringStartsWith(spec, "./") || SafeStringStartsWith(spec, "../") || SafeStringStartsWith(spec, "/")) {
      const target = resolveLocal(fromRel, spec);
      return loadModule(target);
    }
    const builtin = SafeStringStartsWith(spec, "node:") ? SafeStringSlice(spec, 5) : spec;
    if (!SafeObjectHasOwn(ALLOWED_BUILTINS, builtin)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "non-allowlisted builtin required in closure");
    return ALLOWED_BUILTINS[builtin];
  }

  function loadModule(relPath) {
    if (SafeMapHas(compiledCache, relPath)) return SafeMapGet(compiledCache, relPath);
    const source = readVerified(relPath);
    const module = SafeObjectCreate(null);
    module["exports"] = SafeObjectCreate(null);
    SafeMapSet(compiledCache, relPath, module.exports); // seed for cycles
    const absFile = path.join(ROOT, relPath);
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
    SafeMapSet(compiledCache, relPath, module.exports);
    return module.exports;
  }

  return loadModule(closure.entryRelPath);
}

function loadAuthoritativeDescriptor(workerPayload) {
  const validatorId = workerPayload && workerPayload.validatorId;
  const expectedValidatorSetHash = workerPayload && workerPayload.expectedValidatorSetHash;
  if (typeof validatorId !== "string" || !validatorId) throw workerFailure("REGISTRY_MISMATCH", "validator worker requires a non-empty validatorId");
  if (SafeSetHas(UNSAFE_VALIDATOR_IDS, validatorId)) throw workerFailure("REGISTRY_MISMATCH", "validator worker rejected unsafe validator id");
  if (typeof expectedValidatorSetHash !== "string" || !expectedValidatorSetHash) throw workerFailure("REGISTRY_MISMATCH", "validator worker requires an expected validatorSetHash");

  let registry;
  try {
    registry = loadValidatorRegistry();
  } catch (error) {
    throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "authoritative validator registry could not load");
  }
  if (registry.validatorSetHash !== expectedValidatorSetHash) {
    throw workerFailure("REGISTRY_MISMATCH", "validatorSetHash mismatch in worker");
  }
  const descriptor = registry.descriptors.get(validatorId);
  if (!descriptor) throw workerFailure("REGISTRY_MISMATCH", "authoritative validator is unavailable in worker");
  return descriptor;
}

try {
  const { validatorId, phase, context } = workerData;
  const descriptor = loadAuthoritativeDescriptor(workerData);
  const closure = descriptor.closure;
  if (!closure || !Array.isArray(closure.modules) || !closure.entryRelPath) {
    fail("CLOSURE_VERIFICATION_FAILURE", "missing authoritative validator closure");
  } else {
    let validator;
    let validatorLoaded = false;
    try {
      lockValidatorHostAccess();
      validator = loadClosureEntry(closure);
      validatorLoaded = true;
    } catch (error) {
      failFromCaught(error, "CLOSURE_VERIFICATION_FAILURE");
    }
    const expectedContract = validatorLoaded ? descriptor.contract : null;
    if (
      validatorLoaded
      && (
      !validator
      || validator.id !== descriptor.id
      || !expectedContract
      || validator.version !== expectedContract.version
      || Boolean(validator.semantic) !== Boolean(expectedContract.semantic)
      || SafeJSONStringify(canonicalArray(validator.actions)) !== SafeJSONStringify(canonicalArray(expectedContract.actions))
      || SafeJSONStringify(canonicalArray(validator.supportedPhases)) !== SafeJSONStringify(canonicalArray(expectedContract.supportedPhases))
      || typeof validator.validate !== "function"
      )
    ) {
      fail("VALIDATOR_RESULT_INVALID", "validator contract mismatch in worker");
    } else if (validatorLoaded && (!SafeArrayIsArray(validator.supportedPhases) || !SafeArrayIncludes(validator.supportedPhases, phase))) {
      fail("VALIDATOR_RESULT_INVALID", "validator does not support requested phase");
    } else if (validatorLoaded) {
      const validationChain = SafePromiseThen(
        SafePromiseResolve(),
        () => {
          let validationResult;
          try {
            validationResult = validator.validate({ ...context, phase });
          } catch (error) {
            fail("VALIDATOR_THROW");
            return undefined;
          }
          return SafePromiseThen(
            SafePromiseResolve(validationResult),
            (raw) => ({ raw }),
            () => {
              fail("VALIDATOR_REJECTION");
              return undefined;
            }
          );
        }
      );
      SafePromiseCatch(
        SafePromiseThen(validationChain, (outcome) => {
          if (!outcome) return undefined;
          const raw = outcome.raw;
          if (!raw || typeof raw !== "object" || SafeArrayIsArray(raw)) return fail("VALIDATOR_RESULT_INVALID", "validator returned a non-object result");
          const normalized = normalizeTransportedResult(raw);
          succeed(normalized);
        }),
        (error) => failFromCaught(error, "WORKER_INTERNAL_FAILURE")
      );
    }
  }
} catch (error) {
  failFromCaught(error, "WORKER_INTERNAL_FAILURE");
}
