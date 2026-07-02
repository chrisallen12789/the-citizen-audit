const fs = require("fs");
const path = require("path");
const publication = require("./publication-data");
const { applyQaStatus } = require("./build/qa-status");

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
    "primaryOrSecondary",
    "citationPriority",
    "verificationStatus",
    "urlVerificationStatus",
    "urlVerificationNote",
    "notes",
    "archiveStatus"
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
  "public/methodology.html",
  "public/claims.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/platform.html",
  "public/status.html",
  "public/search.html",
  "public/explorer.html",
  "public/review.html",
  "public/corrections.html",
  "public/release-notes.html",
  "public/version-history.html",
  "public/changelog.html",
  "public/press.html",
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
  if (strictMetaFiles.has(relative) && !html.includes('rel="canonical"')) {
    problems.push(`${relative}: missing canonical URL`);
  }
  if (strictMetaFiles.has(relative) && !html.includes('property="og:title"')) {
    problems.push(`${relative}: missing Open Graph title`);
  }
  if (strictMetaFiles.has(relative) && !html.includes('property="og:description"')) {
    problems.push(`${relative}: missing Open Graph description`);
  }
  if (strictMetaFiles.has(relative) && !html.includes('rel="icon"')) {
    problems.push(`${relative}: missing favicon link`);
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
  "public/audit/section-01-executive-summary.html",
  "public/audit.html",
  "public/methodology.html",
  "public/claims.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/platform.html",
  "public/status.html",
  "public/search.html",
  "public/explorer.html",
  "public/review.html",
  "public/corrections.html",
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
  "public/data/trace-records.json",
  "public/robots.txt",
  "public/sitemap.xml",
  "public/favicon.svg"
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
const pageIds = collectIds(publication.pages, "pages", problems);
const expectedModeledPageSlugs = new Set([
  "audit",
  "methodology",
  "sources",
  "open-questions",
  "decision-log",
  "review",
  "downloads",
  "corrections",
  "release-notes",
  "version-history",
  "changelog",
  "search",
  "explorer",
  "appendix-a-open-questions",
  "appendix-b-transparency-scorecard",
  "status",
  "platform",
  "claims"
]);
const requiredRendererModules = [
  "scripts/build/io.js",
  "scripts/build/data-outputs.js",
  "scripts/build/finalize.js",
  "scripts/build/qa-status.js",
  "scripts/renderers/shared.js",
  "scripts/renderers/relationships.js",
  "scripts/renderers/page-model.js",
  "scripts/renderers/sections.js",
  "scripts/renderers/details.js"
];

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
  if (source.verificationStatus === "verified" && !source.canonicalUrl) {
    problems.push(`${source.id}: verified source is missing canonicalUrl`);
  }
  if (source.citationPriority === "high") {
    for (const field of [
      "canonicalUrl",
      "publisher",
      "documentType",
      "primaryOrSecondary",
      "verificationStatus"
    ]) {
      if (!source[field] || !String(source[field]).trim()) {
        problems.push(`${source.id}: high-priority source lacks ${field}`);
      }
    }
  }
  if (
    source.urlVerificationStatus === "pending" &&
    !source.urlVerificationNote.toLowerCase().includes("pending")
  ) {
    problems.push(`${source.id}: pending URL verification note must explain why verification is pending`);
  }
  if (source.archiveUrl && source.archiveStatus === "not-available") {
    problems.push(`${source.id}: archiveStatus says not-available but archiveUrl is populated`);
  }
  if (!source.archiveUrl && source.archiveStatus === "available") {
    problems.push(`${source.id}: archiveStatus says available but archiveUrl is missing`);
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
const siteJs = fs.readFileSync(path.join(root, "public/site.js"), "utf8");
const detailsRenderer = fs.readFileSync(path.join(root, "scripts/renderers/details.js"), "utf8");
const sectionContentSource = fs.readFileSync(path.join(root, "data-model/section-content.js"), "utf8");
const pageContentSource = fs.readFileSync(path.join(root, "data-model/pages.js"), "utf8");

const generatedSectionFiles = fs
  .readdirSync(path.join(publicDir, "audit"))
  .filter((name) => /^section-\d+.*\.html$/.test(name));
const modeledSections = publication.sections.filter((section) => /^Section \d+$/.test(section.id));
const expectedHtmlFiles = new Set([
  "public/index.html",
  "public/press.html",
  ...publication.pages.map((page) => `public/${page.url.replace(/^\//, "")}`),
  ...publication.sections
    .filter((section) => /^Section \d+$/.test(section.id))
    .map((section) => `public/${section.url.replace(/^\//, "")}`),
  ...publication.sources.map((source) => `public/sources/${source.slug}.html`),
  ...publication.claims.map((claim) => `public/claims/${claim.id.toLowerCase()}.html`),
  ...publication.openQuestions.map((item) => `public/open-questions/${item.slug}.html`),
  ...publication.decisions.map((decision) => `public/decision-log/${decision.slug}.html`)
]);

for (const filePath of htmlFiles) {
  const relative = path.relative(root, filePath).replace(/\\/g, "/");
  if (!expectedHtmlFiles.has(relative)) {
    problems.push(`${relative}: unexpected public HTML artifact`);
  }
}

for (const slug of expectedModeledPageSlugs) {
  if (!publication.pages.some((page) => page.slug === slug)) {
    problems.push(`page model missing required non-section page ${slug}`);
  }
}

for (const page of publication.pages) {
  if (!expectedModeledPageSlugs.has(page.slug)) {
    problems.push(`page model contains unexpected non-section page ${page.slug}`);
  }
  for (const field of ["title", "description", "heading", "lede"]) {
    if (!page[field] || !String(page[field]).trim()) {
      problems.push(`${page.id}: missing page field ${field}`);
    }
  }
  for (const auditId of page.relatedAuditIds || []) {
    if (!auditIds.has(auditId)) {
      problems.push(`${page.id}: page references missing audit ${auditId}`);
    }
  }
  for (const sectionId of page.relatedSectionIds || []) {
    if (!sectionIds.has(sectionId)) {
      problems.push(`${page.id}: page references missing section ${sectionId}`);
    }
  }
  for (const claimId of page.relatedClaimIds || []) {
    if (!claimIds.has(claimId)) {
      problems.push(`${page.id}: page references missing claim ${claimId}`);
    }
  }
  for (const sourceId of page.relatedSourceIds || []) {
    if (!sourceIds.has(sourceId)) {
      problems.push(`${page.id}: page references missing source ${sourceId}`);
    }
  }
  for (const decisionId of page.relatedDecisionIds || []) {
    if (!decisionIds.has(decisionId)) {
      problems.push(`${page.id}: page references missing decision ${decisionId}`);
    }
  }
  for (const openQuestionId of page.relatedOpenQuestionIds || []) {
    if (!openQuestionIds.has(openQuestionId)) {
      problems.push(`${page.id}: page references missing open question ${openQuestionId}`);
    }
  }
  const htmlPath = path.join(publicDir, page.url.replace(/^\//, ""));
  const relativeHtml = `public/${page.url.replace(/^\//, "")}`;
  if (!fs.existsSync(htmlPath)) {
    problems.push(`${page.id}: generated non-section page is missing`);
    continue;
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  if (!html.includes(`data-generated-source="page-model"`)) {
    problems.push(`${page.id}: generated page missing page-model marker`);
  }
  if (!html.includes(`data-page-id="${page.id}"`)) {
    problems.push(`${page.id}: generated page missing page ID marker`);
  }
  if (!html.includes("<title>")) {
    problems.push(`${relativeHtml}: generated page missing title`);
  }
  if (!html.includes('meta name="description"')) {
    problems.push(`${relativeHtml}: generated page missing description`);
  }
  if (!html.includes("<h1>")) {
    problems.push(`${relativeHtml}: generated page missing heading`);
  }
  if (!html.includes('<p class="lede">')) {
    problems.push(`${relativeHtml}: generated page missing lede`);
  }
  if (page.id === "PAGE-SEARCH" && !html.includes("data-publication-search")) {
    problems.push("PAGE-SEARCH: modeled utility page missing search input hook");
  }
  if (
    page.id === "PAGE-EXPLORER" &&
    (!html.includes("data-traceability-search") ||
      !html.includes("data-claim-search") ||
      !html.includes("data-tax-amount"))
  ) {
    problems.push("PAGE-EXPLORER: modeled utility page missing explorer hooks");
  }
  if (page.id === "PAGE-APPENDIX-A" && !html.includes('data-appendix-source="open-questions"')) {
    problems.push("PAGE-APPENDIX-A: appendix page missing open-question source marker");
  }
  if (page.id === "PAGE-APPENDIX-B" && !html.includes('data-appendix-source="transparency-scorecard"')) {
    problems.push("PAGE-APPENDIX-B: appendix page missing transparency source marker");
  }
}

const rawHtmlCount =
  (sectionContentSource.match(/["']html["']\s*:/g) || []).length +
  (pageContentSource.match(/["']html["']\s*:/g) || []).length;
if (rawHtmlCount > 164) {
  problems.push("raw HTML content increases beyond the current cleanup ceiling");
}

if (!detailsRenderer.includes('data-generated-source="typed-detail-renderer"')) {
  problems.push("detail pages bypass typed renderers");
}

if (generatedSectionFiles.length !== modeledSections.length) {
  problems.push("generated section count does not match data model");
}

if (/(S-\d{3}|A-\d{3}|D-\d{3}|Section \d+)/.test(siteJs)) {
  problems.push("public/site.js contains hardcoded audit-specific evidence data");
}

for (const section of modeledSections) {
  if (!section.contentBlocks || !section.contentBlocks.length) {
    problems.push(`${section.id}: section has no structured content blocks`);
  }
  if (!section.claimIds.length) {
    problems.push(`${section.id}: section has no linked claims`);
  }
  for (const sourceId of section.sourceIds) {
    if (!sourceIds.has(sourceId)) {
      problems.push(`${section.id}: section references missing source ${sourceId}`);
    }
  }
  for (const decisionId of section.decisionIds) {
    if (!decisionIds.has(decisionId)) {
      problems.push(`${section.id}: section references missing decision ${decisionId}`);
    }
  }
  for (const openQuestionId of section.openQuestionIds) {
    if (!openQuestionIds.has(openQuestionId)) {
      problems.push(`${section.id}: section references missing open question ${openQuestionId}`);
    }
  }
  const htmlPath = path.join(publicDir, section.url.replace(/^\//, ""));
  if (!fs.existsSync(htmlPath)) {
    problems.push(`${section.id}: section page is missing`);
  } else {
    const html = fs.readFileSync(htmlPath, "utf8");
    if (!html.includes('data-generated-source="section-model"')) {
      problems.push(`${section.id}: section page is not generated from data`);
    }
  }
}

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

for (const page of publication.pages) {
  if (!publicationSearch.some((item) => item.type === "Page" && item.id === page.id)) {
    problems.push(`${page.id}: search index omits generated non-section page`);
  }
}

const appendixAHtml = fs.existsSync(path.join(root, "public/audit/appendix-a-open-questions.html"))
  ? fs.readFileSync(path.join(root, "public/audit/appendix-a-open-questions.html"), "utf8")
  : "";
const appendixBHtml = fs.existsSync(path.join(root, "public/audit/appendix-b-transparency-scorecard.html"))
  ? fs.readFileSync(path.join(root, "public/audit/appendix-b-transparency-scorecard.html"), "utf8")
  : "";
if (appendixAHtml) {
  const appendixALinkCount = [...appendixAHtml.matchAll(/href="\/open-questions\/[^"]+\.html"/g)].length;
  if (appendixALinkCount !== publication.openQuestions.length) {
    problems.push("Appendix A disagrees with open-question data");
  }
}
if (appendixBHtml) {
  const appendixBRowCount = [...appendixBHtml.matchAll(/<tr>/g)].length - 1;
  if (appendixBRowCount !== publication.transparencyScorecard.length) {
    problems.push("Appendix B disagrees with transparency scorecard data");
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

for (const group of ["pages", "audits", "sections", "claims", "sources", "decisions", "openQuestions"]) {
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

for (const relative of requiredRendererModules) {
  if (!fs.existsSync(path.join(root, relative))) {
    problems.push(`${relative}: required renderer/build module missing`);
  }
}

const buildScriptPath = path.join(root, "scripts/build-publication-assets.js");
if (fs.existsSync(buildScriptPath)) {
  const buildScript = fs.readFileSync(buildScriptPath, "utf8");
  const buildLineCount = buildScript.split(/\r?\n/).length;
  if (buildLineCount > 220) {
    problems.push("scripts/build-publication-assets.js remains monolithic beyond reasonable orchestration");
  }
}

if (!manifest.outputs.includes("/data/evidence-graph.json")) {
  problems.push("public/data/publication-manifest.json: missing evidence graph output");
}
for (const page of publication.pages) {
  if (!manifest.outputs.includes(page.url)) {
    problems.push(`public/data/publication-manifest.json: missing page output ${page.url}`);
  }
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
if (metrics.verifiedSourceCount !== publication.sources.filter((source) => source.verificationStatus === "verified").length) {
  problems.push("public/data/platform-metrics.json: verified source count mismatch");
}
if (metrics.pendingSourceCount !== publication.sources.filter((source) => source.verificationStatus !== "verified").length) {
  problems.push("public/data/platform-metrics.json: pending source count mismatch");
}
if (metrics.archiveCoverageCount !== publication.sources.filter((source) => source.archiveUrl).length) {
  problems.push("public/data/platform-metrics.json: archive coverage count mismatch");
}
const highPrioritySources = publication.sources.filter((source) => source.citationPriority === "high");
const expectedHighPriorityCitationCompletionPercent = highPrioritySources.length
  ? Number(
      (
        (highPrioritySources.filter((source) => source.canonicalUrl).length / highPrioritySources.length) *
        100
      ).toFixed(2)
    )
  : 100;
if (metrics.highPriorityCitationCompletionPercent !== expectedHighPriorityCitationCompletionPercent) {
  problems.push("public/data/platform-metrics.json: high-priority citation completion mismatch");
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
if (metrics.generatedPublicationPages !== publication.pages.length) {
  problems.push("public/data/platform-metrics.json: generated publication page count mismatch");
}
if (metrics.generatedSectionPages !== modeledSections.length) {
  problems.push("public/data/platform-metrics.json: generated section page count mismatch");
}
if (metrics.generatedClaimPages !== publication.claims.length) {
  problems.push("public/data/platform-metrics.json: generated claim page count mismatch");
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
if (platformStatus.generatedPublicationPages !== metrics.generatedPublicationPages) {
  problems.push("public/data/platform-status.json: generated publication page count mismatch");
}
if (platformStatus.generatedSectionPages !== metrics.generatedSectionPages) {
  problems.push("public/data/platform-status.json: generated section page count mismatch");
}
if (platformStatus.generatedClaimPages !== metrics.generatedClaimPages) {
  problems.push("public/data/platform-status.json: generated claim page count mismatch");
}
if (platformStatus.qaStatus !== metrics.qaStatus.status) {
  problems.push("QA status is not propagated consistently");
}

const platformHtml = fs.existsSync(path.join(root, "public/platform.html"))
  ? fs.readFileSync(path.join(root, "public/platform.html"), "utf8")
  : "";
const statusHtml = fs.existsSync(path.join(root, "public/status.html"))
  ? fs.readFileSync(path.join(root, "public/status.html"), "utf8")
  : "";
if (
  platformHtml &&
  !platformHtml.includes(`data-qa-status-value="platform">${metrics.qaStatus.status}</h2>`)
) {
  problems.push("platform.html QA status display is inconsistent");
}
if (
  statusHtml &&
  !statusHtml.includes(`data-qa-status-value="status">${platformStatus.qaStatus}</h2>`)
) {
  problems.push("status.html QA status display is inconsistent");
}

if (problems.length) {
  console.error("QA failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

applyQaStatus({
  root,
  status: "passed",
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
});

console.log(`QA passed for ${htmlFiles.length} HTML files.`);
