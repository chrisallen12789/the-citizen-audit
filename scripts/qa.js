const fs = require("fs");
const path = require("path");

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

const htmlFiles = walk(publicDir);
const problems = [];
const strictMetaFiles = new Set([
  "public/index.html",
  "public/audit.html",
  "public/sources.html",
  "public/open-questions.html",
  "public/decision-log.html",
  "public/search.html",
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
    html.includes("Â") ||
    html.includes("â€”") ||
    html.includes("â€“") ||
    html.includes("â€")
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
  "public/release-notes.html",
  "public/version-history.html",
  "public/changelog.html",
  "public/audit/appendix-a-open-questions.html",
  "public/audit/appendix-b-transparency-scorecard.html",
  "public/data/publication-search.json",
  "public/data/section-traceability.json",
  "public/data/build-manifest.json"
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) {
    problems.push(`${relative}: required generated file missing`);
  }
}

const traceabilityPath = path.join(root, "public/data/section-traceability.json");
if (fs.existsSync(traceabilityPath)) {
  const traceability = JSON.parse(fs.readFileSync(traceabilityPath, "utf8"));
  const records = Array.isArray(traceability.records) ? traceability.records : [];
  if (records.length < 16) {
    problems.push("public/data/section-traceability.json: expected at least 16 section records");
  }
  for (const record of records) {
    if (!record.id || !record.url || !record.verification) {
      problems.push(`public/data/section-traceability.json: malformed section record ${record.id || "unknown"}`);
    }
    if (!Array.isArray(record.sources) || !Array.isArray(record.decisions) || !Array.isArray(record.openQuestions)) {
      problems.push(`public/data/section-traceability.json: missing linked record arrays for ${record.id || "unknown"}`);
    }
    if (!Array.isArray(record.claims) || !record.claims.length) {
      problems.push(`public/data/section-traceability.json: missing claim trace records for ${record.id || "unknown"}`);
    }
    for (const claim of record.claims || []) {
      if (!claim.title || !claim.body) {
        problems.push(`public/data/section-traceability.json: malformed claim trace for ${record.id || "unknown"}`);
      }
    }
  }
}

const searchIndexPath = path.join(root, "public/data/publication-search.json");
if (fs.existsSync(searchIndexPath)) {
  const searchIndex = JSON.parse(fs.readFileSync(searchIndexPath, "utf8"));
  if (!Array.isArray(searchIndex)) {
    problems.push("public/data/publication-search.json: expected array search index");
  } else {
    const sections = searchIndex.filter((item) => item.type === "Section");
    const traces = searchIndex.filter((item) => item.type === "Claim trace");
    if (sections.length < 16) {
      problems.push("public/data/publication-search.json: expected at least 16 section search records");
    }
    if (traces.length < 16) {
      problems.push("public/data/publication-search.json: expected at least 16 claim trace search records");
    }
    for (const requiredTerm of ["no blended total", "provider", "SNAP", "federal-only", "ORR"]) {
      const found = searchIndex.some((item) => [item.title, item.text].join(" ").toLowerCase().includes(requiredTerm.toLowerCase()));
      if (!found) {
        problems.push(`public/data/publication-search.json: missing expected searchable term ${requiredTerm}`);
      }
    }
  }
}

const manifestPath = path.join(root, "public/data/build-manifest.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const field of ["name", "edition", "generatedAt", "generators", "sourceData", "qa", "counts", "invariants"]) {
    if (!manifest[field]) {
      problems.push(`public/data/build-manifest.json: missing ${field}`);
    }
  }
  if (!Array.isArray(manifest.generators) || !manifest.generators.includes("scripts/build-manifest.js")) {
    problems.push("public/data/build-manifest.json: manifest generator not recorded");
  }
  if (!manifest.counts || manifest.counts.sectionTraceRecords < 16 || manifest.counts.searchClaimTraceRecords < 16) {
    problems.push("public/data/build-manifest.json: manifest counts do not reflect current verification layer");
  }
}

if (problems.length) {
  console.error("QA failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`QA passed for ${htmlFiles.length} HTML files.`);
