const fs = require("fs");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");
const { excluded } = require("./sandbox");

function normalize(rootDir, target) {
  return path.relative(rootDir, target).split(path.sep).join("/");
}

function snapshotFiles(rootDir) {
  const entries = [];
  function walk(directory) {
    const children = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const target = path.join(directory, child.name);
      const relativePath = normalize(rootDir, target);
      if (excluded(relativePath)) continue;
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw new Error(`Sandbox contains a symbolic link: ${relativePath}.`);
      if (stat.isDirectory()) {
        walk(target);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Sandbox contains an unsupported object: ${relativePath}.`);
      entries.push({ path: relativePath, contentHash: sha256(fs.readFileSync(target)), mode: stat.mode & 0o777 });
    }
  }
  walk(rootDir);
  return Object.freeze(entries);
}

function encodeWrite(bytes) {
  const text = bytes.toString("utf8");
  if (Buffer.from(text, "utf8").equals(bytes)) return { content: text, encoding: "utf8" };
  return { content: bytes.toString("base64"), encoding: "base64" };
}

function diffSnapshots(before, after, sandboxRoot) {
  const beforeByPath = new Map(before.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(after.map((entry) => [entry.path, entry]));
  const writes = [];
  const paths = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])].sort();
  for (const relativePath of paths) {
    const previous = beforeByPath.get(relativePath);
    const current = afterByPath.get(relativePath);
    if (!current) {
      writes.push({ operation: "delete", path: relativePath });
      continue;
    }
    if (previous && previous.contentHash === current.contentHash && previous.mode === current.mode) continue;
    if (previous && previous.mode !== current.mode) throw new Error(`Agent changed file mode, which is not transactionally supported: ${relativePath}.`);
    const bytes = fs.readFileSync(path.join(sandboxRoot, ...relativePath.split("/")));
    writes.push({
      operation: "write",
      path: relativePath,
      ...encodeWrite(bytes),
      contentHash: current.contentHash
    });
  }
  return Object.freeze(writes);
}

module.exports = { diffSnapshots, encodeWrite, snapshotFiles };
