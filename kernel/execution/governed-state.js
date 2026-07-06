const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const EXCLUDED_PREFIXES = Object.freeze([".git/", "node_modules/", "kernel/execution/state/"]);
const EXCLUDED_PATHS = new Set([".git", "node_modules", "kernel/execution/state"]);

function normalizeRelative(rootDir, target) {
  return path.relative(rootDir, target).split(path.sep).join("/");
}

function isExcluded(relativePath) {
  return EXCLUDED_PATHS.has(relativePath) || EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function captureGovernedState(rootDir) {
  const entries = [];
  function walk(directory) {
    const children = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const target = path.join(directory, child.name);
      const relativePath = normalizeRelative(rootDir, target);
      if (isExcluded(relativePath)) continue;
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw new Error(`Governed state contains a symbolic link: ${relativePath}.`);
      if (stat.isDirectory()) {
        walk(target);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Governed state contains an unsupported object: ${relativePath}.`);
      entries.push({ path: relativePath, contentHash: sha256(fs.readFileSync(target)), mode: stat.mode & 0o777 });
    }
  }
  walk(rootDir);
  const manifest = Object.freeze(entries);
  return Object.freeze({ entries: manifest, stateHash: sha256(canonicalStringify(entries)) });
}

function compareGovernedState(expected, actual) {
  const problems = [];
  const expectedByPath = new Map(expected.entries.map((entry) => [entry.path, entry]));
  const actualByPath = new Map(actual.entries.map((entry) => [entry.path, entry]));
  for (const [relativePath, entry] of expectedByPath) {
    const current = actualByPath.get(relativePath);
    if (!current) {
      problems.push(`${relativePath}: governed file is missing.`);
      continue;
    }
    if (current.contentHash !== entry.contentHash) problems.push(`${relativePath}: governed content changed.`);
    if (current.mode !== entry.mode) problems.push(`${relativePath}: governed mode changed.`);
  }
  for (const relativePath of actualByPath.keys()) if (!expectedByPath.has(relativePath)) problems.push(`${relativePath}: undeclared governed file was created.`);
  return { valid: problems.length === 0, problems };
}

function expectedPostWriteState(baseline, writes) {
  const byPath = new Map(baseline.entries.map((entry) => [entry.path, { ...entry }]));
  for (const write of writes) {
    if (write.operation === "delete") {
      byPath.delete(write.path);
      continue;
    }
    const previous = byPath.get(write.path);
    byPath.set(write.path, {
      path: write.path,
      contentHash: write.contentHash,
      mode: previous ? previous.mode : 0o600
    });
  }
  const entries = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  return Object.freeze({ entries: Object.freeze(entries), stateHash: sha256(canonicalStringify(entries)) });
}

module.exports = {
  EXCLUDED_PATHS,
  EXCLUDED_PREFIXES,
  captureGovernedState,
  compareGovernedState,
  expectedPostWriteState,
  isExcluded
};
