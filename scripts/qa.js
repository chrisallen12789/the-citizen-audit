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
  "public/data/publication-search.json"
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) {
    problems.push(`${relative}: required generated file missing`);
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
