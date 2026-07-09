"use strict";

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const { sha256 } = require("../../kernel/lib/append-only-log");
const { canonicalStringify } = require("../../kernel/lib/canonical-json");

const ROOT_POLICY_VERSION = "1.0.0";
const BUILTIN_ALLOWLIST = new Set(["path", "crypto", "util", "assert", "buffer", "os"]);
const STRUCTURAL_FS = "fs";
const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, "..", ".."));
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";
const OVERLY_BROAD_ROOTS = new Set(["/", "/usr", "/bin", "/sbin", "/lib", "/etc", "/home", "/root", "/tmp", "/var", "/opt", "/mnt", "/proc", "/sys", "/dev"]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function resolveAuthoritativeRoot(root) {
  if (!root || typeof root !== "string") throw fail("CLOSURE_ROOT_INVALID", "Authoritative project root is required.");
  let real;
  try { real = fs.realpathSync(path.resolve(root)); } catch (error) { throw fail("CLOSURE_ROOT_INVALID", `Authoritative root does not exist: ${root}`); }
  const stat = fs.lstatSync(real);
  if (!stat.isDirectory()) throw fail("CLOSURE_ROOT_INVALID", `Authoritative root is not a directory: ${real}`);
  if (OVERLY_BROAD_ROOTS.has(real)) throw fail("CLOSURE_ROOT_TOO_BROAD", `Authoritative root is overly broad: ${real}`);
  const segments = real.split(path.sep).filter(Boolean);
  if (segments.length < 2) throw fail("CLOSURE_ROOT_TOO_BROAD", `Authoritative root is too shallow: ${real}`);
  return real;
}

function isLocalSpecifier(spec) {
  return typeof spec === "string" && (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/"));
}

function extractRequires(source, label) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true, locations: true });
  const specifiers = [];
  (function walk(node) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && node.callee.name === "require") {
      const arg = node.arguments && node.arguments[0];
      if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") throw fail("CLOSURE_DYNAMIC_REQUIRE", `${label}: dynamic or non-literal require is not permitted in validator closures.`);
      specifiers.push(arg.value);
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach((candidate) => candidate && typeof candidate.type === "string" && walk(candidate));
      else if (child && typeof child.type === "string") walk(child);
    }
  })(ast);
  return specifiers;
}

function inspectAndRead(absLexical, realRoot) {
  const relLex = path.relative(realRoot, absLexical);
  if (relLex === "" || relLex.startsWith("..") || path.isAbsolute(relLex)) throw fail("CLOSURE_ESCAPE", `Dependency escapes authoritative root: ${absLexical}`);
  let fd;
  try { fd = fs.openSync(absLexical, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (error) { if (error.code === "ELOOP") throw fail("CLOSURE_SYMLINK", `Validator closure module is a symlink: ${absLexical}`); throw error; }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw fail("CLOSURE_NONREGULAR", `Validator closure module is not a regular file: ${absLexical}`);
    if (stat.nlink > 1) throw fail("CLOSURE_HARDLINK", `Validator closure module is hard-linked (nlink=${stat.nlink}): ${absLexical}`);
    if (ENFORCE_POSIX_WRITE_BITS && (stat.mode & 0o022)) throw fail("CLOSURE_WRITABLE", `Validator closure module is group/world-writable (mode=${(stat.mode & 0o777).toString(8)}): ${absLexical}`);
    const real = fs.realpathSync(absLexical);
    if (real !== absLexical || path.relative(realRoot, real).startsWith("..")) throw fail("CLOSURE_ESCAPE", `Dependency resolves outside authoritative root via symlink: ${absLexical}`);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < stat.size) {
      const read = fs.readSync(fd, bytes, offset, stat.size - offset, offset);
      if (read <= 0) break;
      offset += read;
    }
    const data = bytes.subarray(0, offset);
    return {
      bytes: data,
      hash: sha256(data),
      meta: { size: stat.size, mode: stat.mode & 0o777, uid: stat.uid, gid: stat.gid, dev: String(stat.dev), ino: String(stat.ino), nlink: stat.nlink }
    };
  } finally {
    fs.closeSync(fd);
  }
}

function resolveLocal(fromDir, spec, realRoot) {
  if (spec.startsWith("/")) throw fail("CLOSURE_ABSOLUTE", `Absolute dependency specifier is not permitted: ${spec}`);
  const base = path.resolve(fromDir, spec);
  const candidates = base.endsWith(".js") ? [base] : [base, `${base}.js`, path.join(base, "index.js")];
  for (const candidate of candidates) {
    const rel = path.relative(realRoot, candidate);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw fail("CLOSURE_ESCAPE", `Dependency escapes authoritative root: ${spec} from ${fromDir}`);
    let exists = false;
    try { exists = fs.lstatSync(candidate) && true; } catch { exists = false; }
    if (exists) return candidate;
  }
  throw fail("CLOSURE_MISSING", `Validator closure dependency not found inside root: ${spec} from ${fromDir}`);
}

function buildValidatorClosure(entryModulePath, projectRoot = REPO_ROOT) {
  const realRoot = resolveAuthoritativeRoot(projectRoot);
  const entryAbs = path.resolve(entryModulePath);
  const collected = new Map();
  const builtins = new Set();
  let usesFs = false;

  const visit = (absPath) => {
    if (collected.has(absPath)) return;
    const { bytes, hash, meta } = inspectAndRead(absPath, realRoot);
    const source = bytes.toString("utf8");
    collected.set(absPath, { hash, source, meta });
    for (const spec of extractRequires(source, absPath)) {
      if (isLocalSpecifier(spec)) visit(resolveLocal(path.dirname(absPath), spec, realRoot));
      else {
        const builtin = spec.startsWith("node:") ? spec.slice(5) : spec;
        if (builtin === STRUCTURAL_FS) { usesFs = true; builtins.add("fs"); }
        else if (BUILTIN_ALLOWLIST.has(builtin)) builtins.add(builtin);
        else throw fail("CLOSURE_BUILTIN_DENIED", `Validator closure requires a non-allowlisted module: ${spec} (in ${absPath})`);
      }
    }
  };

  if (path.relative(realRoot, entryAbs).startsWith("..")) throw fail("CLOSURE_ESCAPE", `Validator entry module is outside authoritative root: ${entryAbs}`);
  visit(entryAbs);

  const toRel = (absPath) => path.relative(realRoot, absPath).split(path.sep).join("/");
  const modules = [...collected.keys()]
    .map((absPath) => ({ relPath: toRel(absPath), absPath, hash: collected.get(absPath).hash, source: collected.get(absPath).source, meta: collected.get(absPath).meta }))
    .sort((left, right) => left.relPath.localeCompare(right.relPath));
  const fullManifest = modules.map((moduleEntry) => ({ relPath: moduleEntry.relPath, hash: moduleEntry.hash, ...moduleEntry.meta }));
  const boundManifest = modules.map((moduleEntry) => ({ relPath: moduleEntry.relPath, hash: moduleEntry.hash, size: moduleEntry.meta.size, mode: moduleEntry.meta.mode }));
  const rootPolicy = {
    version: ROOT_POLICY_VERSION,
    enforced: ["authoritative-root", "root-relative", "no-absolute-spec", "no-parent-escape", "no-symlink", "regular-file", "nlink==1", ...(ENFORCE_POSIX_WRITE_BITS ? ["not-group-world-writable"] : []), "no-overly-broad-root"]
  };
  const closureHash = sha256(canonicalStringify({ rootPolicy, builtins: [...builtins].sort(), modules: boundManifest }));
  return {
    closureRoot: realRoot,
    rootPolicy,
    entryRelPath: toRel(entryAbs),
    modules,
    manifest: fullManifest,
    builtins: [...builtins].sort(),
    usesFs,
    closureHash
  };
}

module.exports = {
  BUILTIN_ALLOWLIST,
  REPO_ROOT,
  ROOT_POLICY_VERSION,
  buildValidatorClosure,
  inspectAndRead,
  resolveAuthoritativeRoot
};
