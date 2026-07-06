const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("./canonical-json");

const GENESIS_HASH = "0".repeat(64);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readVerifiedLog(filePath, label = "append-only log") {
  const entries = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse)
    : [];
  let previousHash = GENESIS_HASH;
  entries.forEach((entry, index) => {
    if (entry.sequence !== index + 1 || entry.previousHash !== previousHash) throw new Error(`${label}: chain verification failed at sequence ${index + 1}.`);
    const { hash, ...payload } = entry;
    const expected = sha256(`${entry.previousHash}\n${canonicalStringify(payload)}`);
    if (hash !== expected) throw new Error(`${label}: hash verification failed at sequence ${entry.sequence}.`);
    previousHash = hash;
  });
  return { entries, count: entries.length, headHash: previousHash };
}

function appendEntry(filePath, record, options = {}) {
  const current = readVerifiedLog(filePath, options.label);
  const payload = {
    sequence: current.count + 1,
    previousHash: current.headHash,
    recordedAt: options.recordedAt || new Date().toISOString(),
    ...record
  };
  const entry = { ...payload, hash: sha256(`${payload.previousHash}\n${canonicalStringify(payload)}`) };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
  return entry;
}

module.exports = { GENESIS_HASH, appendEntry, readVerifiedLog, sha256 };
