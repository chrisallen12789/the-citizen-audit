const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const registryFile = path.join(root, "kernel", "registry", "institution.json");

const validTypes = [
  "system",
  "doctrine",
  "engine",
  "registry",
  "schema",
  "report",
  "agent",
  "department"
];

const requiredSystems = [
  "SYSTEM-INSTITUTION",
  "SYSTEM-KERNEL",
  "SYSTEM-MEMORY",
  "SYSTEM-WORKFORCE",
  "SYSTEM-PLATFORM",
  "SYSTEM-AUDITS",
  "SYSTEM-SCHEMAS"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function existsInRepo(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function validateRegistry(registry) {
  const problems = [];
  const warnings = [];
  const ids = new Set();
  const paths = new Map();
  const objects = Array.isArray(registry.objects) ? registry.objects : [];

  if (!registry.version) problems.push("Registry missing version.");
  if (!registry.updated) problems.push("Registry missing updated date.");
  if (!Array.isArray(registry.objects)) problems.push("Registry objects must be an array.");

  for (const item of objects) {
    const label = item && item.id ? item.id : "UNKNOWN";

    for (const field of ["id", "type", "name", "path", "description"]) {
      if (!item || !item[field]) problems.push(`${label}: missing ${field}.`);
    }

    if (!item || !item.id) continue;

    if (ids.has(item.id)) problems.push(`${item.id}: duplicate id.`);
    ids.add(item.id);

    if (item.type && !validTypes.includes(item.type)) problems.push(`${item.id}: invalid type ${item.type}.`);
    if (item.path && !existsInRepo(item.path)) problems.push(`${item.id}: missing path ${item.path}.`);

    if (item.path) {
      if (!paths.has(item.path)) paths.set(item.path, []);
      paths.get(item.path).push(item.id);
    }
  }

  for (const id of requiredSystems) {
    if (!ids.has(id)) problems.push(`Missing required system: ${id}.`);
  }

  for (const [registeredPath, pathIds] of paths.entries()) {
    if (pathIds.length > 1) warnings.push(`Multiple objects use ${registeredPath}: ${pathIds.join(", ")}.`);
  }

  return {
    objectCount: objects.length,
    problems,
    warnings
  };
}

function report(result) {
  console.log("Citizen Audit Institution Registry Validation");
  console.log("");
  console.log(`Objects: ${result.objectCount}`);
  console.log(`Problems: ${result.problems.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log("");

  if (result.problems.length) {
    console.log("Problems:");
    for (const problem of result.problems) console.log(`- ${problem}`);
    console.log("");
  }

  if (result.warnings.length) {
    console.log("Warnings:");
    for (const warning of result.warnings) console.log(`- ${warning}`);
    console.log("");
  }

  console.log(result.problems.length ? "Institution registry: FAIL" : "Institution registry: PASS");
}

module.exports = { validateRegistry, validTypes, requiredSystems };

if (require.main === module) {
  const result = validateRegistry(readJson(registryFile));
  report(result);
  if (result.problems.length) process.exitCode = 1;
}
