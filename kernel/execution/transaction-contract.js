const { sha256 } = require("../lib/append-only-log");
const { assertValidTransaction, computeWriteSetHash, decodeWriteContent } = require("../transactions/validate");
const { executionError } = require("./orchestrator-errors");

function verifyApprovedTransaction(transaction) {
  const validation = assertValidTransaction(transaction);
  if (transaction.status !== "approved") throw executionError(`Transaction is not approved: ${transaction.id}.`, "TRANSACTION_NOT_APPROVED");
  for (const [index, write] of transaction.proposedWrites.entries()) {
    if (write.operation !== "write") continue;
    if (typeof write.contentHash !== "string" || !/^[0-9a-f]{64}$/.test(write.contentHash)) throw executionError(`Approved write is missing a canonical content hash at index ${index}.`, "MISSING_WRITE_CONTENT_HASH");
    if (sha256(decodeWriteContent(write)) !== write.contentHash) throw executionError(`Approved write content hash mismatch at index ${index}.`, "WRITE_CONTENT_HASH_MISMATCH");
  }
  const computed = computeWriteSetHash(transaction.proposedWrites);
  if (transaction.writeSetHash !== computed || validation.writeSetHash !== computed) throw executionError(`Transaction write-set hash mismatch: ${transaction.id}.`, "WRITE_SET_HASH_MISMATCH");
  return computed;
}

module.exports = { verifyApprovedTransaction };
