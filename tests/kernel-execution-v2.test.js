const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { executeTransaction } = require("../kernel/execution");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "institution-os-execution-"));
  const target = "docs/agent-reports/result.md";
  fs.mkdirSync(path.join(rootDir, "docs", "agent-reports"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "kernel", "execution"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, target), "before\n", "utf8");

  const registry = {
    version: "1.0.0",
    updated: "2026-07-06",
    objects: [{ id: "SYSTEM-KERNEL", type: "system", name: "Kernel", path: "kernel/", description: "Kernel fixture." }]
  };
  const policy = {
    version: "1.0.0",
    warningPolicy: "nonfatal",
    requiredValidators: ["execution-plan"],
    prohibitedPaths: ["package.json"],
    prohibitedPrefixes: ["institution/", "kernel/execution/", "kernel/transactions/"],
    actions: {
      write_report: {
        allowedPaths: [target, "docs/agent-reports/second.md", "docs/agent-reports/new.md"],
        allowedPrefixes: [],
        allowDelete: true
      }
    }
  };
  writeJson(path.join(rootDir, "kernel", "registry", "institution.json"), registry);
  writeJson(path.join(rootDir, "kernel", "execution", "policy.json"), policy);

  return {
    rootDir,
    target,
    registry,
    policy,
    historyPath: path.join(rootDir, "execution-history.jsonl"),
    eventLogPath: path.join(rootDir, "events.jsonl"),
    boundaryPath: path.join(rootDir, "boundary.jsonl"),
    recoveryRoot: path.join(rootDir, "recovery")
  };
}

function approvedTransaction(write, overrides = {}) {
  return {
    id: overrides.id || "TX-EXEC-001",
    version: "1.0.0",
    status: overrides.status || "approved",
    action: "write_report",
    actor: { type: "agent", id: "AGENT-TEST" },
    requestedAt: "2026-07-06T12:00:00.000Z",
    approval: {
      approvedBy: { type: "human", id: "HUMAN-TEST" },
      approvedAt: "2026-07-06T12:01:00.000Z",
      decisionId: "DECISION-EXEC-001"
    },
    affectedObjects: ["SYSTEM-KERNEL"],
    proposedWrites: Array.isArray(write) ? write : [write]
  };
}

function options(f, extra = {}) {
  return {
    rootDir: f.rootDir,
    policy: f.policy,
    registry: f.registry,
    historyPath: f.historyPath,
    eventLogPath: f.eventLogPath,
    boundaryPath: f.boundaryPath,
    recoveryRoot: f.recoveryRoot,
    requireRecorded: false,
    authorityCheck: () => ({ allowed: true, reason: "test authority" }),
    ...extra
  };
}

test("replaces one approved existing file and records success", () => {
  const f = fixture();
  const transaction = approvedTransaction({ operation: "write", path: f.target, content: "after\n", encoding: "utf8" });
  const result = executeTransaction(transaction, options(f));
  assert.equal(result.status, "succeeded");
  assert.equal(fs.readFileSync(path.join(f.rootDir, f.target), "utf8"), "after\n");
  assert.equal(fs.existsSync(f.historyPath), true);
  const events = fs.readFileSync(f.eventLogPath, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);
  assert.equal(events.some((event) => event.type === "execution.succeeded"), true);
});
