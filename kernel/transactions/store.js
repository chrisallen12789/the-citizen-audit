const fs = require("fs");
const path = require("path");
const { appendEntry, readVerifiedLog } = require("../lib/append-only-log");
const { canonicalStringify } = require("../lib/canonical-json");
const { assertValidTransaction, computeWriteSetHash } = require("./validate");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function defaultLogPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "transactions", "log.jsonl");
}

function readTransactionLog(options = {}) {
  const logPath = options.logPath || defaultLogPath(options.rootDir);
  const result = readVerifiedLog(logPath, "transaction log");
  const seen = new Set();
  for (const entry of result.entries) {
    if (!entry.transaction || typeof entry.transaction !== "object") throw new Error(`transaction log: missing transaction at sequence ${entry.sequence}.`);
    assertValidTransaction(entry.transaction);
    if (seen.has(entry.transaction.id)) throw new Error(`transaction log: duplicate transaction id ${entry.transaction.id}.`);
    seen.add(entry.transaction.id);
  }
  return { ...result, logPath };
}

function recordTransaction(transaction, options = {}) {
  const validation = assertValidTransaction(transaction);
  const logPath = options.logPath || defaultLogPath(options.rootDir);
  const current = readTransactionLog({ logPath });
  if (current.entries.some((entry) => entry.transaction.id === transaction.id)) {
    const error = new Error(`Transaction already recorded: ${transaction.id}.`);
    error.code = "DUPLICATE_TRANSACTION";
    throw error;
  }
  const normalized = JSON.parse(canonicalStringify({
    ...transaction,
    writeSetHash: transaction.writeSetHash || validation.writeSetHash || computeWriteSetHash(transaction.proposedWrites)
  }));
  return appendEntry(logPath, { recordType: "transaction.recorded", transaction: normalized }, {
    label: "transaction log",
    recordedAt: options.recordedAt
  });
}

function getTransaction(transactionId, options = {}) {
  const result = readTransactionLog(options);
  const matches = result.entries.filter((entry) => entry.transaction.id === transactionId);
  if (matches.length !== 1) {
    const error = new Error(matches.length ? `Duplicate transaction records found: ${transactionId}.` : `Transaction not found: ${transactionId}.`);
    error.code = matches.length ? "DUPLICATE_TRANSACTION" : "TRANSACTION_NOT_FOUND";
    throw error;
  }
  return matches[0].transaction;
}

function reportVerification(result) {
  console.log("Institution OS Transaction Log");
  console.log("");
  console.log(`Records: ${result.count}`);
  console.log(`Head hash: ${result.headHash}`);
  console.log("Transaction log: PASS");
}

module.exports = { defaultLogPath, getTransaction, readTransactionLog, recordTransaction };

if (require.main === module) {
  const [command, value] = process.argv.slice(2);
  try {
    if (command === "record" && value) {
      const transaction = JSON.parse(fs.readFileSync(path.resolve(value), "utf8"));
      const entry = recordTransaction(transaction);
      console.log(JSON.stringify(entry, null, 2));
    } else if (command === "verify") {
      reportVerification(readTransactionLog());
    } else if (command === "show" && value) {
      console.log(JSON.stringify(getTransaction(value), null, 2));
    } else {
      console.error("Usage: node kernel/transactions/store.js record <transaction.json> | verify | show <transaction-id>");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
