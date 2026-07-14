const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");
const { institutionFile } = require("../execution/path-safety");

const RUN_ID_PATTERN = /^RUN-[A-Z0-9][A-Z0-9-]{2,63}$/;

function assertRunId(runId) {
  if (!RUN_ID_PATTERN.test(runId || "")) throw new Error(`Invalid agent run id: ${runId}.`);
  return runId;
}

function workspaceRoot(rootDir) {
  const token = sha256(fs.realpathSync(rootDir)).slice(0, 16);
  return path.join(os.tmpdir(), "the-citizen-audit-runtime", token);
}

function assertOutsideLiveRoot(rootDir, candidate) {
  const live = fs.realpathSync(rootDir);
  const resolved = path.resolve(candidate);
  if (resolved === live || resolved.startsWith(`${live}${path.sep}`)) throw new Error("Runtime workspace must be outside the live institution root.");
}

function copyInput(rootDir, inputDir, relativePath) {
  const source = institutionFile(rootDir, relativePath);
  const stat = fs.lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Agent input must be a regular file: ${relativePath}.`);
  const destination = path.join(inputDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, 0o400);
}

function createWorkspace(rootDir, runId, options = {}) {
  assertRunId(runId);
  const parent = workspaceRoot(rootDir);
  assertOutsideLiveRoot(rootDir, parent);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const dir = path.join(parent, runId);
  const sandboxDir = path.join(parent, `${runId}.sandbox`);
  if (fs.existsSync(dir) || fs.existsSync(sandboxDir)) throw new Error(`Agent workspace already exists: ${runId}.`);
  const inputDir = path.join(dir, "inputs");
  const outputDir = path.join(dir, "outputs");
  const tmpDir = path.join(dir, "tmp");
  fs.mkdirSync(inputDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(sandboxDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  for (const relativePath of options.inputs || []) copyInput(rootDir, inputDir, relativePath);
  assertWorkspaceIsolation(rootDir, dir);
  return Object.freeze({ rootDir: fs.realpathSync(rootDir), runId, dir, inputDir, outputDir, tmpDir, sandboxDir });
}

function walkWorkspace(dir, base = dir) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const name of fs.readdirSync(dir).sort()) {
    const fullPath = path.join(dir, name);
    const stat = fs.lstatSync(fullPath);
    const relativePath = path.relative(base, fullPath).split(path.sep).join("/");
    if (stat.isSymbolicLink()) throw new Error(`Workspace symlinks are prohibited: ${relativePath}.`);
    if (stat.isDirectory()) entries.push(...walkWorkspace(fullPath, base));
    else if (stat.isFile()) entries.push(relativePath);
    else throw new Error(`Unsupported workspace entry type: ${relativePath}.`);
  }
  return entries;
}

function assertWorkspaceIsolation(rootDir, workspaceDir) {
  assertOutsideLiveRoot(rootDir, workspaceDir);
  walkWorkspace(workspaceDir);
  return true;
}

function captureProposedWrites(rootDir, workspace) {
  assertWorkspaceIsolation(rootDir, workspace.dir);
  const raw = [];
  const deletesManifest = path.join(workspace.outputDir, "_deletes.json");
  const declaredDeletes = new Set();
  if (fs.existsSync(deletesManifest)) {
    const stat = fs.lstatSync(deletesManifest);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("_deletes.json must be a regular file.");
    try {
      const list = JSON.parse(fs.readFileSync(deletesManifest, "utf8"));
      if (!Array.isArray(list)) throw new Error("manifest must be an array");
      for (const item of list) declaredDeletes.add(String(item));
    } catch (error) {
      throw new Error(`Invalid _deletes.json in agent workspace: ${error.message}`);
    }
  }

  for (const relativePath of walkWorkspace(workspace.outputDir, workspace.outputDir)) {
    if (relativePath === "_deletes.json") continue;
    const fullPath = path.join(workspace.outputDir, relativePath);
    const bytes = fs.readFileSync(fullPath);
    let exists = false;
    try { exists = fs.existsSync(institutionFile(rootDir, relativePath)); } catch { exists = false; }
    raw.push({ operation: exists ? "update" : "create", path: relativePath, content: bytes.toString("base64"), encoding: "base64" });
  }
  for (const relativePath of [...declaredDeletes].sort()) raw.push({ operation: "delete", path: relativePath });
  return raw;
}

function cleanupWorkspace(workspace, options = {}) {
  if (options.preserve) return Object.freeze({ removed: false, preserved: true, error: null });
  try {
    fs.rmSync(workspace.dir, { recursive: true, force: true });
    fs.rmSync(workspace.sandboxDir, { recursive: true, force: true });
    return Object.freeze({ removed: true, preserved: false, error: null });
  } catch (error) {
    return Object.freeze({ removed: false, preserved: false, error: error.message });
  }
}

module.exports = {
  RUN_ID_PATTERN,
  assertRunId,
  assertWorkspaceIsolation,
  captureProposedWrites,
  cleanupWorkspace,
  createWorkspace,
  workspaceRoot
};
