const EXECUTION_STATES = Object.freeze([
  "prepared",
  "recovery_persisted",
  "applying",
  "validating",
  "committed",
  "rolling_back",
  "rolled_back",
  "recovery_required"
]);
const TERMINAL_STATES = Object.freeze(["committed", "rolled_back", "recovery_required"]);
const terminalStateSet = new Set(TERMINAL_STATES);
const ALLOWED_TRANSITIONS = Object.freeze({
  prepared: Object.freeze(["recovery_persisted"]),
  recovery_persisted: Object.freeze(["applying"]),
  applying: Object.freeze(["validating", "rolling_back"]),
  validating: Object.freeze(["committed", "rolling_back"]),
  rolling_back: Object.freeze(["rolled_back", "recovery_required"]),
  committed: Object.freeze([]),
  rolled_back: Object.freeze([]),
  recovery_required: Object.freeze([])
});

function isExecutionState(value) {
  return EXECUTION_STATES.includes(value);
}

function isTerminalExecutionState(value) {
  return terminalStateSet.has(value);
}

function canTransitionExecutionState(from, to) {
  return isExecutionState(from) && isExecutionState(to) && ALLOWED_TRANSITIONS[from].includes(to);
}

function assertExecutionStateTransition(from, to) {
  if (!isExecutionState(from)) {
    const error = new Error(`Unknown execution state: ${from}.`);
    error.code = "UNKNOWN_EXECUTION_STATE";
    throw error;
  }
  if (!isExecutionState(to)) {
    const error = new Error(`Unknown execution state: ${to}.`);
    error.code = "UNKNOWN_EXECUTION_STATE";
    throw error;
  }
  if (!canTransitionExecutionState(from, to)) {
    const error = new Error(`Invalid execution state transition: ${from} -> ${to}.`);
    error.code = "INVALID_EXECUTION_STATE_TRANSITION";
    throw error;
  }
}

function requiredTransitionHash(to) {
  if (to === "recovery_persisted") return "preStateManifestHash";
  if (to === "committed") return "validationResultHash";
  if (to === "rolled_back" || to === "recovery_required") return "rollbackResultHash";
  return null;
}

module.exports = {
  ALLOWED_TRANSITIONS,
  EXECUTION_STATES,
  TERMINAL_STATES,
  assertExecutionStateTransition,
  canTransitionExecutionState,
  isExecutionState,
  isTerminalExecutionState,
  requiredTransitionHash
};
