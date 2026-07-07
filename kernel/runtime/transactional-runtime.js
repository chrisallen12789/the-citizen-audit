const fs = require("fs");
const path = require("path");
const { checkActionAtRoot } = require("../authority/engine");
const { executeApprovedTransaction } = require("../execution/orchestrator");
const { pathMatches } = require("../execution/plan");
const { captureProposedWrites, cleanupWorkspace, createWorkspace } = require("./agent-workspace");
const { inspectAndRestoreGovernedTree, snapshotGovernedTree } = require("./governed-tree-guard");
const { runExternalAgentIsolated } = require("./isolation-adapter");
const { resolveRegisteredAgent } = require("./agent-registry");
const { assertNoRuntimeIsolationBarrier, recordRuntimeIsolationBarrier } = require("../execution/runtime-isolation-barrier");
const { validateProposedWrites } = require("./proposed-writes");
const { buildTransactionIntent, recordApprovedTransaction } = require("./transaction-intent");


function baseResult(runId) {
  return {
    runId,
    transactionId: null,
    isolation: { kind: null, available: null, violation: false, changes: [], restoration: null },
    agentProcess: { ran: false, status: null, signal: null, error: null },
    proposal: { status: "not_created", writeCount: 0, writeSetHash: null, problems: [] },
    approval: { status: "not_requested", decisionId: null },
    execution: { disposition: null, attemptId: null, ledgerHash: null, validationResultHash: null },
    cleanup: { removed: false, preserved: false, error: null },
    institutionalResult: "no_op",
    problems: []
  };
}

function freezeResult(result) {
  return Object.freeze(JSON.parse(JSON.stringify(result)));
}

function finish(result, workspace, options) {
  if (workspace) {
    result.cleanup = cleanupWorkspace(workspace, { preserve: options.preserveWorkspace });
    if (result.cleanup.error) result.problems.push(`Workspace cleanup failed: ${result.cleanup.error}`);
  }
  return freezeResult(result);
}

function loadPolicy(rootDir, policyPath) {
  const resolved = policyPath || path.join(rootDir, "kernel", "execution", "policy.json");
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

// Early rejection uses the same current policy data and path-matching helper as
// the authoritative execution plan. It is only a preflight filter: the Phase 3
// orchestrator still re-loads policy and remains the sole execution authority.
function precheckProposalPolicy(rootDir, action, writes, policyPath) {
  const policy = loadPolicy(rootDir, policyPath);
  const actionPolicy = policy.actions && policy.actions[action];
  const problems = [];
  if (!actionPolicy) return [`Execution policy does not authorize action: ${action}.`];
  for (const write of writes) {
    if (pathMatches(write.path, policy.prohibitedPaths || [], policy.prohibitedPrefixes || [])) {
      problems.push(`Prohibited execution path: ${write.path}.`);
    } else if (!pathMatches(write.path, actionPolicy.allowedPaths || [], actionPolicy.allowedPrefixes || [])) {
      problems.push(`Path is outside action policy: ${write.path}.`);
    } else if (write.operation === "delete" && !actionPolicy.allowDelete) {
      problems.push(`Delete is not authorized for action ${action}: ${write.path}.`);
    }
  }
  return problems;
}

function handleDrift(result, rootDir, guardBefore, runId) {
  const inspection = inspectAndRestoreGovernedTree(rootDir, guardBefore);
  if (!inspection.changed) return false;
  result.isolation.violation = true;
  result.isolation.changes = inspection.changes.map((change) => ({ path: change.path, change: change.change }));
  result.isolation.restoration = inspection.restoration;
  if (!inspection.restoration || !inspection.restoration.verified) {
    result.institutionalResult = "recovery_required";
    result.problems.push("Unauthorized live-state drift was detected and exact restoration could not be proven.");
    result.problems.push(...((inspection.restoration && inspection.restoration.problems) || []));
    try {
      recordRuntimeIsolationBarrier(rootDir, {
        runId,
        beforeHash: guardBefore.manifestHash,
        afterHash: inspection.restoration && inspection.restoration.afterHash,
        changes: result.isolation.changes,
        problems: result.problems,
        expectedManifest: guardBefore
      });
    } catch (error) {
      result.problems.push(`Could not persist runtime isolation recovery barrier: ${error.message}`);
    }
  } else {
    result.institutionalResult = "isolation_violation";
    result.problems.push("Unauthorized live-state drift was detected and exactly restored. The run remains failed closed.");
  }
  return true;
}

async function runTransactionalAgent(options = {}) {
  const { rootDir, runId, agentId, action, affectedObjects, approvalDecisionId } = options;
  const result = baseResult(runId);
  let workspace;
  const prohibitedOptionNames = ["agent", "actor", "command", "args", "approvalProvider", "onStep", "faultInjector", "policyPath", "validatorsDir", "ledgerPath", "recordedAt"];
  const allowedOptionNames = new Set(["rootDir", "runId", "agentId", "action", "affectedObjects", "approvalDecisionId", "inputs", "reason", "preserveWorkspace"]);
  try {
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === "function") { result.institutionalResult = "agent_rejected"; result.problems.push(`Production runtime rejects executable caller option: ${key}.`); return finish(result, workspace, options); }
    }
    for (const key of prohibitedOptionNames) if (Object.prototype.hasOwnProperty.call(options, key)) { result.institutionalResult = "agent_rejected"; result.problems.push(`Production runtime rejects caller-controlled option: ${key}.`); return finish(result, workspace, options); }
    for (const key of Object.keys(options)) if (!allowedOptionNames.has(key)) { result.institutionalResult = "agent_rejected"; result.problems.push(`Production runtime rejects undeclared caller option: ${key}.`); return finish(result, workspace, options); }
    if (!rootDir || !runId || !agentId || !action || !Array.isArray(affectedObjects) || affectedObjects.length === 0) throw new Error("Transactional runtime options are incomplete.");
    try { assertNoRuntimeIsolationBarrier(rootDir); }
    catch (error) { result.institutionalResult = "recovery_required"; result.problems.push(error.message); return finish(result, workspace, options); }
    let resolvedAgent;
    try {
      resolvedAgent = resolveRegisteredAgent(rootDir, agentId, action);
    } catch (error) {
      result.institutionalResult = "agent_rejected";
      result.problems.push(`Registered agent identity rejected: ${error.message}`);
      return finish(result, workspace, options);
    }
    workspace = createWorkspace(rootDir, runId, { inputs: options.inputs });

    let guardBefore;
    try { guardBefore = snapshotGovernedTree(rootDir); }
    catch (error) { result.institutionalResult = "recovery_required"; result.problems.push(`Could not establish governed-tree guard: ${error.message}`); return finish(result, workspace, options); }

    let agentRun;
    try {
      agentRun = runExternalAgentIsolated(rootDir, workspace, resolvedAgent);
      result.isolation.kind = agentRun.isolation.kind;
      result.isolation.available = agentRun.isolation.available;
      result.agentProcess = { ran: true, status: agentRun.status, signal: agentRun.signal, error: agentRun.error };
    } catch (error) {
      result.isolation.kind = error.capability ? error.capability.kind : null;
      result.isolation.available = error.capability ? error.capability.available : false;
      result.institutionalResult = error.code === "ISOLATION_UNAVAILABLE" ? "isolation_unavailable" : "agent_rejected";
      result.problems.push(error.message);
      return finish(result, workspace, options);
    }

    try { if (handleDrift(result, rootDir, guardBefore, runId)) return finish(result, workspace, options); }
    catch (error) { result.institutionalResult = "recovery_required"; result.problems.push(`Governed-tree verification failed: ${error.message}`); return finish(result, workspace, options); }

    if (agentRun.status !== 0) {
      result.institutionalResult = "agent_failed";
      result.problems.push(`Agent process failed with status ${agentRun.status}.`);
      if (agentRun.stderr) result.problems.push(agentRun.stderr.trim().slice(-2000));
      return finish(result, workspace, options);
    }

    const rawWrites = captureProposedWrites(rootDir, workspace);
    const { writes, problems } = validateProposedWrites(rootDir, rawWrites);
    result.proposal.problems = [...problems];
    if (writes.length === 0 && problems.length === 0) result.proposal.problems.push("Agent produced no valid proposed writes.");
    const policyProblems = writes.length ? precheckProposalPolicy(rootDir, action, writes) : [];
    result.proposal.problems.push(...policyProblems);
    if (result.proposal.problems.length || writes.length === 0) {
      result.proposal.status = "rejected"; result.institutionalResult = "proposal_rejected"; result.problems.push(...result.proposal.problems); return finish(result, workspace, options);
    }

    const actor = { type: "agent", id: agentId };
    const intent = buildTransactionIntent({
      rootDir, actor, action, agentRunId: runId, proposedWrites: writes, affectedObjects,
      reason: options.reason,
      provenance: { runId, ...agentRun.provenance }
    });
    result.transactionId = intent.transaction.id;
    result.proposal.status = "created";
    result.proposal.writeCount = writes.length;
    result.proposal.writeSetHash = intent.writeSetHash;

    const authority = checkActionAtRoot(rootDir, agentId, action);
    if (!authority.allowed) { result.approval.status = "denied"; result.institutionalResult = "not_authorized"; result.problems.push(authority.reason); return finish(result, workspace, options); }
    result.approval.status = "requested";
    if (typeof approvalDecisionId !== "string" || !approvalDecisionId) {
      result.approval.status = "denied"; result.institutionalResult = "not_approved"; result.problems.push("Authoritative approval decision id is required."); return finish(result, workspace, options);
    }
    try {
      recordApprovedTransaction(rootDir, intent, approvalDecisionId);
    } catch (error) {
      result.approval.status = "denied"; result.institutionalResult = "not_approved"; result.problems.push(error.message); return finish(result, workspace, options);
    }
    result.approval.status = "approved";
    result.approval.decisionId = approvalDecisionId;

    const execution = await executeApprovedTransaction(intent.transaction.id, { rootDir });
    result.execution = { disposition: execution.disposition, attemptId: execution.attemptId, ledgerHash: execution.ledgerHash, validationResultHash: execution.validationResultHash };
    result.institutionalResult = execution.disposition;
    if (execution.disposition !== "committed") result.problems.push(...(execution.problems || []));
    return finish(result, workspace, options);
  } catch (error) {
    result.institutionalResult = "error";
    result.problems.push(error.message);
    return finish(result, workspace, options);
  }
}
module.exports = { precheckProposalPolicy, runTransactionalAgent };
