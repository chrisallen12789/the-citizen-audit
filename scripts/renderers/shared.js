function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unique(values) {
  return [...new Set(values)];
}

function nav() {
  return `<header class="site-header">
    <a class="brand" href="/"><span class="seal">CA</span><span>The Citizen Audit</span></a>
    <button class="menu" data-menu aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" data-nav>
      <a href="/audit.html">Audit</a>
      <a href="/claims.html">Claims</a>
      <a href="/sources.html">Sources</a>
      <a href="/search.html">Search</a>
      <a href="/explorer.html">Explorer</a>
      <a href="/review.html">Review</a>
      <a href="/platform.html">Platform</a>
      <a href="/methodology.html">Methodology</a>
      <a href="/downloads.html">Downloads</a>
      <a href="/corrections.html">Corrections</a>
    </nav>
  </header>`;
}

function footer(label) {
  return `<footer><strong>The Citizen Audit</strong><span>${escapeHtml(label)}</span></footer>`;
}

function layout({ title, description, eyebrow, heading, lede, body, footerLabel }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  ${nav()}
  <main class="page">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h1>${escapeHtml(heading)}</h1>
    <p class="lede">${escapeHtml(lede)}</p>
    ${body}
  </main>
  ${footer(footerLabel)}
  <script src="/site.js"></script>
</body>
</html>`;
}

function renderActionLinks(links) {
  return `<div class="actions">${links
    .map(
      (link) =>
        `<a class="button${link.variant === "primary" ? " primary" : ""}" href="${escapeHtml(
          link.href
        )}">${escapeHtml(link.label)}</a>`
    )
    .join("")}</div>`;
}

function renderTable(table) {
  return `<table><tr>${table.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")}</tr>${table.rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("")}</table>`;
}

function renderPanelBlock(block) {
  return `<section class="panel${block.stack ? " stack" : ""}">
      ${block.heading ? `<h2>${escapeHtml(block.heading)}</h2>` : ""}
      ${(block.paragraphs || []).join("")}
      ${block.table ? renderTable(block.table) : ""}
    </section>`;
}

function renderCardGrid(cards) {
  return `<section class="grid">${cards
    .map((card) => {
      const tag = card.href ? "a" : "article";
      const attrs = card.href ? ` class="card" href="${escapeHtml(card.href)}"` : ` class="card stack"`;
      return `<${tag}${attrs}>${card.eyebrow ? `<p class="row-kicker">${escapeHtml(card.eyebrow)}</p>` : ""}<h3>${escapeHtml(
        card.title
      )}</h3><p>${escapeHtml(card.body)}</p></${tag}>`;
    })
    .join("")}</section>`;
}

function renderTocBlock(block) {
  return `<section class="panel">
      <h2>${escapeHtml(block.heading)}</h2>
      <div class="toc">${block.entries
        .map(
          (entry) =>
            `<a href="${escapeHtml(entry.href)}">${escapeHtml(entry.label)}${
              entry.detail ? `<small>${escapeHtml(entry.detail)}</small>` : ""
            }</a>`
        )
        .join("")}</div>
    </section>`;
}

function renderSearchFilter(block) {
  return `<label class="search-wrap">
      <span class="sr-only">${escapeHtml(block.ariaLabel)}</span>
      <input class="search" data-filter-input data-filter-target="${escapeHtml(
        block.target
      )}" placeholder="${escapeHtml(block.placeholder)}">
    </label>`;
}

function linkList(items, basePath) {
  return items
    .map((item) => `<a class="tag" href="${basePath}${item.toLowerCase()}.html">${escapeHtml(item)}</a>`)
    .join(" ");
}

function linkClaims(claimIds) {
  return claimIds
    .map((claimId) => `<a class="tag" href="/claims/${claimId.toLowerCase()}.html">${escapeHtml(claimId)}</a>`)
    .join(" ");
}

function renderRecordLinks(ids, basePath) {
  return ids.length ? linkList(ids, basePath) : "<span class='empty-state'>None linked yet</span>";
}

function formatDate(value) {
  if (!value) return "Not recorded";
  return value;
}

module.exports = {
  escapeHtml,
  unique,
  layout,
  renderActionLinks,
  renderTable,
  renderPanelBlock,
  renderCardGrid,
  renderTocBlock,
  renderSearchFilter,
  linkList,
  linkClaims,
  renderRecordLinks,
  formatDate
};
