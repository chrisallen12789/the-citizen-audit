const path = require("path");
const fs = require("fs");
const publication = require("./publication-data");
const { writeFile, copyFile } = require("./build/io");
const { finalizeBuild } = require("./build/finalize");
const { createRelationships } = require("./renderers/relationships");
const { createPageRenderer } = require("./renderers/page-model");
const { createSectionRenderer } = require("./renderers/sections");
const { createDetailRenderers } = require("./renderers/details");
const { createDataOutputBuilders } = require("./build/data-outputs");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const canonicalPdfSource =
  process.env.CANONICAL_PDF_PATH ||
  path.join(process.env.USERPROFILE || "C:\\Users\\Chris", "Downloads", "The Citizen Audit - v1.0(1).pdf");
const canonicalPdfPublicPath = "downloads/the-citizen-audit-v1.0.pdf";

const relationships = createRelationships(publication);
const { renderPublicationPage } = createPageRenderer(publication);
const { renderSectionPage } = createSectionRenderer(publication, relationships);
const {
  renderSourceDetail,
  renderOpenQuestionDetail,
  renderDecisionDetail,
  renderClaimDetail
} = createDetailRenderers(publication, relationships);
const {
  buildSearchIndex,
  buildClaimDatabase,
  buildCrossReferenceTables,
  buildEvidenceGraph,
  buildManifest,
  buildPlatformStatus,
  buildTraceRecords,
  buildPlatformMetrics,
  buildResearchStateOutput,
  buildPublicationMetadata
} = createDataOutputBuilders(publication, publicDir);

function getPage(pageId) {
  return publication.maps.pagesById.get(pageId);
}

function build() {
  if (!fs.existsSync(canonicalPdfSource)) {
    throw new Error(`Canonical PDF not found at ${canonicalPdfSource}`);
  }

  copyFile(publicDir, canonicalPdfPublicPath, canonicalPdfSource);

  const searchIndex = buildSearchIndex();
  const traceRecords = buildTraceRecords();
  const claimDatabase = buildClaimDatabase();
  const crossReferences = buildCrossReferenceTables();
  const evidenceGraph = buildEvidenceGraph();

  const manifestOutputs = [
    ...publication.pages.map((page) => page.url),
    ...publication.sections.filter((item) => /^Section \d+$/.test(item.id)).map((section) => section.url),
    ...publication.sources.map((source) => `/sources/${source.slug}.html`),
    ...publication.claims.map((claim) => `/claims/${claim.id.toLowerCase()}.html`),
    ...publication.openQuestions.map((item) => `/open-questions/${item.slug}.html`),
    ...publication.decisions.map((decision) => `/decision-log/${decision.slug}.html`),
    `/${canonicalPdfPublicPath}`,
    "/data/claim-database.json",
    "/data/cross-reference-tables.json",
    "/data/evidence-graph.json",
    "/data/platform-metrics.json",
    "/data/platform-status.json",
    "/data/publication-manifest.json",
    "/data/publication-metadata-v2.json",
    "/data/publication-search.json",
    "/data/research-state.json",
    "/data/trace-records.json"
  ];

  for (const page of publication.pages.filter((item) => !["PAGE-PLATFORM", "PAGE-STATUS"].includes(item.id))) {
    writeFile(publicDir, page.url.replace(/^\//, ""), renderPublicationPage(page));
  }

  for (const section of publication.sections.filter((item) => /^Section \d+$/.test(item.id))) {
    writeFile(publicDir, section.url.replace(/^\//, ""), renderSectionPage(section));
  }

  for (const source of publication.sources) {
    writeFile(publicDir, `sources/${source.slug}.html`, renderSourceDetail(source));
  }

  for (const claim of publication.claims) {
    writeFile(publicDir, `claims/${claim.id.toLowerCase()}.html`, renderClaimDetail(claim));
  }

  for (const item of publication.openQuestions) {
    writeFile(publicDir, `open-questions/${item.slug}.html`, renderOpenQuestionDetail(item));
  }

  for (const decision of publication.decisions) {
    writeFile(publicDir, `decision-log/${decision.slug}.html`, renderDecisionDetail(decision));
  }

  writeFile(publicDir, "data/claim-database.json", `${JSON.stringify(claimDatabase, null, 2)}\n`);
  writeFile(publicDir, "data/cross-reference-tables.json", `${JSON.stringify(crossReferences, null, 2)}\n`);
  writeFile(publicDir, "data/evidence-graph.json", `${JSON.stringify(evidenceGraph, null, 2)}\n`);
  writeFile(publicDir, "data/publication-search.json", `${JSON.stringify(searchIndex, null, 2)}\n`);
  writeFile(publicDir, "data/trace-records.json", `${JSON.stringify(traceRecords, null, 2)}\n`);

  finalizeBuild({
    writeFile,
    publicDir,
    getPage,
    renderPublicationPage,
    buildManifest,
    buildPlatformMetrics,
    buildPlatformStatus,
    buildResearchStateOutput,
    buildPublicationMetadata,
    searchIndex,
    traceRecords,
    manifestOutputs
  });
}

build();
