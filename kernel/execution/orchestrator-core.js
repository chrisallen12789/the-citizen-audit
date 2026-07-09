const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { getTransaction } = require("../transactions/store");
const { assertValidTransaction, computeWriteSetHash } = require("../transactions/validate");
const { checkActionAtRoot, loadAuthorityStateAtRoot } = require("../authority/engine");
const { verifyApprovalDecisionForIntent } = require("../approvals/decision-store");
const {
  createExecutionAttempt,
  defaultExecutionLedgerPath,
  getExecutionAttempt,
  hasCommittedTransaction,
  transitionExecutionAttempt
} = require("./ledger");
const { buildExecutionPlan, loadInstitutionRegistry } = require("./plan");
const { createCandidateState } = require("./candidate-state");
const { institutionFile } = require("./path-safety");
const { runValidationPhase } = require("./validation-cycle");
const { writeValidationResult } = require("./validation-result-store");
const {
  applyJournaledWrites,
  assertNoRecoveryBarrier,
  beginRecoveryAttempt
} = require("./recovery-session");
const { rollbackExecutionAttempt } = require("./rollback");
const { releaseExecutionLock } = require("./exclusive-boundary");
const { resolveRegisteredAgent } = require("../runtime/agent-registry");
const { ISOLATION_ADAPTER_VERSION, reviewedSandboxHelperSourceHash } = require("../runtime/runtime-provenance");
const { PRODUCTION_VALIDATORS_DIR, selectRequiredValidators, validatorsForPhase } = require("./validators/registry-core");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const BASELINE_REQUIRED_VALIDATORS = Object.freeze([
  "execution-plan",
  "exact-materialization",
  "institution-registry",
  "dependency-graph"
]);

function hashOf(value) {
  return sha256(canonicalStringify(value));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

class ExecutionRejected extends Error {
  constructor(problems) {
    super(Array.isArray(problems) ? problems.join("; ") : String(problems));
    this.code = "EXECUTION_REJECTED";
    this.problems = Array.isArray(problems) ? problems : [String(problems)];
  }
}

function freezeResult(result) {
  return Object.freeze(JSON.parse(JSON.stringify(result)));
}

async function executeApprovedTransactionInternal(transactionId, options = {}, executionSurface) {
  const rootDir = options.rootDir || repositoryRoot;
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(rootDir);
  const policyPath = options.policyPath || path.join(rootDir, "kernel", "execution", "policy.json");
  const timeoutMs = options.timeoutMs;
  const registryLoader = executionSurface.loadValidatorRegistry;
  const allowProjectRootOverride = executionSurface.allowProjectRootOverride === true;
  const allowValidatorsDirOverride = executionSurface.allowValidatorsDirOverride === true;
  const validatorsDir = allowValidatorsDirOverride
    ? path.resolve(options.validatorsDir || PRODUCTION_VALIDATORS_DIR)
    : PRODUCTION_VALIDATORS_DIR;

  const bindings = {
    attemptId: null,
    transactionId,
    writeSetHash: null,
    authorityEvaluationHash: null,
    policyHash: null,
    validatorSetHash: null,
    preStateManifestHash: null,
    planHash: null,
    validationResults: { candidate: null, post_write: null },
    rollbackResults: null,
    ledgerHash: null,
    validationResultHash: null,
    operationalWarnings: []
  };

  try {
    if (!allowProjectRootOverride && Object.prototype.hasOwnProperty.call(options, "projectRoot")) {
      throw new ExecutionRejected(["Production orchestrator rejects caller-selected projectRoot."]);
    }
    if (!allowValidatorsDirOverride && Object.prototype.hasOwnProperty.call(options, "validatorsDir")) {
      throw new ExecutionRejected(["Production orchestrator rejects caller-selected validatorsDir."]);
    }
    if (Object.prototype.hasOwnProperty.call(options, "onStep") || Object.values(options).some((value) => typeof value === "function")) {
      throw new ExecutionRejected(["Production orchestrator rejects caller-supplied executable callbacks."]);
    }

    let transaction;
    try {
      transaction = getTransaction(transactionId, { rootDir });
    } catch (error) {
      throw new ExecutionRejected([`Transaction could not be loaded: ${error.message}`]);
    }

    assertValidTransaction(transaction);
    if (transaction.status !== "approved") throw new ExecutionRejected([`Transaction is not approved (status: ${transaction.status}).`]);
    if (!transaction.approval || typeof transaction.approval !== "object") throw new ExecutionRejected(["Approved transaction is missing approval metadata."]);
    let approvalDecision;
    try {
      approvalDecision = verifyApprovalDecisionForIntent(rootDir, transaction.approval.decisionId, transaction);
    } catch (error) {
      throw new ExecutionRejected([`Approval decision verification failed: ${error.message}`]);
    }
    if (transaction.approval.decisionRecordHash !== approvalDecision.recordHash) throw new ExecutionRejected(["Approved transaction decision-record hash mismatch."]);
    if (transaction.approval.approvedBy.type !== approvalDecision.approver.type || transaction.approval.approvedBy.id !== approvalDecision.approver.id) throw new ExecutionRejected(["Approved transaction approver identity mismatch."]);
    if (transaction.approval.approverAuthority !== approvalDecision.approverAuthority || transaction.approval.approvedAt !== approvalDecision.decidedAt) throw new ExecutionRejected(["Approved transaction approval metadata mismatch."]);

    const runtimeProvenance = transaction.metadata && transaction.metadata.provenance;
    if (transaction.actor.type === "agent") {
      const requiredProvenanceHashes = ["executableDigest", "argumentsDigest", "registryEntryHash", "sandboxHelperSourceHash", "sandboxHelperBinaryHash"];
      if (!runtimeProvenance || runtimeProvenance.registeredAgentId !== transaction.actor.id) throw new ExecutionRejected(["Agent transaction is not bound to its registered agent identity."]);
      if (typeof runtimeProvenance.executableRealPath !== "string" || !path.isAbsolute(runtimeProvenance.executableRealPath)) throw new ExecutionRejected(["Agent transaction executable real path is invalid."]);
      for (const field of requiredProvenanceHashes) if (!/^[0-9a-f]{64}$/.test(runtimeProvenance[field] || "")) throw new ExecutionRejected([`Agent transaction provenance is missing ${field}.`]);
      for (const field of ["runtimeVersion", "isolationAdapterVersion"]) if (typeof runtimeProvenance[field] !== "string" || !runtimeProvenance[field]) throw new ExecutionRejected([`Agent transaction provenance is missing ${field}.`]);
      let authoritativeAgent;
      try {
        authoritativeAgent = resolveRegisteredAgent(rootDir, transaction.actor.id, transaction.action);
      } catch (error) {
        throw new ExecutionRejected([`Registered agent identity could not be resolved: ${error.message}`]);
      }
      for (const field of ["registeredAgentId", "executableRealPath", "executableDigest", "argumentsDigest", "registryEntryHash", "runtimeVersion"]) {
        if (runtimeProvenance[field] !== authoritativeAgent.provenance[field]) {
          throw new ExecutionRejected([`Agent transaction provenance no longer matches the authoritative registry: ${field}.`]);
        }
      }
      if (runtimeProvenance.isolationAdapterVersion !== ISOLATION_ADAPTER_VERSION) throw new ExecutionRejected(["Agent transaction isolation-adapter version mismatch."]);
      if (runtimeProvenance.sandboxHelperSourceHash !== reviewedSandboxHelperSourceHash()) throw new ExecutionRejected(["Agent transaction sandbox-helper source hash mismatch."]);
    }

    const writeSetHash = computeWriteSetHash(transaction.proposedWrites);
    bindings.writeSetHash = writeSetHash;
    if (transaction.writeSetHash && transaction.writeSetHash !== writeSetHash) {
      throw new ExecutionRejected(["Approved write-set hash does not match the recorded transaction content."]);
    }
    for (const write of transaction.proposedWrites) {
      if (write.operation === "write" && write.contentHash) {
        const bytes = Buffer.from(write.content, write.encoding || "utf8");
        if (write.contentHash !== sha256(bytes)) throw new ExecutionRejected([`Declared content hash mismatch for ${write.path}.`]);
      }
    }

    if (hasCommittedTransaction(transactionId, { ledgerPath })) throw new ExecutionRejected([`Transaction already committed: ${transactionId}.`]);
    try {
      assertNoRecoveryBarrier(ledgerPath, { rootDir });
    } catch (error) {
      throw new ExecutionRejected([`Execution is blocked: ${error.message}`]);
    }

    let authorityState;
    let decision;
    try {
      authorityState = loadAuthorityStateAtRoot(rootDir);
      decision = checkActionAtRoot(rootDir, transaction.actor.id, transaction.action);
    } catch (error) {
      throw new ExecutionRejected([`Authority could not be evaluated: ${error.message}`]);
    }
    const authorityStateHash = hashOf(authorityState);
    const authorityEvaluationHash = hashOf({
      actor: { type: transaction.actor.type, id: transaction.actor.id },
      action: transaction.action,
      transactionId,
      writeSetHash,
      authorityStateHash,
      decision
    });
    bindings.authorityEvaluationHash = authorityEvaluationHash;
    if (!decision.allowed) throw new ExecutionRejected([`Current authority does not permit the action: ${decision.reason}.`]);

    let policy;
    try {
      policy = readJsonFile(policyPath);
    } catch (error) {
      throw new ExecutionRejected([`Execution policy could not be loaded: ${error.message}`]);
    }
    if (!policy || typeof policy !== "object" || !policy.actions || typeof policy.actions !== "object") {
      throw new ExecutionRejected(["Execution policy is invalid."]);
    }
    const policyHash = hashOf(policy);
    bindings.policyHash = policyHash;

    let validatorSetHash;
    let descriptors;
    try {
      const registry = allowProjectRootOverride || allowValidatorsDirOverride
        ? registryLoader({ validatorsDir, projectRoot: options.projectRoot })
        : registryLoader();
      descriptors = registry.descriptors;
      validatorSetHash = registry.validatorSetHash;
    } catch (error) {
      throw new ExecutionRejected([`Validator registry is invalid: ${error.message}`]);
    }
    bindings.validatorSetHash = validatorSetHash;

    const actionPolicy = policy.actions[transaction.action] || {};
    const semanticIds = actionPolicy.semanticValidators;
    if (!Array.isArray(semanticIds) || semanticIds.length === 0) {
      if (actionPolicy.nonSemantic !== true || typeof actionPolicy.nonSemanticJustification !== "string" || !actionPolicy.nonSemanticJustification.trim()) {
        throw new ExecutionRejected([`Action ${transaction.action} has no action-specific semantic validator.`]);
      }
    }
    const requiredIds = [
      ...BASELINE_REQUIRED_VALIDATORS,
      ...(policy.requiredValidators || []),
      ...(actionPolicy.requiredValidators || []),
      ...(semanticIds || [])
    ];
    const requiredPolicy = { ...policy, requiredValidators: [...new Set(requiredIds)] };
    let required;
    try {
      required = selectRequiredValidators(requiredPolicy, descriptors);
      for (const semanticId of semanticIds || []) {
        const descriptor = descriptors.get(semanticId);
        if (!descriptor || descriptor.semantic !== true || !Array.isArray(descriptor.actions) || !descriptor.actions.includes(transaction.action)) {
          throw new Error(`Action semantic validator is unavailable or not bound to ${transaction.action}: ${semanticId}.`);
        }
      }
    } catch (error) {
      throw new ExecutionRejected([error.message]);
    }

    let registry;
    let plan;
    try {
      registry = loadInstitutionRegistry(rootDir);
      plan = buildExecutionPlan(transaction, policy, registry);
    } catch (error) {
      throw new ExecutionRejected([error.message]);
    }
    const planHash = hashOf({
      action: plan.action,
      affectedObjects: plan.affectedObjects,
      impactedObjects: plan.impactedObjects,
      validatorIds: plan.validatorIds,
      writeSetHash: plan.writeSetHash,
      writes: plan.writes
    });
    bindings.planHash = planHash;

    for (const write of plan.writes) {
      try {
        institutionFile(rootDir, write.path);
      } catch (error) {
        throw new ExecutionRejected([`Unsafe execution path ${write.path}: ${error.message}`]);
      }
    }

    const candidateState = createCandidateState(rootDir, plan.writes);
    const candidateContext = { rootDir, transaction, plan, writeSetHash, candidateState };
    const candidatePhase = await runValidationPhase("candidate", validatorsForPhase(required, "candidate"), candidateContext, { timeoutMs });
    bindings.validationResults.candidate = candidatePhase;
    if (candidatePhase.status !== "passed") throw new ExecutionRejected(["Candidate validation failed.", ...candidatePhase.problems]);

    const attemptId = options.attemptId
      || `ATTEMPT-${sha256(canonicalStringify({ transactionId, writeSetHash, nonce: options.attemptNonce || crypto.randomUUID() })).slice(0, 40).toUpperCase()}`;
    bindings.attemptId = attemptId;

    createExecutionAttempt({
      id: attemptId,
      transactionId,
      writeSetHash,
      actor: { type: transaction.actor.type, id: transaction.actor.id },
      authorityStateHash,
      policyHash,
      validatorSetHash,
      planHash,
      metadata: { runtimeProvenance: runtimeProvenance || null, approvalDecisionHash: approvalDecision.recordHash }
    }, { ledgerPath, createdAt: options.createdAt });

    let session;
    try {
      session = beginRecoveryAttempt(rootDir, attemptId, plan.writes, { ledgerPath, createdAt: options.createdAt });
    } catch (error) {
      if (error.code === "EXECUTION_LOCKED") throw new ExecutionRejected([`Execution is already locked by ${error.owner ? error.owner.attemptId : "another attempt"}.`]);
      throw error;
    }
    bindings.preStateManifestHash = session.manifest.manifestHash;

    let committed = false;
    try {
      applyJournaledWrites(session, { ledgerPath });
      transitionExecutionAttempt(attemptId, "validating", {}, { ledgerPath });
      const postContext = { rootDir, transaction, plan, writeSetHash, attemptId, manifest: session.manifest };
      const postPhase = await runValidationPhase("post_write", validatorsForPhase(required, "post_write"), postContext, { timeoutMs });
      bindings.validationResults.post_write = postPhase;

      if (postPhase.status !== "passed") {
        throw new ExecutionRejected(["Post-write validation failed.", ...postPhase.problems]);
      }

      const validationArtifact = writeValidationResult(rootDir, attemptId, [candidatePhase, postPhase], { completedAt: options.completedAt });
      bindings.validationResultHash = validationArtifact.validationResultHash;
      transitionExecutionAttempt(attemptId, "committed", {
        validationResultHash: validationArtifact.validationResultHash,
        warnings: postPhase.warnings
      }, { ledgerPath });
      committed = true;
    } catch (mutationError) {
      if (mutationError.code === "INJECTED_CRASH") throw mutationError;
      const rollbackResult = rollbackExecutionAttempt(rootDir, attemptId, {
        ledgerPath,
        lock: session.lock,
        problems: mutationError.problems || [mutationError.message]
      });
      bindings.rollbackResults = rollbackResult;
    }

    if (committed) {
      try {
        releaseExecutionLock(rootDir, session.lock);
      } catch (releaseError) {
        bindings.operationalWarnings.push(`Committed execution lock requires startup reconciliation: ${releaseError.message}`);
      }
    }

    const durable = getExecutionAttempt(attemptId, { ledgerPath });
    bindings.ledgerHash = durable.ledgerHash;
    const disposition = durable.terminalDisposition;
    if (!disposition) {
      throw new ExecutionRejected([`Execution did not reach a terminal state (state: ${durable.state}).`]);
    }

    return freezeResult({
      ...bindings,
      disposition,
      problems: disposition === "committed" ? [] : durable.problems,
      warnings: durable.warnings
    });
  } catch (error) {
    if (error instanceof ExecutionRejected) {
      return freezeResult({ ...bindings, disposition: "rejected", problems: error.problems, warnings: [] });
    }
    throw error;
  }
}

module.exports = { BASELINE_REQUIRED_VALIDATORS, executeApprovedTransactionInternal };
