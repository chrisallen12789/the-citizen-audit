"use strict";

// Validator execution worker.
//
// Executes ONLY the bytes of the validator's verified code closure. Before any
// validator byte is compiled or executed, every module in the closure is opened
// with no-follow semantics, checked for symlink/non-regular status, re-hashed
// against the manifest bound into validatorSetHash, and copied into an immutable
// in-memory source map. The validator module loader never reopens source files
// after execution begins. There is no path-based require() fallback: local
// dependencies resolve only within the captured closure, and built-ins are
// limited to explicit reviewed facades. A synchronous infinite loop simply never
// posts; the parent enforces the hard deadline via worker.terminate().

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const os = require("os");
const util = require("util");
const assert = require("assert");
const { MessageChannel, MessagePort, parentPort, workerData } = require("worker_threads");
const { loadValidatorRegistry } = require("./validators");
const { REVIEWED_VALIDATOR_LIMITS } = require("./validator-limits");


const HOST_PROCESS = process;
const HOST_GLOBAL = globalThis;
const SafeVmCreateContext = vm.createContext.bind(vm);
const SafeVmCompileFunction = vm.compileFunction.bind(vm);
const SafeVmRunInContext = vm.runInContext.bind(vm);
const SafeArrayIncludes = Function.call.bind(Array.prototype.includes);
const SafeArrayIsArray = Array.isArray;
const SafeArrayJoin = Function.call.bind(Array.prototype.join);
const SafeArrayPop = Function.call.bind(Array.prototype.pop);
const SafeArrayPush = Function.call.bind(Array.prototype.push);
const SafeArraySlice = Function.call.bind(Array.prototype.slice);
const SafeArraySort = Function.call.bind(Array.prototype.sort);
const SafeBufferAlloc = Buffer.alloc.bind(Buffer);
const SafeBufferByteLength = Buffer.byteLength.bind(Buffer);
const SafeBufferConcat = Buffer.concat.bind(Buffer);
const SafeBufferFrom = Buffer.from.bind(Buffer);
const SafeBufferIsBuffer = Buffer.isBuffer.bind(Buffer);
const SafeBufferSubarray = Function.call.bind(Buffer.prototype.subarray);
const SafeBufferToString = Function.call.bind(Buffer.prototype.toString);
const SafeCryptoCreateHash = crypto.createHash.bind(crypto);
const SafeFunctionApply = Function.call.bind(Function.prototype.apply);
const SafeJSONStringify = JSON.stringify;
const SafeJSONParse = JSON.parse;
const SafeMessagePortClose = Function.call.bind(MessagePort.prototype.close);
const SafeMessagePortPostMessage = Function.call.bind(MessagePort.prototype.postMessage);
const SafeMessagePortRef = Function.call.bind(MessagePort.prototype.ref);
const SafeObjectCreate = Object.create;
const SafeObjectDefineProperty = Object.defineProperty;
const SafeObjectFreeze = Object.freeze;
const SafeObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const SafeObjectGetOwnPropertySymbols = Object.getOwnPropertySymbols;
const SafeObjectGetPrototypeOf = Object.getPrototypeOf;
const SafeObjectHasOwn = Function.call.bind(Object.prototype.hasOwnProperty);
const SafeObjectKeys = Object.keys;
const SafeObjectSetPrototypeOf = Object.setPrototypeOf;
const SafeMapDelete = Function.call.bind(Map.prototype.delete);
const SafeMapGet = Function.call.bind(Map.prototype.get);
const SafeMapHas = Function.call.bind(Map.prototype.has);
const SafeMapSet = Function.call.bind(Map.prototype.set);
const SafePromiseCatch = Function.call.bind(Promise.prototype.catch);
const SafePromiseResolve = Promise.resolve.bind(Promise);
const SafePromiseThen = Function.call.bind(Promise.prototype.then);
const SafeSetHas = Function.call.bind(Set.prototype.has);
const SafeStringSlice = Function.call.bind(String.prototype.slice);
const SafeStringSplit = Function.call.bind(String.prototype.split);
const SafeStringStartsWith = Function.call.bind(String.prototype.startsWith);
const SafeString = String;
const SafeWeakMapGet = Function.call.bind(WeakMap.prototype.get);
const SafeWeakMapHas = Function.call.bind(WeakMap.prototype.has);
const SafeWeakMapSet = Function.call.bind(WeakMap.prototype.set);
const SAFE_BYTE_VALUES = new WeakMap();

const HARNESS_CHANNEL_TYPE = "validator-harness-channel-v1";
const { port1: HARNESS_RESULT_PORT, port2: PARENT_RESULT_PORT } = new MessageChannel();
SafeMessagePortRef(HARNESS_RESULT_PORT);
SafeMessagePortPostMessage(parentPort, { type: HARNESS_CHANNEL_TYPE, port: PARENT_RESULT_PORT }, [PARENT_RESULT_PORT]);
try { SafeMessagePortClose(parentPort); } catch (error) {}

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

function safeWrapper(fn) {
  const callable = function safeWrappedCapability() {
    try {
      return fn(arguments);
    } catch (error) {
      throw "capability operation failed";
    }
  };
  try { SafeObjectSetPrototypeOf(callable, null); } catch (error) {}
  defineReadOnly(callable, "constructor", undefined);
  return SafeObjectFreeze(callable);
}

function createPathFacade(pathModule, includeVariants = false) {
  const entries = [
    ["join", safeWrapper((args) => SafeFunctionApply(pathModule.join, pathModule, SafeArraySlice(args)))],
    ["resolve", safeWrapper((args) => SafeFunctionApply(pathModule.resolve, pathModule, SafeArraySlice(args)))],
    ["relative", safeWrapper((args) => pathModule.relative(args[0], args[1]))],
    ["dirname", safeWrapper((args) => pathModule.dirname(args[0]))],
    ["basename", safeWrapper((args) => pathModule.basename(args[0], args[1]))],
    ["extname", safeWrapper((args) => pathModule.extname(args[0]))],
    ["normalize", safeWrapper((args) => pathModule.normalize(args[0]))],
    ["isAbsolute", safeWrapper((args) => Boolean(pathModule.isAbsolute(args[0])))],
    ["sep", pathModule.sep],
    ["delimiter", pathModule.delimiter]
  ];
  if (includeVariants) {
    entries[entries.length] = ["posix", createPathFacade(pathModule.posix, false)];
    entries[entries.length] = ["win32", createPathFacade(pathModule.win32, false)];
  }
  return frozenRecord(entries);
}

function createSafeBytes(value, encoding) {
  const bytes = SafeBufferFrom(unwrapSafeBytes(value), encoding);
  const copy = SafeBufferFrom(bytes);
  const wrapper = SafeObjectCreate(null);
  defineReadOnly(wrapper, "length", copy.length);
  defineReadOnly(wrapper, "byteLength", copy.length);
  defineReadOnly(wrapper, "toString", safeWrapper((args) => SafeBufferToString(copy, args[0] || "utf8")));
  defineReadOnly(wrapper, "subarray", safeWrapper((args) => createSafeBytes(SafeBufferSubarray(copy, args[0] || 0, args[1]))));
  defineReadOnly(wrapper, "slice", safeWrapper((args) => createSafeBytes(SafeBufferSubarray(copy, args[0] || 0, args[1]))));
  defineReadOnly(wrapper, "constructor", undefined);
  SafeWeakMapSet(SAFE_BYTE_VALUES, wrapper, copy);
  return SafeObjectFreeze(wrapper);
}

function unwrapSafeBytes(value) {
  if (SafeWeakMapHas(SAFE_BYTE_VALUES, value)) return SafeBufferFrom(SafeWeakMapGet(SAFE_BYTE_VALUES, value));
  return value;
}

function safeStatMethod(fn) {
  return safeWrapper(() => Boolean(fn()));
}

function createSafeStats(stats) {
  const wrapper = SafeObjectCreate(null);
  for (const key of ["dev", "ino", "mode", "nlink", "uid", "gid", "rdev", "size", "blksize", "blocks", "atimeMs", "mtimeMs", "ctimeMs", "birthtimeMs"]) {
    if (SafeObjectHasOwn(stats, key) || stats[key] !== undefined) defineReadOnly(wrapper, key, stats[key]);
  }
  defineReadOnly(wrapper, "isFile", safeStatMethod(() => stats.isFile()));
  defineReadOnly(wrapper, "isDirectory", safeStatMethod(() => stats.isDirectory()));
  defineReadOnly(wrapper, "isSymbolicLink", safeStatMethod(() => stats.isSymbolicLink()));
  defineReadOnly(wrapper, "isBlockDevice", safeStatMethod(() => stats.isBlockDevice()));
  defineReadOnly(wrapper, "isCharacterDevice", safeStatMethod(() => stats.isCharacterDevice()));
  defineReadOnly(wrapper, "isFIFO", safeStatMethod(() => stats.isFIFO()));
  defineReadOnly(wrapper, "isSocket", safeStatMethod(() => stats.isSocket()));
  defineReadOnly(wrapper, "constructor", undefined);
  return SafeObjectFreeze(wrapper);
}

function fsReadFileSyncFacade(args) {
  const result = fs.readFileSync(args[0], args[1]);
  return typeof result === "string" ? result : createSafeBytes(result);
}

function fsRealpathSyncFacade(args) {
  return fs.realpathSync(args[0], "utf8");
}

function fsWriteFileSyncFacade(args) {
  if (typeof args[0] !== "string") throw new TypeError("fs.writeFileSync path must be a string");
  fs.writeFileSync(args[0], unwrapSafeBytes(args[1]), args[2]);
}

function copyJsonValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (SafeArrayIsArray(value)) {
    const copy = [];
    for (let index = 0; index < value.length; index += 1) copy[index] = copyJsonValue(value[index]);
    defineReadOnly(copy, "constructor", undefined);
    return SafeObjectFreeze(copy);
  }
  const copy = SafeObjectCreate(null);
  const keys = SafeObjectKeys(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    defineReadOnly(copy, key, copyJsonValue(value[key]));
  }
  return SafeObjectFreeze(copy);
}

function cryptoCreateHashFacade(args) {
  const hash = SafeCryptoCreateHash(args[0]);
  let digested = false;
  const wrapper = SafeObjectCreate(null);
  defineReadOnly(wrapper, "update", safeWrapper((updateArgs) => {
    if (digested) throw new Error("hash already digested");
    hash.update(unwrapSafeBytes(updateArgs[0]), updateArgs[1]);
    return wrapper;
  }));
  defineReadOnly(wrapper, "digest", safeWrapper((digestArgs) => {
    if (digested) throw new Error("hash already digested");
    digested = true;
    const result = hash.digest(digestArgs[0]);
    return typeof result === "string" ? result : createSafeBytes(result);
  }));
  defineReadOnly(wrapper, "constructor", undefined);
  return SafeObjectFreeze(wrapper);
}

const SAFE_BUFFER_FACADE = frozenRecord([
  ["from", safeWrapper((args) => createSafeBytes(args[0], args[1]))],
  ["byteLength", safeWrapper((args) => SafeBufferByteLength(unwrapSafeBytes(args[0]), args[1] || "utf8"))],
  ["isBuffer", safeWrapper((args) => SafeWeakMapHas(SAFE_BYTE_VALUES, args[0]))],
  ["concat", safeWrapper((args) => {
    const list = args[0];
    if (!SafeArrayIsArray(list)) throw new TypeError("Buffer.concat list must be an array");
    const buffers = [];
    for (let index = 0; index < list.length; index += 1) buffers[index] = SafeBufferFrom(unwrapSafeBytes(list[index]));
    return createSafeBytes(SafeBufferConcat(buffers, args[1]));
  })],
  ["alloc", safeWrapper((args) => createSafeBytes(SafeBufferAlloc(args[0], args[1], args[2])))],
  ["allocUnsafe", safeWrapper((args) => createSafeBytes(SafeBufferAlloc(args[0])))]
]);
const SAFE_BUFFER_MODULE = frozenRecord([["Buffer", SAFE_BUFFER_FACADE]]);
const SAFE_JSON_FACADE = frozenRecord([
  ["parse", safeWrapper((args) => copyJsonValue(SafeJSONParse(args[0], args[1])))],
  ["stringify", safeWrapper((args) => SafeJSONStringify(args[0], args[1], args[2]))]
]);
const SAFE_FS_FACADE = frozenRecord([
  ["existsSync", safeWrapper((args) => Boolean(fs.existsSync(args[0])))],
  ["readFileSync", safeWrapper(fsReadFileSyncFacade)],
  ["writeFileSync", safeWrapper(fsWriteFileSyncFacade)],
  ["lstatSync", safeWrapper((args) => createSafeStats(fs.lstatSync(args[0], args[1])))],
  ["statSync", safeWrapper((args) => createSafeStats(fs.statSync(args[0], args[1])))],
  ["realpathSync", safeWrapper(fsRealpathSyncFacade)],
  ["constants", frozenRecord([
    ["O_RDONLY", fs.constants.O_RDONLY],
    ["O_NOFOLLOW", fs.constants.O_NOFOLLOW]
  ])]
]);
const SAFE_CRYPTO_FACADE = frozenRecord([
  ["createHash", safeWrapper(cryptoCreateHashFacade)],
  ["randomUUID", safeWrapper(() => crypto.randomUUID())]
]);
const SAFE_OS_FACADE = frozenRecord([
  ["hostname", safeWrapper(() => os.hostname())],
  ["platform", safeWrapper(() => os.platform())],
  ["tmpdir", safeWrapper(() => os.tmpdir())],
  ["type", safeWrapper(() => os.type())],
  ["release", safeWrapper(() => os.release())],
  ["arch", safeWrapper(() => os.arch())]
]);
const SAFE_ASSERT_FACADE = frozenRecord([
  ["ok", safeWrapper((args) => assert.ok(args[0], args[1]))],
  ["equal", safeWrapper((args) => assert.equal(args[0], args[1], args[2]))],
  ["strictEqual", safeWrapper((args) => assert.strictEqual(args[0], args[1], args[2]))],
  ["deepEqual", safeWrapper((args) => assert.deepEqual(args[0], args[1], args[2]))],
  ["deepStrictEqual", safeWrapper((args) => assert.deepStrictEqual(args[0], args[1], args[2]))]
]);
const SAFE_UTIL_FACADE = frozenRecord([
  ["format", safeWrapper((args) => SafeFunctionApply(util.format, util, SafeArraySlice(args)))]
]);
const SAFE_PATH_FACADE = createPathFacade(path, true);
const ALLOWED_BUILTINS = frozenRecord([
  ["path", SAFE_PATH_FACADE],
  ["crypto", SAFE_CRYPTO_FACADE],
  ["util", SAFE_UTIL_FACADE],
  ["assert", SAFE_ASSERT_FACADE],
  ["buffer", SAFE_BUFFER_MODULE],
  ["os", SAFE_OS_FACADE],
  ["fs", SAFE_FS_FACADE]
]);
const TRANSPORT_PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "bigint", "undefined"]);
const VALIDATOR_CONTEXT_UNDEFINED_GLOBALS = Object.freeze([
  "process",
  "global",
  "console",
  "performance",
  "navigator",
  "fetch",
  "WebSocket",
  "crypto",
  "structuredClone",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "clearTimeout",
  "clearInterval",
  "clearImmediate",
  "queueMicrotask",
  "AbortController",
  "AbortSignal",
  "ReadableStream",
  "ReadableStreamDefaultReader",
  "ReadableStreamDefaultController",
  "WritableStream",
  "WritableStreamDefaultWriter",
  "WritableStreamDefaultController",
  "TransformStream",
  "TextEncoder",
  "TextDecoder",
  "TextEncoderStream",
  "TextDecoderStream",
  "CompressionStream",
  "DecompressionStream",
  "Blob",
  "File",
  "FormData",
  "Headers",
  "Request",
  "Response",
  "MessagePort",
  "MessageChannel",
  "BroadcastChannel",
  "EventTarget",
  "Event",
  "MessageEvent",
  "require",
  "module",
  "exports"
]);

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
    BigUint64Array, Buffer, MessagePort, MessageChannel
  ];
  if (typeof AggregateError === "function") constructors[constructors.length] = AggregateError;
  if (typeof SharedArrayBuffer === "function") constructors[constructors.length] = SharedArrayBuffer;
  if (typeof BroadcastChannel === "function") constructors[constructors.length] = BroadcastChannel;
  if (typeof EventTarget === "function") constructors[constructors.length] = EventTarget;
  if (typeof Event === "function") constructors[constructors.length] = Event;
  if (typeof MessageEvent === "function") constructors[constructors.length] = MessageEvent;
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

function mustSetGlobalValue(name, value) {
  setGlobalValue(name, value);
  const descriptor = SafeObjectGetOwnPropertyDescriptor(HOST_GLOBAL, name);
  if (!descriptor) throw workerFailure("WORKER_INTERNAL_FAILURE", "global lockdown failed");
  if (!SafeObjectHasOwn(descriptor, "value") || descriptor.value !== value) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "global lockdown failed");
  }
}

function setProcessValue(name, value) {
  try {
    SafeObjectDefineProperty(HOST_PROCESS, name, { value, writable: false, configurable: false });
  } catch (error) {}
}

function isPrimitiveGlobalValue(value) {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

function neutralizeGlobalAuthority(key) {
  try {
    SafeObjectDefineProperty(HOST_GLOBAL, key, { value: undefined, writable: false, configurable: false });
  } catch (error) {}
  const descriptor = SafeObjectGetOwnPropertyDescriptor(HOST_GLOBAL, key);
  if (!descriptor) return;
  if (SafeObjectHasOwn(descriptor, "value") && descriptor.value === undefined) return;
  throw workerFailure("WORKER_INTERNAL_FAILURE", "symbol-keyed global authority could not be neutralized");
}

function lockSymbolKeyedGlobalAuthorities() {
  const symbols = SafeObjectGetOwnPropertySymbols(HOST_GLOBAL);
  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index];
    const descriptor = SafeObjectGetOwnPropertyDescriptor(HOST_GLOBAL, symbol);
    if (!descriptor) continue;
    if (!SafeObjectHasOwn(descriptor, "value")) {
      neutralizeGlobalAuthority(symbol);
      continue;
    }
    if (isPrimitiveGlobalValue(descriptor.value)) continue;
    neutralizeGlobalAuthority(symbol);
  }
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
  mustSetGlobalValue("Buffer", SAFE_BUFFER_FACADE);
  mustSetGlobalValue("JSON", SAFE_JSON_FACADE);
  const inertGlobals = [
    "console",
    "performance",
    "navigator",
    "fetch",
    "WebSocket",
    "crypto",
    "structuredClone",
    "setTimeout",
    "setInterval",
    "setImmediate",
    "clearTimeout",
    "clearInterval",
    "clearImmediate",
    "queueMicrotask",
    "AbortController",
    "AbortSignal",
    "ReadableStream",
    "ReadableStreamDefaultReader",
    "ReadableStreamDefaultController",
    "WritableStream",
    "WritableStreamDefaultWriter",
    "WritableStreamDefaultController",
    "TransformStream",
    "TextEncoder",
    "TextDecoder",
    "TextEncoderStream",
    "TextDecoderStream",
    "CompressionStream",
    "DecompressionStream",
    "Blob",
    "File",
    "FormData",
    "Headers",
    "Request",
    "Response"
  ];
  for (let index = 0; index < inertGlobals.length; index += 1) mustSetGlobalValue(inertGlobals[index], undefined);
  setGlobalValue("MessagePort", undefined);
  setGlobalValue("MessageChannel", undefined);
  setGlobalValue("BroadcastChannel", undefined);
  setGlobalValue("EventTarget", undefined);
  setGlobalValue("Event", undefined);
  setGlobalValue("MessageEvent", undefined);
  lockSymbolKeyedGlobalAuthorities();
}

function defineValidatorGlobal(context, name, value) {
  try {
    SafeObjectDefineProperty(context, name, { value, enumerable: false, writable: false, configurable: false });
  } catch (error) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "validator context global definition failed");
  }
}

function encodeBridgeValue(value) {
  if (SafeBufferIsBuffer(value)) return { __validatorKind: "bytes", base64: SafeBufferToString(value, "base64") };
  return value;
}

function encodeStats(stats) {
  const data = SafeObjectCreate(null);
  for (const key of ["dev", "ino", "mode", "nlink", "uid", "gid", "rdev", "size", "blksize", "blocks", "atimeMs", "mtimeMs", "ctimeMs", "birthtimeMs"]) {
    data[key] = stats[key];
  }
  data.isFile = Boolean(stats.isFile());
  data.isDirectory = Boolean(stats.isDirectory());
  data.isSymbolicLink = Boolean(stats.isSymbolicLink());
  data.isBlockDevice = Boolean(stats.isBlockDevice());
  data.isCharacterDevice = Boolean(stats.isCharacterDevice());
  data.isFIFO = Boolean(stats.isFIFO());
  data.isSocket = Boolean(stats.isSocket());
  return { __validatorKind: "stats", data };
}

function decodeBridgeValue(value) {
  if (value && typeof value === "object") {
    if (value.__validatorKind === "bytes" && typeof value.base64 === "string") return SafeBufferFrom(value.base64, "base64");
    if (SafeArrayIsArray(value)) {
      const copy = [];
      for (let index = 0; index < value.length; index += 1) copy[index] = decodeBridgeValue(value[index]);
      return copy;
    }
    const copy = SafeObjectCreate(null);
    const keys = SafeObjectKeys(value);
    for (let index = 0; index < keys.length; index += 1) copy[keys[index]] = decodeBridgeValue(value[keys[index]]);
    return copy;
  }
  return value;
}

function bridgeResponse(ok, value) {
  return SafeJSONStringify(ok ? { ok: true, value } : { ok: false });
}

function createCapabilityBridge() {
  const hashStates = new Map();
  let nextHashToken = 0;
  function readArgs(serializedArgs) {
    const parsed = SafeJSONParse(serializedArgs);
    if (!SafeArrayIsArray(parsed)) throw new Error("bridge args must be an array");
    const args = [];
    for (let index = 0; index < parsed.length; index += 1) args[index] = decodeBridgeValue(parsed[index]);
    return args;
  }
  return function validatorCapabilityBridge(operation, serializedArgs) {
    try {
      const args = readArgs(serializedArgs);
      switch (operation) {
        case "bytes.from":
          return bridgeResponse(true, encodeBridgeValue(SafeBufferFrom(args[0], args[1])));
        case "bytes.alloc":
          return bridgeResponse(true, encodeBridgeValue(SafeBufferAlloc(args[0], args[1], args[2])));
        case "bytes.allocUnsafe":
          return bridgeResponse(true, encodeBridgeValue(SafeBufferAlloc(args[0])));
        case "bytes.byteLength":
          return bridgeResponse(true, SafeBufferByteLength(args[0], args[1] || "utf8"));
        case "bytes.concat": {
          const list = args[0];
          if (!SafeArrayIsArray(list)) throw new TypeError("Buffer.concat list must be an array");
          const buffers = [];
          for (let index = 0; index < list.length; index += 1) buffers[index] = SafeBufferFrom(list[index]);
          return bridgeResponse(true, encodeBridgeValue(SafeBufferConcat(buffers, typeof args[1] === "number" ? args[1] : undefined)));
        }
        case "bytes.toString":
          return bridgeResponse(true, SafeBufferToString(args[0], args[1] || "utf8"));
        case "bytes.subarray":
          return bridgeResponse(true, encodeBridgeValue(SafeBufferSubarray(args[0], args[1] || 0, args[2])));
        case "fs.existsSync":
          return bridgeResponse(true, Boolean(fs.existsSync(args[0])));
        case "fs.readFileSync":
          return bridgeResponse(true, encodeBridgeValue(fs.readFileSync(args[0], args[1])));
        case "fs.writeFileSync":
          if (typeof args[0] !== "string") throw new TypeError("fs.writeFileSync path must be a string");
          fs.writeFileSync(args[0], args[1], args[2]);
          return bridgeResponse(true, undefined);
        case "fs.lstatSync":
          return bridgeResponse(true, encodeStats(fs.lstatSync(args[0], args[1])));
        case "fs.statSync":
          return bridgeResponse(true, encodeStats(fs.statSync(args[0], args[1])));
        case "fs.realpathSync":
          return bridgeResponse(true, fs.realpathSync(args[0], "utf8"));
        case "crypto.createHash": {
          const token = `hash-${++nextHashToken}`;
          SafeMapSet(hashStates, token, SafeCryptoCreateHash(args[0]));
          return bridgeResponse(true, token);
        }
        case "hash.update": {
          const hash = SafeMapGet(hashStates, args[0]);
          if (!hash) throw new Error("unknown hash token");
          hash.update(args[1], args[2]);
          return bridgeResponse(true, true);
        }
        case "hash.digest": {
          const hash = SafeMapGet(hashStates, args[0]);
          if (!hash) throw new Error("unknown hash token");
          hashStates.delete(args[0]);
          return bridgeResponse(true, encodeBridgeValue(hash.digest(args[1])));
        }
        case "crypto.randomUUID":
          return bridgeResponse(true, crypto.randomUUID());
        case "os.hostname":
          return bridgeResponse(true, os.hostname());
        case "os.platform":
          return bridgeResponse(true, os.platform());
        case "os.tmpdir":
          return bridgeResponse(true, os.tmpdir());
        case "os.type":
          return bridgeResponse(true, os.type());
        case "os.release":
          return bridgeResponse(true, os.release());
        case "os.arch":
          return bridgeResponse(true, os.arch());
        case "util.format":
          return bridgeResponse(true, SafeFunctionApply(util.format, util, args));
        case "assert.ok":
          assert.ok(args[0], args[1]);
          return bridgeResponse(true, undefined);
        case "assert.equal":
          assert.equal(args[0], args[1], args[2]);
          return bridgeResponse(true, undefined);
        case "assert.strictEqual":
          assert.strictEqual(args[0], args[1], args[2]);
          return bridgeResponse(true, undefined);
        case "assert.deepEqual":
          assert.deepEqual(args[0], args[1], args[2]);
          return bridgeResponse(true, undefined);
        case "assert.deepStrictEqual":
          assert.deepStrictEqual(args[0], args[1], args[2]);
          return bridgeResponse(true, undefined);
        default:
          if (SafeStringStartsWith(operation, "path.")) {
            const parts = SafeStringSplit(operation, ".");
            const variant = parts.length === 3 ? parts[1] : null;
            const method = parts.length === 3 ? parts[2] : parts[1];
            const pathModule = variant === "posix" ? path.posix : variant === "win32" ? path.win32 : path;
            if (!SafeObjectHasOwn(pathModule, method) || typeof pathModule[method] !== "function") throw new Error("unknown path operation");
            return bridgeResponse(true, SafeFunctionApply(pathModule[method], pathModule, args));
          }
          throw new Error("unknown bridge operation");
      }
    } catch (error) {
      return bridgeResponse(false);
    }
  };
}

function createValidatorContext() {
  if (!vm.constants || !vm.constants.DONT_CONTEXTIFY) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "durable validator context is unavailable");
  }
  let context;
  try {
    context = SafeVmCreateContext(vm.constants.DONT_CONTEXTIFY);
  } catch (error) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "durable validator context creation failed");
  }
  for (let index = 0; index < VALIDATOR_CONTEXT_UNDEFINED_GLOBALS.length; index += 1) {
    defineValidatorGlobal(context, VALIDATOR_CONTEXT_UNDEFINED_GLOBALS[index], undefined);
  }
  let runtime;
  try {
    runtime = SafeVmRunInContext(`
      ((bridge) => {
        const O = Object;
        const A = Array;
        const R = Reflect;
        const J = globalThis.JSON;
        const define = O.defineProperty;
        const create = O.create;
        const freeze = O.freeze;
        const getOwnDescriptor = O.getOwnPropertyDescriptor;
        const getPrototypeOf = O.getPrototypeOf;
        const setPrototypeOf = O.setPrototypeOf;
        const ownKeys = R.ownKeys;
        const arrayIsArray = A.isArray;
        const jsonParse = J.parse;
        const jsonStringify = J.stringify;
        const safeBytes = new WeakMap();

        function defineRO(target, key, value) {
          define(target, key, { value, enumerable: true, writable: false, configurable: false });
        }
        function record(entries) {
          const out = create(null);
          for (let index = 0; index < entries.length; index += 1) defineRO(out, entries[index][0], entries[index][1]);
          return freeze(out);
        }
        function serialize(value, seen) {
          if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
          if (safeBytes.has(value)) return { __validatorKind: "bytes", base64: safeBytes.get(value) };
          if (!seen) seen = [];
          for (let index = 0; index < seen.length; index += 1) if (seen[index] === value) throw "capability operation failed";
          seen[seen.length] = value;
          if (arrayIsArray(value)) {
            const arr = [];
            for (let index = 0; index < value.length; index += 1) arr[index] = serialize(value[index], seen);
            return arr;
          }
          const out = create(null);
          const keys = ownKeys(value);
          for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (typeof key !== "string") continue;
            const descriptor = getOwnDescriptor(value, key);
            if (!descriptor || !("value" in descriptor)) continue;
            out[key] = serialize(descriptor.value, seen);
          }
          return out;
        }
        function bridgeCall(operation, args) {
          const responseText = bridge(operation, jsonStringify(args.map((arg) => serialize(arg))));
          if (typeof responseText !== "string") throw "capability operation failed";
          const response = jsonParse(responseText);
          if (!response || response.ok !== true) throw "capability operation failed: " + operation;
          return materialize(response.value);
        }
        function makeCallable(fn) {
          const callable = (...args) => fn(args);
          try { setPrototypeOf(callable, null); } catch (error) {}
          try { defineRO(callable, "constructor", undefined); } catch (error) {}
          return freeze(callable);
        }
        function makeBridgeCallable(operation) {
          return makeCallable((args) => bridgeCall(operation, args));
        }
        function createRealmRequireFailure(code) {
          const failure = create(null);
          defineRO(failure, "name", "ValidatorRequireFailure");
          defineRO(failure, "message", "validator dependency could not be loaded");
          defineRO(failure, "code", typeof code === "string" ? code : "VALIDATOR_THROW");
          return freeze(failure);
        }
        function deepFreezeJson(value, seen) {
          if (value === null || typeof value !== "object") return value;
          if (!seen) seen = [];
          for (let index = 0; index < seen.length; index += 1) if (seen[index] === value) return value;
          seen[seen.length] = value;
          if (arrayIsArray(value)) {
            for (let index = 0; index < value.length; index += 1) deepFreezeJson(value[index], seen);
            try { defineRO(value, "constructor", undefined); } catch (error) {}
            return freeze(value);
          }
          const copy = create(null);
          const keys = ownKeys(value);
          for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (typeof key !== "string") continue;
            const descriptor = getOwnDescriptor(value, key);
            if (!descriptor || !("value" in descriptor)) continue;
            defineRO(copy, key, deepFreezeJson(descriptor.value, seen));
          }
          return freeze(copy);
        }
        function createBytes(base64) {
          const wrapper = create(null);
          const byteLength = bridgeCall("bytes.byteLength", [{ __validatorKind: "bytes", base64 }]);
          defineRO(wrapper, "length", byteLength);
          defineRO(wrapper, "byteLength", byteLength);
          defineRO(wrapper, "toString", makeCallable((args) => bridgeCall("bytes.toString", [{ __validatorKind: "bytes", base64 }, args[0] || "utf8"])));
          defineRO(wrapper, "subarray", makeCallable((args) => bridgeCall("bytes.subarray", [{ __validatorKind: "bytes", base64 }, args[0] || 0, args[1]])));
          defineRO(wrapper, "slice", makeCallable((args) => bridgeCall("bytes.subarray", [{ __validatorKind: "bytes", base64 }, args[0] || 0, args[1]])));
          defineRO(wrapper, "constructor", undefined);
          safeBytes.set(wrapper, base64);
          return freeze(wrapper);
        }
        function createStats(data) {
          const wrapper = create(null);
          const keys = ownKeys(data);
          for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (typeof key === "string" && key.slice(0, 2) !== "is") defineRO(wrapper, key, data[key]);
          }
          for (const name of ["isFile", "isDirectory", "isSymbolicLink", "isBlockDevice", "isCharacterDevice", "isFIFO", "isSocket"]) {
            defineRO(wrapper, name, makeCallable(() => Boolean(data[name])));
          }
          defineRO(wrapper, "constructor", undefined);
          return freeze(wrapper);
        }
        function createHash(token) {
          let digested = false;
          const wrapper = create(null);
          defineRO(wrapper, "update", makeCallable((args) => {
            if (digested) throw "capability operation failed";
            bridgeCall("hash.update", [token, args[0], args[1]]);
            return wrapper;
          }));
          defineRO(wrapper, "digest", makeCallable((args) => {
            if (digested) throw "capability operation failed";
            digested = true;
            return bridgeCall("hash.digest", [token, args[0]]);
          }));
          defineRO(wrapper, "constructor", undefined);
          return freeze(wrapper);
        }
        function materialize(value) {
          if (value && typeof value === "object") {
            if (value.__validatorKind === "bytes") return createBytes(value.base64);
            if (value.__validatorKind === "stats") return createStats(value.data);
            if (arrayIsArray(value)) {
              const arr = [];
              for (let index = 0; index < value.length; index += 1) arr[index] = materialize(value[index]);
              try { defineRO(arr, "constructor", undefined); } catch (error) {}
              return freeze(arr);
            }
            return deepFreezeJson(value);
          }
          return value;
        }
        function pathFacade(prefix, includeVariants) {
          const entries = [
            ["join", makeBridgeCallable(prefix + "join")],
            ["resolve", makeBridgeCallable(prefix + "resolve")],
            ["relative", makeBridgeCallable(prefix + "relative")],
            ["dirname", makeBridgeCallable(prefix + "dirname")],
            ["basename", makeBridgeCallable(prefix + "basename")],
            ["extname", makeBridgeCallable(prefix + "extname")],
            ["normalize", makeBridgeCallable(prefix + "normalize")],
            ["isAbsolute", makeBridgeCallable(prefix + "isAbsolute")],
            ["sep", prefix === "path.win32." ? "\\\\" : "/"],
            ["delimiter", prefix === "path.win32." ? ";" : ":"]
          ];
          if (includeVariants) {
            entries[entries.length] = ["posix", pathFacade("path.posix.", false)];
            entries[entries.length] = ["win32", pathFacade("path.win32.", false)];
          }
          return record(entries);
        }
        const bufferFacade = record([
          ["from", makeBridgeCallable("bytes.from")],
          ["byteLength", makeBridgeCallable("bytes.byteLength")],
          ["isBuffer", makeCallable((args) => safeBytes.has(args[0]))],
          ["concat", makeBridgeCallable("bytes.concat")],
          ["alloc", makeBridgeCallable("bytes.alloc")],
          ["allocUnsafe", makeBridgeCallable("bytes.allocUnsafe")]
        ]);
        const jsonFacade = record([
          ["parse", makeCallable((args) => deepFreezeJson(jsonParse(args[0], args[1])))],
          ["stringify", makeCallable((args) => jsonStringify(args[0], args[1], args[2]))]
        ]);
        const fsFacade = record([
          ["existsSync", makeBridgeCallable("fs.existsSync")],
          ["readFileSync", makeBridgeCallable("fs.readFileSync")],
          ["writeFileSync", makeBridgeCallable("fs.writeFileSync")],
          ["lstatSync", makeBridgeCallable("fs.lstatSync")],
          ["statSync", makeBridgeCallable("fs.statSync")],
          ["realpathSync", makeBridgeCallable("fs.realpathSync")],
          ["constants", record([["O_RDONLY", 0], ["O_NOFOLLOW", 0]])]
        ]);
        const cryptoFacade = record([
          ["createHash", makeCallable((args) => createHash(bridgeCall("crypto.createHash", args)))],
          ["randomUUID", makeBridgeCallable("crypto.randomUUID")]
        ]);
        const builtins = record([
          ["path", pathFacade("path.", true)],
          ["crypto", cryptoFacade],
          ["util", record([["format", makeBridgeCallable("util.format")]])],
          ["assert", record([
            ["ok", makeBridgeCallable("assert.ok")],
            ["equal", makeBridgeCallable("assert.equal")],
            ["strictEqual", makeBridgeCallable("assert.strictEqual")],
            ["deepEqual", makeBridgeCallable("assert.deepEqual")],
            ["deepStrictEqual", makeBridgeCallable("assert.deepStrictEqual")]
          ])],
          ["buffer", record([["Buffer", bufferFacade]])],
          ["os", record([
            ["hostname", makeBridgeCallable("os.hostname")],
            ["platform", makeBridgeCallable("os.platform")],
            ["tmpdir", makeBridgeCallable("os.tmpdir")],
            ["type", makeBridgeCallable("os.type")],
            ["release", makeBridgeCallable("os.release")],
            ["arch", makeBridgeCallable("os.arch")]
          ])],
          ["fs", fsFacade]
        ]);
        define(globalThis, "Buffer", { value: bufferFacade, enumerable: false, writable: false, configurable: false });
        define(globalThis, "JSON", { value: jsonFacade, enumerable: false, writable: false, configurable: false });
        const runtime = record([
          ["createModule", makeCallable(() => {
            const module = create(null);
            define(module, "exports", { value: create(null), enumerable: true, writable: true, configurable: false });
            return module;
          })],
          ["createRequire", makeCallable((args) => {
            const localBridge = args[0];
            return makeCallable((requireArgs) => {
              const response = localBridge(String(requireArgs[0]));
              if (!response || response.ok !== true) {
                throw createRealmRequireFailure(response && response.code);
              }
              return response.value;
            });
          })],
          ["parseJson", makeCallable((args) => deepFreezeJson(jsonParse(args[0])))],
          ["requireBuiltin", makeCallable((args) => builtins[args[0]])]
        ]);
        return runtime;
      })
    `, context)(createCapabilityBridge());
  } catch (error) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "validator runtime creation failed");
  }
  try {
    SafeVmRunInContext(`
      Object.setPrototypeOf(globalThis, null);
      Object.freeze(globalThis);
    `, context);
  } catch (error) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "validator context lockdown failed");
  }
  let auditProblems;
  try {
    auditProblems = SafeVmRunInContext(`
      (() => {
        const problems = [];
        if (Object.getPrototypeOf(globalThis) !== null) problems[problems.length] = "validator global prototype is not null";
        if (Object.isExtensible(globalThis)) problems[problems.length] = "validator global is extensible";
        if (!Object.isFrozen(globalThis)) problems[problems.length] = "validator global is not frozen";
        const symbols = Object.getOwnPropertySymbols(globalThis);
        for (const symbol of symbols) {
          const descriptor = Object.getOwnPropertyDescriptor(globalThis, symbol);
          if (!descriptor) continue;
          if ("get" in descriptor || "set" in descriptor) {
            problems[problems.length] = "validator global symbol accessor remains";
            continue;
          }
          const value = descriptor.value;
          if (value !== null && (typeof value === "object" || typeof value === "function")) {
            problems[problems.length] = "validator global symbol nonprimitive remains";
          }
        }
        return problems;
      })()
    `, context);
  } catch (error) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "validator context audit failed");
  }
  if (!SafeArrayIsArray(auditProblems) || auditProblems.length) {
    throw workerFailure("WORKER_INTERNAL_FAILURE", "validator context audit rejected global surface");
  }
  return { context, runtime };
}

const WORKER_FAILURE_METADATA = new WeakMap();

class WorkerFailure extends Error {
  constructor(code, diagnostic) {
    super(code);
    this.failureCode = code;
    this.diagnostic = diagnostic;
    const metadata = SafeObjectCreate(null);
    metadata.code = code;
    metadata.diagnostic = diagnostic;
    SafeWeakMapSet(WORKER_FAILURE_METADATA, this, metadata);
  }
}

function workerFailure(code, diagnostic) {
  return new WorkerFailure(code, diagnostic);
}

function getWorkerFailureMetadata(error) {
  if (!SafeWeakMapHas(WORKER_FAILURE_METADATA, error)) return null;
  return SafeWeakMapGet(WORKER_FAILURE_METADATA, error);
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
    SafeMessagePortPostMessage(HARNESS_RESULT_PORT, checkedEnvelopeString(envelope));
  } catch (error) { /* parent gone */ }
  finally {
    try { SafeMessagePortClose(HARNESS_RESULT_PORT); } catch (error) {}
  }
}

function fail(code, diagnostic) {
  postEnvelope(failureEnvelope(code, diagnostic));
}

function failFromCaught(error, fallbackCode, diagnostic) {
  const metadata = getWorkerFailureMetadata(error);
  if (metadata !== null) return fail(metadata.code, metadata.diagnostic);
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
  const verifiedSources = verifyCompleteClosureSources(ROOT, expected, closure.modules);
  const validatorRuntime = createValidatorContext();
  lockValidatorHostAccess();
  const validatorContext = validatorRuntime.context;
  const compiledCache = new Map(); // relPath -> one identity-stable load record
  let activeLoadTransaction = null;

  function createLoadTransaction() {
    const transaction = SafeObjectCreate(null);
    transaction.entries = [];
    transaction.stack = [];
    return transaction;
  }

  function trackLoadTransactionEntry(transaction, record) {
    record.journalIndex = transaction.entries.length;
    SafeArrayPush(transaction.entries, record);
  }

  function invalidateLoadTransactionFrom(transaction, rollbackFloor, failureCode) {
    for (let index = transaction.entries.length - 1; index >= rollbackFloor; index -= 1) {
      const record = transaction.entries[index];
      record.valid = false;
      record.state = "invalid";
      record.failureCode = safeFailureCode(failureCode);
      if (!record.executing && SafeMapGet(compiledCache, record.relPath) === record) {
        SafeMapDelete(compiledCache, record.relPath);
      }
    }
  }

  function markActiveCycle(transaction, ancestor) {
    let ancestorStackIndex = -1;
    for (let index = 0; index < transaction.stack.length; index += 1) {
      if (transaction.stack[index] === ancestor) {
        ancestorStackIndex = index;
        break;
      }
    }
    if (ancestorStackIndex < 0) {
      throw workerFailure("WORKER_INTERNAL_FAILURE", "validator module cache contains a non-active loading entry");
    }
    for (let index = ancestorStackIndex; index < transaction.stack.length; index += 1) {
      const record = transaction.stack[index];
      if (record.cycleFloor === null || ancestor.journalIndex < record.cycleFloor) {
        record.cycleFloor = ancestor.journalIndex;
      }
    }
  }

  function commitLoadTransaction(transaction) {
    for (let index = 0; index < transaction.entries.length; index += 1) {
      const record = transaction.entries[index];
      if (!record.valid) continue;
      if (SafeMapGet(compiledCache, record.relPath) !== record || record.state !== "initialized" || record.executing) {
        throw workerFailure("WORKER_INTERNAL_FAILURE", "validator load transaction cannot commit an incomplete module");
      }
    }
    for (let index = 0; index < transaction.entries.length; index += 1) {
      const record = transaction.entries[index];
      if (!record.valid) continue;
      record.state = "loaded";
      record.module = null;
    }
  }

  function verifyOneModule(relPath) {
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
      const bytes = SafeBufferAlloc(st.size);
      let off = 0;
      while (off < st.size) { const n = fs.readSync(fd, bytes, off, st.size - off, off); if (n <= 0) break; off += n; }
      const data = SafeBufferSubarray(bytes, 0, off);
      const hash = SafeCryptoCreateHash("sha256").update(data).digest("hex");
      if (hash !== want.hash) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module hash mismatch at execution");
      return SafeBufferFrom(data);
    } finally { fs.closeSync(fd); }
  }

  function verifyCompleteClosureSources(root, expectedModules, modules) {
    const sourceMap = new Map();
    for (let index = 0; index < modules.length; index += 1) {
      const moduleEntry = modules[index];
      const relPath = moduleEntry && moduleEntry.relPath;
      if (typeof relPath !== "string" || !relPath) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "invalid closure module entry");
      if (!SafeMapHas(expectedModules, relPath)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure manifest entry is not bound");
      const verifiedBytes = verifyOneModule(relPath);
      SafeMapSet(sourceMap, relPath, SafeBufferToString(verifiedBytes, "utf8"));
    }
    if (!SafeMapHas(sourceMap, closure.entryRelPath)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure entry is not captured");
    return sourceMap;
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
    return validatorRuntime.runtime.requireBuiltin(builtin);
  }

  function requireBridgeSuccess(value) {
    const response = SafeObjectCreate(null);
    response.ok = true;
    response.value = value;
    return response;
  }

  function requireBridgeFailure(code) {
    const response = SafeObjectCreate(null);
    response.ok = false;
    response.code = safeFailureCode(code);
    return response;
  }

  function requireFailureCode(error) {
    const metadata = getWorkerFailureMetadata(error);
    if (metadata !== null) return metadata.code;
    return "VALIDATOR_THROW";
  }

  function createValidatorRequire(fromRel, ownerRecord) {
    return validatorRuntime.runtime.createRequire((spec) => {
      try {
        if (!ownerRecord.valid) {
          throw workerFailure(ownerRecord.failureCode, "invalidated validator module attempted to require a dependency");
        }
        return requireBridgeSuccess(requireFrom(fromRel, spec));
      } catch (error) {
        return requireBridgeFailure(requireFailureCode(error));
      }
    });
  }

  function loadModule(relPath) {
    if (activeLoadTransaction === null && SafeMapHas(compiledCache, relPath)) {
      const cached = SafeMapGet(compiledCache, relPath);
      if (cached.state === "loaded" && cached.valid) return cached.exports;
      throw workerFailure("WORKER_INTERNAL_FAILURE", "validator module cache contains a stale provisional entry");
    }
    const ownsTransaction = activeLoadTransaction === null;
    const transaction = ownsTransaction ? createLoadTransaction() : activeLoadTransaction;
    if (ownsTransaction) activeLoadTransaction = transaction;
    const savepoint = transaction.entries.length;
    let cacheRecord = null;
    try {
      if (SafeMapHas(compiledCache, relPath)) {
        const cached = SafeMapGet(compiledCache, relPath);
        if (cached.state === "loading") {
          markActiveCycle(transaction, cached);
          return cached.module.exports;
        }
        if (cached.state === "initialized" && cached.valid) return cached.exports;
        if (cached.state === "loaded") return cached.exports;
        if (cached.state === "invalid" || !cached.valid) {
          throw workerFailure(cached.failureCode, "invalidated validator module cannot be reused");
        }
        throw workerFailure("WORKER_INTERNAL_FAILURE", "validator module cache state is invalid");
      }
      if (!SafeMapHas(verifiedSources, relPath)) throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "closure module was not captured before execution");
      const source = SafeMapGet(verifiedSources, relPath);
      const module = validatorRuntime.runtime.createModule();
      cacheRecord = SafeObjectCreate(null);
      cacheRecord.relPath = relPath;
      cacheRecord.state = "loading";
      cacheRecord.module = module;
      cacheRecord.exports = null;
      cacheRecord.valid = true;
      cacheRecord.executing = false;
      cacheRecord.cycleFloor = null;
      cacheRecord.failureCode = "WORKER_INTERNAL_FAILURE";
      SafeMapSet(compiledCache, relPath, cacheRecord);
      trackLoadTransactionEntry(transaction, cacheRecord);
      const absFile = path.join(ROOT, relPath);
      let wrapper;
      try {
        wrapper = SafeVmCompileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename: absFile, parsingContext: validatorContext });
      } catch (error) {
        throw workerFailure("CLOSURE_VERIFICATION_FAILURE", "validator module compilation failed");
      }
      cacheRecord.executing = true;
      SafeArrayPush(transaction.stack, cacheRecord);
      try {
        wrapper(module.exports, createValidatorRequire(relPath, cacheRecord), module, absFile, path.dirname(absFile));
      } catch (error) {
        if (getWorkerFailureMetadata(error) !== null) throw error;
        throw workerFailure("VALIDATOR_THROW");
      } finally {
        SafeArrayPop(transaction.stack);
        cacheRecord.executing = false;
        if (!cacheRecord.valid && SafeMapGet(compiledCache, relPath) === cacheRecord) {
          SafeMapDelete(compiledCache, relPath);
        }
      }
      if (!cacheRecord.valid) {
        throw workerFailure(cacheRecord.failureCode, "validator module was invalidated by a failed initialization group");
      }
      cacheRecord.state = "initialized";
      cacheRecord.exports = module.exports;
      if (ownsTransaction) commitLoadTransaction(transaction);
      return module.exports;
    } catch (error) {
      let rollbackFloor = savepoint;
      if (cacheRecord !== null && cacheRecord.cycleFloor !== null && cacheRecord.cycleFloor < rollbackFloor) {
        rollbackFloor = cacheRecord.cycleFloor;
      }
      const failureCode = requireFailureCode(error);
      invalidateLoadTransactionFrom(transaction, rollbackFloor, failureCode);
      if (getWorkerFailureMetadata(error) !== null) throw error;
      throw workerFailure(failureCode);
    } finally {
      if (ownsTransaction) activeLoadTransaction = null;
    }
  }

  return { exports: loadModule(closure.entryRelPath), runtime: validatorRuntime.runtime };
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
    let validatorRealmRuntime;
    let validatorLoaded = false;
    try {
      const loadedValidator = loadClosureEntry(closure);
      validator = loadedValidator.exports;
      validatorRealmRuntime = loadedValidator.runtime;
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
            const serializedContext = SafeJSONStringify({ ...context, phase });
            const validationContext = validatorRealmRuntime.parseJson(serializedContext);
            validationResult = validator.validate(validationContext);
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
