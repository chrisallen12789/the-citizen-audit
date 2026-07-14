const fs = require("fs");
const path = require("path");
const { normalizeRelativePath } = require("../transactions/validate");
const { sha256 } = require("../lib/append-only-log");
const { institutionFile } = require("../execution/path-safety");

// Capture-level operations. These map onto the transaction layer's
// write/delete operations but additionally assert create-vs-update intent
// against current governed state.
const CAPTURE_OPERATIONS = Object.freeze(["create", "update", "delete"]);

function governedExists(rootDir, relativePath) {
  // institutionFile safe-resolves and throws on symlink components; if it
  // resolves, existence is a plain check.
  return fs.existsSync(institutionFile(rootDir, relativePath));
}

// Validate and normalize a list of raw proposed writes captured from an agent.
// Rejects path traversal, absolute paths, backslashes, symlinked components,
// duplicate/conflicting targets, and create/update/delete state mismatches.
// Returns { writes, problems } where writes use transaction operations
// (write | delete) and carry a content hash for write operations.
function validateProposedWrites(rootDir, rawWrites) {
  const problems = [];
  const writes = [];
  const seen = new Set();

  if (!Array.isArray(rawWrites)) return { writes: [], problems: ["Proposed writes must be an array."] };

  for (let index = 0; index < rawWrites.length; index += 1) {
    const raw = rawWrites[index];
    const label = `proposedWrites[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      problems.push(`${label}: must be an object.`);
      continue;
    }
    if (!CAPTURE_OPERATIONS.includes(raw.operation)) {
      problems.push(`${label}: invalid operation ${raw.operation}.`);
      continue;
    }

    let relativePath;
    try {
      relativePath = normalizeRelativePath(raw.path);
    } catch (error) {
      problems.push(`${label}: ${error.message}.`);
      continue;
    }

    if (seen.has(relativePath)) {
      problems.push(`${label}: duplicate or conflicting operation on ${relativePath}.`);
      continue;
    }
    seen.add(relativePath);

    // Symlink / non-directory component detection under the governed root.
    let exists;
    try {
      exists = governedExists(rootDir, relativePath);
    } catch (error) {
      problems.push(`${label}: ${error.message}`);
      continue;
    }

    if (raw.operation === "create" && exists) {
      problems.push(`${label}: create target already exists: ${relativePath}.`);
      continue;
    }
    if (raw.operation === "update" && !exists) {
      problems.push(`${label}: update target does not exist: ${relativePath}.`);
      continue;
    }
    if (raw.operation === "delete") {
      if (!exists) {
        problems.push(`${label}: delete target does not exist: ${relativePath}.`);
        continue;
      }
      writes.push({ operation: "delete", path: relativePath });
      continue;
    }

    if (typeof raw.content !== "string") {
      problems.push(`${label}: ${raw.operation} requires string content.`);
      continue;
    }
    const encoding = raw.encoding || "utf8";
    if (encoding !== "utf8" && encoding !== "base64") {
      problems.push(`${label}: unsupported encoding ${encoding}.`);
      continue;
    }
    const bytes = Buffer.from(raw.content, encoding);
    writes.push({ operation: "write", path: relativePath, content: raw.content, encoding, contentHash: sha256(bytes) });
  }

  return { writes, problems };
}

module.exports = { CAPTURE_OPERATIONS, validateProposedWrites };
