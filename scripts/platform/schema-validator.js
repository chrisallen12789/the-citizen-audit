"use strict";

const fs = require("fs");
const path = require("path");
const { COLLECTIONS } = require("./config");
const { addError, stableStringify } = require("./errors");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadSchemas(schemaDir) {
  const schemas = new Map();
  for (const entry of fs.readdirSync(schemaDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.startsWith("platform-") || !entry.name.endsWith(".schema.json")) continue;
    const schema = readJson(path.join(schemaDir, entry.name));
    schemas.set(entry.name, schema);
    if (schema.$id) schemas.set(schema.$id, schema);
  }
  return schemas;
}

function pointerGet(root, fragment) {
  if (!fragment || fragment === "#") return root;
  if (!fragment.startsWith("#/")) throw new Error(`Unsupported JSON Pointer fragment: ${fragment}`);
  return fragment.slice(2).split("/").reduce((value, token) => {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!value || !Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`Unresolvable schema pointer: ${fragment}`);
    return value[key];
  }, root);
}

function resolveRef(ref, currentRoot, schemas) {
  const hashIndex = ref.indexOf("#");
  const base = hashIndex >= 0 ? ref.slice(0, hashIndex) : ref;
  const fragment = hashIndex >= 0 ? ref.slice(hashIndex) : "#";
  let root = currentRoot;
  if (base) {
    root = schemas.get(base) || schemas.get(path.basename(base));
    if (!root) throw new Error(`Unknown schema reference: ${ref}`);
  }
  return { schema: pointerGet(root, fragment), root };
}

function actualType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function typeMatches(value, expected) {
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "null") return value === null;
  return typeof value === expected;
}

function validateSchemaValue(value, schema, options) {
  const { schemas, rootSchema, errors, record, fieldPath } = options;
  if (!schema || Object.keys(schema).length === 0) return;

  if (schema.$ref) {
    try {
      const resolved = resolveRef(schema.$ref, rootSchema, schemas);
      validateSchemaValue(value, resolved.schema, { ...options, rootSchema: resolved.root });
    } catch (error) {
      addError(errors, "SCHEMA_REFERENCE_ERROR", record, fieldPath, error.message);
    }
    return;
  }

  if (schema.anyOf) {
    const candidates = schema.anyOf.map((candidate) => {
      const candidateErrors = [];
      validateSchemaValue(value, candidate, { ...options, errors: candidateErrors });
      return candidateErrors;
    });
    if (!candidates.some((candidateErrors) => candidateErrors.length === 0)) {
      addError(errors, "SCHEMA_ANY_OF", record, fieldPath, "Value does not satisfy any allowed schema.");
    }
    return;
  }

  if (schema.oneOf) {
    const passing = schema.oneOf.filter((candidate) => {
      const candidateErrors = [];
      validateSchemaValue(value, candidate, { ...options, errors: candidateErrors });
      return candidateErrors.length === 0;
    }).length;
    if (passing !== 1) addError(errors, "SCHEMA_ONE_OF", record, fieldPath, "Value must satisfy exactly one allowed schema.");
    return;
  }

  if (Object.prototype.hasOwnProperty.call(schema, "const") && stableStringify(value) !== stableStringify(schema.const)) {
    addError(errors, "SCHEMA_CONST", record, fieldPath, `Expected constant value ${JSON.stringify(schema.const)}.`);
    return;
  }

  if (schema.enum && !schema.enum.some((candidate) => stableStringify(candidate) === stableStringify(value))) {
    addError(errors, "SCHEMA_ENUM", record, fieldPath, `Value is not in the allowed set: ${schema.enum.join(", ")}.`);
    return;
  }

  if (schema.type && !typeMatches(value, schema.type)) {
    addError(errors, "SCHEMA_TYPE", record, fieldPath, `Expected ${schema.type}; received ${actualType(value)}.`);
    return;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) addError(errors, "SCHEMA_MIN_LENGTH", record, fieldPath, `String must contain at least ${schema.minLength} character(s).`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) addError(errors, "SCHEMA_MAX_LENGTH", record, fieldPath, `String must contain at most ${schema.maxLength} character(s).`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) addError(errors, "SCHEMA_PATTERN", record, fieldPath, `String does not match required pattern ${schema.pattern}.`);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) addError(errors, "SCHEMA_NUMBER", record, fieldPath, "Number must be finite.");
    if (schema.minimum !== undefined && value < schema.minimum) addError(errors, "SCHEMA_MINIMUM", record, fieldPath, `Number must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) addError(errors, "SCHEMA_MAXIMUM", record, fieldPath, `Number must be at most ${schema.maximum}.`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) addError(errors, "SCHEMA_MIN_ITEMS", record, fieldPath, `Array must contain at least ${schema.minItems} item(s).`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) addError(errors, "SCHEMA_MAX_ITEMS", record, fieldPath, `Array must contain at most ${schema.maxItems} item(s).`);
    if (schema.uniqueItems) {
      const unique = new Set(value.map(stableStringify));
      if (unique.size !== value.length) addError(errors, "SCHEMA_UNIQUE_ITEMS", record, fieldPath, "Array items must be unique.");
    }
    if (schema.items) value.forEach((item, index) => validateSchemaValue(item, schema.items, { ...options, fieldPath: `${fieldPath}[${index}]` }));
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) addError(errors, "SCHEMA_REQUIRED", record, `${fieldPath}.${required}`, `Required property ${required} is missing.`);
    }
    for (const key of Object.keys(value).sort()) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateSchemaValue(value[key], properties[key], { ...options, fieldPath: `${fieldPath}.${key}` });
      } else if (schema.additionalProperties === false) {
        addError(errors, "SCHEMA_ADDITIONAL_PROPERTY", record, `${fieldPath}.${key}`, `Unexpected property ${key}.`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validateSchemaValue(value[key], schema.additionalProperties, { ...options, fieldPath: `${fieldPath}.${key}` });
      }
    }
  }
}

function validateSchemas(collections, schemaDir, errors) {
  let schemas;
  try {
    schemas = loadSchemas(schemaDir);
  } catch (error) {
    addError(errors, "SCHEMA_LOAD_ERROR", null, "$", error.message);
    return;
  }
  for (const [collection, records] of Object.entries(collections)) {
    const schemaName = COLLECTIONS[collection].schema;
    const rootSchema = schemas.get(schemaName);
    if (!rootSchema) {
      addError(errors, "MISSING_SCHEMA", { collection, file: null, id: null }, "$", `Missing schema ${schemaName}.`);
      continue;
    }
    for (const record of records) validateSchemaValue(record.data, rootSchema, { schemas, rootSchema, errors, record, fieldPath: "$" });
  }
}

module.exports = { loadSchemas, validateSchemaValue, validateSchemas };
