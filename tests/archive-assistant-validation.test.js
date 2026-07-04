const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getCompletionMessage,
  getRowIssues,
  isArchivedComplete,
  isDocumentedFailure,
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
