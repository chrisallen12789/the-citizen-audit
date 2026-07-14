"use strict";

const path = require("path");
const { auditSamples } = require("./sample-audit");
const { evidenceSamples } = require("./sample-evidence");
const { releaseSamples } = require("./sample-release");
const { COLLECTIONS } = require("../../scripts/platform/config");
const { buildIndexes } = require("../../scripts/platform/catalog");
const { sortErrors } = require("../../scripts/platform/errors");
const { validateLinks } = require("../../scripts/platform/link-validator");
const { validateReleaseRules } = require("../../scripts/platform/release-rules");
const { loadSchemas, validateSchemas } = require("../../scripts/platform/schema-validator");

function samples() {
  return { ...auditSamples(), ...evidenceSamples(), ...releaseSamples() };
}

function minimalCatalog() {
  const s = samples();
  return {
    audits: [s.audit], findings: [s.finding], claims: [s.claim], sources: [s.source],
    "source-captures": [s.sourceCapture], calculations: [s.calculation], unknowns: [s.unknown],
    methodologies: [s.methodology], challenges: [], responses: [], corrections: [],
    releases: [s.release], artifacts: [s.reportArtifact, s.manifestArtifact], institutions: [s.institution]
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function wrapCatalog(catalog) {
  return Object.fromEntries(Object.keys(COLLECTIONS).map((collection) => {
    const idField = COLLECTIONS[collection].idField;
    return [collection, (catalog[collection] || []).map((data) => ({
      collection,
      id: data[idField],
      file: `fixture/${collection}/${data[idField]}.json`,
      data
    }))];
  }));
}

function validateCatalog(catalog) {
  const errors = [];
  const collections = wrapCatalog(catalog);
  const schemaDir = path.join(__dirname, "..", "..", "schemas");
  validateSchemas(collections, schemaDir, errors);
  const indexes = buildIndexes(collections, errors);
  validateLinks(collections, indexes, errors);
  validateReleaseRules(collections, indexes, errors);
  sortErrors(errors);
  return { valid: errors.length === 0, errors, collections, indexes, schemas: loadSchemas(schemaDir) };
}

module.exports = { clone, minimalCatalog, samples, validateCatalog, wrapCatalog };
