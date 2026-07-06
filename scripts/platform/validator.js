"use strict";

const path = require("path");
const { COLLECTIONS } = require("./config");
const { sortErrors, stableStringify } = require("./errors");
const { validatePublicationPolicy } = require("./publication-policy");
const { validateReferenceIntegrity } = require("./reference-integrity");
const { buildIndexes, loadCollections } = require("./catalog");
const { loadSchemas, validateSchemas, validateSchemaValue } = require("./schema-validator");

function validatePlatformRecords(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, "..", ".."));
  const schemaDir = path.resolve(options.schemaDir || path.join(rootDir, "schemas"));
  const errors = [];
  const collections = loadCollections(rootDir, errors);
  validateSchemas(collections, schemaDir, errors);
  const indexes = buildIndexes(collections, errors);
  validateReferenceIntegrity(collections, indexes, errors);
  validatePublicationPolicy(collections, indexes, errors);
  sortErrors(errors);
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors.map((error) => Object.freeze(error))),
    counts: Object.freeze(Object.fromEntries(Object.entries(collections).map(([collection, items]) => [collection, items.length])))
  });
}

module.exports = {
  COLLECTIONS,
  loadSchemas,
  stableStringify,
  validatePlatformRecords,
  validateSchemaValue
};
