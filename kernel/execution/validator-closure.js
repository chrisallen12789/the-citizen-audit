"use strict";

// Deterministic validator code-closure manifest with an AUTHORITATIVE PROJECT ROOT.
//
// The registry supplies ONE authoritative project root. Every validator entry and
// every transitive local CommonJS dependency must resolve INSIDE that root after
// realpath. The closure root is NOT derived from the collected files (which would
// let `../`/absolute deps silently widen it) — it is the authoritative root, and
// anything outside it is rejected.
//
// For each source file we open with no-follow, then use the SAME file descriptor
// to inspect (fstat), read bytes, and hash them (no separate path check followed
// by an unprotected reopen). We record and verify: root-relative path, sha256,
// size, mode, uid, gid, dev, ino, nlink, and regular-file/symlink status. We
// reject: absolute specifiers, `../` escape, symlinks, non-regular files,
// dependencies outside the project, an overly broad root, hard links (nlink > 1),
// and group/world-writable files. The authoritative-root policy plus the portable
// security-relevant manifest (relPath, hash, size, mode) is bound into closureHash
// (and thereby validatorSetHash).

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const { sha256 } = require("../lib/append-only-log");
const { canonicalStringify } = require("../lib/canonical-json");

const ROOT_POLICY_VERSION = "1.0.0";
const BUILTIN_ALLOWLIST = new Set(["path", "crypto", "util", "assert", "buffer", "os"]);
const STRUCTURAL_FS = "fs";
const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, "..", ".."));
const ENFORCE_POSIX_WRITE_BITS = process.platform !== "win32";

// Roots that are too broad to be an authoritative validator source boundary.
const OVERLY_BROAD_ROOTS = new Set(["/", "/usr", "/bin", "/sbin", "/lib", "/etc", "/home", "/root", "/tmp", "/var", "/opt", "/mnt", "/proc", "/sys", "/dev"]);

function fail(code, message) { const e = new Error(message); e.code = code; return e; }

// Validate and canonicalize the authoritative root. Rejects overly broad or
// non-specific roots so a caller cannot widen acceptance by selecting `/` etc.
function resolveAuthoritativeRoot(root) {
  if (!root || typeof root !== "string") throw fail("CLOSURE_ROOT_INVALID", "Authoritative project root is required.");
  let real;
  try { real = fs.realpathSync(path.resolve(root)); } catch (e) { throw fail("CLOSURE_ROOT_INVALID", `Authoritative root does not exist: ${root}`); }
  const st = fs.lstatSync(real);
  if (!st.isDirectory()) throw fail("CLOSURE_ROOT_INVALID", `Authoritative root is not a directory: ${real}`);
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
      if (Array.isArray(child)) child.forEach((c) => c && typeof c.type === "string" && walk(c));
      else if (child && typeof child.type === "string") walk(child);
    }
  })(ast);
  return specifiers;
}

// Open with O_NOFOLLOW, then use the SAME fd to fstat, read, and hash. Enforces
// regular-file, nlink==1, not group/world-writable, and (via realpath) that the
// file is inside the authoritative root with no intermediate-symlink escape.
function inspectAndRead(absLexical, realRoot) {
  const relLex = path.relative(realRoot, absLexical);
  if (relLex === "" || relLex.startsWith("..") || path.isAbsolute(relLex)) throw fail("CLOSURE_ESCAPE", `Dependency escapes authoritative root: ${absLexical}`);
  let fd;
  try { fd = fs.openSync(absLexical, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (e) { if (e.code === "ELOOP") throw fail("CLOSURE_SYMLINK", `Validator closure module is a symlink: ${absLexical}`); throw e; }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw fail("CLOSURE_NONREGULAR", `Validator closure module is not a regular file: ${absLexical}`);
    if (st.nlink > 1) throw fail("CLOSURE_HARDLINK", `Validator closure module is hard-linked (nlink=${st.nlink}): ${absLexical}`);
    if (ENFORCE_POSIX_WRITE_BITS && (st.mode & 0o022)) throw fail("CLOSURE_WRITABLE", `Validator closure module is group/world-writable (mode=${(st.mode & 0o777).toString(8)}): ${absLexical}`);
    // Catch intermediate-symlink directory escape: realpath must stay inside root
    // and resolve to the same lexical path (no component was a symlink).
    const real = fs.realpathSync(absLexical);
    if (real !== absLexical || path.relative(realRoot, real).startsWith("..")) throw fail("CLOSURE_ESCAPE", `Dependency resolves outside authoritative root via symlink: ${absLexical}`);
    const bytes = Buffer.alloc(st.size);
    let off = 0;
    while (off < st.size) { const n = fs.readSync(fd, bytes, off, st.size - off, off); if (n <= 0) break; off += n; }
    const data = bytes.subarray(0, off);
    return {
      bytes: data, hash: sha256(data),
      meta: { size: st.size, mode: st.mode & 0o777, uid: st.uid, gid: st.gid, dev: String(st.dev), ino: String(st.ino), nlink: st.nlink }
    };
  } finally { fs.closeSync(fd); }
}

// Resolve a local specifier to a concrete file path inside the root (index.js
// resolution included), rejecting absolute specifiers and escapes up front.
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

// Build the closure for one validator entry module against an authoritative root.
function buildValidatorClosure(entryModulePath, projectRoot = REPO_ROOT) {
  const realRoot = resolveAuthoritativeRoot(projectRoot);
  const entryAbs = path.resolve(entryModulePath);
  const collected = new Map(); // absLexical -> {hash, source, meta}
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
  // entry must itself be inside the root
  if (path.relative(realRoot, entryAbs).startsWith("..")) throw fail("CLOSURE_ESCAPE", `Validator entry module is outside authoritative root: ${entryAbs}`);
  visit(entryAbs);

  const toRel = (abs) => path.relative(realRoot, abs).split(path.sep).join("/");
  const modules = [...collected.keys()]
    .map((abs) => ({ relPath: toRel(abs), absPath: abs, hash: collected.get(abs).hash, source: collected.get(abs).source, meta: collected.get(abs).meta }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  // Full recorded manifest (verified at execution): includes machine-specific
  // dev/ino/uid/gid/nlink for inode-replacement / ownership checks.
  const fullManifest = modules.map((m) => ({ relPath: m.relPath, hash: m.hash, ...m.meta }));
  // Bound manifest (portable, security-relevant): folded into closureHash.
  const boundManifest = modules.map((m) => ({ relPath: m.relPath, hash: m.hash, size: m.meta.size, mode: m.meta.mode }));
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

module.exports = { buildValidatorClosure, resolveAuthoritativeRoot, inspectAndRead, BUILTIN_ALLOWLIST, REPO_ROOT, ROOT_POLICY_VERSION };
