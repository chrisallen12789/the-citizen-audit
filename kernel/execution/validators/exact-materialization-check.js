const { sha256 } = require("../../lib/append-only-log");
const { decodeWriteContent } = require("../../transactions/validate");
const { captureGovernedState, compareGovernedState, expectedPostWriteState } = require("../governed-state");

function validateMaterialization({ rootDir, plan, state, governedBaseline }) {
  const problems = [];
  const checkedPaths = [];
  for (const write of plan.writes) {
    checkedPaths.push(write.path);
    if (write.operation !== "write") {
      if (state.exists(write.path)) problems.push(`${write.path}: non-file operation did not reach its approved state.`);
      continue;
    }
    if (!state.exists(write.path) || !state.isFile(write.path)) {
      problems.push(`${write.path}: declared file does not exist as a regular file.`);
      continue;
    }
    const expected = sha256(decodeWriteContent(write));
    const actual = sha256(state.readFile(write.path));
    if (actual !== expected || actual !== write.contentHash) problems.push(`${write.path}: live content hash does not match the approved write.`);
  }
  if (!governedBaseline || governedBaseline.stateHash !== plan.governedStateHash) {
    problems.push("Governed pre-state is missing or does not match the execution plan.");
  } else {
    const expectedState = expectedPostWriteState(governedBaseline, plan.writes);
    const liveState = captureGovernedState(rootDir);
    problems.push(...compareGovernedState(expectedState, liveState).problems);
  }
  return {
    status: problems.length ? "failed" : "passed",
    problems,
    warnings: [],
    checkedObjects: plan.affectedObjects,
    checkedPaths
  };
}

module.exports = { validateMaterialization };
