const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { sha256 } = require("../lib/append-only-log");
const { captureGovernedState, compareGovernedState } = require("../execution/governed-state");
const { createSandbox, removeSandbox } = require("./sandbox");
const { snapshotFiles, diffSnapshots } = require("./snapshot");
const { resolveAction, resolveAffectedObjects } = require("./action-resolution");
const { captureTransaction } = require("./transaction-capture");
const { appendRuntimeEvent } = require("./event-log");
const { writeRuntimeArtifact } = require("./artifacts");

function loadAgents(rootDir) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, "agents", "registry.json"), "utf8"));
}

function findAgent(registry, options = {}) {
  if (options.agentId) return (registry.agents || []).find((agent) => agent.id === options.agentId) || null;
  if (options.script) return (registry.agents || []).find((agent) => String(agent.command || "").includes(options.script)) || null;
  return null;
}

function invocationId() {
  return `RUN-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function commandFor(agent, options = {}) {
  const suffix = options.dryRun && !String(agent.command).includes("--dry-run") ? " --dry-run" : "";
  return `${agent.command}${suffix}`;
}

function runAgent(rootDir, agent, options = {}) {
  if (!agent) throw new Error("Runtime agent was not found.");
  if (agent.status !== "active") throw new Error(`Runtime agent is not active: ${agent.id}.`);
  const id = options.invocationId || invocationId();
  const command = commandFor(agent, options);
  const commandHash = sha256(command);
  const rootBefore = captureGovernedState(rootDir);
  appendRuntimeEvent(rootDir, { eventType: "runtime.invocation.started", invocationId: id, agentId: agent.id, commandHash }, options);
  let sandboxRoot;
  try {
    sandboxRoot = createSandbox(rootDir, id, options);
    const before = snapshotFiles(sandboxRoot);
    const result = spawnSync(command, {
      cwd: sandboxRoot,
      shell: true,
      encoding: "utf8",
      timeout: options.timeoutMs || 120000,
      env: {
        ...process.env,
        INSTITUTION_OS_AGENT_SANDBOX: "1",
        INSTITUTION_OS_ROOT: sandboxRoot,
        INSTITUTION_OS_INVOCATION_ID: id
      }
    });
    const artifact = writeRuntimeArtifact(rootDir, id, result);
    appendRuntimeEvent(rootDir, {
      eventType: "runtime.command.completed",
      invocationId: id,
      agentId: agent.id,
      commandHash,
      exitCode: result.status,
      signal: result.signal || null,
      artifactHash: artifact.artifactHash
    }, options);
    if (result.error || result.status !== 0) {
      appendRuntimeEvent(rootDir, {
        eventType: "runtime.invocation.completed",
        invocationId: id,
        agentId: agent.id,
        disposition: "agent_failed",
        transactionId: null
      }, options);
      return Object.freeze({ invocationId: id, agentId: agent.id, disposition: "agent_failed", exitCode: result.status, artifactHash: artifact.artifactHash });
    }
    const after = snapshotFiles(sandboxRoot);
    const writes = diffSnapshots(before, after, sandboxRoot);
    const rootAfterCommand = captureGovernedState(rootDir);
    const rootComparison = compareGovernedState(rootBefore, rootAfterCommand);
    if (!rootComparison.valid) throw new Error(`Agent escaped isolation: ${rootComparison.problems.join("; ")}`);
    if (options.dryRun || writes.length === 0) {
      appendRuntimeEvent(rootDir, {
        eventType: "runtime.invocation.completed",
        invocationId: id,
        agentId: agent.id,
        disposition: options.dryRun ? "dry_run" : "no_changes",
        transactionId: null
      }, options);
      return Object.freeze({ invocationId: id, agentId: agent.id, disposition: options.dryRun ? "dry_run" : "no_changes", writes, artifactHash: artifact.artifactHash });
    }
    const { action } = resolveAction(rootDir, agent, writes, options);
    const affectedObjects = resolveAffectedObjects(rootDir, writes);
    const transaction = captureTransaction(rootDir, {
      agent,
      action,
      affectedObjects,
      writes,
      invocationId: id,
      commandHash,
      stdoutHash: sha256(result.stdout || ""),
      stderrHash: sha256(result.stderr || "")
    }, options);
    appendRuntimeEvent(rootDir, {
      eventType: "transaction.proposed",
      invocationId: id,
      agentId: agent.id,
      transactionId: transaction.id,
      action,
      writeSetHash: transaction.writeSetHash
    }, options);
    appendRuntimeEvent(rootDir, {
      eventType: "runtime.invocation.completed",
      invocationId: id,
      agentId: agent.id,
      disposition: "transaction_proposed",
      transactionId: transaction.id
    }, options);
    return Object.freeze({ invocationId: id, agentId: agent.id, disposition: "transaction_proposed", transaction, artifactHash: artifact.artifactHash });
  } catch (error) {
    appendRuntimeEvent(rootDir, {
      eventType: "runtime.invocation.completed",
      invocationId: id,
      agentId: agent.id,
      disposition: "capture_failed",
      transactionId: null,
      errorCode: error.code || "RUNTIME_CAPTURE_FAILED"
    }, options);
    throw error;
  } finally {
    if (!options.keepSandbox) removeSandbox(sandboxRoot);
  }
}

module.exports = { commandFor, findAgent, invocationId, loadAgents, runAgent };
