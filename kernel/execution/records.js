const { appendEntry, readVerifiedLog } = require("../lib/append-only-log");

function readExecutionHistory(historyPath) {
  return readVerifiedLog(historyPath, "execution history");
}

function previousSuccessfulExecution(historyPath, transactionId) {
  return readExecutionHistory(historyPath).entries.find((entry) => entry.execution && entry.execution.transactionId === transactionId && entry.execution.status === "succeeded");
}

function appendExecutionHistory(historyPath, execution, recordedAt) {
  return appendEntry(historyPath, { recordType: "execution.disposition", execution }, { label: "execution history", recordedAt });
}

module.exports = { appendExecutionHistory, previousSuccessfulExecution, readExecutionHistory };
