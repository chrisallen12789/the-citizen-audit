function findAgent(state, agentId) { return (state.registry.agents || []).find((agent) => agent.id === agentId); }
function findRule(state, action) { return (state.rules.rules || []).find((rule) => rule.action === action); }
module.exports = { findAgent, findRule };
