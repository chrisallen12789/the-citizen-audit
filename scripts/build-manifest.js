const fs = require("fs");
const path = require("path");
const publication = require("./publication-data");
const sectionTraceClaims = require("./section-trace-claims");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

function countHtmlFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countHtmlFiles(next);
    if (entry.isFile() && entry.name.endsWith(".html")) count += 1;
  }
  return count;
}

function readJson(relativePath, fallback) {
  const target = path.join(publicDir, relativePath);
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function buildManifest() {
  const searchIndex = readJson("data/publication-search.json", []);
  const traceability = readJson("data/section-traceability.json", { records: [] });
  const claimTraceCount = Object.values(sectionTraceClaims).reduce((sum, claims) => sum + claims.length, 0);

  return {
    name: "The Citizen Audit",
    edition: "v1.0 web edition",
    generatedAt: "deterministic-build",
    generators: [
      "scripts/build-publication-assets.js",
      "scripts/build-traceability-data.js",
      "scripts/build-search-index.js",
      "scripts/build-manifest.js"
    ],
    sourceData: [
      "scripts/publication-data.js",
      "scripts/section-trace-claims.js"
    ],
    qa: [
      "scripts/assert-search-source-of-truth.js",
      "scripts/qa.js"
    ],
    counts: {
      htmlFiles: countHtmlFiles(publicDir),
      sources: publication.sources.length,
      openQuestions: publication.openQuestions.length,
      decisions: publication.decisions.length,
      releases: publication.releases.length,
      sectionTraceRecords: Array.isArray(traceability.records) ? traceability.records.length : 0,
      curatedClaimTraces: claimTraceCount,
      searchRecords: Array.isArray(searchIndex) ? searchIndex.length : 0,
      searchSectionRecords: Array.isArray(searchIndex) ? searchIndex.filter((item) => item.type === "Section").length : 0,
      searchClaimTraceRecords: Array.isArray(searchIndex) ? searchIndex.filter((item) => item.type === "Claim trace").length : 0
    },
    invariants: [
      "Version 1.0 analytical conclusions remain locked unless explicitly revised in a later edition.",
      "Search index is generated after publication assets and traceability data.",
      "Traceability data is generated from repository-backed structured data.",
      "Open questions remain visible instead of being estimated into false precision."
    ]
  };
}

function build() {
  const target = path.join(publicDir, "data", "build-manifest.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(buildManifest(), null, 2)}\n`, "utf8");
}

build();
