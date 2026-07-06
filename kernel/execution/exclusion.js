const {
  acquireExecutionLock,
  readExecutionLock,
  releaseExecutionLock,
  releaseRecoveredExecutionLock
} = require("./exclusive-boundary");

function enterMutationBoundary() {
  const error = new Error("The legacy mutation exclusion journal is disabled. Use acquireExecutionLock().");
  error.code = "LEGACY_MUTATION_BOUNDARY_DISABLED";
  throw error;
}

module.exports = {
  acquireExecutionLock,
  enterMutationBoundary,
  readExecutionLock,
  releaseExecutionLock,
  releaseRecoveredExecutionLock
};
