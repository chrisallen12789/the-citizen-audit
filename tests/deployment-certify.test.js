const assert = require("node:assert/strict");
const test = require("node:test");
const { certify, toMarkdown, evaluate } = require("../scripts/deployment-certify");

const V = (id, mandatory, status) => ({ id, category: "t", mandatory, status, detail: "" });

test("failed mandatory check => CERTIFICATION_FAILED and nonzero exit", () => {
  const e = evaluate([V("a", true, "verified"), V("b", true, "failed")], true);
  assert.equal(e.ruling, "CERTIFICATION_FAILED");
  assert.equal(e.exitCode, 1);
});

test("unavailable mandatory capability => REPRESENTATIVE_ENVIRONMENT_REQUIRED (never a pass)", () => {
  const e = evaluate([V("a", true, "verified"), V("b", true, "unavailable")], true);
  assert.equal(e.ruling, "REPRESENTATIVE_ENVIRONMENT_REQUIRED");
  assert.equal(e.exitCode, 1);
});

test("representative_required mandatory check blocks certification even with attestation", () => {
  const e = evaluate([V("a", true, "verified"), V("b", true, "representative_required")], true);
  assert.equal(e.ruling, "REPRESENTATIVE_ENVIRONMENT_REQUIRED");
  assert.equal(e.exitCode, 1);
});

test("all mandatory verified but NOT attested => REPRESENTATIVE_ENVIRONMENT_REQUIRED (no false certification)", () => {
  const e = evaluate([V("a", true, "verified"), V("b", true, "verified")], false);
  assert.equal(e.ruling, "REPRESENTATIVE_ENVIRONMENT_REQUIRED");
  assert.equal(e.exitCode, 1);
});

test("all mandatory verified AND attested => CERTIFIED, exit 0", () => {
  const e = evaluate([V("a", true, "verified"), V("b", true, "verified"), V("c", false, "info")], true);
  assert.equal(e.ruling, "CERTIFIED");
  assert.equal(e.exitCode, 0);
});

test("non-mandatory (info) checks do not affect the ruling", () => {
  const e = evaluate([V("a", true, "verified"), V("info", false, "info"), V("x", false, "failed")], true);
  assert.equal(e.ruling, "CERTIFIED");
});

test("failed dominates over representative_required", () => {
  const e = evaluate([V("a", true, "representative_required"), V("b", true, "failed")], true);
  assert.equal(e.ruling, "CERTIFICATION_FAILED");
});

test("evaluate is deterministic for the same input", () => {
  const input = [V("a", true, "verified"), V("b", true, "unavailable")];
  assert.deepEqual(evaluate(input, false), evaluate(input, false));
});

test("real certify() emits a well-formed schema and never self-certifies this sandbox", () => {
  const { report, exitCode } = certify();
  assert.equal(report.schemaVersion, "1.0.0");
  assert.ok(Array.isArray(report.checks) && report.checks.length > 0);
  assert.ok(report.summary && typeof report.summary.mandatoryTotal === "number");
  for (const c of report.checks) {
    assert.ok(["verified", "failed", "unavailable", "representative_required", "info"].includes(c.status), `bad status: ${c.status}`);
    assert.ok(typeof c.id === "string" && c.id.length > 0);
  }
  // This sandbox is not attested representative, so it must never be CERTIFIED.
  assert.notEqual(report.ruling, "CERTIFIED");
  assert.equal(exitCode, 1);
  assert.match(toMarkdown(report), /Ruling: /);
});
