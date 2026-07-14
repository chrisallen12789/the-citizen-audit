const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { evaluateTransactionAuthority } = require("../authority/engine");
const { getTransaction } = require("../transactions/store");
const { buildExecutionPlan, loadInstitutionRegistry } = require("./plan");
const { loadExecutionPolicy } = require("./policy");
const { loadValidatorRegistry } = require("./validator-registry");
const { runValidationPhase } = require("./validation-cycle");
const { createExecutionAttempt, defaultExecutionLedgerPath, hasCommittedTransaction } = require("./ledger");
const { recoverIncompleteExecution } = require("./recovery");
const { captureGovernedState } = require("./governed-state");
const { assertValidatorCoverage } = require("./validator-contract");
const { executionError, generateAttemptId } = require("./orchestrator-errors");
const { verifyApprovedTransaction } = require("./transaction-contract");

const repositoryRoot = path.resolve(__dirname, "..", "..");

async function prepareApprovedExecution(transactionId, options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(rootDir);
  const transactionLogPath = options.transactionLogPath;
  const recovery = recoverIncompleteExecution(rootDir, { ledgerPath });
  if (recovery.status === "recovery_required") throw executionError("Governed execution is blocked by an unresolved recovery barrier.", "EXECUTION_RECOVERY_REQUIRED", { attempts: recovery.recovered });
  const transaction = getTransaction(transactionId, { rootDir, logPath: transactionLogPath });
  const writeSetHash = verifyApprovedTransaction(transaction);
  if (hasCommittedTransaction(transaction.id, { ledgerPath })) throw executionError(`Transaction already committed: ${transaction.id}.`, "TRANSACTION_ALREADY_COMMITTED");
  const authorityDecision = evaluateTransactionAuthority(transaction, { rootDir });
  if (!authorityDecision.allowed) throw executionError(`Current authority rejected transaction ${transaction.id}: ${authorityDecision.reason}.`, "EXECUTION_AUTHORITY_DENIED", { authorityDecision });
  const policyBinding = loadExecutionPolicy({ rootDir, policyPath: options.policyPath });
  const validatorBinding = loadValidatorRegistry({ rootDir, validatorRegistryPath: options.validatorRegistryPath });
  const institutionRegistry = loadInstitutionRegistry(rootDir);
  const governedBaseline = captureGovernedState(rootDir);
  const plan = buildExecutionPlan(transaction, policyBinding.policy, institutionRegistry, {
    policyHash: policyBinding.policyHash,
    validatorSetHash: validatorBinding.validatorSetHash,
    governedStateHash: governedBaseline.stateHash
  });
  assertValidatorCoverage(plan, validatorBinding, policyBinding.policy);
  const candidate = await runValidationPhase("candidate", validatorBinding, plan.validatorIds, { rootDir, transaction, plan, governedBaseline });
  if (!candidate.passed) throw executionError(`Candidate validation failed for ${transaction.id}.`, "CANDIDATE_VALIDATION_FAILED", { problems: candidate.problems, warnings: candidate.warnings, results: candidate.results });
  const attemptId = options.attemptId || generateAttemptId();
  createExecutionAttempt({
    id: attemptId,
    transactionId: transaction.id,
    writeSetHash,
    actor: transaction.actor,
    authorityStateHash: authorityDecision.authorityStateHash,
    policyHash: policyBinding.policyHash,
    validatorSetHash: validatorBinding.validatorSetHash,
    planHash: plan.planHash,
    metadata: { authorityDecisionHash: sha256(canonicalStringify(authorityDecision)), approvalDecisionId: transaction.approval.decisionId }
  }, { ledgerPath, createdAt: options.createdAt, recordedAt: options.recordedAt });
  return { rootDir, ledgerPath, transactionLogPath, transaction, authorityDecision, policyBinding, validatorBinding, institutionRegistry, governedBaseline, plan, candidate, attemptId, options };
}

module.exports = { prepareApprovedExecution };
