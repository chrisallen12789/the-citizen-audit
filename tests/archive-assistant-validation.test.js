const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyAutoArchiveStatus,
  getCompletionMessage,
  getRowIssues,
  isArchivedComplete,
  isDocumentedFailure,
  isNeedsRecaptureStatus,
  isRowComplete
} = require("../docs/archive-assistant-validation.js");

function buildBaseRecord(overrides = {}) {
  return {
    source_id: "S-0024",
    canonical_url: "https://www.vaoig.gov/reports",
    save_page_now_url: "https://web.archive.org/save/https://www.vaoig.gov/reports",
    capture_url_recorded: "",
    sha256_recorded: "",
    archive_status: "PENDING",
    archive_date: "",
    verified_by: "CAL",
    archive_failure_date: "",
    archive_failure_reason: "",
    archive_attempted_url: "",
    ...overrides
  };
}

test("ATTEMPT_FAILED with no SHA and no archive URL validates as a documented failure", () => {
  const record = buildBaseRecord({
    archive_status: "ATTEMPT_FAILED",
    archive_failure_date: "2026-07-04",
    archive_failure_reason: "Sorry - Job failed."
  });

  const issues = getRowIssues(record);

  assert.deepEqual(issues, []);
  assert.equal(isDocumentedFailure(record), true);
  assert.equal(isRowComplete(record), true);
  assert.match(
    getCompletionMessage(record, issues),
    /Archive failure documented/i
  );
});

test("ATTEMPT_FAILED does not emit SHA-256 or archive URL requirements", () => {
  const record = buildBaseRecord({
    archive_status: "ATTEMPT_FAILED",
    archive_failure_date: "2026-07-04",
    archive_failure_reason: "No existing Wayback snapshot found."
  });

  const issues = getRowIssues(record);

  assert.equal(issues.some((issue) => /SHA-256 hash is required/i.test(issue)), false);
  assert.equal(issues.some((issue) => /Returned archive URL is required/i.test(issue)), false);
  assert.equal(issues.some((issue) => /Capture Date is required/i.test(issue)), false);
});

test("ARCHIVED without SHA fails validation", () => {
  const record = buildBaseRecord({
    archive_status: "ARCHIVED",
    capture_url_recorded: "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/reports",
    archive_date: "2026-07-04"
  });

  const issues = getRowIssues(record);

  assert.equal(issues.includes("SHA-256 hash is required."), true);
  assert.equal(isArchivedComplete(record), false);
  assert.equal(isRowComplete(record), false);
});

test("ARCHIVED without archive URL fails validation", () => {
  const record = buildBaseRecord({
    archive_status: "ARCHIVED",
    archive_date: "2026-07-04",
    sha256_recorded: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  });

  const issues = getRowIssues(record);

  assert.equal(issues.includes("Returned archive URL is required."), true);
  assert.equal(isArchivedComplete(record), false);
  assert.equal(isRowComplete(record), false);
});

test("ARCHIVED with a legacy Wayback URL without a timestamp fails validation", () => {
  const record = buildBaseRecord({
    archive_status: "ARCHIVED",
    capture_url_recorded: "https://web.archive.org/web/https://www.vaoig.gov/reports",
    archive_date: "2026-07-04",
    sha256_recorded: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  });

  const issues = getRowIssues(record);

  assert.equal(
    issues.includes("Returned archive URL is a legacy Wayback URL without a timestamp. Repair or reselect the timestamped snapshot before export."),
    true
  );
  assert.equal(isArchivedComplete(record), false);
  assert.equal(isRowComplete(record), false);
});

test("ARCHIVED with a Save Page Now URL in returned archive URL fails validation", () => {
  const record = buildBaseRecord({
    archive_status: "ARCHIVED",
    capture_url_recorded: "https://web.archive.org/save/https://www.vaoig.gov/reports",
    archive_date: "2026-07-04",
    sha256_recorded: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  });

  const issues = getRowIssues(record);

  assert.equal(
    issues.includes("Returned archive URL cannot be a Save Page Now request URL. Store the timestamped Wayback snapshot URL instead."),
    true
  );
  assert.equal(isArchivedComplete(record), false);
  assert.equal(isRowComplete(record), false);
});

test("NEEDS_RECAPTURE explains which archive evidence fields are still missing", () => {
  const record = buildBaseRecord({
    archive_status: "NEEDS_RECAPTURE",
    capture_url_recorded: "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/reports"
  });

  const issues = getRowIssues(record);

  assert.equal(issues.includes("Capture Date is required."), true);
  assert.equal(issues.includes("SHA-256 hash is required."), true);
  assert.equal(issues.includes("Verified By is required."), false);
  assert.equal(isRowComplete(record), false);
});

test("PENDING with complete evidence still auto-promotes to ARCHIVED", () => {
  const record = buildBaseRecord({
    archive_status: "PENDING",
    capture_url_recorded: "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/reports",
    archive_date: "2026-07-04",
    sha256_recorded: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  });

  const transition = applyAutoArchiveStatus(record);

  assert.deepEqual(transition, {
    changed: true,
    fromStatus: "PENDING",
    toStatus: "ARCHIVED"
  });
  assert.equal(record.archive_status, "ARCHIVED");
  assert.equal(isArchivedComplete(record), true);
});

test("NEEDS_RECAPTURE with incomplete evidence remains NEEDS_RECAPTURE", () => {
  const record = buildBaseRecord({
    archive_status: "NEEDS_RECAPTURE",
    capture_url_recorded: "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/reports"
  });

  const transition = applyAutoArchiveStatus(record);

  assert.equal(transition.changed, false);
  assert.equal(record.archive_status, "NEEDS_RECAPTURE");
  assert.equal(isNeedsRecaptureStatus(record), true);
});

test("NEEDS_RECAPTURE with complete matching evidence auto-promotes to ARCHIVED", () => {
  const record = buildBaseRecord({
    source_id: "S-0105",
    canonical_url: "https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf",
    save_page_now_url:
      "https://web.archive.org/save/https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf",
    archive_status: "NEEDS_RECAPTURE",
    capture_url_recorded:
      "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf",
    archive_date: "2026-07-04",
    sha256_recorded: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  });

  const transition = applyAutoArchiveStatus(record);

  assert.deepEqual(transition, {
    changed: true,
    fromStatus: "NEEDS_RECAPTURE",
    toStatus: "ARCHIVED"
  });
  assert.equal(record.archive_status, "ARCHIVED");
  assert.equal(isArchivedComplete(record), true);
});

test("NEEDS_RECAPTURE with complete evidence but the wrong archive target does not auto-promote", () => {
  const record = buildBaseRecord({
    source_id: "S-0106",
    canonical_url: "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf",
    save_page_now_url:
      "https://web.archive.org/save/https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf",
    archive_status: "NEEDS_RECAPTURE",
    capture_url_recorded: "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/reports",
    archive_date: "2026-07-04",
    sha256_recorded: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  });

  const transition = applyAutoArchiveStatus(record);
  const issues = getRowIssues(record);

  assert.equal(transition.changed, false);
  assert.equal(record.archive_status, "NEEDS_RECAPTURE");
  assert.equal(
    issues.includes("Returned archive URL does not match the current canonical URL for recapture."),
    true
  );
});

test("ATTEMPT_FAILED never auto-promotes even when other fields are present", () => {
  const record = buildBaseRecord({
    archive_status: "ATTEMPT_FAILED",
    capture_url_recorded: "https://web.archive.org/web/20260704123000/https://www.vaoig.gov/reports",
    archive_date: "2026-07-04",
    sha256_recorded: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    archive_failure_date: "2026-07-04",
    archive_failure_reason: "No existing snapshot."
  });

  const transition = applyAutoArchiveStatus(record);

  assert.equal(transition.changed, false);
  assert.equal(record.archive_status, "ATTEMPT_FAILED");
  assert.equal(isDocumentedFailure(record), true);
});
