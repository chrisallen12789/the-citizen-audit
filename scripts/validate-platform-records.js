#!/usr/bin/env node
"use strict";

const path = require("path");
const { validatePlatformRecords } = require("./platform/validator");

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, "..");
const result = validatePlatformRecords({ rootDir });

if (result.valid) {
  const total = Object.values(result.counts).reduce((sum, count) => sum + count, 0);
  process.stdout.write(`Public platform records valid: ${total} record(s).\n`);
  for (const [collection, count] of Object.entries(result.counts)) process.stdout.write(`- ${collection}: ${count}\n`);
  process.exit(0);
}

process.stderr.write(`Public platform validation failed with ${result.errors.length} error(s).\n`);
for (const error of result.errors) {
  const location = [error.file, error.path].filter(Boolean).join(":");
  process.stderr.write(`- [${error.code}] ${location || "platform"}: ${error.message}\n`);
}
process.exit(1);
