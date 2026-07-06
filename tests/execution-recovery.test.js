const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { sha256 } = require("../kernel/lib/append-only-log");
const { createExecutionAttempt, getExecutionAttempt } = require("../kernel/execution/ledger");
const { readExecutionLock } = require("../kernel/execution/exclusive-boundary");
const { createPreStateManifest, loadPreStateManifest, blobPath } = require("../kernel/execution/recovery-store");
const { applyJournaledWrites, beginRecoveryAttempt, rollbackExecutionAttempt } = require("../kernel/execution/recovery");

const hashes = {
  writeSetHash: "1".repeat(64),
  authorityStateHash: "2".repeat(64),
  policyHash: "3".repeat(64),
  validatorSetHash: "4".repeat(64),
  planHash: "5".repeat(64)
};

function withRoot(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "execution-recovery-test-"));
  const ledgerPath = path.join(rootDir, "kernel", "execution", "state", "ledger.jsonl");
  try {
    run({ rootDir, ledgerPath });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

function createAttempt(ledgerPath) {
  createExecutionAttempt({
    id: "ATTEMPT-001",
    transactionId: "TX-001",
    actor: { type: "system", id: "TEST-SYSTEM" },
    metadata: {},
    ...hashes
  }, { ledgerPath, createdAt: "2026-07-06T14:00:00.000Z" });
}

function writeOperation(relativePath, content) {
  return {
    operation: "write",
    path: relativePath,
    content,
    encoding: "utf8",
    contentHash: sha256(Buffer.from(content, "utf8"))
  };
}

test("durable manifest stores and verifies original bytes", () => withRoot(({ rootDir }) => {
  const target = path.join(rootDir, "data", "record.txt");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "original", { mode: 0o640 });
  const manifest = createPreStateManifest(rootDir, "ATTEMPT-001", [writeOperation("data/record.txt", "replacement")]);
  const loaded = loadPreStateManifest(rootDir, "ATTEMPT-001");
  assert.equal(loaded.manifestHash, manifest.manifestHash);
  assert.equal(fs.readFileSync(blobPath(rootDir, loaded.entries[0].blobHash), "utf8"), "original");
}));

test("journaled write rolls back to exact bytes and mode", () => withRoot(({ rootDir, ledgerPath }) => {
  const target = path.join(rootDir, "data", "record.txt");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "original", { mode: 0o640 });
  fs.chmodSync(target, 0o640);
  createAttempt(ledgerPath);
  const session = beginRecoveryAttempt(rootDir, "ATTEMPT-001", [writeOperation("data/record.txt", "replacement")], { ledgerPath });
  applyJournaledWrites(session);
  assert.equal(fs.readFileSync(target, "utf8"), "replacement");
  const result = rollbackExecutionAttempt(rootDir, "ATTEMPT-001", { ledgerPath, lock: session.lock });
  assert.equal(result.status, "rolled_back");
  assert.equal(fs.readFileSync(target, "utf8"), "original");
  assert.equal(fs.statSync(target).mode & 0o777, 0o640);
  assert.equal(getExecutionAttempt("ATTEMPT-001", { ledgerPath }).state, "rolled_back");
  assert.equal(readExecutionLock(rootDir), null);
}));

test("rollback removes files that did not exist before execution", () => withRoot(({ rootDir, ledgerPath }) => {
  createAttempt(ledgerPath);
  const session = beginRecoveryAttempt(rootDir, "ATTEMPT-001", [writeOperation("new/path/record.txt", "created")], { ledgerPath });
  applyJournaledWrites(session);
  assert.equal(fs.existsSync(path.join(rootDir, "new", "path", "record.txt")), true);
  const result = rollbackExecutionAttempt(rootDir, "ATTEMPT-001", { ledgerPath, lock: session.lock });
  assert.equal(result.status, "rolled_back");
  assert.equal(fs.existsSync(path.join(rootDir, "new")), false);
}));
