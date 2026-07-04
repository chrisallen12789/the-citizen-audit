const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const test = require("node:test");

const {
  FINAL_EXPORT_FILE_NAME,
  FINAL_EXPORT_SIDECAR_FILE_NAME,
  buildFinalExportArtifacts,
  runAdvisoryVerificationSweep,
  runLocalFinalConsistencyCheck
} = require("../docs/archive-assistant-export.js");

function buildArchivedRecord(sourceId, canonicalUrl, hashSeed) {
  const hash = hashSeed.repeat(64).slice(0, 64);
  return {
    source_id: sourceId,
    canonical_url: canonicalUrl,
    save_page_now_url: `https://web.archive.org/save/${canonicalUrl}`,
    capture_url_recorded: `https://web.archive.org/web/20260704123000/${canonicalUrl}`,
    sha256_recorded: hash,
    archive_status: "ARCHIVED",
    archive_date: "2026-07-04",
    verified_by: "CAL",
    archive_failure_date: "",
    archive_failure_reason: "",
    archive_attempted_url: ""
  };
}

function buildAttemptFailedRecord(sourceId, canonicalUrl) {
  return {
    source_id: sourceId,
    canonical_url: canonicalUrl,
    save_page_now_url: `https://web.archive.org/save/${canonicalUrl}`,
    capture_url_recorded: "",
    sha256_recorded: "",
    archive_status: "ATTEMPT_FAILED",
    archive_date: "",
    verified_by: "CAL",
    archive_failure_date: "2026-07-04",
    archive_failure_reason: "Sorry - Job failed.",
    archive_attempted_url: `https://web.archive.org/save/${canonicalUrl}`
  };
}

function buildValidManifestRecords() {
  const records = [];
  for (let index = 1; index <= 42; index += 1) {
    const sourceId = `S-${String(index).padStart(4, "0")}`;
    records.push(buildArchivedRecord(sourceId, `https://example.com/${sourceId.toLowerCase()}.pdf`, index.toString(16)));
  }
  records.push(buildAttemptFailedRecord("S-0043", "https://example.com/s-0043.pdf"));
  return records;
}

function computeManifestHash(csvText) {
  return createHash("sha256").update(csvText).digest("hex");
}

test("local final export validation succeeds for 42 ARCHIVED rows and 1 ATTEMPT_FAILED row", () => {
  const result = runLocalFinalConsistencyCheck({
    records: buildValidManifestRecords(),
    duplicates: {
      canonical: new Map(),
      archive: new Map(),
      sha: new Map()
    },
    expectedRowCount: 43
  });

  assert.deepEqual(result.requiredIssues, []);
  assert.deepEqual(result.statusCounts, {
    ARCHIVED: 42,
    ATTEMPT_FAILED: 1
  });
});

test("final export artifacts are created as archive_manifest_authoritative.csv", async () => {
  const headers = [
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

  const artifacts = await buildFinalExportArtifacts({
    headers,
    records: buildValidManifestRecords(),
    computeManifestHash
  });

  assert.equal(artifacts.exportFileName, FINAL_EXPORT_FILE_NAME);
  assert.equal(artifacts.sidecarFileName, FINAL_EXPORT_SIDECAR_FILE_NAME);
  assert.match(artifacts.csvText, /^source_id,/);
  assert.match(artifacts.sidecarText, /archive_manifest_authoritative\.csv/);
  assert.equal(/^[a-f0-9]{64}$/i.test(artifacts.manifestHash), true);
});

test("local final export validation rejects legacy Wayback URLs without timestamps", () => {
  const records = buildValidManifestRecords();
  records[0].capture_url_recorded = "https://web.archive.org/web/https://example.com/s-0001.pdf";

  const result = runLocalFinalConsistencyCheck({
    records,
    duplicates: {
      canonical: new Map(),
      archive: new Map(),
      sha: new Map()
    },
    expectedRowCount: 43
  });

  assert.ok(
    result.requiredIssues.some((issue) =>
      /legacy Wayback URL without a timestamp|timestamped Wayback snapshot URL/i.test(issue)
    )
  );
});

test("helper unavailable warnings do not block authoritative export artifacts", async () => {
  const records = buildValidManifestRecords();
  const warnings = await runAdvisoryVerificationSweep({
    records,
    verifyRecord: async (record) => ({
      status: "unverified",
      verifiedBy: "tool-unavailable",
      message: `Archive URL not verified by tool for ${record.source_id}. Browser check failed: Failed to fetch. Helper check failed: Failed to fetch.`
    })
  });
  const artifacts = await buildFinalExportArtifacts({
    headers: Object.keys(records[0]),
    records,
    computeManifestHash
  });

  assert.ok(warnings.length >= 1);
  assert.equal(artifacts.exportFileName, FINAL_EXPORT_FILE_NAME);
});

test("helper HTTP 500 exceptions become advisory warnings and do not abort export", async () => {
  const records = buildValidManifestRecords();
  const loggedWarnings = [];
  const warnings = await runAdvisoryVerificationSweep({
    records,
    verifyRecord: async () => {
      throw new Error("Local helper verification failed with status 500.");
    },
    logWarning: (_record, message) => {
      loggedWarnings.push(message);
    }
  });
  const artifacts = await buildFinalExportArtifacts({
    headers: Object.keys(records[0]),
    records,
    computeManifestHash
  });

  assert.ok(warnings.some((warning) => /status 500/i.test(warning)));
  assert.equal(loggedWarnings.length, warnings.length);
  assert.equal(artifacts.exportFileName, FINAL_EXPORT_FILE_NAME);
});

test("archive.org/browser verification outages remain advisory and export still prepares authoritative csv", async () => {
  const records = buildValidManifestRecords();
  const warnings = await runAdvisoryVerificationSweep({
    records,
    verifyRecord: async () => ({
      status: "unverified",
      verifiedBy: "tool-unavailable",
      message: "Archive URL not verified by tool. Browser check failed: Failed to fetch. Helper check failed: connect ECONNREFUSED 127.0.0.1:4317."
    })
  });
  const artifacts = await buildFinalExportArtifacts({
    headers: Object.keys(records[0]),
    records,
    computeManifestHash
  });

  assert.ok(warnings.some((warning) => /not verified by tool/i.test(warning)));
  assert.equal(artifacts.exportFileName, FINAL_EXPORT_FILE_NAME);
});
