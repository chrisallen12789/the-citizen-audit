"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { parentPort, workerData } = require("worker_threads");

const LIMITS = workerData.limits || {};
const MAX_RESULT_BYTES = LIMITS.maxResultBytes || 262144;
const MAX_ARRAY_LEN = LIMITS.maxArrayLen || 10000;
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";

const ALLOWED_BUILTINS = {
  path: require("path"),
  crypto: require("crypto"),
  util: require("util"),
  assert: require("assert"),
  buffer: require("buffer"),
  os: require("os"),
  fs: require("fs")
};

function fail(reason) { try { parentPort.postMessage({ ok: false, error: reason }); } catch (error) {} }
function canonicalArray(value) { return Array.isArray(value) ? [...value].map(String).sort() : []; }
function boundArray(value, label, problems) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { problems.push(`${label} is not an array`); return []; }
  if (value.length > MAX_ARRAY_LEN) { problems.push(`${label} exceeds ${MAX_ARRAY_LEN} entries`); return value.slice(0, MAX_ARRAY_LEN); }
  return value;
}

function loadClosureEntry(closure) {
  const root = closure.closureRoot;
  const expected = new Map();
  for (const moduleEntry of closure.modules) expected.set(moduleEntry.relPath, moduleEntry);
  const compiledCache = new Map();

  function readVerified(relPath) {
    const want = expected.get(relPath);
    if (!want) throw new Error(`undeclared closure module: ${relPath}`);
    const abs = path.join(root, relPath);
    if (path.relative(root, abs).split(path.sep).join("/").startsWith("..")) throw new Error(`closure path escape: ${relPath}`);
    let fd;
    try { fd = fs.openSync(abs, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch (error) { if (error.code === "ELOOP") throw new Error(`closure module is a symlink: ${relPath}`); throw error; }
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) throw new Error(`closure module is not a regular file: ${relPath}`);
      if (stat.nlink > 1) throw new Error(`closure module is hard-linked at execution: ${relPath}`);
      if (ENFORCE_POSIX_WRITE_BITS && (stat.mode & 0o022)) throw new Error(`closure module is group/world-writable at execution: ${relPath}`);
      if (stat.size !== want.size) throw new Error(`closure module size mismatch at execution: ${relPath}`);
      if ((stat.mode & 0o777) !== want.mode) throw new Error(`closure module mode change at execution: ${relPath}`);
      if (String(stat.dev) !== String(want.dev) || String(stat.ino) !== String(want.ino)) throw new Error(`closure module inode replacement at execution: ${relPath}`);
      if (stat.uid !== want.uid || stat.gid !== want.gid) throw new Error(`closure module ownership change at execution: ${relPath}`);
      const real = fs.realpathSync(abs);
      if (real !== abs || path.relative(root, real).startsWith("..")) throw new Error(`closure module resolves outside root at execution: ${relPath}`);
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < stat.size) {
        const read = fs.readSync(fd, bytes, offset, stat.size - offset, offset);
        if (read <= 0) break;
        offset += read;
      }
      const data = bytes.subarray(0, offset);
      const hash = crypto.createHash("sha256").update(data).digest("hex");
      if (hash !== want.hash) throw new Error(`closure module hash mismatch at execution: ${relPath}`);
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
    throw new Error(`undeclared closure dependency: ${spec} from ${fromRel}`);
  }

  function requireFrom(fromRel, spec) {
    if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
      return loadModule(resolveLocal(fromRel, spec));
    }
    const builtin = spec.startsWith("node:") ? spec.slice(5) : spec;
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_BUILTINS, builtin)) throw new Error(`non-allowlisted builtin required in closure: ${spec}`);
    return ALLOWED_BUILTINS[builtin];
  }

  function loadModule(relPath) {
    if (compiledCache.has(relPath)) return compiledCache.get(relPath);
    const source = readVerified(relPath);
    const module = { exports: {} };
    compiledCache.set(relPath, module.exports);
    const absFile = path.join(root, relPath);
    const wrapper = vm.compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename: absFile });
    wrapper(module.exports, (spec) => requireFrom(relPath, spec), module, absFile, path.dirname(absFile));
    compiledCache.set(relPath, module.exports);
    return module.exports;
  }

  return loadModule(closure.entryRelPath);
}

try {
  const { closure, expectedContract, validatorId, phase, context } = workerData;
  if (!closure || !Array.isArray(closure.modules) || !closure.entryRelPath) {
    fail(`missing validator closure: ${validatorId}`);
  } else {
    const validator = loadClosureEntry(closure);
    if (
      !validator
      || validator.id !== validatorId
      || !expectedContract
      || validator.version !== expectedContract.version
      || Boolean(validator.semantic) !== Boolean(expectedContract.semantic)
      || JSON.stringify(canonicalArray(validator.actions)) !== JSON.stringify(canonicalArray(expectedContract.actions))
      || JSON.stringify(canonicalArray(validator.supportedPhases)) !== JSON.stringify(canonicalArray(expectedContract.supportedPhases))
      || typeof validator.validate !== "function"
    ) {
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
          try { serialized = JSON.stringify(normalized); } catch (error) { return fail(`validator result is not serializable (circular/deep): ${validatorId}`); }
          const serializedBytes = Buffer.byteLength(serialized, "utf8");
          if (serializedBytes > MAX_RESULT_BYTES) return fail(`validator result exceeds ${MAX_RESULT_BYTES} bytes: ${validatorId}`);
          parentPort.postMessage({ ok: true, raw: normalized });
        })
        .catch((error) => fail(`validator threw: ${(error && error.message) || String(error)}`));
    }
  }
} catch (error) {
  fail(`validator worker failure: ${(error && error.message) || String(error)}`);
}
