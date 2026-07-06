const crypto = require("crypto");

function executionError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function generateAttemptId() {
  return `ATTEMPT-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function structuredResult(attempt, extra = {}) {
  return Object.freeze({
    attemptId: attempt.id,
    transactionId: attempt.transactionId,
    disposition: attempt.terminalDisposition,
    executionLedgerHash: attempt.ledgerHash,
    validationResultHash: attempt.validationResultHash,
    problems: [...attempt.problems],
    warnings: [...attempt.warnings],
    ...extra
  });
}

module.exports = { executionError, generateAttemptId, structuredResult };
