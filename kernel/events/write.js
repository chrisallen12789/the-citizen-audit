const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..", "..");

function defaultEventLogPath(rootDir = repositoryRoot) {
  return path.join(rootDir, "kernel", "events", "log.jsonl");
}

function nextEventId(filePath) {
  if (!fs.existsSync(filePath)) return "EVENT-00000001";
  let max = 0;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)) {
    const event = JSON.parse(line);
    const match = typeof event.id === "string" ? event.id.match(/^EVENT-(\d{8})$/) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `EVENT-${String(max + 1).padStart(8, "0")}`;
}

function createEventWriter(options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const filePath = options.filePath || defaultEventLogPath(rootDir);
  const now = options.now || (() => new Date().toISOString());
  return function writeEvent(input) {
    const event = {
      id: nextEventId(filePath),
      type: input.type,
      timestamp: input.timestamp || now(),
      actor: input.actor,
      summary: input.summary,
      relatedRecords: [...new Set(input.relatedRecords || [])],
      severity: input.severity || "info",
      data: input.data || {}
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
    return event;
  };
}

module.exports = { createEventWriter, defaultEventLogPath };
