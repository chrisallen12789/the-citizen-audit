const assert = require("node:assert/strict");
const test = require("node:test");

const {
  looksLikeWaybackCaptureUrl,
  normalizeWaybackSnapshotRows
} = require("../scripts/archive-assistant-helper.js");

test("helper normalizes CDX rows into full timestamped Wayback snapshot URLs", () => {
  const snapshots = normalizeWaybackSnapshotRows([
    ["timestamp", "original", "statuscode"],
    ["20260704123000", "https://example.com/file.pdf", "200"]
  ]);

  assert.deepEqual(snapshots, [
    {
      timestamp: "20260704123000",
      archiveUrl: "https://web.archive.org/web/20260704123000/https://example.com/file.pdf",
      captureDate: "2026-07-04"
    }
  ]);
  assert.equal(looksLikeWaybackCaptureUrl(snapshots[0].archiveUrl), true);
});

test("helper never emits legacy /web/https:// archive URLs", () => {
  const snapshots = normalizeWaybackSnapshotRows([
    ["timestamp", "original", "statuscode"],
    ["20260704123000", "https://example.com/file.pdf", "200"],
    ["", "https://example.com/invalid.pdf", "200"]
  ]);

  assert.equal(
    snapshots.some((snapshot) => /^https?:\/\/web\.archive\.org\/web\/https?:\/\//i.test(snapshot.archiveUrl)),
    false
  );
});
