const {
  assert, fs, path, test,
  executeApprovedTransaction, getExecutionAttempt, readExecutionLock, readValidationArtifact,
  withExecutionRoot, write, appendApprovedTransaction,
  addValidator, addSemanticValidator, contractValidatorRegistry, executionOptions
} = require("./helpers/execution-orchestrator-fixture");

function semanticFailureValidator(id) {
  return addValidator(this, {
    id,
    phases: ["post_write"],
    source: `module.exports={id:"${id}",version:"1.0.0",validate(){return {status:"failed",problems:["semantic failure"],warnings:[],checkedObjects:["repair-reports"],checkedPaths:["docs/repair-agent-report.md"]}}};\n`
  });
}

test("post-write semantic failure rolls back and preserves durable validation evidence", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const before = "original report\n";
  fs.writeFileSync(path.join(rootDir, "docs/repair-agent-report.md"), before, "utf8");
  const validatorId = semanticFailureValidator.call(rootDir, "test-semantic-failure");
  addSemanticValidator(rootDir, "write_report", validatorId);
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, {
    id: "TX-ORCH-SEMANTIC-FAIL",
    proposedWrites: [write("docs/repair-agent-report.md", "changed report\n")]
  });
  const result = await executeApprovedTransaction(transaction.id, executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-SEMANTIC-FAIL"));
  assert.equal(result.disposition, "rolled_back");
  assert.equal(fs.readFileSync(path.join(rootDir, "docs/repair-agent-report.md"), "utf8"), before);
  const durable = getExecutionAttempt("ATTEMPT-SEMANTIC-FAIL", { ledgerPath });
  assert.equal(durable.state, "rolled_back");
  assert.match(result.validationResultHash, /^[0-9a-f]{64}$/);
  assert.equal(durable.validationResultHash, null);
  assert.equal(readValidationArtifact(rootDir, durable.id).validationResultHash, result.validationResultHash);
  assert.equal(readExecutionLock(rootDir), null);
}));

test("undeclared mutation fails exact materialization, rolls back declared writes, and requires recovery", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const declaredBefore = "declared-before\n";
  fs.writeFileSync(path.join(rootDir, "docs/repair-agent-report.md"), declaredBefore, "utf8");
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, {
    id: "TX-ORCH-UNDECLARED",
    proposedWrites: [write("docs/repair-agent-report.md", "declared-after\n")]
  });
  const options = executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-UNDECLARED");
  options.afterApply = ({ rootDir: activeRoot }) => {
    fs.writeFileSync(path.join(activeRoot, "undeclared.txt"), "undeclared\n", "utf8");
  };
  const result = await executeApprovedTransaction(transaction.id, options);
  assert.equal(result.disposition, "recovery_required");
  assert.equal(fs.readFileSync(path.join(rootDir, "docs/repair-agent-report.md"), "utf8"), declaredBefore);
  assert.equal(fs.readFileSync(path.join(rootDir, "undeclared.txt"), "utf8"), "undeclared\n");
  assert.notEqual(readExecutionLock(rootDir), null);
  assert.match(result.problems.join("\n"), /undeclared\.txt/);
}));

test("broken registry dependency fails post-write validation and rolls back", async () => withExecutionRoot(async ({ rootDir, ledgerPath, transactionLogPath }) => {
  contractValidatorRegistry(rootDir);
  const before = "original report\n";
  fs.writeFileSync(path.join(rootDir, "docs/repair-agent-report.md"), before, "utf8");
  const transaction = appendApprovedTransaction(rootDir, transactionLogPath, {
    id: "TX-ORCH-BROKEN-DEPENDENCY",
    proposedWrites: [write("docs/repair-agent-report.md", "changed report\n")]
  });
  const options = executionOptions(rootDir, ledgerPath, transactionLogPath, "ATTEMPT-BROKEN-DEPENDENCY");
  options.afterApply = ({ rootDir: activeRoot }) => {
    const registryPath = path.join(activeRoot, "kernel", "registry", "institution.json");
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    registry.objects.find((object) => object.id === "repair-reports").dependsOn.push("missing-object");
    fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  };
  const result = await executeApprovedTransaction(transaction.id, options);
  assert.equal(result.disposition, "recovery_required");
  assert.equal(fs.readFileSync(path.join(rootDir, "docs/repair-agent-report.md"), "utf8"), before);
  assert.match(result.problems.join("\n"), /missing-object/);
}));
