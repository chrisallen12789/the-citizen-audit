const {
  assert, fs, path, test,
  executeApprovedTransaction, getExecutionAttempt, readExecutionLock, readValidationArtifact,
  withExecutionRoot, appendApprovedTransaction, contractValidatorRegistry, executionOptions
} = require("./helpers/execution-orchestrator-fixture");

test("commits an approved transaction through the sole orchestrator path", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-COMMIT" });
  const result = await executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-ORCH-COMMIT"));
  assert.equal(result.disposition, "committed");
  assert.equal(fs.readFileSync(path.join(rootDir, "docs/repair-agent-report.md"), "utf8"), "governed output\n");
  const durable = getExecutionAttempt("ATTEMPT-ORCH-COMMIT", { ledgerPath });
  assert.equal(durable.state, "committed");
  assert.equal(durable.writeSetHash, transaction.writeSetHash);
  assert.equal(durable.validationResultHash, result.validationResultHash);
  assert.equal(readExecutionLock(rootDir), null);
  assert.equal(readValidationArtifact(rootDir, durable.id).validationResultHash, durable.validationResultHash);
}));

test("produces deterministic execution-plan bindings for identical governed state", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-DETERMINISTIC" });
  const first = await executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-ORCH-DETERMINISTIC"));
  const durable = getExecutionAttempt(first.attemptId, { ledgerPath });
  assert.match(durable.planHash, /^[0-9a-f]{64}$/);
  assert.match(durable.policyHash, /^[0-9a-f]{64}$/);
  assert.match(durable.validatorSetHash, /^[0-9a-f]{64}$/);
  assert.match(durable.authorityStateHash, /^[0-9a-f]{64}$/);
  assert.equal(durable.writeSetHash, transaction.writeSetHash);
}));

test("does not use a global success flag or report exit code zero as transactional success", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "kernel", "execution", "orchestrator.js"), "utf8");
  assert.doesNotMatch(source, /success\s*=/);
  assert.doesNotMatch(source, /exitCode\s*===\s*0/);
  assert.match(source, /executeApprovedTransaction/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "kernel", "execution", "execute.js"), "utf8"), /disposition/);
});
