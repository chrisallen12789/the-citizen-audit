const fs = require("fs");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { normalizeRelativePath } = require("../transactions/validate");
const { fileState } = require("./file-state");
const { writeCanonicalJsonAtomic } = require("./durable-io");
const { assertRegularFile, blobPath, manifestPath } = require("./recovery-paths");
const { persistBlob } = require("./snapshot-blob-store");

const MANIFEST_VERSION = "1.0.0";

function ensureWriteSet(writes) {
  if (!Array.isArray(writes) || writes.length === 0) throw new Error("Recovery write set must contain at least one operation.");
  const seen = new Set();
  return writes.map((write, index) => {
    if (!write || !["write", "delete"].includes(write.operation)) throw new Error(`Recovery write ${index} has an invalid operation.`);
    const normalized = normalizeRelativePath(write.path);
    if (seen.has(normalized)) throw new Error(`Recovery write set contains duplicate path: ${normalized}.`);
    if (normalized === "kernel/execution/state" || normalized.startsWith("kernel/execution/state/")) throw new Error(`Recovery write targets execution state: ${normalized}.`);
    seen.add(normalized);
    return { ...write, path: normalized, index };
  });
}

function createPreStateManifest(rootDir, attemptId, writes, options = {}) {
  const target = manifestPath(rootDir, attemptId);
  if (fs.existsSync(target)) {
    const error = new Error(`Recovery manifest already exists: ${attemptId}.`);
    error.code = "RECOVERY_MANIFEST_EXISTS";
    throw error;
  }
  const entries = ensureWriteSet(writes).map((write) => {
    const state = fileState(rootDir, write.path);
    if (!state.existed) return { index: write.index, path: write.path, operation: write.operation, existed: false, type: null, mode: null, contentHash: null, blobHash: null };
    const contentHash = sha256(state.bytes);
    return {
      index: write.index,
      path: write.path,
      operation: write.operation,
      existed: true,
      type: "file",
      mode: state.mode,
      contentHash,
      blobHash: persistBlob(rootDir, state.bytes)
    };
  });
  const body = { version: MANIFEST_VERSION, attemptId, createdAt: options.createdAt || new Date().toISOString(), entries };
  const manifest = { ...body, manifestHash: sha256(canonicalStringify(body)) };
  writeCanonicalJsonAtomic(target, manifest);
  return Object.freeze(manifest);
}

function loadPreStateManifest(rootDir, attemptId) {
  const target = manifestPath(rootDir, attemptId);
  if (!fs.existsSync(target)) {
    const error = new Error(`Recovery manifest not found: ${attemptId}.`);
    error.code = "RECOVERY_MANIFEST_NOT_FOUND";
    throw error;
  }
  assertRegularFile(target, "Recovery manifest");
  const manifest = JSON.parse(fs.readFileSync(target, "utf8"));
  const { manifestHash, ...body } = manifest;
  if (manifest.version !== MANIFEST_VERSION || manifest.attemptId !== attemptId || !Array.isArray(manifest.entries)) {
    const error = new Error(`Recovery manifest is invalid: ${attemptId}.`);
    error.code = "INVALID_RECOVERY_MANIFEST";
    throw error;
  }
  if (sha256(canonicalStringify(body)) !== manifestHash) {
    const error = new Error(`Recovery manifest hash verification failed: ${attemptId}.`);
    error.code = "INVALID_RECOVERY_MANIFEST";
    throw error;
  }
  for (const entry of manifest.entries) {
    normalizeRelativePath(entry.path);
    if (entry.existed) {
      const stored = blobPath(rootDir, entry.blobHash);
      if (!fs.existsSync(stored)) throw new Error(`Snapshot blob missing: ${entry.blobHash}.`);
      assertRegularFile(stored, "Snapshot blob");
      const bytes = fs.readFileSync(stored);
      if (sha256(bytes) !== entry.blobHash || entry.contentHash !== entry.blobHash) throw new Error(`Snapshot blob verification failed: ${entry.path}.`);
    }
  }
  return Object.freeze(manifest);
}

module.exports = { MANIFEST_VERSION, createPreStateManifest, loadPreStateManifest };
