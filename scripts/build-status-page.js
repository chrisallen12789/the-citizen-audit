const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const manifestPath = path.join(publicDir, "data", "build-manifest.json");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nav() {
  return `<header class="site-header">
    <a class="brand" href="/"><span class="seal">CA</span><span>The Citizen Audit</span></a>
    <button class="menu" data-menu aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" data-nav>
      <a href="/audit.html">Audit</a>
      <a href="/sources.html">Sources</a>
      <a href="/search.html">Search</a>
      <a href="/explorer.html">Explorer</a>
      <a href="/methodology.html">Methodology</a>
      <a href="/downloads.html">Downloads</a>
      <a href="/corrections.html">Corrections</a>
    </nav>
  </header>`;
}

function renderList(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderStatusPage() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const counts = manifest.counts || {};
  const countRows = Object.entries(counts)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Build Status | The Citizen Audit</title>
  <meta name="description" content="Generated build status and publication-platform manifest for The Citizen Audit.">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  ${nav()}
  <main class="page">
    <p class="eyebrow">Build Status</p>
    <h1>Build Status</h1>
    <p class="lede">This page exposes the generated publication manifest so readers and maintainers can see what produced the live web edition.</p>
    <div class="actions">
      <a class="button primary" href="/data/build-manifest.json">View raw manifest</a>
      <a class="button" href="/search.html">Search publication</a>
      <a class="button" href="/explorer.html">Traceability explorer</a>
    </div>
    <section class="panel">
      <h2>Edition</h2>
      <div class="meta-grid">
        <p><strong>Name:</strong> ${escapeHtml(manifest.name)}</p>
        <p><strong>Edition:</strong> ${escapeHtml(manifest.edition)}</p>
        <p><strong>Generated:</strong> ${escapeHtml(manifest.generatedAt)}</p>
      </div>
    </section>
    <section class="panel">
      <h2>Generated counts</h2>
      <table>${countRows}</table>
    </section>
    <section class="panel grid two">
      <div>
        <h2>Generators</h2>
        ${renderList(manifest.generators || [])}
      </div>
      <div>
        <h2>Source data</h2>
        ${renderList(manifest.sourceData || [])}
      </div>
    </section>
    <section class="panel">
      <h2>Locked-edition invariants</h2>
      ${renderList(manifest.invariants || [])}
    </section>
  </main>
  <footer><strong>The Citizen Audit</strong><span>Build status - generated platform manifest</span></footer>
  <script src="/site.js"></script>
</body>
</html>`;
}

function build() {
  fs.writeFileSync(path.join(publicDir, "status.html"), renderStatusPage(), "utf8");
}

build();
