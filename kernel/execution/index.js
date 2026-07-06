const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkAction } = require("../authority/engine");
const { createEventWriter } = require("../events/write");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { getTransaction } = require("../transactions/store");
const { assertValidTransaction, computeWriteSetHash } = require("../transactions/validate");
const { applyDeclaredChange } = require("./apply-change");
const { assessPlan } = require("./assurance");
const { createCandidateState } = require("./candidate-state");
const { matchesDeclaredWrite } = require("./canonical-assurance");
const { enterMutationBoundary } = require("./exclusion");
const { buildExecutionPlan, loadInstitutionRegistry, readJson } = require("./plan");
const { appendExecutionHistory, previousSuccessfulExecution } = require("./records");
const { preserveRecoveryRecord } = require("./recovery-record");
const { restoreExistingFile } = require("./restore-existing");
const { snapshotWrites, verifyRestoration, verifySnapshot } = require("./snapshots");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function defaultPolicy(rootDir = repositoryRoot) {
  return readJson(path.join(rootDir, "kernel", "execution", "policy.json"));
}

function defaultHistoryPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "execution", "history.jsonl");
}

function defaultBoundaryPath(rootDir) {
  return path.join(os.tmpdir(), "institution-os-boundaries", `${sha256(path.resolve(rootDir)).slice(0, 24)}.jsonl`);
}

function nextExecutionId(now = new Date()) {
  return `EXEC-${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function normalizeRecordedTransaction(transaction) {
  return { ...transaction, writeSetHash: transaction.writeSetHash || computeWriteSetHash(transaction.proposedWrites) };
}

function resolveTransaction(transactionOrId, options) {
  if (typeof transactionOrId === "string") return getTransaction(transactionOrId, { rootDir: options.rootDir, logPath: options.transactionLogPath });
  if (!transactionOrId || typeof transactionOrId !== "object") throw new Error("Execution requires a transaction object or transaction id.");
  if (!options.requireRecorded) return transactionOrId;
  const recorded = getTransaction(transactionOrId.id, { rootDir: options.rootDir, logPath: options.transactionLogPath });
  if (canonicalStringify(recorded) !== canonicalStringify(normalizeRecordedTransaction(transactionOrId))) throw new Error(`Transaction input differs from append-only record: ${transactionOrId.id}.`);
  return recorded;
}

function createExecutionEmitter(writeEvent, context) {
  return function emit(type, summary, data = {}, severity = "info") {
    return writeEvent({
      type,
      summary,
      severity,
      actor: context.actor,
      relatedRecords: [context.executionId, context.transactionId, ...(context.affectedObjects || [])],
      data: {
        executionId: context.executionId,
        transactionId: context.transactionId,
        affectedObjects: context.affectedObjects || [],
        declaredPaths: context.declaredPaths || [],
        ...data
      }
    });
  };
}

function prepareExecution(transactionOrId, options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const transaction = normalizeRecordedTransaction(resolveTransaction(transactionOrId, { ...options, rootDir, requireRecorded: options.requireRecorded !== false }));
  assertValidTransaction(transaction);
  if (transaction.status !== "approved") {
    const error = new Error(`Transaction is not approved: ${transaction.id}.`);
    error.code = "TRANSACTION_NOT_APPROVED";
    throw error;
  }
  const historyPath = options.historyPath || defaultHistoryPath(rootDir);
  if (previousSuccessfulExecution(historyPath, transaction.id)) {
    const error = new Error(`Transaction already executed successfully: ${transaction.id}.`);
    error.code = "DUPLICATE_EXECUTION";
    throw error;
  }
  const authorityDecision = (options.authorityCheck || checkAction)(transaction.actor.id, transaction.action);
  if (!authorityDecision.allowed) {
    const error = new Error(`Authority denied at execution time: ${authorityDecision.reason}.`);
    error.code = "AUTHORITY_DENIED";
    error.authorityDecision = authorityDecision;
    throw error;
  }
  const policy = options.policy || defaultPolicy(rootDir);
  const registry = options.registry || loadInstitutionRegistry(rootDir);
  const plan = buildExecutionPlan(transaction, policy, registry);
  if (plan.writeSetHash !== transaction.writeSetHash) {
    const error = new Error("Transaction write-set hash changed before execution.");
    error.code = "WRITE_SET_MISMATCH";
    throw error;
  }
  return { rootDir, transaction, historyPath, authorityDecision, policy, registry, plan };
}

function executeTransaction(transactionOrId, options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const timestamp = options.now ? options.now() : new Date().toISOString();
  const executionId = options.executionId || nextExecutionId(new Date(timestamp));
  const rawTransaction = normalizeRecordedTransaction(resolveTransaction(transactionOrId, { ...options, rootDir, requireRecorded: options.requireRecorded !== false }));
  const context = {
    executionId,
    transactionId: rawTransaction.id,
    actor: rawTransaction.actor,
    affectedObjects: rawTransaction.affectedObjects || [],
    declaredPaths: (rawTransaction.proposedWrites || []).map((write) => write.path)
  };
  const writeEvent = options.writeEvent || createEventWriter({ rootDir, filePath: options.eventLogPath, now: options.now });
  const emit = createExecutionEmitter(writeEvent, context);
  const fault = typeof options.faultInjector === "function" ? options.faultInjector : () => {};
  let releaseBoundary = null;
  let snapshots = [];
  let plan = null;
  let mutationStarted = false;
  let finalRecord = null;

  emit("execution.started", `Execution ${executionId} started.`);

  try {
    const prepared = prepareExecution(rawTransaction, { ...options, rootDir, requireRecorded: options.requireRecorded !== false });
    plan = prepared.plan;
    emit("execution.authority.recheck.passed", "Authority re-check passed.", { authorityDecision: prepared.authorityDecision });

    const boundaryPath = options.boundaryPath || defaultBoundaryPath(rootDir);
    releaseBoundary = enterMutationBoundary(boundaryPath, { executionId, transactionId: prepared.transaction.id });
    emit("execution.mutation.control.acquired", "Exclusive mutation control acquired.", { boundaryPath });
    emit("execution.plan.created", "Execution plan created.", { writeSetHash: plan.writeSetHash, impactedObjects: plan.impactedObjects, validatorIds: plan.validatorIds });

    snapshots = snapshotWrites(rootDir, plan.writes);
    emit("execution.snapshots.created", "Canonical preimages captured.", { snapshots: snapshots.map((snapshot) => ({ path: snapshot.path, existed: snapshot.existed, hash: snapshot.hash })) });

    const candidate = createCandidateState(rootDir, plan.writes);
    emit("execution.candidate.state.created", "Read-only candidate state created.");
    const candidateResult = assessPlan(plan, "candidate");
    emit("execution.candidate.validation.started", "Candidate validation started.", { validatorIds: [candidateResult.validatorId] });
    emit("execution.validator.result", `${candidateResult.validatorId} ${candidateResult.status} during candidate validation.`, { result: candidateResult }, candidateResult.status === "passed" ? "info" : "error");
    if (candidateResult.status !== "passed") {
      const error = new Error("Candidate validation failed.");
      error.code = "CANDIDATE_VALIDATION_FAILED";
      throw error;
    }
    emit("execution.candidate.validation.passed", "Candidate validation passed.", { results: [candidateResult] });

    for (let index = 0; index < plan.writes.length; index += 1) {
      if (plan.writes[index].operation !== "write" || !snapshots[index].existed) {
        const error = new Error(`Live execution currently supports replacement of existing files only: ${plan.writes[index].path}.`);
        error.code = "UNSUPPORTED_LIVE_SCOPE";
        throw error;
      }
    }

    fault("beforePreimageVerification", { executionId, transaction: prepared.transaction, plan, snapshots });
    for (const snapshot of snapshots) {
      if (!verifySnapshot(rootDir, snapshot)) {
        const error = new Error(`Canonical preimage changed before promotion: ${snapshot.path}.`);
        error.code = "STALE_PREIMAGE";
        throw error;
      }
    }

    emit("execution.promotion.started", "Promotion of declared writes started.");
    mutationStarted = true;
    for (let index = 0; index < plan.writes.length; index += 1) {
      fault("beforePromoteWrite", { executionId, index, write: plan.writes[index] });
      applyDeclaredChange(rootDir, plan.writes[index]);
      fault("afterPromoteWrite", { executionId, index, write: plan.writes[index] });
    }

    emit("execution.canonical.validation.started", "Canonical validation started.", { validatorIds: ["execution-plan", "declared-write-bytes"] });
    const canonicalResult = assessPlan(plan, "canonical");
    const canonicalProblems = plan.writes.filter((write) => !matchesDeclaredWrite(rootDir, write)).map((write) => `Canonical content mismatch: ${write.path}.`);
    canonicalResult.problems.push(...canonicalProblems);
    canonicalResult.status = canonicalResult.problems.length ? "failed" : "passed";
    emit("execution.validator.result", `${canonicalResult.validatorId} ${canonicalResult.status} during canonical validation.`, { result: canonicalResult }, canonicalResult.status === "passed" ? "info" : "error");
    if (canonicalResult.status !== "passed") {
      const error = new Error("Canonical validation failed.");
      error.code = "CANONICAL_VALIDATION_FAILED";
      throw error;
    }
    emit("execution.canonical.validation.passed", "Canonical validation passed.", { results: [canonicalResult] });

    finalRecord = {
      executionId,
      transactionId: prepared.transaction.id,
      status: "succeeded",
      completedAt: options.now ? options.now() : new Date().toISOString(),
      action: prepared.transaction.action,
      actor: prepared.transaction.actor,
      affectedObjects: plan.affectedObjects,
      impactedObjects: plan.impactedObjects,
      declaredPaths: plan.writes.map((write) => write.path),
      writeSetHash: plan.writeSetHash,
      validatorIds: ["execution-plan", "declared-write-bytes"]
    };
    appendExecutionHistory(prepared.historyPath, finalRecord, finalRecord.completedAt);
    emit("execution.succeeded", `Execution ${executionId} succeeded.`, { disposition: finalRecord });
    return finalRecord;
  } catch (error) {
    let status = "failed";
    let rollback = null;
    if (mutationStarted && snapshots.length) {
      emit("execution.rollback.started", "Rollback started after execution failure.", { failure: { code: error.code || "EXECUTION_FAILED", message: error.message } }, "error");
      try {
        for (let index = snapshots.length - 1; index >= 0; index -= 1) {
          fault("beforeRestore", { executionId, index, snapshot: snapshots[index] });
          restoreExistingFile(rootDir, snapshots[index]);
          fault("afterRestore", { executionId, index, snapshot: snapshots[index] });
        }
        rollback = verifyRestoration(rootDir, snapshots);
        if (!rollback.valid) throw new Error(`Rollback verification failed for: ${rollback.failures.join(", ")}.`);
        emit("execution.rollback.completed", "Rollback completed and verified.", { rollback });
      } catch (rollbackError) {
        status = "recovery_required";
        const recoveryPath = preserveRecoveryRecord({
          executionId,
          transactionId: context.transactionId,
          reason: `${error.message}; rollback failure: ${rollbackError.message}`,
          snapshots,
          recoveryRoot: options.recoveryRoot
        });
        rollback = { valid: false, error: rollbackError.message, recoveryPath };
        emit("execution.rollback.failed", "Rollback failed verification.", { rollback }, "critical");
        emit("execution.recovery.required", "Manual recovery is required.", { rollback, originalFailure: error.message }, "critical");
      }
    }

    finalRecord = {
      executionId,
      transactionId: context.transactionId,
      status,
      completedAt: options.now ? options.now() : new Date().toISOString(),
      action: rawTransaction.action,
      actor: rawTransaction.actor,
      affectedObjects: plan ? plan.affectedObjects : context.affectedObjects,
      declaredPaths: plan ? plan.writes.map((write) => write.path) : context.declaredPaths,
      writeSetHash: plan ? plan.writeSetHash : rawTransaction.writeSetHash,
      failure: { code: error.code || "EXECUTION_FAILED", message: error.message },
      rollback
    };
    try {
      appendExecutionHistory(options.historyPath || defaultHistoryPath(rootDir), finalRecord, finalRecord.completedAt);
    } catch (historyError) {
      finalRecord.historyFailure = historyError.message;
      status = "recovery_required";
      finalRecord.status = status;
    }
    emit(status === "recovery_required" ? "execution.recovery.required" : "execution.failed", `Execution ${executionId} ${status}.`, { disposition: finalRecord }, status === "recovery_required" ? "critical" : "error");
    if (options.throwOnFailure) {
      error.execution = finalRecord;
      throw error;
    }
    return finalRecord;
  } finally {
    if (releaseBoundary) {
      releaseBoundary();
      emit("execution.mutation.control.released", "Exclusive mutation control released.");
    }
  }
}

module.exports = { createExecutionEmitter, defaultBoundaryPath, defaultHistoryPath, defaultPolicy, executeTransaction, nextExecutionId, prepareExecution, resolveTransaction };

if (require.main === module) {
  const transactionId = process.argv[2];
  if (!transactionId) {
    console.error("Usage: node kernel/execution/index.js <transaction-id>");
    process.exitCode = 1;
  } else {
    try {
      const result = executeTransaction(transactionId, { throwOnFailure: true });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
