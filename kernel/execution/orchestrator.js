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
const { loadValidatorRegistry, selectRequiredValidators, validatorsForPhase } = require("./validators");
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

// The sole authoritative Phase 3 execution entry point.
// Loads the approved transaction from repository state (never from the caller),
// revalidates it, rebinds current authority/policy/validators, runs candidate
// validation, applies declared writes through the Phase 2 journaled mechanism,
// verifies exact live-state materialization and mandatory post-write validators,
// and commits only after a durable terminal ledger record is written. Any
// failure after mutation begins rolls back through Phase 2; unprovable rollback
// yields recovery_required and fails closed.
async function executeApprovedTransaction(transactionId, options = {}) {
  const rootDir = options.rootDir || repositoryRoot;
  const ledgerPath = options.ledgerPath || defaultExecutionLedgerPath(rootDir);
  const policyPath = options.policyPath || path.join(rootDir, "kernel", "execution", "policy.json");
  const validatorsDir = options.validatorsDir || path.join(__dirname, "validators");
  const timeoutMs = options.timeoutMs;
  if (Object.prototype.hasOwnProperty.call(options, "onStep") || Object.values(options).some((value) => typeof value === "function")) {
    throw new ExecutionRejected(["Production orchestrator rejects caller-supplied executable callbacks."]);
  }

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
    // 1. Load the recorded transaction from authoritative repository state.
    let transaction;
    try {
      transaction = getTransaction(transactionId, { rootDir });
    } catch (error) {
      throw new ExecutionRejected([`Transaction could not be loaded: ${error.message}`]);
    }

    // 2. Validate against schema. 3. Confirm approval state.
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

    // 4. Recompute content hashes and the approved write-set hash. 5. Reject altered content.
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

    // 6. Prevent duplicate committed execution and honor the recovery barrier.
    if (hasCommittedTransaction(transactionId, { ledgerPath })) throw new ExecutionRejected([`Transaction already committed: ${transactionId}.`]);
    try {
      assertNoRecoveryBarrier(ledgerPath, { rootDir });
    } catch (error) {
      throw new ExecutionRejected([`Execution is blocked: ${error.message}`]);
    }

    // 7. Re-evaluate current authority. 8. Bind actor/action/tx/write-set hash.
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

    // 9. Load and hash the current execution policy.
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

    // 10. Load and hash the current validator registry.
    let loaded;
    let validatorSetHash;
    try {
      const registry = loadValidatorRegistry({ validatorsDir });
      loaded = registry.loaded;
      validatorSetHash = registry.validatorSetHash;
    } catch (error) {
      throw new ExecutionRejected([`Validator registry is invalid: ${error.message}`]);
    }
    bindings.validatorSetHash = validatorSetHash;

    // Missing mandatory validators fail closed (policy + action-specific).
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
      required = selectRequiredValidators(requiredPolicy, loaded);
      for (const semanticId of semanticIds || []) {
        const validator = loaded.get(semanticId);
        if (!validator || validator.semantic !== true || !Array.isArray(validator.actions) || !validator.actions.includes(transaction.action)) {
          throw new Error(`Action semantic validator is unavailable or not bound to ${transaction.action}: ${semanticId}.`);
        }
      }
    } catch (error) {
      throw new ExecutionRejected([error.message]);
    }

    // 11. Build a deterministic execution plan (enforces coverage + path policy).
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

    // 12-13. Fail closed on symlink / path-escape / non-regular targets before mutation.
    for (const write of plan.writes) {
      try {
        institutionFile(rootDir, write.path);
      } catch (error) {
        throw new ExecutionRejected([`Unsafe execution path ${write.path}: ${error.message}`]);
      }
    }

    // Candidate-state validation (preflight; no mutation).
    const candidateState = createCandidateState(rootDir, plan.writes);
    const candidateContext = { rootDir, transaction, plan, writeSetHash, candidateState };
    const candidatePhase = await runValidationPhase("candidate", validatorsForPhase(required, "candidate"), candidateContext, { timeoutMs });
    bindings.validationResults.candidate = candidatePhase;
    if (candidatePhase.status !== "passed") throw new ExecutionRejected(["Candidate validation failed.", ...candidatePhase.problems]);

    // ---- Mutation phase (governed through Phase 2) ----
    const attemptId = options.attemptId
      || `ATTEMPT-${sha256(canonicalStringify({ transactionId, writeSetHash, nonce: options.attemptNonce || crypto.randomUUID() })).slice(0, 40).toUpperCase()}`;
    bindings.attemptId = attemptId;

    // 14/15 pre-work: create the immutable attempt with all bound hashes.
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

    // 14/15. Acquire the Phase 2 exclusive boundary and persist durable pre-state.
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
      // 16-18. (Candidate already run.) Apply the declared write set (journaled).
      applyJournaledWrites(session, { ledgerPath });

      // Move to validating and run exact-materialization + post-write validators.
      transitionExecutionAttempt(attemptId, "validating", {}, { ledgerPath });
      const postContext = { rootDir, transaction, plan, writeSetHash, attemptId, manifest: session.manifest };
      const postPhase = await runValidationPhase("post_write", validatorsForPhase(required, "post_write"), postContext, { timeoutMs });
      bindings.validationResults.post_write = postPhase;

      if (postPhase.status !== "passed") {
        throw new ExecutionRejected(["Post-write validation failed.", ...postPhase.problems]);
      }

      // 21. Durably record validation, then append the terminal committed state.
      const validationArtifact = writeValidationResult(rootDir, attemptId, [candidatePhase, postPhase], { completedAt: options.completedAt });
      bindings.validationResultHash = validationArtifact.validationResultHash;
      transitionExecutionAttempt(attemptId, "committed", {
        validationResultHash: validationArtifact.validationResultHash,
        warnings: postPhase.warnings
      }, { ledgerPath });
      committed = true;
    } catch (mutationError) {
      if (mutationError.code === "INJECTED_CRASH") throw mutationError; // simulate process death: leave for startup recovery
      // 22-25. Roll back through the Phase 2 recovery layer.
      const rollbackResult = rollbackExecutionAttempt(rootDir, attemptId, {
        ledgerPath,
        lock: session.lock,
        problems: mutationError.problems || [mutationError.message]
      });
      bindings.rollbackResults = rollbackResult;
    }

    // Lock release occurs after the durable committed transition. A release
    // failure must never attempt to roll back an already committed attempt.
    // Leave the lock for explicit startup reconciliation and return the durable
    // committed disposition with an operational warning.
    if (committed) {
      try {
        releaseExecutionLock(rootDir, session.lock);
      } catch (releaseError) {
        bindings.operationalWarnings.push(`Committed execution lock requires startup reconciliation: ${releaseError.message}`);
      }
    }

    // Disposition must match the durable terminal ledger record — read it back.
    const durable = getExecutionAttempt(attemptId, { ledgerPath });
    bindings.ledgerHash = durable.ledgerHash;
    const disposition = durable.terminalDisposition;
    if (!disposition) {
      // No terminal state was reached without an injected crash: fail closed.
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

module.exports = { BASELINE_REQUIRED_VALIDATORS, executeApprovedTransaction };
