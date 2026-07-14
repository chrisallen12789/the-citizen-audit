const { loadAuthorityState } = require("./state");

function listAuthorityProblems(options = {}) {
  const state = options.state || loadAuthorityState(options);
  const problems = [];
  const rules = new Map((state.rules.rules || []).map((rule) => [rule.action, rule]));
  const levels = new Set((state.levels.levels || []).map((level) => level.level));
  for (const agent of state.registry.agents || []) {
    if (!levels.has(agent.authorityLevel)) problems.push(`${agent.id}: unknown authority level ${agent.authorityLevel}.`);
    if (!Array.isArray(agent.capabilities) || !agent.capabilities.length) {
      problems.push(`${agent.id}: missing canonical capabilities.`);
      continue;
    }
    for (const capability of agent.capabilities) {
      const rule = rules.get(capability);
      if (!rule) problems.push(`${agent.id}: capability ${capability} has no permission rule.`);
      else if (agent.authorityLevel < rule.minimumAuthorityLevel) problems.push(`${agent.id}: capability ${capability} requires authority level ${rule.minimumAuthorityLevel}.`);
    }
  }
  return problems;
}

module.exports = { listAuthorityProblems };
