const { loadInstitutionRegistry, objectForPath, pathMatches } = require("../execution/plan");
const { loadExecutionPolicy } = require("../execution/policy");

function actionAcceptsWrites(actionPolicy, policy, writes) {
  return writes.every((write) => {
    if (pathMatches(write.path, policy.prohibitedPaths || [], policy.prohibitedPrefixes || [])) return false;
    if (!pathMatches(write.path, actionPolicy.allowedPaths || [], actionPolicy.allowedPrefixes || [])) return false;
    if (write.operation !== "write" && !actionPolicy.allowDelete) return false;
    return true;
  });
}

function resolveAction(rootDir, agent, writes, options = {}) {
  const binding = loadExecutionPolicy({ rootDir, policyPath: options.policyPath });
  const requested = options.action;
  const capabilities = [...new Set(agent.capabilities || [])].filter((action) => binding.policy.actions[action]);
  if (requested) {
    if (!capabilities.includes(requested)) throw new Error(`Agent ${agent.id} does not declare action ${requested}.`);
    if (!actionAcceptsWrites(binding.policy.actions[requested], binding.policy, writes)) throw new Error(`Captured writes do not satisfy action policy ${requested}.`);
    return { action: requested, policyBinding: binding };
  }
  const matches = capabilities.filter((action) => actionAcceptsWrites(binding.policy.actions[action], binding.policy, writes));
  if (matches.length !== 1) throw new Error(`Captured writes resolve to ${matches.length} authorized actions for ${agent.id}; specify one action explicitly.`);
  return { action: matches[0], policyBinding: binding };
}

function resolveAffectedObjects(rootDir, writes) {
  const registry = loadInstitutionRegistry(rootDir);
  const affected = new Set();
  for (const write of writes) {
    const object = objectForPath(registry, write.path);
    if (!object) throw new Error(`Captured path is not registered as an institutional object: ${write.path}.`);
    affected.add(object.id);
  }
  return [...affected].sort();
}

module.exports = { actionAcceptsWrites, resolveAction, resolveAffectedObjects };
