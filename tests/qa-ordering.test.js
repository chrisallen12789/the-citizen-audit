const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const qaPath = path.join(root, "scripts", "qa.js");
const expectedDiagnostics = [
  "public/articles.html: unexpected public HTML artifact",
  "public/articles/audit-002-va-reader-guide.html: unexpected public HTML artifact",
  "public/articles/what-audit-002-found-va-spending.html: unexpected public HTML artifact",
  "public/articles/what-the-citizen-audit-is.html: unexpected public HTML artifact",
  "public/audits.html: unexpected public HTML artifact",
  "public/audits/audit-002/claims.html: unexpected public HTML artifact",
  "public/audits/audit-002/data.html: unexpected public HTML artifact",
  "public/audits/audit-002/decision-log.html: unexpected public HTML artifact",
  "public/audits/audit-002/downloads.html: unexpected public HTML artifact",
  "public/audits/audit-002/evidence.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings/sf-0001.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings/sf-0002.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings/sf-0003.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings/sf-0004.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings/sf-0005.html: unexpected public HTML artifact",
  "public/audits/audit-002/findings/sf-0006.html: unexpected public HTML artifact",
  "public/audits/audit-002/index.html: unexpected public HTML artifact",
  "public/audits/audit-002/limitations.html: unexpected public HTML artifact",
  "public/audits/audit-002/sources.html: unexpected public HTML artifact",
  "public/charter.html: unexpected public HTML artifact",
  "public/citizen-standard.html: unexpected public HTML artifact",
  "public/constitution.html: unexpected public HTML artifact",
  "public/institution.html: unexpected public HTML artifact",
  "public/introduction.html: unexpected public HTML artifact",
  "public/oath.html: unexpected public HTML artifact",
  "public/standard.html: duplicate title also used by public/citizen-standard.html",
  "public/standard.html: unexpected public HTML artifact",
  "public/support.html: unexpected public HTML artifact",
  "public/unknowns.html: unexpected public HTML artifact",
  "public/volume-ii-veterans-affairs.html: broken internal link /data/volume-ii-archive-manifest.csv",
  "public/volume-ii-veterans-affairs.html: broken internal link /data/volume-ii-claim-database.csv",
  "public/volume-ii-veterans-affairs.html: broken internal link /data/volume-ii-evidence-index.json",
  "public/volume-ii-veterans-affairs.html: broken internal link /data/volume-ii-evidence-register.csv",
  "public/volume-ii-veterans-affairs.html: broken internal link /data/volume-ii-relationship-graph.json",
  "public/volume-ii-veterans-affairs.html: broken internal link /downloads/volume-ii-decision-log.md",
  "public/volume-ii-veterans-affairs.html: unexpected public HTML artifact"
];
const expectedPayload = `${expectedDiagnostics.map((item) => `- ${item}`).join("\n")}\n`;
const expectedHash = "b6984c73241b51af52307eb56049109a68ac2b68ceaaab4c592330da82209ff0";

function compareCodePoints(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalPayload(output) {
  const lines = output
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.startsWith("- "));
  return `${lines.join("\n")}\n`;
}

function runQa() {
  return spawnSync(process.execPath, [qaPath], { cwd: root, encoding: "utf8" });
}

function snapshotPublicTree() {
  const records = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => compareCodePoints(a.name, b.name))) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).replace(/\\/g, "/");
      const stat = fs.statSync(absolute);
      records.push({
        path: relative,
        type: entry.isDirectory() ? "directory" : "file",
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: entry.isFile()
          ? crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")
          : null
      });
      if (entry.isDirectory()) visit(absolute);
    }
  }
  visit(path.join(root, "public"));
  return records;
}

test("QA preserves the exact ordered 37-diagnostic failing baseline", () => {
  const result = runQa();
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.ok(result.stderr.replace(/\r\n/g, "\n").startsWith("QA failed:\n"));

  const payload = canonicalPayload(result.stderr);
  const diagnostics = payload.trimEnd().split("\n").map((line) => line.slice(2));
  assert.equal(diagnostics.length, 37);
  assert.deepEqual(diagnostics, expectedDiagnostics);
  assert.deepEqual(diagnostics, [...diagnostics].sort(compareCodePoints));
  assert.ok(diagnostics.every((item) => !item.includes("\\")));
  assert.equal(payload, expectedPayload);
  assert.equal(crypto.createHash("sha256").update(payload, "utf8").digest("hex"), expectedHash);
});

test("repeated QA runs are byte-identical and retain no public output", () => {
  const before = snapshotPublicTree();
  const first = runQa();
  const between = snapshotPublicTree();
  const second = runQa();
  const after = snapshotPublicTree();

  assert.equal(first.status, 1);
  assert.equal(second.status, 1);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stderr, second.stderr);
  assert.deepEqual(between, before);
  assert.deepEqual(after, before);
});

test("LF and CRLF transport yield the same canonical QA payload", () => {
  const crlf = expectedPayload.replace(/\n/g, "\r\n");
  assert.equal(canonicalPayload(expectedPayload), expectedPayload);
  assert.equal(canonicalPayload(crlf), expectedPayload);
});

module.exports = {
  expectedDiagnostics,
  expectedHash,
  expectedPayload
};
