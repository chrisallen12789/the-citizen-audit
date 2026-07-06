const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { getTransaction, readTransactionLog, recordTransaction } = require("../kernel/transactions/store");

function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "institution-os-records-"));
  return { rootDir, logPath: path.join(rootDir, "records.jsonl") };
}

function approvedRecord() {
  return {
    id: "TX-TEST-001",
    version: "1.0.0",
    status: "approved",
    action: "write_report",
    actor: { type: "agent", id: "AGENT-TEST" },
    requestedAt: "2026-07-06T12:00:00.000Z",
    approval: {
      approvedBy: { type: "human", id: "HUMAN-TEST" },
      approvedAt: "2026-07-06T12:01:00.000Z",
      decisionId: "DECISION-TEST-001"
    },
    affectedObjects: ["SYSTEM-KERNEL"],
    proposedWrites: [{ operation: "write", path: "docs/agent-reports/result.md", content: "result\n", encoding: "utf8" }]
  };
}

test("records and reads one governed operation", () => {
  const { rootDir, logPath } = fixture();
  const entry = recordTransaction(approvedRecord(), { rootDir, logPath });
  assert.equal(entry.transaction.id, "TX-TEST-001");
  assert.equal(readTransactionLog({ rootDir, logPath }).count, 1);
  assert.deepEqual(getTransaction("TX-TEST-001", { rootDir, logPath }), entry.transaction);
});
