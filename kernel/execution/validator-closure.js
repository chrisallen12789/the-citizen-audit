"use strict";

// Deterministic validator code-closure manifest.
//
// Statically resolves a validator's complete LOCAL CommonJS dependency closure
// (entry module + every transitive local dependency), captures each module's
// canonical relative path, bytes, and SHA-256, and produces a closureHash that is
// folded into validatorSetHash. Only the bytes in this closure are executed
// (see validator-runner): there is no path-based require() fallback, so the code
// actually run provably matches the bound hash.
//
// Rejects: dynamic (non-literal) require, path escape outside the repo root,
// symlinked/non-regular modules, and undeclared/built-in modules outside an
// explicit allowlist.

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const { sha256 } = require("../lib/append-only-log");
const { canonicalStringify } = require("../lib/canonical-json");

// Built-ins a validator (or its local deps) may require. Deliberately excludes
// child_process, worker_threads, net/http/https/dns, cluster, vm, module, etc.
const BUILTIN_ALLOWLIST = new Set(["path", "crypto", "util", "assert", "buffer", "os"]);
// fs is allowed ONLY for structural validators that must read live post-write
// state; semantic validators must not receive it (enforced by the runner via
// the allowlist passed per closure). We include it here as resolvable but tag
// closures that use it.
const STRUCTURAL_FS = "fs";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function isLocalSpecifier(spec) {
  return typeof spec === "string" && (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/"));
}

// Extract require("literal") specifiers; flag dynamic requires.
function extractRequires(source, label) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true, locations: true });
  const specifiers = [];
  (function walk(node) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "CallExpression" && node.callee && node.callee.type === "Identifier" && node.callee.name === "require") {
      const arg = node.arguments && node.arguments[0];
      if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") {
        const err = new Error(`${label}: dynamic or non-literal require is not permitted in validator closures.`);
        err.code = "CLOSURE_DYNAMIC_REQUIRE";
        throw err;
      }
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

function resolveLocal(fromDir, spec) {
  let base = path.resolve(fromDir, spec);
  const candidates = base.endsWith(".js") ? [base] : [base, `${base}.js`, path.join(base, "index.js")];
  for (const candidate of candidates) {
    const lst = (() => { try { return fs.lstatSync(candidate); } catch { return null; } })();
    if (!lst) continue;
    if (lst.isSymbolicLink()) { const e = new Error(`Validator closure module is a symlink: ${candidate}`); e.code = "CLOSURE_SYMLINK"; throw e; }
    if (!lst.isFile()) { const e = new Error(`Validator closure module is not a regular file: ${candidate}`); e.code = "CLOSURE_NONREGULAR"; throw e; }
    return candidate;
  }
  const e = new Error(`Validator closure dependency not found: ${spec} from ${fromDir}`);
  e.code = "CLOSURE_MISSING";
  throw e;
}

function commonAncestorDir(absPaths) {
  if (absPaths.length === 1) return path.dirname(absPaths[0]);
  const split = absPaths.map((p) => path.dirname(p).split(path.sep));
  const first = split[0];
  let i = 0;
  for (; i < first.length; i++) {
    if (!split.every((parts) => parts[i] === first[i])) break;
  }
  return first.slice(0, i).join(path.sep) || path.sep;
}

// Build the closure for one validator entry module. Returns
// { closureRoot, entryRelPath, modules:[{relPath,absPath,hash,source}], manifest, builtins, usesFs, closureHash }.
// relPaths are relative to closureRoot (the common ancestor of all closure
// modules), so the closureHash is independent of checkout location.
function buildValidatorClosure(entryModulePath) {
  const entryAbs = path.resolve(entryModulePath);
  const collected = new Map(); // absPath -> {hash, source}
  const builtins = new Set();
  let usesFs = false;

  const visit = (absPath) => {
    if (collected.has(absPath)) return;
    const lst = fs.lstatSync(absPath);
    if (lst.isSymbolicLink()) { const e = new Error(`Validator closure module is a symlink: ${absPath}`); e.code = "CLOSURE_SYMLINK"; throw e; }
    if (!lst.isFile()) { const e = new Error(`Validator closure module is not a regular file: ${absPath}`); e.code = "CLOSURE_NONREGULAR"; throw e; }
    const bytes = fs.readFileSync(absPath);
    const source = bytes.toString("utf8");
    collected.set(absPath, { hash: sha256(bytes), source });
    for (const spec of extractRequires(source, absPath)) {
      if (isLocalSpecifier(spec)) visit(resolveLocal(path.dirname(absPath), spec));
      else {
        const builtin = spec.startsWith("node:") ? spec.slice(5) : spec;
        if (builtin === STRUCTURAL_FS) { usesFs = true; builtins.add("fs"); }
        else if (BUILTIN_ALLOWLIST.has(builtin)) builtins.add(builtin);
        else { const e = new Error(`Validator closure requires a non-allowlisted module: ${spec} (in ${absPath})`); e.code = "CLOSURE_BUILTIN_DENIED"; throw e; }
      }
    }
  };
  visit(entryAbs);

  const absPaths = [...collected.keys()];
  const closureRoot = commonAncestorDir(absPaths);
  const toRel = (abs) => path.relative(closureRoot, abs).split(path.sep).join("/");
  const modules = absPaths
    .map((abs) => ({ relPath: toRel(abs), absPath: abs, hash: collected.get(abs).hash, source: collected.get(abs).source }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  const manifest = modules.map((m) => ({ relPath: m.relPath, hash: m.hash }));
  const closureHash = sha256(canonicalStringify({ builtins: [...builtins].sort(), modules: manifest }));
  return {
    closureRoot,
    entryRelPath: toRel(entryAbs),
    modules,
    manifest,
    builtins: [...builtins].sort(),
    usesFs,
    closureHash
  };
}

module.exports = { buildValidatorClosure, BUILTIN_ALLOWLIST, REPO_ROOT };
