const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const publication = require("./publication-data");
const { createDataOutputBuilders } = require("./build/data-outputs");
const { createPageRenderer } = require("./renderers/page-model");
const { createRelationships } = require("./renderers/relationships");
const { createSectionRenderer } = require("./renderers/sections");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const CANONICAL_PDF_SHA256 = "30d7a44cfedf8b5c654466dd69a0f18b3e93837b18dba0c1f2db4b71fb0f1a49";
const CANONICAL_PDF_BYTES = 1425061;
const PUBLIC_PDF_PATH = "public/downloads/the-citizen-audit-v1.0.pdf";
const STYLESHEET_PATH = "public/audit-reader.css";
const STYLESHEET_LINK = '<link rel="stylesheet" href="/audit-reader.css">';

function compareCodePoints(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function routeToPublicPath(route) {
  const pathname = route.split(/[?#]/, 1)[0];
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  return toPosix(path.posix.join("public", relative.endsWith("/") ? `${relative}index.html` : relative));
}

function parseArguments(argv) {
  let canonicalPdfPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--canonical-pdf") {
      return { error: "unsupported argument" };
    }
    if (canonicalPdfPath !== null) {
      return { error: "duplicate --canonical-pdf argument" };
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
      return { error: "--canonical-pdf requires a path" };
    }
    canonicalPdfPath = argv[index + 1];
    index += 1;
  }
  if (canonicalPdfPath === null) {
    return { error: "--canonical-pdf is required" };
  }
  return { canonicalPdfPath };
}

function buildExpectedReaderOutputs({ rootDir = DEFAULT_ROOT } = {}) {
  const publicDir = path.join(rootDir, "public");
  const auditPage = publication.pages.find((page) => page.id === "PAGE-AUDIT");
  const appendixPages = ["PAGE-APPENDIX-A", "PAGE-APPENDIX-B"].map((id) =>
    publication.pages.find((page) => page.id === id)
  );
  const numberedSections = publication.sections.filter((section) => /^Section \d+$/.test(section.id));

  if (!auditPage || appendixPages.some((page) => !page) || numberedSections.length !== 16) {
    throw new Error("approved reader model cardinality is unavailable");
  }

  const { renderPublicationPage } = createPageRenderer(publication);
  const { renderSectionPage } = createSectionRenderer(publication, createRelationships(publication));
  const { buildSearchIndex } = createDataOutputBuilders(publication, publicDir);
  const outputs = new Map();

  outputs.set(routeToPublicPath(auditPage.url), renderPublicationPage(auditPage));
  for (const section of numberedSections) {
    outputs.set(routeToPublicPath(section.url), renderSectionPage(section));
  }
  for (const page of appendixPages) {
    outputs.set(routeToPublicPath(page.url), renderPublicationPage(page));
  }
  outputs.set("public/data/publication-search.json", `${JSON.stringify(buildSearchIndex(), null, 2)}\n`);

  return outputs;
}

function failureRecord(relativePath, reason, details = {}) {
  return {
    path: toPosix(relativePath),
    reason,
    ...details
  };
}

function describeTextMismatch(relativePath, expectedText, actualText) {
  const expected = Buffer.from(normalizeText(expectedText), "utf8");
  const actual = Buffer.from(normalizeText(actualText), "utf8");
  return failureRecord(relativePath, "content mismatch", {
    expectedSha256: sha256(expected),
    actualSha256: sha256(actual),
    expectedBytes: expected.length,
    actualBytes: actual.length
  });
}

function describeMissing(relativePath, expectedText) {
  const expected = Buffer.from(normalizeText(expectedText), "utf8");
  return failureRecord(relativePath, "missing", {
    expectedSha256: sha256(expected),
    actualSha256: "<absent>",
    expectedBytes: expected.length,
    actualBytes: "<absent>"
  });
}

function validatePdf(filePath, diagnosticPath, failures) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    failures.push(
      failureRecord(diagnosticPath, "missing", {
        expectedSha256: CANONICAL_PDF_SHA256,
        actualSha256: "<absent>",
        expectedBytes: CANONICAL_PDF_BYTES,
        actualBytes: "<absent>"
      })
    );
    return;
  }

  const content = fs.readFileSync(filePath);
  const actualSha256 = sha256(content);
  if (actualSha256 !== CANONICAL_PDF_SHA256 || content.length !== CANONICAL_PDF_BYTES) {
    failures.push(
      failureRecord(diagnosticPath, "PDF mismatch", {
        expectedSha256: CANONICAL_PDF_SHA256,
        actualSha256,
        expectedBytes: CANONICAL_PDF_BYTES,
        actualBytes: content.length
      })
    );
  }
}

function validateReaderOutputs({ rootDir = DEFAULT_ROOT, canonicalPdfPath } = {}) {
  const failures = [];
  if (!canonicalPdfPath) {
    failures.push(failureRecord("canonical-pdf-source", "invalid argument"));
    return failures;
  }

  let expectedOutputs;
  try {
    expectedOutputs = buildExpectedReaderOutputs({ rootDir });
  } catch {
    failures.push(failureRecord("reader-output-manifest", "model cardinality mismatch"));
    return failures;
  }

  const expectedAuditFiles = [...expectedOutputs.keys()]
    .filter((relativePath) => relativePath.startsWith("public/audit/") && relativePath.endsWith(".html"))
    .sort(compareCodePoints);
  const auditDir = path.join(rootDir, "public", "audit");
  const actualAuditFiles = fs.existsSync(auditDir)
    ? fs
        .readdirSync(auditDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
        .map((entry) => `public/audit/${entry.name}`)
        .sort(compareCodePoints)
    : [];
  const expectedAuditSet = new Set(expectedAuditFiles);

  for (const relativePath of actualAuditFiles) {
    if (!expectedAuditSet.has(relativePath)) {
      const actual = Buffer.from(
        normalizeText(fs.readFileSync(path.join(rootDir, ...relativePath.split("/")), "utf8")),
        "utf8"
      );
      failures.push(
        failureRecord(relativePath, "unexpected", {
          expectedSha256: "<absent>",
          actualSha256: sha256(actual),
          expectedBytes: "<absent>",
          actualBytes: actual.length
        })
      );
    }
  }

  for (const [relativePath, expectedText] of expectedOutputs) {
    const absolutePath = path.join(rootDir, ...relativePath.split("/"));
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      failures.push(describeMissing(relativePath, expectedText));
      continue;
    }
    const actualText = fs.readFileSync(absolutePath, "utf8");
    if (normalizeText(actualText) !== normalizeText(expectedText)) {
      failures.push(describeTextMismatch(relativePath, expectedText, actualText));
    }
  }

  const stylesheetAbsolutePath = path.join(rootDir, ...STYLESHEET_PATH.split("/"));
  if (!fs.existsSync(stylesheetAbsolutePath) || !fs.statSync(stylesheetAbsolutePath).isFile()) {
    failures.push(failureRecord(STYLESHEET_PATH, "stylesheet missing"));
  }

  for (const [relativePath] of expectedOutputs) {
    if (!relativePath.endsWith(".html")) continue;
    const absolutePath = path.join(rootDir, ...relativePath.split("/"));
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
    const actualText = fs.readFileSync(absolutePath, "utf8");
    if (!actualText.includes(STYLESHEET_LINK)) {
      failures.push(failureRecord(relativePath, "stylesheet unlinked"));
    }
  }

  validatePdf(canonicalPdfPath, "canonical-pdf-source", failures);
  validatePdf(path.join(rootDir, ...PUBLIC_PDF_PATH.split("/")), PUBLIC_PDF_PATH, failures);

  return failures.sort((a, b) => {
    const pathOrder = compareCodePoints(a.path, b.path);
    return pathOrder || compareCodePoints(a.reason, b.reason);
  });
}

function formatFailure(record) {
  const fields = [`- ${record.path}: ${record.reason}`];
  if (record.detail !== undefined) fields.push(`detail=${record.detail}`);
  if (record.expectedSha256 !== undefined) fields.push(`expected-sha256=${record.expectedSha256}`);
  if (record.actualSha256 !== undefined) fields.push(`actual-sha256=${record.actualSha256}`);
  if (record.expectedBytes !== undefined) fields.push(`expected-bytes=${record.expectedBytes}`);
  if (record.actualBytes !== undefined) fields.push(`actual-bytes=${record.actualBytes}`);
  return fields.join("; ");
}

function runCli(argv = process.argv.slice(2)) {
  const parsed = parseArguments(argv);
  if (parsed.error) {
    console.error("Reader output freshness failed:");
    console.error(
      formatFailure(failureRecord("canonical-pdf-source", "invalid argument", { detail: parsed.error }))
    );
    return 1;
  }

  let failures;
  try {
    failures = validateReaderOutputs({ canonicalPdfPath: parsed.canonicalPdfPath });
  } catch {
    failures = [failureRecord("reader-output-validator", "internal validation error")];
  }
  if (failures.length) {
    console.error("Reader output freshness failed:");
    for (const failure of failures) console.error(formatFailure(failure));
    return 1;
  }

  console.log("Reader output freshness passed: 19 HTML files, 1 JSON file, stylesheet linkage, and canonical PDF identity verified.");
  return 0;
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  CANONICAL_PDF_BYTES,
  CANONICAL_PDF_SHA256,
  PUBLIC_PDF_PATH,
  STYLESHEET_LINK,
  STYLESHEET_PATH,
  buildExpectedReaderOutputs,
  compareCodePoints,
  formatFailure,
  normalizeText,
  parseArguments,
  runCli,
  sha256,
  validateReaderOutputs
};
