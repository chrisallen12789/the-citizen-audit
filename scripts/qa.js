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

function hasRevisionHistory(record) {
  return Array.isArray(record.revisionHistory) && record.revisionHistory.length > 0;
}

function collectIds(records, label, problems) {
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) {
      problems.push(`${label}: duplicate ID ${record.id}`);
    }
    ids.add(record.id);
  }
  return ids;
}

const htmlFiles = walk(publicDir);
const problems = [];
const strictMetaFiles = new Set([
  "public/index.html",
  "public/audit.html",
  "public/claims.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/platform.html",
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
    html.includes("Ãƒâ€š") ||
    html.includes("ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â") ||
    html.includes("ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“") ||
    html.includes("ÃƒÂ¢Ã¢â€šÂ¬")
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
  "public/claims.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/platform.html",
  "public/search.html",
  "public/explorer.html",
  "public/review.html",
  "public/release-notes.html",
  "public/version-history.html",
  "public/changelog.html",
  "public/audit/appendix-a-open-questions.html",
  "public/audit/appendix-b-transparency-scorecard.html",
  "public/data/claim-database.json",
  "public/data/cross-reference-tables.json",
  "public/data/evidence-graph.json",
  "public/data/platform-metrics.json",
  "public/data/platform-status.json",
  "public/data/publication-manifest.json",
  "public/data/publication-search.json",
  "public/data/trace-records.json"
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) {
    problems.push(`${relative}: required generated file missing`);
  }
}

const auditIds = collectIds(publication.audits, "audits", problems);
const sectionIds = collectIds(publication.sections, "sections", problems);
const claimIds = collectIds(publication.claims, "claims", problems);
const sourceIds = collectIds(publication.sources, "sources", problems);
const decisionIds = collectIds(publication.decisions, "decisions", problems);
const openQuestionIds = collectIds(publication.openQuestions, "open questions", problems);

for (const section of publication.sections) {
  if (!hasRevisionHistory(section)) {
    problems.push(`${section.id}: missing revision history`);
  }
  if (
    !section.claimIds.length &&
    !section.id.startsWith("Appendix") &&
    section.id !== "Repository assets"
  ) {
    problems.push(`${section.id}: orphan section has no claims`);
  }
  for (const claimId of section.claimIds) {
    if (!claimIds.has(claimId)) {
      problems.push(`${section.id}: section references missing claim ${claimId}`);
    }
  }
}

for (const claim of publication.claims) {
  if (!auditIds.has(claim.auditId)) {
    problems.push(`${claim.id}: claim references missing audit ${claim.auditId}`);
  }
  if (!sectionIds.has(claim.sectionId)) {
    problems.push(`${claim.id}: claim references missing section ${claim.sectionId}`);
  }
  if (!claim.sources.length) {
    problems.push(`${claim.id}: claim lacks source`);
  }
  if (!claim.confidence || !String(claim.confidence).trim()) {
    problems.push(`${claim.id}: missing confidence`);
  }
  if (!hasRevisionHistory(claim)) {
    problems.push(`${claim.id}: missing revision history`);
  }
  for (const sourceId of claim.sources) {
    if (!sourceIds.has(sourceId)) {
      problems.push(`${claim.id}: claim references missing source ${sourceId}`);
    }
  }
  for (const decisionId of claim.decisions) {
    if (!decisionIds.has(decisionId)) {
      problems.push(`${claim.id}: claim references missing decision ${decisionId}`);
    }
  }
  for (const openQuestionId of claim.openQuestions) {
    if (!openQuestionIds.has(openQuestionId)) {
      problems.push(`${claim.id}: claim references missing open question ${openQuestionId}`);
    }
  }
  for (const relatedClaimId of claim.relatedClaims) {
    if (!claimIds.has(relatedClaimId)) {
      problems.push(`${claim.id}: claim references missing related claim ${relatedClaimId}`);
    }
  }
}

for (const source of publication.sources) {
  if (!hasRequiredSourceMetadata(source)) {
    problems.push(`${source.id}: required source metadata missing`);
  }
  if (!hasRevisionHistory(source)) {
    problems.push(`${source.id}: missing revision history`);
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

for (const decision of publication.decisions) {
  if (!hasRevisionHistory(decision)) {
    problems.push(`${decision.id}: missing revision history`);
  }
  for (const sectionId of decision.sectionIds || decision.references || []) {
    if (!sectionIds.has(sectionId)) {
      problems.push(`${decision.id}: decision references missing section ID ${sectionId}`);
    }
  }
}

for (const question of publication.openQuestions) {
  if (!hasRevisionHistory(question)) {
    problems.push(`${question.id}: missing revision history`);
  }
}

const claimDatabase = readJson("public/data/claim-database.json");
const crossReferences = readJson("public/data/cross-reference-tables.json");
const evidenceGraph = readJson("public/data/evidence-graph.json");
const manifest = readJson("public/data/publication-manifest.json");
const metrics = readJson("public/data/platform-metrics.json");
const publicationSearch = readJson("public/data/publication-search.json");
const platformStatus = readJson("public/data/platform-status.json");
const traceRecords = readJson("public/data/trace-records.json");

if (claimDatabase.claims.length !== publication.claims.length) {
  problems.push("public/data/claim-database.json: claim count does not match publication data");
}

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
}

for (const claim of publication.traceClaims) {
  if (!publicationSearch.some((item) => item.type === "Claim" && item.id === claim.id)) {
    problems.push(`${claim.id}: search index omits trace claim`);
  }
}

for (const [claimId, refs] of Object.entries(crossReferences.claims || {})) {
  if (!claimIds.has(claimId)) {
    problems.push(`cross references: unknown claim ${claimId}`);
  }
  for (const sourceId of refs.sources || []) {
    if (!sourceIds.has(sourceId)) {
      problems.push(`${claimId}: broken cross-reference source ${sourceId}`);
    }
  }
  for (const decisionId of refs.decisions || []) {
    if (!decisionIds.has(decisionId)) {
      problems.push(`${claimId}: broken cross-reference decision ${decisionId}`);
    }
  }
  for (const openQuestionId of refs.openQuestions || []) {
    if (!openQuestionIds.has(openQuestionId)) {
      problems.push(`${claimId}: broken cross-reference open question ${openQuestionId}`);
    }
  }
}

for (const group of ["audits", "sections", "claims", "sources", "decisions", "openQuestions"]) {
  for (const node of evidenceGraph[group] || []) {
    if (!Array.isArray(node.connectedIds) || !node.connectedIds.length) {
      problems.push(`evidence graph: orphan ${group} node ${node.id}`);
    }
    for (const connectedId of node.connectedIds) {
      if (
        !auditIds.has(connectedId) &&
        !sectionIds.has(connectedId) &&
        !claimIds.has(connectedId) &&
        !sourceIds.has(connectedId) &&
        !decisionIds.has(connectedId) &&
        !openQuestionIds.has(connectedId)
      ) {
        problems.push(`evidence graph: broken graph node link ${node.id} -> ${connectedId}`);
      }
    }
  }
}

if (!manifest.outputs.includes("/data/evidence-graph.json")) {
  problems.push("public/data/publication-manifest.json: missing evidence graph output");
}
if (platformStatus.buildVersion !== metrics.buildVersion) {
  problems.push("public/data/platform-status.json: build version mismatch");
}

if (metrics.audits !== publication.audits.length) {
  problems.push("public/data/platform-metrics.json: audit count mismatch");
}
if (metrics.sections !== publication.sections.length) {
  problems.push("public/data/platform-metrics.json: section count mismatch");
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
if (metrics.claims !== publication.claims.length) {
  problems.push("public/data/platform-metrics.json: claim count mismatch");
}
if (metrics.searchRecords !== publicationSearch.length) {
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
    "claim sources",
    "decision references",
    "graph integrity",
    "cross-reference integrity",
    "duplicate IDs",
    "orphan records",
    "citation metadata",
    "claim confidence",
    "revision history",
    "internal links"
  ]
};
fs.writeFileSync(
  path.join(root, "public/data/platform-metrics.json"),
  `${JSON.stringify(metrics, null, 2)}\n`,
  "utf8"
);

console.log(`QA passed for ${htmlFiles.length} HTML files.`);
