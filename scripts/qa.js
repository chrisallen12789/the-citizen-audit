const fs = require("fs");
const path = require("path");
const publication = require("./publication-data");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(next));
      continue;
    }
    if (entry.name.endsWith(".html")) {
      results.push(next);
    }
  }
  return results;
}

function linkTargets(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

function fileExistsFromHref(href) {
  if (!href.startsWith("/")) {
    return true;
  }
  const cleanHref = href.split("#")[0].split("?")[0];
  const normalized = cleanHref === "/" ? "/index.html" : cleanHref;
  const filePath = path.join(publicDir, normalized.replace(/^\//, ""));
  if (fs.existsSync(filePath)) {
    return true;
  }
  if (fs.existsSync(path.join(filePath, "index.html"))) {
    return true;
  }
  return false;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function hasRequiredSourceMetadata(source) {
  const requiredStringFields = [
    "publisher",
    "documentType",
    "classification",
    "citationPriority",
    "urlVerificationStatus",
    "urlVerificationNote"
  ];
  return requiredStringFields.every(
    (field) => typeof source[field] === "string" && source[field].trim().length > 0
  );
}

const htmlFiles = walk(publicDir);
const problems = [];
const strictMetaFiles = new Set([
  "public/index.html",
  "public/audit.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/search.html",
  "public/explorer.html",
  "public/review.html",
  "public/release-notes.html",
  "public/version-history.html",
  "public/changelog.html",
  "public/audit/appendix-a-open-questions.html",
  "public/audit/appendix-b-transparency-scorecard.html",
  "public/downloads.html"
]);

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const relative = path.relative(root, filePath);
  if (!html.includes("<title>")) {
    problems.push(`${relative}: missing <title>`);
  }
  if (strictMetaFiles.has(relative) && !html.includes('meta name="description"')) {
    problems.push(`${relative}: missing meta description`);
  }
  if (
    html.includes("Ã‚") ||
    html.includes("Ã¢â‚¬â€") ||
    html.includes("Ã¢â‚¬â€œ") ||
    html.includes("Ã¢â‚¬")
  ) {
    problems.push(`${relative}: possible mojibake detected`);
  }
  for (const href of linkTargets(html)) {
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) {
      continue;
    }
    if (!fileExistsFromHref(href)) {
      problems.push(`${relative}: broken internal link ${href}`);
    }
  }
}

const requiredFiles = [
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/search.html",
  "public/explorer.html",
  "public/review.html",
  "public/release-notes.html",
  "public/version-history.html",
  "public/changelog.html",
  "public/audit/appendix-a-open-questions.html",
  "public/audit/appendix-b-transparency-scorecard.html",
  "public/data/publication-search.json",
  "public/data/trace-records.json",
  "public/data/platform-metrics.json"
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) {
    problems.push(`${relative}: required generated file missing`);
  }
}

for (const source of publication.sources) {
  if (!hasRequiredSourceMetadata(source)) {
    problems.push(`${source.id}: required source metadata missing`);
  }
  if (source.urlVerificationStatus === "verified" && !source.officialUrl) {
    problems.push(`${source.id}: verified source is missing officialUrl`);
  }
  if (source.citationPriority === "high" && !source.officialUrl) {
    problems.push(`${source.id}: high-priority citation lacks canonical URL`);
  }
  if (
    source.urlVerificationStatus === "pending" &&
    !source.urlVerificationNote.toLowerCase().includes("pending")
  ) {
    problems.push(`${source.id}: pending URL verification note must explain why verification is pending`);
  }
}

const sectionIds = new Set(publication.sectionRecords.map((section) => section.id));
const sourceIds = new Set(publication.sources.map((source) => source.id));
const decisionIds = new Set(publication.decisions.map((decision) => decision.id));
const openQuestionIds = new Set(publication.openQuestions.map((item) => item.id));

for (const claim of publication.traceClaims) {
  if (!sectionIds.has(claim.section)) {
    problems.push(`${claim.id}: trace claim references missing section ${claim.section}`);
  }
  if (!claim.sources.length) {
    problems.push(`${claim.id}: trace claim has no linked sources`);
  }
  for (const sourceId of claim.sources) {
    if (!sourceIds.has(sourceId)) {
      problems.push(`${claim.id}: trace claim references missing source ${sourceId}`);
    }
  }
  for (const decisionId of claim.decisions) {
    if (!decisionIds.has(decisionId)) {
      problems.push(`${claim.id}: trace claim references missing decision ${decisionId}`);
    }
  }
  for (const openQuestionId of claim.openQuestions) {
    if (!openQuestionIds.has(openQuestionId)) {
      problems.push(`${claim.id}: trace claim references missing open question ${openQuestionId}`);
    }
  }
}

const traceRecords = readJson("public/data/trace-records.json");
const searchIndex = readJson("public/data/publication-search.json");
const metrics = readJson("public/data/platform-metrics.json");

if (traceRecords.sections.length !== publication.sectionRecords.length) {
  problems.push("public/data/trace-records.json: section record count does not match publication data");
}
if (traceRecords.claims.length !== publication.traceClaims.length) {
  problems.push("public/data/trace-records.json: claim record count does not match publication data");
}

for (const section of traceRecords.sections) {
  if (!fileExistsFromHref(section.url)) {
    problems.push(`Explorer section record ${section.id}: broken section URL ${section.url}`);
  }
  for (const sourceId of section.sources) {
    if (!sourceIds.has(sourceId)) {
      problems.push(`Explorer section record ${section.id}: unknown source ${sourceId}`);
    }
  }
  for (const decisionId of section.decisions) {
    if (!decisionIds.has(decisionId)) {
      problems.push(`Explorer section record ${section.id}: unknown decision ${decisionId}`);
    }
  }
  for (const openQuestionId of section.openQuestions) {
    if (!openQuestionIds.has(openQuestionId)) {
      problems.push(`Explorer section record ${section.id}: unknown open question ${openQuestionId}`);
    }
  }
}

for (const claim of publication.traceClaims) {
  if (!searchIndex.some((item) => item.type === "Claim" && item.id === claim.id)) {
    problems.push(`${claim.id}: search index omits trace claim`);
  }
}

if (metrics.sources !== publication.sources.length) {
  problems.push("public/data/platform-metrics.json: source count mismatch");
}
if (metrics.decisionLogs !== publication.decisions.length) {
  problems.push("public/data/platform-metrics.json: decision count mismatch");
}
if (metrics.openQuestions !== publication.openQuestions.length) {
  problems.push("public/data/platform-metrics.json: open-question count mismatch");
}
if (metrics.claims !== publication.traceClaims.length) {
  problems.push("public/data/platform-metrics.json: claim count mismatch");
}
if (metrics.searchRecords !== searchIndex.length) {
  problems.push("public/data/platform-metrics.json: search record count mismatch");
}
if (metrics.traceRecords.sections !== traceRecords.sections.length) {
  problems.push("public/data/platform-metrics.json: section trace count mismatch");
}
if (metrics.traceRecords.claims !== traceRecords.claims.length) {
  problems.push("public/data/platform-metrics.json: claim trace count mismatch");
}

if (problems.length) {
  console.error("QA failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

metrics.qaStatus = {
  status: "passed",
  validatedAt: new Date().toISOString(),
  htmlPagesChecked: htmlFiles.length,
  checksEnforced: [
    "required source metadata",
    "high-priority canonical URLs",
    "orphaned trace records",
    "search coverage for trace claims",
    "explorer reference integrity",
    "generated-file consistency"
  ]
};
fs.writeFileSync(
  path.join(root, "public/data/platform-metrics.json"),
  `${JSON.stringify(metrics, null, 2)}\n`,
  "utf8"
);

console.log(`QA passed for ${htmlFiles.length} HTML files.`);
