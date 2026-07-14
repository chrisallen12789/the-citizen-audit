const {
  assert, fs, test, sha256,
  executeApprovedTransaction,
  withExecutionRoot, write, appendApprovedTransaction,
  contractValidatorRegistry, executionOptions
} = require("./helpers/execution-orchestrator-fixture");

test("rejects a non-approved transaction before creating an attempt", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-NOT-APPROVED" });
  const lines = fs.readFileSync(transactionLogPath, "utf8").trim().split(/\r?\n/);
  const entry = JSON.parse(lines[0]);
  entry.transaction.status = "proposed";
  const { hash, ...payload } = entry;
  entry.hash = sha256(`${entry.previousHash}\n${require("../kernel/lib/canonical-json").canonicalStringify(payload)}`);
  fs.writeFileSync(transactionLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  await assert.rejects(
    executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-NOT-APPROVED")),
    { code: "TRANSACTION_NOT_APPROVED" }
  );
  assert.equal(fs.existsSync(ledgerPath), false);
}));

test("rejects tampered approved content before creating an attempt", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const proposedWrites = [write("docs/repair-agent-report.md", "approved\n")];
  proposedWrites[0].content = "tampered\n";
  proposedWrites[0].contentHash = sha256(Buffer.from("approved\n", "utf8"));
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-TAMPER", proposedWrites });
  await assert.rejects(
    executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-TAMPER")),
    { code: "INVALID_TRANSACTION" }
  );
  assert.equal(fs.existsSync(ledgerPath), false);
}));

test("rejects a missing write content hash before execution", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const proposedWrites = [write("docs/repair-agent-report.md", "approved\n")];
  delete proposedWrites[0].contentHash;
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-MISSING-HASH", proposedWrites });
  await assert.rejects(
    executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-MISSING-HASH")),
    { code: "INVALID_TRANSACTION" }
  );
}));

test("rejects unauthorized actor despite a valid approval record", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, {
    id: "TX-ORCH-AUTH-DENIED",
    actor: { type: "agent", id: "hygiene-agent" }
  });
  await assert.rejects(
    executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-AUTH-DENIED")),
    { code: "EXECUTION_AUTHORITY_DENIED" }
  );
}));

test("rejects a prohibited or uncovered execution path", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, {
    id: "TX-ORCH-PROHIBITED",
    proposedWrites: [write("kernel/execution/policy.json", "{}\n")],
    affectedObjects: ["execution"]
  });
  await assert.rejects(
    executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-PROHIBITED")),
    /Prohibited execution path/
  );
}));
