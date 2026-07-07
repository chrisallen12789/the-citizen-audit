const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");

const RUNTIME_VERSION = "2.1.0";

function readRegistry(rootDir) {
  const filePath = path.join(rootDir, "agents", "registry.json");
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Agent registry is not a regular file.");
  const registry = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!registry || !Array.isArray(registry.agents)) throw new Error("Agent registry is malformed.");
  return registry;
}
function resolveExecutable(command) {
  const candidates = command === "node" ? [process.execPath] : (path.isAbsolute(command) ? [command] : ["/usr/sbin","/usr/bin","/sbin","/bin"].map((dir) => path.join(dir, command)));
  for (const candidate of candidates) {
    try {
      const realPath = fs.realpathSync(candidate);
      const stat = fs.lstatSync(realPath);
      if (!stat.isSymbolicLink() && stat.isFile() && (stat.mode & 0o111)) return { realPath, digest: sha256(fs.readFileSync(realPath)) };
    } catch {}
  }
  throw new Error(`Registered agent executable is unavailable: ${command}.`);
}
function resolveRegisteredAgent(rootDir, agentId, action) {
  const registry = readRegistry(rootDir);
  const matches = registry.agents.filter((agent) => agent && agent.id === agentId);
  if (matches.length === 0) throw new Error(`Unknown registered agent: ${agentId}.`);
  if (matches.length !== 1) throw new Error(`Agent registry contains duplicate authoritative identities for ${agentId}.`);
  const [entry] = matches;
  if (entry.status !== "active") throw new Error(`Registered agent is not active: ${agentId}.`);
  if (!Array.isArray(entry.capabilities) || !entry.capabilities.includes(action)) throw new Error(`Registered agent ${agentId} does not declare capability ${action}.`);
  const runtime = entry.runtime;
  if (!runtime || typeof runtime.executable !== "string" || !runtime.executable || !Array.isArray(runtime.arguments) || runtime.arguments.some((arg) => typeof arg !== "string")) {
    throw new Error(`Registered agent ${agentId} has no authoritative runtime identity.`);
  }
  const executable = resolveExecutable(runtime.executable);
  const argumentsDigest = sha256(canonicalStringify(runtime.arguments));
  const registryEntryHash = sha256(canonicalStringify(entry));
  return Object.freeze({
    id: agentId,
    command: executable.realPath,
    args: Object.freeze([...runtime.arguments]),
    expectedExecutableDigest: executable.digest,
    provenance: Object.freeze({
      registeredAgentId: agentId,
      executableRealPath: executable.realPath,
      executableDigest: executable.digest,
      argumentsDigest,
      registryEntryHash,
      runtimeVersion: RUNTIME_VERSION
    })
  });
}
function verifyResolvedAgent(agent) {
  if (!agent || typeof agent.command !== "string" || !agent.expectedExecutableDigest) throw new Error("Resolved registered agent is required.");
  const realPath = fs.realpathSync(agent.command);
  const stat = fs.lstatSync(realPath);
  if (stat.isSymbolicLink() || !stat.isFile() || !(stat.mode & 0o111)) throw new Error("Registered agent executable is no longer a regular executable file.");
  const digest = sha256(fs.readFileSync(realPath));
  if (realPath !== agent.provenance.executableRealPath || digest !== agent.expectedExecutableDigest) throw new Error("Registered agent executable identity changed after resolution.");
  if (sha256(canonicalStringify(agent.args || [])) !== agent.provenance.argumentsDigest) throw new Error("Registered agent arguments no longer match the registry identity.");
  return true;
}
module.exports = { RUNTIME_VERSION, resolveRegisteredAgent, verifyResolvedAgent };
