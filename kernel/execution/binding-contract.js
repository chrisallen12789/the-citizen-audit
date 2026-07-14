const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { evaluateTransactionAuthority } = require("../authority/engine");
const { getTransaction } = require("../transactions/store");
const { buildExecutionPlan, loadInstitutionRegistry } = require("./plan");
const { loadExecutionPolicy } = require("./policy");
const { loadValidatorRegistry } = require("./validator-registry");
const { captureGovernedState, compareGovernedState } = require("./governed-state");
const { executionError } = require("./orchestrator-errors");

function assertUnchangedBindings(context) {
  const { rootDir, transaction, plan, governedBaseline, authorityDecision, policyBinding, validatorBinding, institutionRegistry, options } = context;
  const authoritative = getTransaction(transaction.id, { rootDir, logPath: options.transactionLogPath });
  if (canonicalStringify(authoritative) !== canonicalStringify(transaction)) throw executionError("Authoritative transaction changed during execution preparation.", "TRANSACTION_BINDING_CHANGED");
  const currentAuthority = evaluateTransactionAuthority(authoritative, { rootDir });
  if (!currentAuthority.allowed || currentAuthority.authorityStateHash !== authorityDecision.authorityStateHash || sha256(canonicalStringify(currentAuthority)) !== sha256(canonicalStringify(authorityDecision))) throw executionError("Authority binding changed during execution preparation.", "AUTHORITY_BINDING_CHANGED");
  const currentPolicy = loadExecutionPolicy({ rootDir, policyPath: options.policyPath });
  if (currentPolicy.policyHash !== policyBinding.policyHash) throw executionError("Execution policy changed during execution preparation.", "POLICY_BINDING_CHANGED");
  const currentValidators = loadValidatorRegistry({ rootDir, validatorRegistryPath: options.validatorRegistryPath });
  if (currentValidators.validatorSetHash !== validatorBinding.validatorSetHash) throw executionError("Validator registry changed during execution preparation.", "VALIDATOR_BINDING_CHANGED");
  const currentGoverned = captureGovernedState(rootDir);
  const stateComparison = compareGovernedState(governedBaseline, currentGoverned);
  if (!stateComparison.valid) throw executionError("Governed state changed during execution preparation.", "GOVERNED_STATE_CHANGED", { problems: stateComparison.problems });
  const currentRegistry = loadInstitutionRegistry(rootDir);
  const currentPlan = buildExecutionPlan(authoritative, currentPolicy.policy, currentRegistry, {
    policyHash: currentPolicy.policyHash,
    validatorSetHash: currentValidators.validatorSetHash,
    governedStateHash: currentGoverned.stateHash
  });
  if (currentPlan.planHash !== plan.planHash || canonicalStringify(currentRegistry) !== canonicalStringify(institutionRegistry)) throw executionError("Execution plan binding changed during execution preparation.", "EXECUTION_PLAN_CHANGED");
}

module.exports = { assertUnchangedBindings };
