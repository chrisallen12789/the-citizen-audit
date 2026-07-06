const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function readRecords(journalPath) {
  if (!fs.existsSync(journalPath)) return [];
  return fs.readFileSync(journalPath, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function activeEntries(records) {
  const released = new Set(records.filter((record) => record.type === "leave").map((record) => record.entryId));
  return records.filter((record) => record.type === "enter" && !released.has(record.entryId));
}

function appendRecord(journalPath, record) {
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.appendFileSync(journalPath, `${JSON.stringify(record)}\n`, "utf8");
}

function enterMutationBoundary(journalPath, metadata = {}) {
  const entryId = crypto.randomUUID();
  appendRecord(journalPath, {
    type: "enter",
    entryId,
    enteredAt: new Date().toISOString(),
    ...metadata
  });
  const active = activeEntries(readRecords(journalPath));
  if (!active.length || active[0].entryId !== entryId) {
    appendRecord(journalPath, { type: "leave", entryId, leftAt: new Date().toISOString(), disposition: "denied" });
    throw new Error(`Another execution owns the mutation boundary: ${active[0] ? active[0].entryId : "unknown"}.`);
  }
  return () => appendRecord(journalPath, { type: "leave", entryId, leftAt: new Date().toISOString(), disposition: "released" });
}

module.exports = { activeEntries, enterMutationBoundary, readRecords };
