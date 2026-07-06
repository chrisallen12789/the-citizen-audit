const {
  assert, fs, path, test,
  executeApprovedTransaction,
  withExecutionRoot, appendApprovedTransaction,
  contractValidatorRegistry, executionOptions
} = require("./helpers/execution-orchestrator-fixture");

test("rejects changed authority after the execution lock is acquired", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-AUTH-CHANGE" });
  const options = executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-AUTH-CHANGE");
  options.lock = {
    onAcquired() {
      const registryPath = path.join(rootDir, "agents", "registry.json");
      const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
      registry.agents.find((agent) => agent.id === "repair-agent").status = "disabled";
      fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    }
  };
  const result = await executeApprovedTransaction(transaction.id, options);
  assert.equal(result.disposition, "rolled_back");
  assert.match(result.problems.join("\n"), /Governed state changed|Authority binding changed/);
}));

test("rejects changed policy after the execution lock is acquired", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-POLICY-CHANGE" });
  const options = executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-POLICY-CHANGE");
  options.lock = {
    onAcquired() {
      const policyPath = path.join(rootDir, "kernel", "execution", "policy.json");
      const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
      policy.principle = "Changed during lock.";
      fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
    }
  };
  const result = await executeApprovedTransaction(transaction.id, options);
  assert.equal(result.disposition, "rolled_back");
  assert.match(result.problems.join("\n"), /Governed state changed|policy changed/);
}));

test("rejects changed validator code after the execution lock is acquired", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, { id: "TX-ORCH-VALIDATOR-CHANGE" });
  const options = executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-VALIDATOR-CHANGE");
  options.lock = {
    onAcquired() {
      fs.appendFileSync(path.join(rootDir, "kernel", "execution", "validators", "execution-plan.js"), "\n// changed\n", "utf8");
    }
  };
  const result = await executeApprovedTransaction(transaction.id, options);
  assert.equal(result.disposition, "rolled_back");
  assert.match(result.problems.join("\n"), /Governed state changed|Validator registry changed/);
}));
