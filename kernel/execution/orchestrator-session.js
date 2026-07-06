const { runValidationPhase } = require("./validation-cycle");
const { writeValidationArtifact } = require("./validation-store");
const { getExecutionAttempt, transitionExecutionAttempt } = require("./ledger");
const { applyJournaledWrites, beginRecoveryAttempt, rollbackExecutionAttempt } = require("./recovery");
const { releaseExecutionLock } = require("./exclusive-boundary");
const { captureGovernedState, compareGovernedState } = require("./governed-state");
const { assertUnchangedBindings } = require("./binding-contract");
const { structuredResult } = require("./orchestrator-errors");

async function executePreparedSession(context) {
  const { rootDir, ledgerPath, transactionLogPath, transaction, authorityDecision, policyBinding, validatorBinding, institutionRegistry, governedBaseline, plan, candidate, attemptId, options } = context;
  let session;
  try {
    session = beginRecoveryAttempt(rootDir, attemptId, transaction.proposedWrites, {
      ledgerPath,
      lock: options.lock,
      createdAt: options.recoveryCreatedAt,
      transitionedAt: options.transitionedAt,
      recordedAt: options.recordedAt
    });
    assertUnchangedBindings({ rootDir, transaction, plan, governedBaseline, authorityDecision, policyBinding, validatorBinding, institutionRegistry, options: { ...options, transactionLogPath } });
    applyJournaledWrites(session, { transitionedAt: options.transitionedAt, recordedAt: options.recordedAt });
    transitionExecutionAttempt(attemptId, "validating", {}, { ledgerPath, transitionedAt: options.transitionedAt, recordedAt: options.recordedAt });
    if (typeof options.afterApply === "function") await options.afterApply({ rootDir, transaction, plan, attemptId });
    const postWrite = await runValidationPhase("post_write", validatorBinding, plan.validatorIds, { rootDir, transaction, plan, governedBaseline });
    const artifact = writeValidationArtifact(rootDir, attemptId, transaction.id, plan.planHash, candidate, postWrite);
    if (!postWrite.passed) {
      const rollback = rollbackExecutionAttempt(rootDir, attemptId, {
        ledgerPath,
        lock: session.lock,
        problems: postWrite.problems,
        warnings: postWrite.warnings,
        validationResultHash: artifact.validationResultHash,
        transitionedAt: options.transitionedAt,
        recordedAt: options.recordedAt,
        verifyRestoration: () => compareGovernedState(governedBaseline, captureGovernedState(rootDir))
      });
      return structuredResult(getExecutionAttempt(attemptId, { ledgerPath }), { rollbackResultHash: rollback.rollbackResultHash });
    }
    transitionExecutionAttempt(attemptId, "committed", {
      validationResultHash: artifact.validationResultHash,
      warnings: [...candidate.warnings, ...postWrite.warnings]
    }, { ledgerPath, transitionedAt: options.transitionedAt, recordedAt: options.recordedAt });
    const committed = getExecutionAttempt(attemptId, { ledgerPath });
    releaseExecutionLock(rootDir, session.lock);
    return structuredResult(committed);
  } catch (error) {
    if (!session) throw error;
    const current = getExecutionAttempt(attemptId, { ledgerPath });
    if (["committed", "rolled_back", "recovery_required"].includes(current.state)) return structuredResult(current);
    const rollback = rollbackExecutionAttempt(rootDir, attemptId, {
      ledgerPath,
      lock: session.lock,
      problems: [error.message],
      transitionedAt: options.transitionedAt,
      recordedAt: options.recordedAt,
      verifyRestoration: () => compareGovernedState(governedBaseline, captureGovernedState(rootDir))
    });
    return structuredResult(getExecutionAttempt(attemptId, { ledgerPath }), { rollbackResultHash: rollback.rollbackResultHash });
  }
}

module.exports = { executePreparedSession };
