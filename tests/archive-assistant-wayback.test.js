const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");

const validation = require("../docs/archive-assistant-validation.js");
const exportApi = require("../docs/archive-assistant-export.js");
const wayback = require("../docs/archive-assistant-wayback.js");

const HEADERS = [
  "source_id",
  "canonical_url",
  "save_page_now_url",
  "capture_url_recorded",
  "sha256_recorded",
  "archive_status",
  "archive_date",
  "verified_by",
  "archive_failure_date",
  "archive_failure_reason",
  "archive_attempted_url"
];

function computeManifestHash(csvText) {
  return createHash("sha256").update(csvText).digest("hex");
}

function buildArchivedRecord(sourceId) {
  const canonicalUrl = `https://example.com/${sourceId.toLowerCase()}.pdf`;
  return {
    source_id: sourceId,
    canonical_url: canonicalUrl,
    save_page_now_url: `https://web.archive.org/save/${canonicalUrl}`,
    capture_url_recorded: `https://web.archive.org/web/20260704123000/${canonicalUrl}`,
    sha256_recorded: sourceId.slice(-1).repeat(64),
    archive_status: "ARCHIVED",
    archive_date: "2026-07-04",
    verified_by: "CAL",
    archive_failure_date: "",
    archive_failure_reason: "",
    archive_attempted_url: ""
  };
}

function buildNeedsRecaptureRecord(sourceId) {
  const canonicalUrl = `https://example.com/${sourceId.toLowerCase()}.pdf`;
  return {
    source_id: sourceId,
    canonical_url: canonicalUrl,
    save_page_now_url: `https://web.archive.org/save/${canonicalUrl}`,
    capture_url_recorded: `https://web.archive.org/web/${canonicalUrl}`,
    sha256_recorded: sourceId.slice(-1).repeat(64),
    archive_status: "NEEDS_RECAPTURE",
    archive_date: "2026-07-04",
    verified_by: "CAL",
    archive_failure_date: "",
    archive_failure_reason: "",
    archive_attempted_url: ""
  };
}

function buildRepairableRecords() {
  const archived = [];
  for (let index = 1; index <= 38; index += 1) {
    archived.push(buildArchivedRecord(`S-${String(index).padStart(4, "0")}`));
  }

  const recaptureIds = ["S-0039", "S-0040", "S-0041", "S-0042"];
  const recaptures = recaptureIds.map((sourceId) => buildNeedsRecaptureRecord(sourceId));
  return { records: [...archived, ...recaptures], recaptureIds };
}

function buildSnapshotForRecord(record, timestamp = "20260704154500") {
  return {
    timestamp,
    archiveUrl: `https://web.archive.org/web/${timestamp}/${record.canonical_url}`,
    captureDate: "2026-07-04"
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      value = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    value += char;
  }
  row.push(value);
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }
  return rows;
}

function recordsFromCsv(csvText) {
  const rows = parseCsv(csvText);
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });
    return record;
  });
}

test("repair, export, and reload preserve timestamped archive URLs and archive status", async () => {
  const { records, recaptureIds } = buildRepairableRecords();

  recaptureIds.forEach((sourceId) => {
    const record = records.find((item) => item.source_id === sourceId);
    const result = wayback.applyLegacyWaybackRepair(record, [buildSnapshotForRecord(record)]);
    assert.equal(result.repaired, true);
    validation.applyAutoArchiveStatus(record);
  });

  assert.equal(records.filter((record) => record.archive_status === "ARCHIVED").length, 42);
  assert.equal(records.every((record) => validation.getRowIssues(record).length === 0), true);

  const artifacts = await exportApi.buildFinalExportArtifacts({
    headers: HEADERS,
    records,
    computeManifestHash
  });

  const reloaded = recordsFromCsv(artifacts.csvText);
  assert.equal(reloaded.filter((record) => record.archive_status === "ARCHIVED").length, 42);
  recaptureIds.forEach((sourceId) => {
    const record = reloaded.find((item) => item.source_id === sourceId);
    assert.match(record.capture_url_recorded, /^https:\/\/web\.archive\.org\/web\/\d{14}\//);
    assert.equal(validation.getRowIssues(record).length, 0);
  });
});

test("a second reload from stale legacy rows preserves 42 archived rows with no validation errors", async () => {
  const { records, recaptureIds } = buildRepairableRecords();
  const staleIncoming = buildRepairableRecords().records;

  recaptureIds.forEach((sourceId) => {
    const record = records.find((item) => item.source_id === sourceId);
    const result = wayback.applyLegacyWaybackRepair(record, [buildSnapshotForRecord(record)]);
    assert.equal(result.repaired, true);
    validation.applyAutoArchiveStatus(record);
  });

  const artifacts = await exportApi.buildFinalExportArtifacts({
    headers: HEADERS,
    records,
    computeManifestHash
  });
  const reloaded = recordsFromCsv(artifacts.csvText);

  reloaded.forEach((record) => {
    const incoming = staleIncoming.find((item) => item.source_id === record.source_id);
    wayback.mergeIncomingRecord(record, incoming, HEADERS);
    validation.applyAutoArchiveStatus(record);
  });

  assert.equal(reloaded.filter((record) => record.archive_status === "ARCHIVED").length, 42);
  assert.equal(reloaded.every((record) => validation.getRowIssues(record).length === 0), true);
  recaptureIds.forEach((sourceId) => {
    const record = reloaded.find((item) => item.source_id === sourceId);
    assert.match(record.capture_url_recorded, /^https:\/\/web\.archive\.org\/web\/\d{14}\//);
  });
});
