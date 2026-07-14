"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { clone, minimalCatalog, validateCatalog } = require("./helpers/platform-harness");

test("complete canonical catalog passes schema, relationship, and release validation", () => {
  const result = validateCatalog(minimalCatalog());
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test("dangling source link is rejected", () => {
  const catalog = minimalCatalog();
  catalog.findings[0].supportingSourceIds = ["SRC-999999"];
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "DANGLING_REFERENCE" && error.referencedId === "SRC-999999"));
});

test("duplicate permanent identifiers are rejected", () => {
  const catalog = minimalCatalog();
  const duplicate = clone(catalog.sources[0]);
  duplicate.title = "Duplicate identifier";
  catalog.sources.push(duplicate);
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_ID"));
});

test("missing bidirectional claim relationship is rejected", () => {
  const catalog = minimalCatalog();
  catalog.claims[0].findingIds = [];
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "REVERSE_REFERENCE_MISSING"));
});

test("release assigned to an unknown audit is rejected", () => {
  const catalog = minimalCatalog();
  catalog.releases[0].auditId = "TCA-TST-2026-999";
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "DANGLING_REFERENCE" && error.referencedId === "TCA-TST-2026-999"));
});
