"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { minimalCatalog, validateCatalog } = require("./helpers/platform-harness");

test("published audit without a release is rejected", () => {
  const catalog = minimalCatalog();
  catalog.audits[0].currentReleaseId = null;
  catalog.audits[0].releaseIds = [];
  catalog.releases = [];
  catalog.artifacts = [];
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_RELEASE_REQUIRED"));
});

test("published-with-limitations audit must disclose a limitation and unknown", () => {
  const catalog = minimalCatalog();
  catalog.audits[0].limitationSummary = "";
  catalog.audits[0].unknownIds = [];
  catalog.findings[0].unknownIds = [];
  catalog.unknowns = [];
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_LIMITATION_SUMMARY_REQUIRED"));
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_UNKNOWN_REQUIRED"));
});

test("high-confidence finding cannot rely exclusively on Tier D evidence", () => {
  const catalog = minimalCatalog();
  catalog.findings[0].confidence = "high";
  catalog.sources[0].sourceTier = "D";
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_HIGH_CONFIDENCE_LOW_TIER"));
});

test("quantitative claim requires a calculation or direct value", () => {
  const catalog = minimalCatalog();
  catalog.claims[0].calculationIds = [];
  catalog.claims[0].directSourceValue = null;
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_QUANTITATIVE_LINEAGE_REQUIRED"));
});

test("open unknown that prevents conclusion blocks determinate publication", () => {
  const catalog = minimalCatalog();
  catalog.unknowns[0].effectOnConclusion = "prevents_conclusion";
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_PREVENTED_CONCLUSION"));
});

test("failed publication gate blocks release", () => {
  const catalog = minimalCatalog();
  catalog.releases[0].publicationGateResults[0].passed = false;
  const result = validateCatalog(catalog);
  assert.ok(result.errors.some((error) => error.code === "PUBLICATION_GATE_FAILED"));
});
