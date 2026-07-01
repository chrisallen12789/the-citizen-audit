const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const build = pkg.scripts?.["build:publication"] || "";

const requiredOrder = [
  "node scripts/build-publication-assets.js",
  "node scripts/build-traceability-data.js",
  "node scripts/build-search-index.js"
];

let cursor = -1;
const problems = [];

for (const command of requiredOrder) {
  const next = build.indexOf(command);
  if (next === -1) {
    problems.push(`build:publication missing ${command}`);
    continue;
  }
  if (next <= cursor) {
    problems.push(`build:publication must run ${command} after the prior generator`);
  }
  cursor = next;
}

if (!build.trim().endsWith("node scripts/build-search-index.js")) {
  problems.push("build:publication must end with build-search-index.js so publication-search.json has a single final writer");
}

if (problems.length) {
  console.error("Search source-of-truth check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Search source-of-truth check passed.");
