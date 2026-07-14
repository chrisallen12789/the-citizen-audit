"use strict";

const assert = require("node:assert/strict");
const path = require("path");
const test = require("node:test");
const { COLLECTIONS, loadSchemas, validateSchemaValue } = require("../scripts/platform/validator");
const { clone, samples } = require("./helpers/platform-harness");

const schemaDir = path.join(__dirname, "..", "schemas");
const schemas = loadSchemas(schemaDir);
const sample = samples();
const cases = {
  audits: sample.audit,
  findings: sample.finding,
  claims: sample.claim,
  sources: sample.source,
  "source-captures": sample.sourceCapture,
  calculations: sample.calculation,
  unknowns: sample.unknown,
  methodologies: sample.methodology,
  challenges: sample.challenge,
  responses: sample.response,
  corrections: sample.correction,
  releases: sample.release,
  artifacts: sample.reportArtifact,
  institutions: sample.institution
};

function validate(collection, value) {
  const rootSchema = schemas.get(COLLECTIONS[collection].schema);
  const errors = [];
  validateSchemaValue(value, rootSchema, {
    schemas,
    rootSchema,
    errors,
    record: { collection, id: value[COLLECTIONS[collection].idField], file: "fixture.json" },
    fieldPath: "$"
  });
  return errors;
}

test("all record schemas accept valid examples", () => {
  for (const [collection, value] of Object.entries(cases)) assert.deepEqual(validate(collection, value), [], collection);
});

test("missing required field fails closed", () => {
  const audit = clone(sample.audit);
  delete audit.question;
  assert.ok(validate("audits", audit).some((error) => error.code === "SCHEMA_REQUIRED" && error.path === "$.question"));
});

test("unknown controlled status is rejected", () => {
  const audit = clone(sample.audit);
  audit.status = "looks_good";
  assert.ok(validate("audits", audit).some((error) => error.code === "SCHEMA_ENUM" && error.path === "$.status"));
});

test("malformed SHA-256 is rejected", () => {
  const release = clone(sample.release);
  release.recordSnapshotHash = "not-a-hash";
  assert.ok(validate("releases", release).some((error) => error.code === "SCHEMA_PATTERN" && error.path === "$.recordSnapshotHash"));
});

test("unexpected properties are rejected", () => {
  const source = clone(sample.source);
  source.uncontrolledField = true;
  assert.ok(validate("sources", source).some((error) => error.code === "SCHEMA_ADDITIONAL_PROPERTY" && error.path === "$.uncontrolledField"));
});
