const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

function authorityPaths(rootDir) {
  return {
    registryPath: path.join(rootDir, "agents", "registry.json"),
    rulesPath: path.join(rootDir, "kernel", "permissions", "rules.json"),
    levelsPath: path.join(rootDir, "kernel", "permissions", "authority-levels.json")
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Load authority state from an explicit institution root. Phase 3 re-evaluates
// current authority at execution time against the governed root, and binds a
// canonical hash of this state into the execution attempt.
function loadAuthorityStateAtRoot(rootDir) {
  const paths = authorityPaths(rootDir);
  return {
    registry: readJson(paths.registryPath),
    rules: readJson(paths.rulesPath),
    levels: readJson(paths.levelsPath)
  };
}

function loadAuthorityState() {
  return loadAuthorityStateAtRoot(root);
}

function findAgent(state, agentId) {
  return (state.registry.agents || []).find((agent) => agent.id === agentId);
}

function findRule(state, action) {
  return (state.rules.rules || []).find((rule) => rule.action === action);
}

function normalizeCapabilities(agent) {
  return new Set(agent.capabilities || []);
}

function evaluateAuthority(agent, rule, action) {
  if (!agent) {
    return {
      allowed: false,
      action,
      reason: "unknown agent"
    };
  }

  if (!rule) {
    return {
      allowed: false,
      agentId: agent.id,
      action,
      reason: "unknown permission rule"
    };
  }

  if (agent.status !== "active") {
    return {
      allowed: false,
      agentId: agent.id,
      action,
      ruleId: rule.id,
      reason: `agent status is ${agent.status}`
    };
  }

  const capabilities = normalizeCapabilities(agent);
  if (!capabilities.has(action)) {
    return {
      allowed: false,
      agentId: agent.id,
      action,
      ruleId: rule.id,
      reason: "agent does not declare capability"
    };
  }

  if (agent.authorityLevel < rule.minimumAuthorityLevel) {
    return {
      allowed: false,
      agentId: agent.id,
      action,
      ruleId: rule.id,
      reason: `agent authority level ${agent.authorityLevel} is below required level ${rule.minimumAuthorityLevel}`
    };
  }

  if (rule.requiresHumanApproval) {
    return {
      allowed: false,
      agentId: agent.id,
      action,
      ruleId: rule.id,
      reason: "action requires human approval"
    };
  }

  return {
    allowed: true,
    agentId: agent.id,
    action,
    ruleId: rule.id,
    reason: "authorized"
  };
}

function checkActionAtRoot(rootDir, agentId, action) {
  const state = loadAuthorityStateAtRoot(rootDir);
  const agent = findAgent(state, agentId);
  const rule = findRule(state, action);
  return evaluateAuthority(agent, rule, action);
}

function checkAction(agentId, action) {
  return checkActionAtRoot(root, agentId, action);
}

function listAuthorityProblems() {
  const state = loadAuthorityState();
  const problems = [];
  const rules = new Map((state.rules.rules || []).map((rule) => [rule.action, rule]));
  const levels = new Set((state.levels.levels || []).map((level) => level.level));

  for (const agent of state.registry.agents || []) {
    if (!levels.has(agent.authorityLevel)) {
      problems.push(`${agent.id}: unknown authority level ${agent.authorityLevel}.`);
    }

    if (!Array.isArray(agent.capabilities) || !agent.capabilities.length) {
      problems.push(`${agent.id}: missing canonical capabilities.`);
      continue;
    }

    for (const capability of agent.capabilities) {
      const rule = rules.get(capability);
      if (!rule) {
        problems.push(`${agent.id}: capability ${capability} has no permission rule.`);
        continue;
      }

      if (agent.authorityLevel < rule.minimumAuthorityLevel) {
        problems.push(`${agent.id}: capability ${capability} requires authority level ${rule.minimumAuthorityLevel}.`);
      }
    }
  }

  return problems;
}

module.exports = {
  checkAction,
  checkActionAtRoot,
  listAuthorityProblems,
  loadAuthorityState,
  loadAuthorityStateAtRoot
};

if (require.main === module) {
  const agentId = process.argv[2];
  const action = process.argv[3];

  if (!agentId || !action) {
    const problems = listAuthorityProblems();
    console.log("Citizen Audit Authority Engine");
    console.log("");
    console.log(`Authority problems: ${problems.length}`);
    if (problems.length) {
      console.log("");
      for (const problem of problems) console.log(`- ${problem}`);
      process.exit(1);
    }
    process.exit(0);
  }

  const result = checkAction(agentId, action);
  console.log(JSON.stringify(result, null, 2));
  if (!result.allowed) process.exit(1);
}
