const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const DEFAULT_GUARDED_PREFIXES = Object.freeze([
  "agents/",
  "audits/",
  "docs/adr/",
  "docs/institution-os/",
  "institution/",
  "kernel/authority/",
  "kernel/events/",
  "kernel/execution/",
  "kernel/permissions/",
  "kernel/registry/",
  "kernel/runtime/",
  "kernel/transactions/",
  "schemas/",
  "scripts/bypass-audit.js",
  "scripts/bypass-audit-config.json",
  ".github/workflows/",
  "package.json"
]);

function posix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function modeOf(stat) {
  return stat.mode & 0o7777;
}

function entryFor(rootDir, fullPath) {
  const stat = fs.lstatSync(fullPath);
  const relativePath = posix(path.relative(rootDir, fullPath));
  if (stat.isSymbolicLink()) {
    return { path: relativePath, type: "symlink", mode: modeOf(stat), target: fs.readlinkSync(fullPath) };
  }
  if (stat.isDirectory()) return { path: relativePath, type: "directory", mode: modeOf(stat) };
  if (stat.isFile()) {
    const bytes = fs.readFileSync(fullPath);
    return { path: relativePath, type: "file", mode: modeOf(stat), size: bytes.length, sha256: sha256(bytes), bytes: bytes.toString("base64") };
  }
  throw new Error(`Unsupported governed-tree entry type: ${relativePath}.`);
}

function walkEntry(rootDir, fullPath, entries) {
  const item = entryFor(rootDir, fullPath);
  entries.push(item);
  if (item.type !== "directory") return;
  for (const name of fs.readdirSync(fullPath).sort()) walkEntry(rootDir, path.join(fullPath, name), entries);
}

function normalizePrefix(prefix) {
  if (typeof prefix !== "string" || !prefix.trim()) throw new Error("Governed-tree prefix must be a non-empty string.");
  const normalized = posix(path.normalize(prefix)).replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || path.isAbsolute(prefix)) {
    throw new Error(`Unsafe governed-tree prefix: ${prefix}.`);
  }
  return normalized;
}

function snapshotGovernedTree(rootDir, options = {}) {
  const root = fs.realpathSync(rootDir);
  const prefixes = [...new Set((options.prefixes || DEFAULT_GUARDED_PREFIXES).map(normalizePrefix))].sort();
  const entries = [];
  for (const prefix of prefixes) {
    const fullPath = path.join(root, prefix);
    if (!fs.existsSync(fullPath)) continue;
    walkEntry(root, fullPath, entries);
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const body = { version: "1.0.0", prefixes, entries };
  return Object.freeze({ ...body, manifestHash: sha256(canonicalStringify(body)) });
}

function comparable(manifest) {
  return canonicalStringify({ version: manifest.version, prefixes: manifest.prefixes, entries: manifest.entries });
}

function diffGovernedTrees(before, after) {
  const beforeMap = new Map(before.entries.map((entry) => [entry.path, entry]));
  const afterMap = new Map(after.entries.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  const changes = [];
  for (const relativePath of paths) {
    const left = beforeMap.get(relativePath);
    const right = afterMap.get(relativePath);
    if (!left) changes.push({ path: relativePath, change: "created", after: right });
    else if (!right) changes.push({ path: relativePath, change: "deleted", before: left });
    else if (canonicalStringify(left) !== canonicalStringify(right)) changes.push({ path: relativePath, change: "modified", before: left, after: right });
  }
  return changes;
}

function ensureParent(fullPath) {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true, mode: 0o700 });
}

function removePath(fullPath) {
  if (!fs.existsSync(fullPath) && !fs.lstatSync(path.dirname(fullPath)).isDirectory()) return;
  try {
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory() && !stat.isSymbolicLink()) fs.rmSync(fullPath, { recursive: true, force: true });
    else fs.unlinkSync(fullPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function restoreGovernedTree(rootDir, before) {
  const root = fs.realpathSync(rootDir);
  const problems = [];
  try {
    const current = snapshotGovernedTree(root, { prefixes: before.prefixes });
    const beforeMap = new Map(before.entries.map((entry) => [entry.path, entry]));
    const currentMap = new Map(current.entries.map((entry) => [entry.path, entry]));

    // Remove created paths and wrong-type replacements deepest-first.
    const removals = [];
    for (const [relativePath, item] of currentMap) {
      const original = beforeMap.get(relativePath);
      if (!original || original.type !== item.type) removals.push(relativePath);
    }
    removals.sort((a, b) => b.split("/").length - a.split("/").length || b.localeCompare(a));
    for (const relativePath of removals) removePath(path.join(root, relativePath));

    // Recreate directories first.
    for (const item of before.entries.filter((entry) => entry.type === "directory").sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))) {
      const fullPath = path.join(root, item.path);
      if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true, mode: item.mode });
    }

    // Restore files and symlinks exactly.
    for (const item of before.entries.filter((entry) => entry.type !== "directory")) {
      const fullPath = path.join(root, item.path);
      ensureParent(fullPath);
      if (fs.existsSync(fullPath) || (() => { try { fs.lstatSync(fullPath); return true; } catch { return false; } })()) removePath(fullPath);
      if (item.type === "file") {
        fs.writeFileSync(fullPath, Buffer.from(item.bytes, "base64"), { mode: item.mode });
        fs.chmodSync(fullPath, item.mode);
      } else if (item.type === "symlink") {
        fs.symlinkSync(item.target, fullPath);
      }
    }

    // Directory modes are applied last because child creation can alter them.
    for (const item of before.entries.filter((entry) => entry.type === "directory").sort((a, b) => b.path.split("/").length - a.path.split("/").length || b.path.localeCompare(a.path))) {
      fs.chmodSync(path.join(root, item.path), item.mode);
    }
  } catch (error) {
    problems.push(error.message);
  }

  let after;
  try {
    after = snapshotGovernedTree(root, { prefixes: before.prefixes });
  } catch (error) {
    problems.push(`Restoration verification failed: ${error.message}`);
  }
  const verified = Boolean(after) && comparable(before) === comparable(after);
  if (!verified && after) {
    for (const change of diffGovernedTrees(before, after)) problems.push(`Unrestored ${change.change} entry: ${change.path}.`);
  }
  return Object.freeze({
    restored: problems.length === 0,
    verified,
    beforeHash: before.manifestHash,
    afterHash: after ? after.manifestHash : null,
    problems: [...new Set(problems)]
  });
}

function inspectAndRestoreGovernedTree(rootDir, before) {
  const after = snapshotGovernedTree(rootDir, { prefixes: before.prefixes });
  const changes = diffGovernedTrees(before, after);
  if (changes.length === 0) return Object.freeze({ changed: false, changes: [], restoration: null });
  return Object.freeze({ changed: true, changes, restoration: restoreGovernedTree(rootDir, before) });
}

module.exports = {
  DEFAULT_GUARDED_PREFIXES,
  diffGovernedTrees,
  inspectAndRestoreGovernedTree,
  restoreGovernedTree,
  snapshotGovernedTree
};
