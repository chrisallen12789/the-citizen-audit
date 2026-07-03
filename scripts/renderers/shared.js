const SITE_ORIGIN = "https://thecitizenaudit.org";

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
    <nav id="site-nav" data-nav aria-label="Primary">
      <a href="/start-here.html">Start Here</a>
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

function absoluteUrl(pathname = "/") {
  const normalized = pathname === "/" ? "/" : `/${String(pathname).replace(/^\/+/, "")}`;
  return `${SITE_ORIGIN}${normalized}`;
}

function layout({
  title,
  description,
  eyebrow,
  heading,
  lede,
  body,
  footerLabel,
  canonicalPath = "/",
  ogType = "website",
  socialImagePath = "/og-image.png"
}) {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const socialImageUrl = absoluteUrl(socialImagePath);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(socialImageUrl)}">
  <meta property="og:site_name" content="The Citizen Audit">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}">
  <meta name="theme-color" content="#f5f0e8">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  ${nav()}
  <main id="main-content" class="page" tabindex="-1">
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
  const paragraphs = [
    ...(block.texts || []).map((text) => renderParagraphBlock({ type: "paragraph", text })),
    ...(block.paragraphs || [])
  ].join("");
  const nestedBlocks = (block.contentBlocks || []).map(renderContentBlock).join("");
  return `<section class="panel${block.stack ? " stack" : ""}">
      ${block.heading ? `<h2>${escapeHtml(block.heading)}</h2>` : ""}
      ${paragraphs}
      ${nestedBlocks}
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

function renderParagraphBlock(block) {
  if (block.html) {
    return block.html;
  }
  return `<p>${escapeHtml(block.text)}</p>`;
}

function renderListBlock(block) {
  const tag = block.ordered ? "ol" : "ul";
  if (block.html) {
    return block.html;
  }
  return `<${tag}>${(block.items || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</${tag}>`;
}

function renderMetadataGrid(block) {
  return `<div class="meta-grid">${(block.items || [])
    .map((item) => {
      const value = item.valueHtml || escapeHtml(item.value || "");
      return `<p><strong>${escapeHtml(item.label)}:</strong> ${value}</p>`;
    })
    .join("")}</div>`;
}

function renderRelationshipGrid(block) {
  return `<div class="${block.layout === "stack" ? "stack" : "grid"}">${(block.items || [])
    .map(
      (item) => `<article class="card stack">
        ${item.eyebrow ? `<p class="row-kicker">${escapeHtml(item.eyebrow)}</p>` : ""}
        <h3>${item.href ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</h3>
        ${item.text ? `<p>${escapeHtml(item.text)}</p>` : ""}
        ${item.html || ""}
      </article>`
    )
    .join("")}</div>`;
}

function renderContentBlock(block) {
  if (
    block.type === "paragraph" ||
    block.type === "methodologyNote" ||
    block.type === "bottomLine"
  ) {
    return renderParagraphBlock(block);
  }
  if (block.type === "callout") {
    return block.html || `<div class="claim"><p>${escapeHtml(block.text || "")}</p></div>`;
  }
  if (block.type === "table") {
    return block.table ? renderTable(block.table) : block.html || "";
  }
  if (block.type === "list") {
    return renderListBlock(block);
  }
  if (block.type === "metadataGrid") {
    return renderMetadataGrid(block);
  }
  if (block.type === "relationshipGrid") {
    return renderRelationshipGrid(block);
  }
  return "";
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
  renderParagraphBlock,
  renderListBlock,
  renderMetadataGrid,
  renderRelationshipGrid,
  renderContentBlock,
  linkList,
  linkClaims,
  renderRecordLinks,
  formatDate,
  absoluteUrl,
  SITE_ORIGIN
};
