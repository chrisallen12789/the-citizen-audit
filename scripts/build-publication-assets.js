const path = require("path");
const publication = require("./publication-data");
const { writeFile } = require("./build/io");
const { createRelationships } = require("./renderers/relationships");
const { createPageRenderer } = require("./renderers/page-model");
const { createSectionRenderer } = require("./renderers/sections");
const { createDetailRenderers } = require("./renderers/details");
const { createDataOutputBuilders } = require("./build/data-outputs");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

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
  buildPlatformMetrics
} = createDataOutputBuilders(publication, publicDir);

function getPage(pageId) {
  return publication.maps.pagesById.get(pageId);
}

function build() {
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
    "/data/claim-database.json",
    "/data/cross-reference-tables.json",
    "/data/evidence-graph.json",
    "/data/platform-metrics.json",
    "/data/platform-status.json",
    "/data/publication-manifest.json",
    "/data/publication-search.json",
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

  const manifest = buildManifest(manifestOutputs);
  const provisionalMetrics = buildPlatformMetrics(searchIndex, traceRecords);
  const provisionalStatus = buildPlatformStatus(provisionalMetrics, manifest);

  writeFile(
    publicDir,
    "platform.html",
    renderPublicationPage(getPage("PAGE-PLATFORM"), { metrics: provisionalMetrics })
  );
  writeFile(
    publicDir,
    "status.html",
    renderPublicationPage(getPage("PAGE-STATUS"), {
      metrics: provisionalMetrics,
      status: provisionalStatus,
      manifest
    })
  );

  const platformMetrics = buildPlatformMetrics(searchIndex, traceRecords);
  const platformStatus = buildPlatformStatus(platformMetrics, manifest);

  writeFile(
    publicDir,
    "platform.html",
    renderPublicationPage(getPage("PAGE-PLATFORM"), { metrics: platformMetrics })
  );
  writeFile(
    publicDir,
    "status.html",
    renderPublicationPage(getPage("PAGE-STATUS"), {
      metrics: platformMetrics,
      status: platformStatus,
      manifest
    })
  );
  writeFile(publicDir, "data/platform-status.json", `${JSON.stringify(platformStatus, null, 2)}\n`);
  writeFile(publicDir, "data/publication-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(publicDir, "data/platform-metrics.json", `${JSON.stringify(platformMetrics, null, 2)}\n`);
}

build();
