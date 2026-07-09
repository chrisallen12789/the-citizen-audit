// Test-only fault adapter. It instruments module imports before the production
// orchestrator is loaded. No production function accepts or executes a callback.
function loadFaultInjectedOrchestrator(onStep, executionOptions = {}) {
  if (typeof onStep !== "function") throw new Error("Test fault adapter requires a callback.");

  const durableIo = require("../../kernel/execution/durable-io");
  const recoveryStore = require("../../kernel/execution/recovery-store");
  const mutationJournal = require("../../kernel/execution/mutation-journal");
  const boundary = require("../../kernel/execution/exclusive-boundary");

  const originals = {
    atomicReplaceFile: durableIo.atomicReplaceFile,
    createPreStateManifest: recoveryStore.createPreStateManifest,
    appendMutationRecord: mutationJournal.appendMutationRecord,
    releaseExecutionLock: boundary.releaseExecutionLock
  };

  durableIo.atomicReplaceFile = (...args) => {
    const result = originals.atomicReplaceFile(...args);
    onStep("after_materialized", { target: args[0] });
    return result;
  };
  recoveryStore.createPreStateManifest = (...args) => {
    const manifest = originals.createPreStateManifest(...args);
    onStep("after_manifest", { attemptId: args[1], manifest });
    return manifest;
  };
  mutationJournal.appendMutationRecord = (...args) => {
    const result = originals.appendMutationRecord(...args);
    if (args[2] && args[2].recordType === "mutation.operation.completed") {
      onStep("after_operation_completed", { attemptId: args[1], record: args[2] });
    }
    return result;
  };

  const recoveryPath = require.resolve("../../kernel/execution/recovery-session");
  const rollbackPath = require.resolve("../../kernel/execution/rollback");
  const orchestratorPath = require.resolve("../../kernel/execution/orchestrator");
  delete require.cache[recoveryPath];
  delete require.cache[rollbackPath];
  delete require.cache[orchestratorPath];
  const instrumentedRecovery = require(recoveryPath);

  durableIo.atomicReplaceFile = originals.atomicReplaceFile;
  recoveryStore.createPreStateManifest = originals.createPreStateManifest;
  mutationJournal.appendMutationRecord = originals.appendMutationRecord;

  boundary.releaseExecutionLock = (...args) => {
    onStep("after_committed", { lock: args[1] });
    return originals.releaseExecutionLock(...args);
  };
  require.cache[recoveryPath].exports = instrumentedRecovery;
  const orchestrator = require(orchestratorPath);
  const loaded = (executionOptions && Object.prototype.hasOwnProperty.call(executionOptions, "projectRoot"))
    ? orchestrator.executeApprovedTransactionForTest
    : orchestrator.executeApprovedTransaction;
  boundary.releaseExecutionLock = originals.releaseExecutionLock;
  return loaded;
}

module.exports = { loadFaultInjectedOrchestrator };
