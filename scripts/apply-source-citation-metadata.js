const fs = require("fs");
const path = require("path");
const publication = require("./publication-data");
const citationMetadata = require("./source-citation-metadata");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metadataPanel(source) {
  const metadata = citationMetadata[source.id] || {};
  const locator = metadata.locator || source.title;
  const accessStatus = metadata.accessStatus || "Citation metadata pending normalization";
  const canonicalUrl = metadata.url
    ? `<p><strong>Canonical URL:</strong> <a href="${escapeHtml(metadata.url)}">${escapeHtml(metadata.url)}</a></p>`
    : "<p><strong>Canonical URL:</strong> Pending URL normalization in the citation metadata layer.</p>";
  const archiveUrl = metadata.archiveUrl
    ? `<p><strong>Archive URL:</strong> <a href="${escapeHtml(metadata.archiveUrl)}">${escapeHtml(metadata.archiveUrl)}</a></p>`
    : "<p><strong>Archive URL:</strong> Not yet recorded.</p>";

  return `<section class="panel" data-citation-metadata>
      <h2>Citation metadata</h2>
      <div class="meta-grid">
        <p><strong>Locator:</strong> ${escapeHtml(locator)}</p>
        <p><strong>Access status:</strong> ${escapeHtml(accessStatus)}</p>
        ${canonicalUrl}
        ${archiveUrl}
      </div>
      <p class="note">This panel is generated from <code>scripts/source-citation-metadata.js</code>. Pending URL normalization is displayed explicitly instead of hidden.</p>
    </section>`;
}

function apply() {
  for (const source of publication.sources) {
    const filePath = path.join(publicDir, "sources", `${source.slug}.html`);
    if (!fs.existsSync(filePath)) continue;
    let html = fs.readFileSync(filePath, "utf8");
    if (html.includes("data-citation-metadata")) continue;
    html = html.replace("<section class=\"panel\">\n      <h2>Claims supported in the current web edition</h2>", `${metadataPanel(source)}\n    <section class=\"panel\">\n      <h2>Claims supported in the current web edition</h2>`);
    fs.writeFileSync(filePath, html, "utf8");
  }
}

apply();
