#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_MANIFEST_HEADERS = [
  "source_id",
  "canonical_url",
  "save_page_now_url",
  "capture_url_recorded",
  "sha256_recorded",
  "archive_status",
  "archive_date",
  "verified_by",
  "archive_failure_date",
  "archive_failure_reason",
  "archive_attempted_url"
];

const HEADER_ALIASES = {
  status: "archive_status",
  archive_url: "capture_url_recorded",
  capture_date: "archive_date",
  sha256: "sha256_recorded",
  verifier: "verified_by",
  failure_date: "archive_failure_date",
  failure_reason: "archive_failure_reason",
  attempted_url: "archive_attempted_url"
};

const PRESERVED_EVIDENCE_HEADERS = [
  "archive_status",
  "capture_url_recorded",
  "sha256_recorded",
  "archive_date",
  "verified_by",
  "archive_failure_date",
  "archive_failure_reason",
  "archive_attempted_url",
  "notes"
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      value = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function encodeCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          if (/[",\r\n]/.test(text)) {
            return `"${text.replace(/"/g, "\"\"")}"`;
          }
          return text;
        })
        .join(",")
    )
    .join("\r\n");
}

function normalizeHeaderName(header) {
  const normalized = String(header || "").trim().toLowerCase();
  return HEADER_ALIASES[normalized] || normalized;
}

function normalizeHeaders(headers) {
  return headers.map((header) => normalizeHeaderName(header));
}

function rowToRecord(headers, row) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = String(row[index] || "").trim();
  });
  return record;
}

function recordToRow(headers, record) {
  return headers.map((header) => String(record[header] || ""));
}

function trimValue(value) {
  return String(value || "").trim();
}

function hasOwn(object, property) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, property);
}

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(trimValue(value));
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(trimValue(value));
}

function normalizeComparableUrl(value) {
  return trimValue(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function normalizeComparableHash(value) {
  return trimValue(value).toLowerCase();
}

function normalizeStatus(value) {
  return trimValue(value).toUpperCase();
}

function buildSavePageNowUrl(canonicalUrl) {
  return `https://web.archive.org/save/${canonicalUrl}`;
}

function parseAnnotatedUrlField(value) {
  const raw = trimValue(value);
  if (!raw) {
    return { canonicalUrl: "", annotation: "" };
  }

  const match = raw.match(/https?:\/\/\S+/i);
  if (!match) {
    return { canonicalUrl: "", annotation: raw };
  }

  const canonicalUrl = match[0];
  const annotation = raw.slice(match.index + canonicalUrl.length).trim();
  return { canonicalUrl, annotation };
}

function ensureHeaders(headers) {
  const normalized = normalizeHeaders(headers);
  const combined = [...normalized];
  for (const header of DEFAULT_MANIFEST_HEADERS) {
    if (!combined.includes(header)) {
      combined.push(header);
    }
  }
  return combined;
}

function combineHeaders(...headerSets) {
  const combined = [];
  for (const headers of headerSets) {
    for (const header of ensureHeaders(headers || [])) {
      if (!combined.includes(header)) {
        combined.push(header);
      }
    }
  }
  return combined.length ? combined : [...DEFAULT_MANIFEST_HEADERS];
}

function readCsvFile(filePath, { ensureManifestHeaders = false } = {}) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new Error(`${filePath} is empty.`);
  }

  const headers = ensureManifestHeaders ? ensureHeaders(rows[0]) : normalizeHeaders(rows[0]);
  const records = rows.slice(1).map((row) => rowToRecord(headers, row));
  return { headers, records };
}

function loadManifestConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    manifestSourceIds: Array.isArray(config.manifestSourceIds) ? config.manifestSourceIds : [],
    sourceOverrides: Array.isArray(config.sourceOverrides) ? config.sourceOverrides : [],
    duplicateCanonicalUrlWhitelist: Array.isArray(config.duplicateCanonicalUrlWhitelist)
      ? config.duplicateCanonicalUrlWhitelist
      : [],
    duplicateSha256Whitelist: Array.isArray(config.duplicateSha256Whitelist)
      ? config.duplicateSha256Whitelist
      : []
  };
}

function createSourceOverrideMap(config) {
  return new Map(
    (config.sourceOverrides || []).map((override) => [
      override.sourceId,
      {
        canonicalUrl: trimValue(override.canonicalUrl),
        reason: trimValue(override.reason)
      }
    ])
  );
}

function createManifestSourceIdSet(config) {
  return new Set((config.manifestSourceIds || []).map((value) => trimValue(value)).filter(Boolean));
}

function applySourceOverride(sourceId, parsedUrl, overrideMap) {
  const override = overrideMap.get(sourceId);
  if (!override) {
    return {
      canonicalUrl: parsedUrl.canonicalUrl,
      annotation: parsedUrl.annotation,
      overrideReason: ""
    };
  }

  return {
    canonicalUrl: override.canonicalUrl,
    annotation: parsedUrl.annotation,
    overrideReason: override.reason
  };
}

function getManifestHeaders(existingHeaders) {
  return combineHeaders(existingHeaders);
}

function buildTemplateManifestRow(sourceRecord, existingRecord, headers, overrideMap) {
  const sourceId = trimValue(sourceRecord.source_id);
  if (!sourceId) {
    throw new Error("Source-library row is missing source_id.");
  }

  const parsedUrl = parseAnnotatedUrlField(sourceRecord.url);
  const resolved = applySourceOverride(sourceId, parsedUrl, overrideMap);
  const canonicalUrl = trimValue(resolved.canonicalUrl);
  if (!isHttpUrl(canonicalUrl)) {
    throw new Error(
      `${sourceId}: canonical URL could not be resolved from source-library field "${sourceRecord.url}".`
    );
  }

  const next = {};
  for (const header of headers) {
    if (header === "source_id") {
      next[header] = sourceId;
      continue;
    }
    if (header === "canonical_url") {
      next[header] = canonicalUrl;
      continue;
    }
    if (header === "save_page_now_url") {
      next[header] = buildSavePageNowUrl(canonicalUrl);
      continue;
    }

    if (existingRecord && hasOwn(existingRecord, header)) {
      next[header] = trimValue(existingRecord[header]);
      continue;
    }

    next[header] = "";
  }

  if (!next.archive_status) {
    next.archive_status = "PENDING";
  }

  return {
    record: next,
    annotation: resolved.annotation,
    overrideReason: resolved.overrideReason
  };
}

function sameSourceSet(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function isDuplicateWhitelisted(type, comparableValue, sourceIds, config) {
  const whitelist =
    type === "canonical"
      ? config.duplicateCanonicalUrlWhitelist || []
      : config.duplicateSha256Whitelist || [];

  const normalizedSourceIds = [...sourceIds].sort();
  return whitelist.some((entry) => {
    const reason = trimValue(entry.reason);
    const entrySourceIds = Array.isArray(entry.sourceIds)
      ? entry.sourceIds.map((value) => trimValue(value)).filter(Boolean).sort()
      : [];
    const entryValue =
      type === "canonical"
        ? normalizeComparableUrl(entry.value)
        : normalizeComparableHash(entry.value);
    return Boolean(reason) && entryValue === comparableValue && sameSourceSet(entrySourceIds, normalizedSourceIds);
  });
}

function validateManifestRows(records, config) {
  const problems = [];
  const sourceIds = new Set();
  const canonicalBuckets = new Map();
  const hashBuckets = new Map();

  for (const record of records) {
    const sourceId = trimValue(record.source_id);
    if (!sourceId) {
      problems.push("Manifest row is missing source_id.");
      continue;
    }
    if (sourceIds.has(sourceId)) {
      problems.push(`Duplicate manifest source_id ${sourceId}.`);
    }
    sourceIds.add(sourceId);

    const canonicalUrl = trimValue(record.canonical_url);
    if (!isHttpUrl(canonicalUrl)) {
      problems.push(`${sourceId}: canonical_url is missing or invalid.`);
    } else {
      const key = normalizeComparableUrl(canonicalUrl);
      if (!canonicalBuckets.has(key)) {
        canonicalBuckets.set(key, []);
      }
      canonicalBuckets.get(key).push(sourceId);
    }

    const hash = trimValue(record.sha256_recorded);
    if (isSha256(hash)) {
      const key = normalizeComparableHash(hash);
      if (!hashBuckets.has(key)) {
        hashBuckets.set(key, []);
      }
      hashBuckets.get(key).push(sourceId);
    }
  }

  for (const [key, groupedSourceIds] of canonicalBuckets.entries()) {
    if (groupedSourceIds.length < 2) {
      continue;
    }
    if (!isDuplicateWhitelisted("canonical", key, groupedSourceIds, config)) {
      problems.push(
        `Duplicate canonical URL detected for source IDs ${groupedSourceIds.join(", ")}: ${key}`
      );
    }
  }

  for (const [key, groupedSourceIds] of hashBuckets.entries()) {
    if (groupedSourceIds.length < 2) {
      continue;
    }
    if (!isDuplicateWhitelisted("sha256", key, groupedSourceIds, config)) {
      problems.push(
        `Duplicate SHA-256 detected for source IDs ${groupedSourceIds.join(", ")}: ${key}`
      );
    }
  }

  if (problems.length) {
    throw new Error(`Archive manifest validation failed:\n- ${problems.join("\n- ")}`);
  }
}

function extractArchivedTargetUrl(value) {
  const captureUrl = trimValue(value);
  const match = captureUrl.match(/^https?:\/\/web\.archive\.org\/web\/[^/]+\/(https?:\/\/.+)$/i);
  if (match) {
    return trimValue(match[1]);
  }
  return captureUrl;
}

function archiveEvidenceMatchesCanonical(record, canonicalUrl) {
  const targetUrl = extractArchivedTargetUrl(record.capture_url_recorded);
  return (
    isHttpUrl(canonicalUrl) &&
    isHttpUrl(targetUrl) &&
    normalizeComparableUrl(targetUrl) === normalizeComparableUrl(canonicalUrl) &&
    isSha256(record.sha256_recorded) &&
    Boolean(trimValue(record.archive_date)) &&
    Boolean(trimValue(record.verified_by))
  );
}

function buildMergeReport() {
  return {
    rowsPreserved: 0,
    canonicalUrlsChanged: 0,
    rowsDowngradedToNeedsRecapture: 0,
    attemptedUnsafeOverwritesBlocked: 0
  };
}

function chooseProtectedValue(header, correctionRecord, authoritativeRecord, options) {
  const authoritativeHas = hasOwn(authoritativeRecord, header);
  const correctionHas = hasOwn(correctionRecord, header);
  const authoritativeValue = authoritativeHas ? trimValue(authoritativeRecord[header]) : "";
  const correctionValue = correctionHas ? trimValue(correctionRecord[header]) : "";

  if (authoritativeValue) {
    if (correctionHas && correctionValue === "" && !options.forceEmpty) {
      options.report.attemptedUnsafeOverwritesBlocked += 1;
    }
    if (correctionHas && correctionValue === "" && options.forceEmpty) {
      return "";
    }
    return authoritativeValue;
  }

  if (correctionHas) {
    return correctionValue;
  }

  return "";
}

function chooseSupplementalValue(header, correctionRecord, authoritativeRecord, options) {
  const authoritativeHas = hasOwn(authoritativeRecord, header);
  const correctionHas = hasOwn(correctionRecord, header);
  const authoritativeValue = authoritativeHas ? trimValue(authoritativeRecord[header]) : "";
  const correctionValue = correctionHas ? trimValue(correctionRecord[header]) : "";

  if (correctionHas && correctionValue) {
    return correctionValue;
  }

  if (authoritativeValue) {
    if (correctionHas && correctionValue === "" && !options.forceEmpty) {
      options.report.attemptedUnsafeOverwritesBlocked += 1;
      return authoritativeValue;
    }
    if (correctionHas && correctionValue === "" && options.forceEmpty) {
      return "";
    }
    return authoritativeValue;
  }

  if (correctionHas) {
    return correctionValue;
  }

  return "";
}

function mergeAuthoritativeRow(correctionRecord, authoritativeRecord, headers, options) {
  const sourceId = trimValue(correctionRecord?.source_id || authoritativeRecord?.source_id);
  if (!sourceId) {
    throw new Error("Merge row is missing source_id.");
  }

  const finalCanonicalUrl = trimValue(correctionRecord?.canonical_url || authoritativeRecord?.canonical_url);
  if (!isHttpUrl(finalCanonicalUrl)) {
    throw new Error(`${sourceId}: canonical_url is missing or invalid in merge mode.`);
  }

  const authoritativeCanonicalUrl = trimValue(authoritativeRecord?.canonical_url);
  const canonicalChanged =
    Boolean(authoritativeCanonicalUrl) &&
    normalizeComparableUrl(authoritativeCanonicalUrl) !== normalizeComparableUrl(finalCanonicalUrl);

  const next = {};

  for (const header of headers) {
    if (header === "source_id") {
      next[header] = sourceId;
      continue;
    }
    if (header === "canonical_url") {
      next[header] = finalCanonicalUrl;
      continue;
    }
    if (header === "save_page_now_url") {
      next[header] = buildSavePageNowUrl(finalCanonicalUrl);
      continue;
    }
    if (PRESERVED_EVIDENCE_HEADERS.includes(header)) {
      next[header] = chooseProtectedValue(header, correctionRecord, authoritativeRecord, options);
      continue;
    }
    next[header] = chooseSupplementalValue(header, correctionRecord, authoritativeRecord, options);
  }

  const authoritativeStatus = normalizeStatus(authoritativeRecord?.archive_status);
  if (!next.archive_status) {
    next.archive_status = trimValue(correctionRecord?.archive_status) || "PENDING";
  }

  if (canonicalChanged) {
    options.report.canonicalUrlsChanged += 1;
  }

  if (authoritativeRecord) {
    options.report.rowsPreserved += 1;
  }

  if (authoritativeStatus === "ATTEMPT_FAILED") {
    next.archive_status = "ATTEMPT_FAILED";
  } else if (authoritativeStatus === "NEEDS_RECAPTURE") {
    next.archive_status = "NEEDS_RECAPTURE";
  } else if (authoritativeStatus === "ARCHIVED") {
    if (canonicalChanged && !archiveEvidenceMatchesCanonical(next, finalCanonicalUrl)) {
      next.archive_status = "NEEDS_RECAPTURE";
      options.report.rowsDowngradedToNeedsRecapture += 1;
    } else {
      next.archive_status = "ARCHIVED";
    }
  } else if (authoritativeStatus) {
    next.archive_status = trimValue(authoritativeRecord.archive_status);
  }

  if (!next.archive_status) {
    next.archive_status = "PENDING";
  }

  return next;
}

function buildManifestFromSourceLibrary({
  sourceLibraryPath,
  existingManifestPath,
  configPath
}) {
  if (!sourceLibraryPath) {
    throw new Error("A source library path is required.");
  }
  if (!configPath) {
    throw new Error("A manifest config path is required.");
  }

  const config = loadManifestConfig(configPath);
  const overrideMap = createSourceOverrideMap(config);
  const manifestSourceIds = createManifestSourceIdSet(config);
  const { records: sourceRecords } = readCsvFile(sourceLibraryPath);
  const sourceById = new Map(sourceRecords.map((record) => [record.source_id, record]));

  const missingSourceIds = [...manifestSourceIds].filter((sourceId) => !sourceById.has(sourceId));
  if (missingSourceIds.length) {
    throw new Error(
      `Source library is missing archive-kit source IDs: ${missingSourceIds.join(", ")}.`
    );
  }

  const existingManifest =
    existingManifestPath && fs.existsSync(existingManifestPath)
      ? readCsvFile(existingManifestPath, { ensureManifestHeaders: true })
      : { headers: [...DEFAULT_MANIFEST_HEADERS], records: [] };
  const existingById = new Map(existingManifest.records.map((record) => [record.source_id, record]));
  const headers = getManifestHeaders(existingManifest.headers);

  const archiveKitOrder = config.manifestSourceIds.length
    ? [...config.manifestSourceIds]
    : sourceRecords.map((record) => record.source_id);

  const records = archiveKitOrder.map((sourceId) => {
    const sourceRecord = sourceById.get(sourceId);
    const existingRecord = existingById.get(sourceId);
    return buildTemplateManifestRow(sourceRecord, existingRecord, headers, overrideMap).record;
  });

  validateManifestRows(records, config);

  return {
    headers,
    records,
    csvText: `${encodeCsv([headers, ...records.map((record) => recordToRow(headers, record))])}\r\n`
  };
}

function validateManifestPreservation(currentRecords, authoritativeRecords) {
  const problems = [];
  const currentById = new Map(currentRecords.map((record) => [trimValue(record.source_id), record]));

  for (const authoritativeRecord of authoritativeRecords) {
    const sourceId = trimValue(authoritativeRecord.source_id);
    const currentRecord = currentById.get(sourceId);
    if (!currentRecord) {
      problems.push(`${sourceId}: authoritative manifest row is missing from the current manifest.`);
      continue;
    }

    for (const header of PRESERVED_EVIDENCE_HEADERS) {
      const authoritativeValue = trimValue(authoritativeRecord[header]);
      const currentValue = trimValue(currentRecord[header]);
      if (authoritativeValue && !currentValue) {
        problems.push(`${sourceId}: authoritative ${header} would be erased.`);
      }
    }

    const authoritativeStatus = normalizeStatus(authoritativeRecord.archive_status);
    const currentStatus = normalizeStatus(currentRecord.archive_status);
    const canonicalChanged =
      normalizeComparableUrl(authoritativeRecord.canonical_url) !==
      normalizeComparableUrl(currentRecord.canonical_url);

    if (authoritativeStatus === "ATTEMPT_FAILED" && currentStatus !== "ATTEMPT_FAILED") {
      problems.push(`${sourceId}: ATTEMPT_FAILED status must be preserved.`);
    }

    if (authoritativeStatus === "NEEDS_RECAPTURE" && currentStatus !== "NEEDS_RECAPTURE") {
      problems.push(`${sourceId}: NEEDS_RECAPTURE status must be preserved.`);
    }

    if (authoritativeStatus === "ARCHIVED") {
      if (currentStatus === "ARCHIVED") {
        continue;
      }
      if (currentStatus === "NEEDS_RECAPTURE" && canonicalChanged) {
        continue;
      }
      problems.push(
        `${sourceId}: ARCHIVED status would be demoted to ${currentStatus || "(blank)"} without an allowed canonical correction downgrade.`
      );
    }
  }

  if (problems.length) {
    throw new Error(`Archive manifest preservation failed:\n- ${problems.join("\n- ")}`);
  }
}

function countManifestStatuses(records) {
  const counts = {};
  for (const record of records) {
    const status = normalizeStatus(record.archive_status) || "PENDING";
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function mergeArchiveManifest({
  authoritativeManifestPath,
  correctionManifestPath,
  sourceLibraryPath,
  outputPath,
  configPath,
  forceEmpty = false
}) {
  if (!authoritativeManifestPath) {
    throw new Error("A merge input path is required.");
  }
  if (!configPath) {
    throw new Error("A manifest config path is required.");
  }
  if (!fs.existsSync(authoritativeManifestPath)) {
    throw new Error(`Authoritative manifest not found: ${authoritativeManifestPath}`);
  }

  const config = loadManifestConfig(configPath);
  const authoritativeManifest = readCsvFile(authoritativeManifestPath, { ensureManifestHeaders: true });
  const authoritativeById = new Map(
    authoritativeManifest.records.map((record) => [trimValue(record.source_id), record])
  );

  let correctionManifest;
  if (sourceLibraryPath) {
    correctionManifest = buildManifestFromSourceLibrary({
      sourceLibraryPath,
      existingManifestPath: correctionManifestPath,
      configPath
    });
  } else {
    const templatePath = correctionManifestPath || outputPath;
    if (!templatePath || !fs.existsSync(templatePath)) {
      throw new Error(
        "Merge mode requires either --source <source_library.csv> or an existing correction manifest/template file."
      );
    }
    correctionManifest = readCsvFile(templatePath, { ensureManifestHeaders: true });
  }

  const correctionById = new Map(
    correctionManifest.records.map((record) => [trimValue(record.source_id), record])
  );
  const manifestSourceIds = config.manifestSourceIds.length
    ? [...config.manifestSourceIds]
    : correctionManifest.records.map((record) => trimValue(record.source_id));
  const missingCorrectionIds = manifestSourceIds.filter((sourceId) => !correctionById.has(sourceId));
  if (missingCorrectionIds.length) {
    throw new Error(
      `Correction manifest is missing archive-kit source IDs: ${missingCorrectionIds.join(", ")}.`
    );
  }

  const headers = combineHeaders(correctionManifest.headers, authoritativeManifest.headers);
  const report = buildMergeReport();

  const mergedRecords = manifestSourceIds.map((sourceId) =>
    mergeAuthoritativeRow(correctionById.get(sourceId), authoritativeById.get(sourceId), headers, {
      forceEmpty,
      report
    })
  );

  validateManifestRows(mergedRecords, config);
  validateManifestPreservation(mergedRecords, authoritativeManifest.records);

  const csvRows = [headers, ...mergedRecords.map((record) => recordToRow(headers, record))];
  const csvText = `${encodeCsv(csvRows)}\r\n`;

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, csvText, "utf8");
  }

  return {
    headers,
    records: mergedRecords,
    csvText,
    report,
    statusCounts: countManifestStatuses(mergedRecords)
  };
}

function generateArchiveManifest({
  sourceLibraryPath,
  existingManifestPath,
  outputPath,
  configPath
}) {
  const result = buildManifestFromSourceLibrary({
    sourceLibraryPath,
    existingManifestPath,
    configPath
  });

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.csvText, "utf8");
  }

  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--")) {
      continue;
    }
    args[key.slice(2)] = value && !value.startsWith("--") ? value : "true";
    if (args[key.slice(2)] !== "true") {
      index += 1;
    }
  }
  return args;
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/archive-manifest-generator.js --source <source_library.csv> --output <archive_manifest.csv> [--existing <archive_manifest.csv>] [--config scripts/archive-manifest-config.json]",
      "  node scripts/archive-manifest-generator.js --merge <archive_manifest_authoritative.csv> [--output docs/archive_manifest.csv] [--source <source_library.csv>] [--existing <correction-template.csv>] [--force-empty] [--config scripts/archive-manifest-config.json]"
    ].join("\n")
  );
}

function printMergeSummary(result, outputPath) {
  const statusSummary = Object.entries(result.statusCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");

  console.log(`Merged ${result.records.length} archive manifest rows into ${outputPath}.`);
  console.log(`Rows preserved: ${result.report.rowsPreserved}`);
  console.log(`Canonical URLs changed: ${result.report.canonicalUrlsChanged}`);
  console.log(`Rows downgraded to NEEDS_RECAPTURE: ${result.report.rowsDowngradedToNeedsRecapture}`);
  console.log(`Attempted unsafe overwrites blocked: ${result.report.attemptedUnsafeOverwritesBlocked}`);
  console.log(`Status counts: ${statusSummary}`);
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const root = path.resolve(__dirname, "..");
    const configPath = path.resolve(root, args.config || "scripts/archive-manifest-config.json");

    if (args.merge) {
      const outputPath = path.resolve(root, args.output || "docs/archive_manifest.csv");
      const result = mergeArchiveManifest({
        authoritativeManifestPath: path.resolve(root, args.merge),
        correctionManifestPath: args.existing ? path.resolve(root, args.existing) : undefined,
        sourceLibraryPath: args.source ? path.resolve(root, args.source) : undefined,
        outputPath,
        configPath,
        forceEmpty: args["force-empty"] === "true"
      });
      printMergeSummary(result, outputPath);
      process.exit(0);
    }

    if (!args.source || !args.output) {
      printUsage();
      process.exit(1);
    }

    const result = generateArchiveManifest({
      sourceLibraryPath: path.resolve(root, args.source),
      existingManifestPath: args.existing ? path.resolve(root, args.existing) : undefined,
      outputPath: path.resolve(root, args.output),
      configPath
    });

    console.log(
      `Generated ${result.records.length} archive manifest rows into ${path.resolve(root, args.output)}.`
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_MANIFEST_HEADERS,
  PRESERVED_EVIDENCE_HEADERS,
  archiveEvidenceMatchesCanonical,
  buildSavePageNowUrl,
  countManifestStatuses,
  generateArchiveManifest,
  loadManifestConfig,
  mergeArchiveManifest,
  parseAnnotatedUrlField,
  parseCsv,
  readCsvFile,
  validateManifestPreservation,
  validateManifestRows
};
