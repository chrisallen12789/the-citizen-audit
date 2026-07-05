const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'registry', 'audits.json');
const AUDIT_STATUSES = ['draft', 'active', 'review', 'published', 'superseded', 'withdrawn'];

function fail(message) {
  console.error(`ADS validation failed: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(ROOT, filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function repoPath(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function validateAuditRecord(registryEntry) {
  if (!registryEntry.record) return;

  const recordPath = path.join(ROOT, registryEntry.record);
  assert(fs.existsSync(recordPath), `${registryEntry.id} record is missing: ${registryEntry.record}`);

  const audit = readJson(recordPath);
  if (!audit) return;

  assert(audit.id === registryEntry.id, `${registryEntry.id} record id mismatch`);
  assert(audit.adsVersion === '1.0.0', `${registryEntry.id} adsVersion must be 1.0.0`);
  assert(AUDIT_STATUSES.includes(audit.status), `${registryEntry.id} record has invalid status`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(audit.created), `${registryEntry.id} created must use YYYY-MM-DD`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(audit.updated), `${registryEntry.id} updated must use YYYY-MM-DD`);

  if (audit.records && typeof audit.records === 'object') {
    for (const [recordType, recordReference] of Object.entries(audit.records)) {
      const referencedPath = path.join(ROOT, recordReference);
      assert(fs.existsSync(referencedPath), `${audit.id} ${recordType} file is missing: ${recordReference}`);
      const referencedJson = readJson(referencedPath);
      assert(Array.isArray(referencedJson), `${audit.id} ${recordType} must be a JSON array: ${repoPath(referencedPath)}`);
    }
  }
}

function validateRegistry() {
  assert(fs.existsSync(REGISTRY_PATH), 'registry/audits.json is missing');
  const registry = readJson(REGISTRY_PATH);
  if (!registry) return;

  assert(registry.adsVersion === '1.0.0', 'registry adsVersion must be 1.0.0');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(registry.updated), 'registry updated must use YYYY-MM-DD');
  assert(Array.isArray(registry.audits), 'registry audits must be an array');

  const ids = new Set();
  for (const audit of registry.audits || []) {
    assert(/^AUD-\d{3}$/.test(audit.id), `invalid audit id: ${audit.id}`);
    assert(!ids.has(audit.id), `duplicate audit id: ${audit.id}`);
    ids.add(audit.id);
    assert(typeof audit.title === 'string' && audit.title.trim().length > 0, `${audit.id} title is required`);
    assert(AUDIT_STATUSES.includes(audit.status), `${audit.id} has invalid status`);
    assert(typeof audit.path === 'string' && audit.path.length > 0, `${audit.id} path is required`);
    validateAuditRecord(audit);
  }
}

function validateSchemasExist() {
  const requiredSchemas = [
    'audit.schema.json',
    'claim.schema.json',
    'source.schema.json',
    'decision.schema.json',
    'unknown.schema.json',
    'registry.schema.json'
  ];

  for (const schema of requiredSchemas) {
    const schemaPath = path.join(ROOT, 'schemas', 'ads', 'v1', schema);
    assert(fs.existsSync(schemaPath), `schemas/ads/v1/${schema} is missing`);
    readJson(schemaPath);
  }
}

validateSchemasExist();
validateRegistry();

if (!process.exitCode) {
  console.log('ADS validation passed.');
}
