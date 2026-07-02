const fs = require("fs");
const path = require("path");
const publication = require("./publication-data");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(relativePath, content) {
  const target = path.join(publicDir, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, content, "utf8");
}

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

function getPage(pageId) {
  return publication.maps.pagesById.get(pageId);
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

function renderSourceIndexRows() {
  return publication.sources
    .map(
      (source) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [
          source.id,
          source.title,
          source.summary,
          source.sections.join(" "),
          source.claims.join(" "),
          source.publisher,
          source.documentType,
          source.classification,
          source.officialUrl || "",
          source.urlVerificationStatus
        ].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(source.documentType)} - ${escapeHtml(source.publisher)}</p>
            <h2 class="row-title"><a href="/sources/${source.slug}.html">${escapeHtml(source.id)} - ${escapeHtml(source.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(source.confidence)}</span>
        </div>
        <p>${escapeHtml(source.summary)}</p>
        <p class="meta-line"><strong>Evidence class:</strong> ${escapeHtml(source.evidenceClass)}</p>
        <p class="meta-line"><strong>Classification:</strong> ${escapeHtml(source.classification)} | <strong>URL status:</strong> ${escapeHtml(source.urlVerificationStatus)}</p>
        <p class="meta-line"><strong>Used in:</strong> ${escapeHtml(source.sections.join(", "))}</p>
      </article>`
    )
    .join("");
}

function renderOpenQuestionRows() {
  return publication.openQuestions
    .map(
      (item) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [item.id, item.title, item.sections.join(" "), item.whyItMatters, item.recordNeeded].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(item.status)} - ${escapeHtml(item.sections.join(", "))}</p>
            <h2 class="row-title"><a href="/open-questions/${item.slug}.html">${escapeHtml(item.id)} - ${escapeHtml(item.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(item.status)}</span>
        </div>
        <p>${escapeHtml(item.whyItMatters)}</p>
        <p class="meta-line"><strong>Record needed:</strong> ${escapeHtml(item.recordNeeded)}</p>
      </article>`
    )
    .join("");
}

function renderDecisionRows() {
  return publication.decisions
    .map(
      (item) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [item.id, item.title, item.body, item.references.join(" ")].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">Canonical methodology decision</p>
            <h2 class="row-title"><a href="/decision-log/${item.slug}.html">${escapeHtml(item.id)} - ${escapeHtml(item.title)}</a></h2>
          </div>
        </div>
        <p>${escapeHtml(item.body)}</p>
        <p class="meta-line"><strong>Visible references:</strong> ${escapeHtml(item.references.join(", "))}</p>
      </article>`
    )
    .join("");
}

function renderClaimRows() {
  return publication.claims
    .map(
      (claim) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [
          claim.id,
          claim.title,
          claim.statement,
          claim.sectionId,
          claim.sources.join(" "),
          claim.decisions.join(" "),
          claim.openQuestions.join(" ")
        ].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(claim.sectionId)} - ${escapeHtml(claim.status)}</p>
            <h2 class="row-title"><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.id)} - ${escapeHtml(claim.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(claim.confidence)}</span>
        </div>
        <p>${escapeHtml(claim.statement)}</p>
        <p class="meta-line"><strong>Sources:</strong> ${escapeHtml(claim.sources.join(", "))}</p>
      </article>`
    )
    .join("");
}

function renderReleaseCards() {
  return `<section class="grid">${publication.releases
    .map(
      (release) => `<article class="card stack">
        <p class="row-kicker">v${escapeHtml(release.version)} - ${escapeHtml(release.date)}</p>
        <h2 class="row-title">${escapeHtml(release.title)}</h2>
        <ul>${release.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      </article>`
    )
    .join("")}</section>`;
}

function renderPlatformMetricsBlock(metrics) {
  const cards = [
    { label: "Published audits", value: metrics.audits },
    { label: "Sections", value: metrics.sections },
    { label: "Claims", value: metrics.claims },
    { label: "Sources", value: metrics.sources },
    { label: "Decision logs", value: metrics.decisionLogs },
    { label: "Open questions", value: metrics.openQuestions },
    { label: "Generated publication pages", value: metrics.generatedPublicationPages },
    { label: "Generated section pages", value: metrics.generatedSectionPages },
    { label: "Generated claim pages", value: metrics.generatedClaimPages },
    { label: "Citation coverage", value: `${metrics.citationCoverage.percentVerified}%` },
    { label: "Traceability coverage", value: `${metrics.traceabilityPercent}%` },
    { label: "QA status", value: metrics.qaStatus.status, marker: "platform" },
    { label: "Build version", value: metrics.buildVersion },
    { label: "Platform health", value: metrics.platformHealth },
    { label: "HTML pages", value: metrics.htmlPages }
  ];
  return `<section class="grid">${cards
    .map(
      (card) =>
        `<article class="card stack"><p class="row-kicker">${escapeHtml(String(card.label))}</p><h2${
          card.marker ? ` data-qa-status-value="${card.marker}"` : ""
        }>${escapeHtml(String(card.value))}</h2></article>`
    )
    .join("")}</section>`;
}

function renderStatusSummaryBlock(metrics, status, manifest) {
  const cards = [
    { label: "Platform health", value: status.status },
    { label: "QA status", value: status.qaStatus, marker: "status" },
    { label: "Build version", value: status.buildVersion },
    { label: "Citation coverage", value: `${status.citationCoveragePercent}%` },
    { label: "Traceability coverage", value: `${status.traceabilityPercent}%` },
    { label: "Generated publication pages", value: metrics.generatedPublicationPages },
    { label: "Generated section pages", value: metrics.generatedSectionPages },
    { label: "Generated claim pages", value: metrics.generatedClaimPages },
    { label: "Manifest outputs", value: manifest.outputs.length }
  ];
  return `<section class="grid">${cards
    .map(
      (card) =>
        `<article class="card stack"><p class="row-kicker">${escapeHtml(String(card.label))}</p><h2${
          card.marker ? ` data-qa-status-value="${card.marker}"` : ""
        }>${escapeHtml(String(card.value))}</h2></article>`
    )
    .join("")}</section>
    <section class="panel stack">
      <h2>Generated counts</h2>
      <p>The build currently publishes ${escapeHtml(String(metrics.generatedPublicationPages))} modeled publication pages, ${escapeHtml(
        String(metrics.generatedSectionPages)
      )} modeled numbered section pages, and ${escapeHtml(String(metrics.generatedClaimPages))} claim detail pages.</p>
      <p>View raw manifest and status data directly at <a href="/data/publication-manifest.json">/data/publication-manifest.json</a> and <a href="/data/platform-status.json">/data/platform-status.json</a>.</p>
    </section>`;
}

function renderPublicationPageBlock(block, context) {
  switch (block.type) {
    case "actions":
      return renderActionLinks(block.links);
    case "panel":
      return renderPanelBlock(block);
    case "cardGrid":
      return renderCardGrid(block.cards);
    case "toc":
      return renderTocBlock(block);
    case "searchFilter":
      return renderSearchFilter(block);
    case "sourceIndex":
      return `<section class="panel stack">${renderSourceIndexRows()}</section>`;
    case "openQuestionIndex":
      return `<section class="panel stack">${renderOpenQuestionRows()}</section>`;
    case "decisionIndex":
      return `<section class="panel stack">${renderDecisionRows()}</section>`;
    case "claimIndex":
      return `<section class="panel stack">${renderClaimRows()}</section>`;
    case "releaseCards":
      return renderReleaseCards();
    case "platformMetrics":
      return renderPlatformMetricsBlock(context.metrics);
    case "statusSummary":
      return renderStatusSummaryBlock(context.metrics, context.status, context.manifest);
    default:
      return "";
  }
}

function renderPublicationPage(page, context = {}) {
  const body = `<div class="sr-only" data-generated-source="page-model" data-page-id="${escapeHtml(
    page.id
  )}"></div>${page.contentBlocks
    .map((block) => renderPublicationPageBlock(block, context))
    .join("")}`;

  return layout({
    title: page.title,
    description: page.description,
    eyebrow: page.eyebrow,
    heading: page.heading,
    lede: page.lede,
    body,
    footerLabel: page.footerLabel || page.heading
  });
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

const sectionPathByName = {
  "Section 1": "/audit/section-01-executive-summary.html",
  "Section 2": "/audit/section-02-definitions-methodology.html",
  "Section 3": "/audit/section-03-international-assistance.html",
  "Section 4": "/audit/section-04-ukraine-israel-examples.html",
  "Section 5": "/audit/section-05-military-aid.html",
  "Section 6": "/audit/section-06-refugee-resettlement.html",
  "Section 7": "/audit/section-07-medicaid-emergency-medical.html",
  "Section 8": "/audit/section-08-food-assistance.html",
  "Section 9": "/audit/section-09-cash-welfare-income.html",
  "Section 10": "/audit/section-10-federal-housing.html",
  "Section 11": "/audit/section-11-education-public-services.html",
  "Section 12": "/audit/section-12-state-administered-federal-dollars.html",
  "Section 13": "/audit/section-13-programs-without-citizenship-breakouts.html",
  "Section 14": "/audit/section-14-conservative-total.html",
  "Section 15": "/audit/section-15-what-is-missing.html",
  "Section 16": "/audit/section-16-final-argument.html",
  "Appendix A": "/audit/appendix-a-open-questions.html",
  "Appendix B": "/audit/appendix-b-transparency-scorecard.html",
  "Repository assets": "/platform.html"
};

function linkSections(sectionNames) {
  return sectionNames
    .map((name) =>
      sectionPathByName[name]
        ? `<a class="tag" href="${sectionPathByName[name]}">${escapeHtml(name)}</a>`
        : `<span class="tag">${escapeHtml(name)}</span>`
    )
    .join(" ");
}

function relatedDecisionsForSections(sectionNames) {
  return publication.decisions.filter((decision) =>
    decision.references.some((reference) => sectionNames.includes(reference))
  );
}

function relatedSourcesForDecision(decision) {
  return publication.sources.filter((source) =>
    source.sections.some((section) => decision.references.includes(section))
  );
}

function relatedOpenQuestionsForDecision(decision) {
  return publication.openQuestions.filter((item) =>
    item.sections.some((section) => decision.references.includes(section))
  );
}

function findSectionRecord(sectionId) {
  return publication.sectionRecords.find((section) => section.id === sectionId) || null;
}

function relatedClaimsForSource(sourceId) {
  return publication.traceClaims.filter((claim) => claim.sources.includes(sourceId));
}

function relatedClaimsForDecision(decisionId) {
  return publication.traceClaims.filter((claim) => claim.decisions.includes(decisionId));
}

function relatedClaimsForOpenQuestion(openQuestionId) {
  return publication.traceClaims.filter((claim) => claim.openQuestions.includes(openQuestionId));
}

function findClaimRecord(claimId) {
  return publication.claims.find((claim) => claim.id === claimId) || null;
}

function relatedSourcesForClaim(claim) {
  return publication.sources.filter((source) => claim.sources.includes(source.id));
}

function relatedDecisionsForClaim(claim) {
  return publication.decisions.filter((decision) => claim.decisions.includes(decision.id));
}

function relatedOpenQuestionsForClaim(claim) {
  return publication.openQuestions.filter((question) => claim.openQuestions.includes(question.id));
}

function relatedClaimsForClaim(claim) {
  return publication.claims.filter((candidate) => claim.relatedClaims.includes(candidate.id));
}

function relatedDecisionsForSource(sourceId, sectionNames) {
  return publication.decisions.filter(
    (decision) =>
      decision.references.some((reference) => sectionNames.includes(reference)) ||
      relatedClaimsForSource(sourceId).some((claim) => claim.decisions.includes(decision.id))
  );
}

function relatedOpenQuestionsForSource(sourceId) {
  const ids = new Set([
    ...publication.sources.find((source) => source.id === sourceId).openQuestions,
    ...relatedClaimsForSource(sourceId).flatMap((claim) => claim.openQuestions)
  ]);
  return publication.openQuestions.filter((item) => ids.has(item.id));
}

function renderSectionTagList(sectionNames) {
  return sectionNames.length ? linkSections(sectionNames) : "<span class='empty-state'>None linked yet</span>";
}

function renderRecordLinks(ids, basePath) {
  return ids.length ? linkList(ids, basePath) : "<span class='empty-state'>None linked yet</span>";
}

function renderSourceUrl(source, key) {
  const href = source[key];
  if (href) {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(href)}</a>`;
  }
  if (key === "officialUrl") {
    return `<span class="empty-state">URL verification pending</span><br><span class="note">${escapeHtml(
      source.urlVerificationNote
    )}</span>`;
  }
  return "<span class='empty-state'>No archive URL recorded</span>";
}

function formatDate(value) {
  if (!value) return "Not recorded";
  return value;
}

function renderSourceIndex() {
  const rows = publication.sources
    .map(
      (source) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [
          source.id,
          source.title,
          source.summary,
          source.sections.join(" "),
          source.claims.join(" "),
          source.publisher,
          source.documentType,
          source.classification,
          source.officialUrl || "",
          source.urlVerificationStatus
        ].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(source.documentType)} - ${escapeHtml(source.publisher)}</p>
            <h2 class="row-title"><a href="/sources/${source.slug}.html">${escapeHtml(source.id)} - ${escapeHtml(source.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(source.confidence)}</span>
        </div>
        <p>${escapeHtml(source.summary)}</p>
        <p class="meta-line"><strong>Evidence class:</strong> ${escapeHtml(source.evidenceClass)}</p>
        <p class="meta-line"><strong>Classification:</strong> ${escapeHtml(source.classification)} | <strong>URL status:</strong> ${escapeHtml(source.urlVerificationStatus)}</p>
        <p class="meta-line"><strong>Used in:</strong> ${escapeHtml(source.sections.join(", "))}</p>
      </article>`
    )
    .join("");

  const body = `<div class="actions">
      <a class="button primary" href="/search.html">Search the publication</a>
      <a class="button" href="/audit/appendix-a-open-questions.html">Open questions register</a>
      <a class="button" href="/decision-log.html">Decision log</a>
    </div>
    <label class="search-wrap">
      <span class="sr-only">Search sources</span>
      <input class="search" data-filter-input data-filter-target="[data-filterable]" placeholder="Search source IDs, agencies, sections, or claim summaries">
    </label>
    <section class="panel">
      <h2>Structured source records</h2>
      <p>This release publishes source metadata, citation-verification status, and claim-level trace links for the records already cited in the converted sections. If an official canonical URL could not be verified, the page says so explicitly instead of guessing.</p>
    </section>
    <section class="panel stack">${rows}</section>`;

  return layout({
    title: "Sources | The Citizen Audit",
    description: "Structured and searchable source records for The Citizen Audit.",
    eyebrow: "Evidence Library",
    heading: "Sources",
    lede: "Every published figure should point to a source, a section, a basis, and any unresolved limitation.",
    body,
    footerLabel: "Source library - structured records"
  });
}

function renderSourceDetail(source) {
  const relatedClaims = relatedClaimsForSource(source.id);
  const relatedDecisions = relatedDecisionsForSource(source.id, source.sections);
  const relatedOpenQuestions = relatedOpenQuestionsForSource(source.id);
  const body = `<div class="actions">
      <a class="button" href="/sources.html">Back to source index</a>
      <a class="button" href="/search.html?q=${encodeURIComponent(source.id)}">Search related records</a>
      <a class="button" href="/explorer.html">Open explorer</a>
    </div>
    <section class="panel">
      <h2>Source summary</h2>
      <p>${escapeHtml(source.summary)}</p>
      <div class="meta-grid">
        <p><strong>Source ID:</strong> ${escapeHtml(source.id)}</p>
        <p><strong>Publisher:</strong> ${escapeHtml(source.publisher)}</p>
        <p><strong>Agency label:</strong> ${escapeHtml(source.agency)}</p>
        <p><strong>Document type:</strong> ${escapeHtml(source.documentType)}</p>
        <p><strong>Classification:</strong> ${escapeHtml(source.classification)}</p>
        <p><strong>Confidence:</strong> ${escapeHtml(source.confidence)}</p>
        <p><strong>Evidence class:</strong> ${escapeHtml(source.evidenceClass)}</p>
        <p><strong>Publication date:</strong> ${escapeHtml(formatDate(source.publicationDate))}</p>
        <p><strong>Retrieval date:</strong> ${escapeHtml(formatDate(source.retrievalDate))}</p>
        <p><strong>Citation priority:</strong> ${escapeHtml(source.citationPriority)}</p>
        <p><strong>URL verification:</strong> ${escapeHtml(source.urlVerificationStatus)}</p>
        <p><strong>Sections:</strong> ${renderSectionTagList(source.sections)}</p>
      </div>
    </section>
    <section class="panel">
      <h2>Citation metadata</h2>
      <div class="meta-grid">
        <p><strong>Official URL:</strong><br>${renderSourceUrl(source, "officialUrl")}</p>
        <p><strong>Archive URL:</strong><br>${renderSourceUrl(source, "archiveUrl")}</p>
      </div>
      <p class="note">${escapeHtml(source.urlVerificationNote)}</p>
    </section>
    <section class="panel">
      <h2>Claims supported</h2>
      ${
        relatedClaims.length
          ? `<div class="stack">${relatedClaims
              .map(
                (claim) => `<article class="card stack">
                  <p class="row-kicker">${escapeHtml(claim.id)} - ${escapeHtml(claim.section)}</p>
                  <h3><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.title)}</a></h3>
                  <p>${escapeHtml(claim.summary)}</p>
                  <p><strong>Decisions</strong><br>${renderRecordLinks(claim.decisions, "/decision-log/")}</p>
                  <p><strong>Open questions</strong><br>${renderRecordLinks(claim.openQuestions, "/open-questions/")}</p>
                </article>`
              )
              .join("")}</div>`
          : `<ul>${source.claims.map((claim) => `<li>${escapeHtml(claim)}</li>`).join("")}</ul>`
      }
    </section>
    <section class="panel">
      <h2>Related decision IDs</h2>
      ${
        relatedDecisions.length
          ? `<p>${linkList(
              relatedDecisions.map((decision) => decision.id),
              "/decision-log/"
            )}</p>`
          : "<p>No decision entry is linked through the current section map.</p>"
      }
    </section>
    <section class="panel">
      <h2>Related open questions</h2>
      ${
        relatedOpenQuestions.length
          ? `<p>${renderRecordLinks(
              relatedOpenQuestions.map((item) => item.id),
              "/open-questions/"
            )}</p>`
          : "<p>No open question is directly attached to this source in the current web edition.</p>"
      }
    </section>`;

  return layout({
    title: `${source.id} | The Citizen Audit`,
    description: `${source.id} source record for The Citizen Audit.`,
    eyebrow: "Source Record",
    heading: `${source.id} - ${source.title}`,
    lede: "This page captures how the current web edition uses the source without altering the locked analytical conclusions.",
    body,
    footerLabel: `${source.id} - source record`
  });
}

function renderOpenQuestionIndex() {
  const rows = publication.openQuestions
    .map(
      (item) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [item.id, item.title, item.sections.join(" "), item.whyItMatters, item.recordNeeded].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(item.status)} - ${escapeHtml(item.sections.join(", "))}</p>
            <h2 class="row-title"><a href="/open-questions/${item.slug}.html">${escapeHtml(item.id)} - ${escapeHtml(item.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(item.status)}</span>
        </div>
        <p>${escapeHtml(item.whyItMatters)}</p>
        <p class="meta-line"><strong>Record needed:</strong> ${escapeHtml(item.recordNeeded)}</p>
      </article>`
    )
    .join("");

  const body = `<div class="actions">
      <a class="button primary" href="/audit/appendix-a-open-questions.html">Read Appendix A</a>
      <a class="button" href="/sources.html">Check supporting sources</a>
    </div>
    <label class="search-wrap">
      <span class="sr-only">Search open questions</span>
      <input class="search" data-filter-input data-filter-target="[data-filterable]" placeholder="Search open question IDs, sections, or records needed">
    </label>
    <section class="panel">
      <h2>Open-question register</h2>
      <p>The publication treats unresolved items as first-class records. Each question explains what remains unknown, why it matters, and what public record would resolve it.</p>
    </section>
    <section class="panel stack">${rows}</section>`;

  return layout({
    title: "Open Questions | The Citizen Audit",
    description: "Open questions register for The Citizen Audit.",
    eyebrow: "Open Question Register",
    heading: "Open Questions",
    lede: "Unresolved items stay visible so the site never pretends a measurement is complete when the public record is not.",
    body,
    footerLabel: "Open questions - current register"
  });
}

function renderOpenQuestionDetail(item) {
  const relatedDecisions = relatedDecisionsForSections(item.sections);
  const relatedClaims = relatedClaimsForOpenQuestion(item.id);
  const body = `<div class="actions">
      <a class="button" href="/open-questions.html">Back to open questions</a>
      <a class="button" href="/audit/appendix-a-open-questions.html">Appendix A</a>
      <a class="button" href="/explorer.html">Open explorer</a>
    </div>
    <section class="panel">
      <h2>Why it matters</h2>
      <p>${escapeHtml(item.whyItMatters)}</p>
    </section>
    <section class="panel">
      <h2>Current web-edition status</h2>
      <p>${escapeHtml(item.currentState)}</p>
      <div class="meta-grid">
        <p><strong>Status:</strong> ${escapeHtml(item.status)}</p>
        <p><strong>Raised in:</strong> ${linkSections(item.sections)}</p>
      </div>
    </section>
    <section class="panel">
      <h2>Record required to resolve it</h2>
      <p>${escapeHtml(item.recordNeeded)}</p>
    </section>
    <section class="panel">
      <h2>Related source IDs</h2>
      ${
        item.relatedSources.length
          ? `<p>${linkList(item.relatedSources, "/sources/")}</p>`
          : "<p>No source record has been linked yet in the current web edition.</p>"
      }
    </section>
    <section class="panel">
      <h2>Claims blocked or limited</h2>
      ${
        relatedClaims.length
          ? `<div class="stack">${relatedClaims
              .map(
                (claim) => `<article class="card stack">
                  <p class="row-kicker">${escapeHtml(claim.id)} - ${escapeHtml(claim.section)}</p>
                  <h3><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.title)}</a></h3>
                  <p>${escapeHtml(claim.summary)}</p>
                </article>`
              )
              .join("")}</div>`
          : "<p>No trace-claim record currently routes through this open question.</p>"
      }
    </section>
    <section class="panel">
      <h2>Related decision IDs</h2>
      ${
        relatedDecisions.length
          ? `<p>${linkList(
              relatedDecisions.map((decision) => decision.id),
              "/decision-log/"
            )}</p>`
          : "<p>No decision entry is linked through the current section map.</p>"
      }
    </section>`;

  return layout({
    title: `${item.id} | The Citizen Audit`,
    description: `${item.id} open question in The Citizen Audit.`,
    eyebrow: "Open Question",
    heading: `${item.id} - ${item.title}`,
    lede: "Open questions are published to keep the limits of the current record explicit.",
    body,
    footerLabel: `${item.id} - open question`
  });
}

function renderDecisionLog() {
  const decisions = publication.decisions
    .map(
      (item) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [item.id, item.title, item.body, item.references.join(" ")].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">Canonical methodology decision</p>
            <h2 class="row-title"><a href="/decision-log/${item.slug}.html">${escapeHtml(item.id)} - ${escapeHtml(item.title)}</a></h2>
          </div>
        </div>
        <p>${escapeHtml(item.body)}</p>
        <p class="meta-line"><strong>Visible references:</strong> ${escapeHtml(item.references.join(", "))}</p>
      </article>`
    )
    .join("");

  const body = `<div class="actions">
      <a class="button primary" href="/sources.html">Source library</a>
      <a class="button" href="/search.html">Search the publication</a>
    </div>
    <label class="search-wrap">
      <span class="sr-only">Search decision log</span>
      <input class="search" data-filter-input data-filter-target="[data-filterable]" placeholder="Search decision IDs, rules, or section references">
    </label>
    <section class="panel">
      <h2>Decision-log status</h2>
      <p>This release publishes the numbered canonical decisions that are explicitly visible in the v1.0 publication text now converted into the repository. Each record captures the rule as published without rewriting the audit's conclusions.</p>
    </section>
    <section class="panel stack">${decisions}</section>`;

  return layout({
    title: "Decision Log | The Citizen Audit",
    description: "Current methodology decision log for The Citizen Audit.",
    eyebrow: "Decision Log",
    heading: "Decision Log",
    lede: "Methodology decisions belong in public, and the numbered rules visible in Version 1.0 now have their own web records.",
    body,
    footerLabel: "Decision log - canonical numbered rules"
  });
}

function renderDecisionDetail(item) {
  const relatedSources = relatedSourcesForDecision(item);
  const relatedOpenQuestions = relatedOpenQuestionsForDecision(item);
  const relatedClaims = relatedClaimsForDecision(item.id);
  const body = `<div class="actions">
      <a class="button" href="/decision-log.html">Back to decision log</a>
      <a class="button" href="/search.html?q=${encodeURIComponent(item.id)}">Search related records</a>
      <a class="button" href="/explorer.html">Open explorer</a>
    </div>
    <section class="panel">
      <h2>Published rule</h2>
      <p>${escapeHtml(item.body)}</p>
      <div class="meta-grid">
        <p><strong>Decision ID:</strong> ${escapeHtml(item.id)}</p>
        <p><strong>References:</strong> ${linkSections(item.references)}</p>
      </div>
    </section>
    <section class="panel">
      <h2>Why this page exists</h2>
      <p>This record makes the numbered methodology rule addressable in the web edition so sources, sections, and future traceability features can point back to the same canonical decision.</p>
    </section>
    <section class="panel">
      <h2>Related source IDs</h2>
      ${
        relatedSources.length
          ? `<p>${linkList(
              relatedSources.map((source) => source.id),
              "/sources/"
            )}</p>`
          : "<p>No source record is linked through the current section map.</p>"
      }
    </section>
    <section class="panel">
      <h2>Related open questions</h2>
      ${
        relatedOpenQuestions.length
          ? `<p>${linkList(
              relatedOpenQuestions.map((openQuestion) => openQuestion.id),
              "/open-questions/"
            )}</p>`
          : "<p>No open-question record is linked through the current section map.</p>"
      }
    </section>
    <section class="panel">
      <h2>Claims governed</h2>
      ${
        relatedClaims.length
          ? `<div class="stack">${relatedClaims
              .map(
                (claim) => `<article class="card stack">
                  <p class="row-kicker">${escapeHtml(claim.id)} - ${escapeHtml(claim.section)}</p>
                  <h3><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.title)}</a></h3>
                  <p>${escapeHtml(claim.summary)}</p>
                </article>`
              )
              .join("")}</div>`
          : "<p>No trace-claim record currently routes through this decision.</p>"
      }
    </section>`;

  return layout({
    title: `${item.id} | The Citizen Audit`,
    description: `${item.id} decision-log entry for The Citizen Audit.`,
    eyebrow: "Decision Record",
    heading: `${item.id} - ${item.title}`,
    lede: "Decision records preserve the publication's binding methodological rules in one addressable location.",
    body,
    footerLabel: `${item.id} - decision record`
  });
}

function renderSectionActions(section) {
  const links = [];
  const previousSection = section.previousSectionId
    ? publication.sections.find((item) => item.id === section.previousSectionId)
    : null;
  const nextSection = section.nextSectionId
    ? publication.sections.find((item) => item.id === section.nextSectionId)
    : null;
  if (previousSection) {
    links.push(`<a class="button" href="${previousSection.url}">Previous Section</a>`);
  }
  links.push(`<a class="button" href="/audit.html">Audit Index</a>`);
  if (nextSection) {
    links.push(`<a class="button" href="${nextSection.url}">Next Section</a>`);
  }
  return `<div class="actions">${links.join("")}</div>`;
}

function renderBlockHtml(block) {
  if (block.type === "paragraph" || block.type === "methodologyNote" || block.type === "bottomLine") {
    return block.html;
  }
  if (block.type === "callout") {
    return block.html;
  }
  if (block.type === "table") {
    return block.html;
  }
  if (block.type === "list") {
    return block.html;
  }
  return "";
}

function groupSectionBlocks(contentBlocks) {
  const groups = [];
  let current = null;
  for (const block of contentBlocks) {
    if (block.type === "heading") {
      current = {
        heading: block.text,
        blocks: []
      };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = { heading: "", blocks: [] };
      groups.push(current);
    }
    current.blocks.push(block);
  }
  return groups;
}

function renderSectionVerificationPanel(section) {
  const relatedClaims = publication.claims.filter((claim) => claim.sectionId === section.id);
  return `<section class="panel verification">
      <div>
        <p class="row-kicker">Structured Verification</p>
        <h2>Trace this section from the data model.</h2>
        <p><strong>Summary:</strong> ${escapeHtml(section.summary)}</p>
        <p><strong>Claims:</strong> ${escapeHtml(String(section.claimIds.length))}</p>
        <p><strong>Claim links:</strong> ${relatedClaims.length ? linkClaims(relatedClaims.map((claim) => claim.id)) : "<span class='empty-state'>No linked claims</span>"}</p>
      </div>
      <div class="stack">
        <p><strong>Sources</strong><br>${renderRecordLinks(section.sourceIds, "/sources/")}</p>
        <p><strong>Decisions</strong><br>${renderRecordLinks(section.decisionIds, "/decision-log/")}</p>
        <p><strong>Open Questions</strong><br>${renderRecordLinks(section.openQuestionIds, "/open-questions/")}</p>
        <p><strong>Related Sections</strong><br>${renderSectionTagList(section.relatedSectionIds)}</p>
      </div>
    </section>`;
}

function renderSectionClaimsPanel(section) {
  const claims = publication.claims.filter((claim) => claim.sectionId === section.id);
  if (!claims.length) {
    return "";
  }
  return `<section class="panel">
      <h2>Claims In This Section</h2>
      <p>Reviewers should be able to move from section to claim without leaving the generated evidence path.</p>
      <div class="grid">${claims
        .map(
          (claim) => `<article class="card stack">
            <p class="row-kicker">${escapeHtml(claim.id)}</p>
            <h3><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.title)}</a></h3>
            <p>${escapeHtml(claim.statement)}</p>
            <p><strong>Sources</strong><br>${renderRecordLinks(claim.sources, "/sources/")}</p>
          </article>`
        )
        .join("")}</div>
    </section>`;
}

function renderSectionContent(section) {
  return groupSectionBlocks(section.contentBlocks)
    .map(
      (group) => `<section class="panel">
        ${group.heading ? `<h2>${escapeHtml(group.heading)}</h2>` : ""}
        ${group.blocks.map(renderBlockHtml).join("")}
      </section>`
    )
    .join("");
}

function renderSectionPage(section) {
  const body = `<div class="sr-only" data-generated-source="section-model" data-section-id="${escapeHtml(
    section.id
  )}"></div>
    ${renderSectionActions(section)}
    ${renderSectionVerificationPanel(section)}
    ${renderSectionClaimsPanel(section)}
    ${renderSectionContent(section)}`;

  return layout({
    title: `${section.id} - ${section.title} | The Citizen Audit`,
    description: `Canonical ${section.id} web conversion for The Citizen Audit v1.0.`,
    eyebrow: `${section.id} - Version 1.0 LOCKED`,
    heading: section.title,
    lede: section.summary,
    body,
    footerLabel: `${section.id} - ${section.title}`
  });
}

function renderClaimIndex() {
  const rows = publication.claims
    .map(
      (claim) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [
          claim.id,
          claim.title,
          claim.statement,
          claim.sectionId,
          claim.sources.join(" "),
          claim.decisions.join(" "),
          claim.openQuestions.join(" ")
        ].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(claim.sectionId)} - ${escapeHtml(claim.status)}</p>
            <h2 class="row-title"><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.id)} - ${escapeHtml(claim.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(claim.confidence)}</span>
        </div>
        <p>${escapeHtml(claim.statement)}</p>
        <p class="meta-line"><strong>Sources:</strong> ${escapeHtml(claim.sources.join(", "))}</p>
      </article>`
    )
    .join("");

  const body = `<div class="actions">
      <a class="button primary" href="/audit.html">Audit index</a>
      <a class="button" href="/explorer.html">Explorer</a>
      <a class="button" href="/platform.html">Platform dashboard</a>
    </div>
    <label class="search-wrap">
      <span class="sr-only">Search claims</span>
      <input class="search" data-filter-input data-filter-target="[data-filterable]" placeholder="Search claim IDs, sections, statements, or linked records">
    </label>
    <section class="panel">
      <h2>Claim database</h2>
      <p>Claims are now first-class structured records. Each claim page links directly to its section, sources, decisions, open questions, and related claims.</p>
    </section>
    <section class="panel stack">${rows}</section>`;

  return layout({
    title: "Claims | The Citizen Audit",
    description: "Structured claim database for The Citizen Audit.",
    eyebrow: "Claim Database",
    heading: "Claims",
    lede: "Reviewers should be able to move from audit to section to claim in three clicks or fewer, then branch outward into the supporting evidence graph.",
    body,
    footerLabel: "Claims - structured records"
  });
}

function renderClaimDetail(claim) {
  const section = publication.sections.find((item) => item.id === claim.sectionId);
  const relatedSources = relatedSourcesForClaim(claim);
  const relatedDecisions = relatedDecisionsForClaim(claim);
  const relatedOpenQuestions = relatedOpenQuestionsForClaim(claim);
  const siblingClaims = relatedClaimsForClaim(claim);
  const body = `<div class="actions">
      <a class="button" href="/claims.html">Back to claims</a>
      <a class="button" href="${escapeHtml(section?.url || "/audit.html")}">Open section</a>
      <a class="button" href="/search.html?q=${encodeURIComponent(claim.id)}">Search related records</a>
    </div>
    <section class="panel">
      <h2>Claim record</h2>
      <div class="meta-grid">
        <p><strong>Claim ID:</strong> ${escapeHtml(claim.id)}</p>
        <p><strong>Audit ID:</strong> ${escapeHtml(claim.auditId)}</p>
        <p><strong>Section ID:</strong> ${escapeHtml(claim.sectionId)}</p>
        <p><strong>Status:</strong> ${escapeHtml(claim.status)}</p>
        <p><strong>Confidence:</strong> ${escapeHtml(claim.confidence)}</p>
      </div>
      <p>${escapeHtml(claim.statement)}</p>
    </section>
    <section class="panel">
      <h2>Referenced By</h2>
      <p><strong>Audit</strong><br><a class="tag" href="/audit.html">${escapeHtml(publication.primaryAudit?.title || "Audit")}</a></p>
      <p><strong>Section</strong><br>${section ? `<a class="tag" href="${section.url}">${escapeHtml(section.id)}</a>` : "<span class='empty-state'>No linked section</span>"}</p>
    </section>
    <section class="panel">
      <h2>Related Sources</h2>
      ${relatedSources.length ? `<p>${renderRecordLinks(relatedSources.map((item) => item.id), "/sources/")}</p>` : "<p>No linked source records.</p>"}
    </section>
    <section class="panel">
      <h2>Related Decisions</h2>
      ${relatedDecisions.length ? `<p>${renderRecordLinks(relatedDecisions.map((item) => item.id), "/decision-log/")}</p>` : "<p>No linked decision records.</p>"}
    </section>
    <section class="panel">
      <h2>Related Open Questions</h2>
      ${relatedOpenQuestions.length ? `<p>${renderRecordLinks(relatedOpenQuestions.map((item) => item.id), "/open-questions/")}</p>` : "<p>No linked open-question records.</p>"}
    </section>
    <section class="panel">
      <h2>Related Claims</h2>
      ${
        siblingClaims.length
          ? `<div class="stack">${siblingClaims
              .map(
                (item) => `<article class="card stack">
                  <p class="row-kicker">${escapeHtml(item.id)} - ${escapeHtml(item.sectionId)}</p>
                  <h3><a href="/claims/${item.id.toLowerCase()}.html">${escapeHtml(item.title)}</a></h3>
                  <p>${escapeHtml(item.statement)}</p>
                </article>`
              )
              .join("")}</div>`
          : "<p>No related-claim records are linked yet.</p>"
      }
    </section>
    <section class="panel">
      <h2>Revision History</h2>
      <ul>${claim.revisionHistory
        .map(
          (entry) =>
            `<li>${escapeHtml(entry.date)} - ${escapeHtml(entry.version)} - ${escapeHtml(entry.summary)}</li>`
        )
        .join("")}</ul>
    </section>`;

  return layout({
    title: `${claim.id} | The Citizen Audit`,
    description: `${claim.id} claim record for The Citizen Audit.`,
    eyebrow: "Claim Record",
    heading: `${claim.id} - ${claim.title}`,
    lede: "Claims are first-class structured records so the evidence platform can point every published conclusion back to its sources, decisions, and unresolved questions.",
    body,
    footerLabel: `${claim.id} - claim record`
  });
}

function renderReleasePage(pageKind) {
  const cards = publication.releases
    .map(
      (release) => `<article class="card stack">
        <p class="row-kicker">v${escapeHtml(release.version)} - ${escapeHtml(release.date)}</p>
        <h2 class="row-title">${escapeHtml(release.title)}</h2>
        <ul>${release.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      </article>`
    )
    .join("");

  const copyByKind = {
    "release-notes": {
      eyebrow: "Release Notes",
      heading: "Release Notes",
      lede: "Each release slice should explain what shipped, what remains, and what changed in the publication platform."
    },
    "version-history": {
      eyebrow: "Version History",
      heading: "Version History",
      lede: "The publication is analytically frozen by edition, but the platform around it should show its delivery history clearly."
    },
    changelog: {
      eyebrow: "Changelog",
      heading: "Changelog",
      lede: "Platform changes are logged publicly so readers can track what improved around the locked publication."
    }
  };

  const copy = copyByKind[pageKind];
  const body = `<div class="actions">
      <a class="button" href="/release-notes.html">Release notes</a>
      <a class="button" href="/version-history.html">Version history</a>
      <a class="button" href="/changelog.html">Changelog</a>
    </div>
    <section class="grid">${cards}</section>`;

  return layout({
    title: `${copy.heading} | The Citizen Audit`,
    description: `${copy.heading} for The Citizen Audit platform.`,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    lede: copy.lede,
    body,
    footerLabel: `${copy.heading.toLowerCase()} - platform history`
  });
}

function renderSearchPage() {
  const body = `<section class="panel">
      <h2>Publication search</h2>
      <p>Search across structured source records, open questions, decision-log entries, and key publication sections extracted into the current web edition.</p>
      <label class="search-wrap">
        <span class="sr-only">Search the publication</span>
        <input class="search" data-publication-search placeholder="Search IDs, sections, methods, or limitations">
      </label>
    </section>
    <section class="panel">
      <div data-search-results class="stack"></div>
    </section>`;

  return layout({
    title: "Search | The Citizen Audit",
    description: "Full-text publication search for The Citizen Audit.",
    eyebrow: "Search",
    heading: "Search the publication",
    lede: "The current static release uses a client-side search index generated from the repository's structured research records.",
    body,
    footerLabel: "Search - publication index"
  });
}

function renderAppendixA() {
  const rows = publication.openQuestions
    .map(
      (item) => `<tr>
        <td><a href="/open-questions/${item.slug}.html">${escapeHtml(item.id)}</a></td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.sections.join(", "))}</td>
        <td>${escapeHtml(item.recordNeeded)}</td>
      </tr>`
    )
    .join("");

  const body = `<div class="actions">
      <a class="button primary" href="/open-questions.html">Open question pages</a>
      <a class="button" href="/audit.html">Audit index</a>
    </div>
    <section class="panel">
      <h2>Appendix A register</h2>
      <p>This appendix turns the current web edition's unresolved items into a readable public register. It does not add new conclusions; it surfaces the limits already named in converted sections.</p>
      <table>
        <tr><th>ID</th><th>Question</th><th>Raised in</th><th>Record needed</th></tr>
        ${rows}
      </table>
    </section>`;

  return layout({
    title: "Appendix A | The Citizen Audit",
    description: "Appendix A open-question register for The Citizen Audit.",
    eyebrow: "Appendix A - Version 1.0 register",
    heading: "Appendix A - Open Questions Register",
    lede: "The publication names what it cannot yet measure, why that gap exists, and what record would resolve it.",
    body,
    footerLabel: "Appendix A - open-question register"
  });
}

function renderAppendixB() {
  const rows = publication.transparencyScorecard
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.area)}</td>
        <td>${escapeHtml(item.section)}</td>
        <td>${escapeHtml(item.transparency)}</td>
        <td>${escapeHtml(item.measurable)}</td>
        <td>${escapeHtml(item.limitation)}</td>
      </tr>`
    )
    .join("");

  const body = `<div class="actions">
      <a class="button primary" href="/sources.html">Evidence library</a>
      <a class="button" href="/audit.html">Audit index</a>
    </div>
    <section class="panel">
      <h2>Transparency scorecard</h2>
      <p>The scorecard summarizes how far the current public record goes in the converted sections already present in the repository. It distinguishes measurable lanes from lanes that remain bounded by missing public breakouts.</p>
      <table>
        <tr><th>Area</th><th>Section</th><th>Transparency</th><th>What is measurable</th><th>Main limitation</th></tr>
        ${rows}
      </table>
    </section>`;

  return layout({
    title: "Appendix B | The Citizen Audit",
    description: "Appendix B transparency scorecard for The Citizen Audit.",
    eyebrow: "Appendix B - Version 1.0 scorecard",
    heading: "Appendix B - Transparency Scorecard",
    lede: "Readers should be able to see which lanes are well-published, which are only partly measurable, and where federal reporting stops.",
    body,
    footerLabel: "Appendix B - transparency scorecard"
  });
}

function renderReviewPage() {
  const body = `<div class="actions">
      <a class="button primary" href="/explorer.html">Open Explorer</a>
      <a class="button" href="/sources.html">Browse sources</a>
      <a class="button" href="/corrections.html">Corrections page</a>
    </div>
    <section class="panel stack">
      <h2>How to verify the audit</h2>
      <p>Start from a section page, open its verification panel, then follow each claim into its source, decision, and open-question records. The platform is designed so readers can move from published prose to supporting evidence without changing the Version 1.0 conclusions.</p>
      <p>Where the public record is incomplete, the platform keeps that incompleteness visible instead of filling it with modeled certainty.</p>
    </section>
    <section class="grid">
      <article class="card stack">
        <p class="row-kicker">Methodology</p>
        <h3>What the platform preserves</h3>
        <p>Number type, resource category, beneficiary chain, section ownership, and unresolved limitations stay separate across the generated site.</p>
      </article>
      <article class="card stack">
        <p class="row-kicker">Evidence Standards</p>
        <h3>Primary before secondary</h3>
        <p>Source records now label document type, primary or secondary classification, evidence class, confidence, and citation-verification status.</p>
      </article>
      <article class="card stack">
        <p class="row-kicker">Confidence Model</p>
        <h3>Confidence is published, not implied</h3>
        <p>The platform preserves section confidence notes and source confidence labels so readers can distinguish direct evidence from corroboration and context.</p>
      </article>
    </section>
    <section class="panel stack">
      <h2>How to submit corrections</h2>
      <p>Use the published corrections workflow to report source mismatches, broken trace links, missing metadata, or verified public records that should resolve an open question. Corrections should cite the exact page, claim, and source record involved.</p>
      <p>Corrections are tracked in public release notes, version history, and changelog pages so the platform never hides what changed around the locked publication.</p>
    </section>
    <section class="panel stack">
      <h2>How corrections are tracked</h2>
      <p>Every release should record platform-level changes without silently rewriting Version 1.0 analytical conclusions. Decision history is preserved, open questions remain public, and unresolved URL verification is flagged explicitly.</p>
      <p>Version history describes delivery milestones, changelog captures platform changes, and release notes summarize what shipped in each iteration.</p>
    </section>`;

  return layout({
    title: "Reviewer Portal | The Citizen Audit",
    description: "Reviewer portal for verifying methodology, evidence, confidence, corrections, and version history in The Citizen Audit.",
    eyebrow: "Reviewer Portal",
    heading: "Review And Verify The Audit",
    lede: "This portal explains how to test the publication, how evidence is classified, how confidence is communicated, and how corrections are carried without weakening transparency.",
    body,
    footerLabel: "Reviewer portal"
  });
}

function renderExplorerPage() {
  const body = `<div class="actions">
      <a class="button primary" href="/search.html">Search the publication</a>
      <a class="button" href="/sources.html">Browse sources</a>
      <a class="button" href="/review.html">Reviewer portal</a>
      <a class="button" href="/decision-log.html">Review decisions</a>
    </div>
    <section class="panel">
      <h2>Traceability Explorer</h2>
      <p>Navigate from the audit to sections, from sections to claims, and from claims to sources, decisions, and open questions.</p>
      <label class="search-wrap">
        <span class="sr-only">Search traceability records</span>
        <input class="search" data-traceability-search placeholder="Try Section 7, C-009, S-065, D-020, A-018, ORR, Medicaid, or housing">
      </label>
      <div class="grid" data-traceability-grid></div>
    </section>
    <section class="panel">
      <h2>Claim Explorer</h2>
      <p>Filter claim-level trace records directly.</p>
      <label class="search-wrap">
        <span class="sr-only">Search claims</span>
        <input class="search" data-claim-search placeholder="Try C-016, conservative total, ORR, Section 214, or SSI">
      </label>
      <div class="grid" data-claim-grid></div>
    </section>
    <section class="panel">
      <h2>Scale Explorer</h2>
      <p>Enter an amount and compare how the audit's currently measurable lanes relate in scale. These lanes remain basis-segregated and are not a blended grand total.</p>
      <label for="taxAmount"><strong>Amount to explore</strong></label>
      <input id="taxAmount" class="search" data-tax-amount type="number" min="1" value="100">
      <div data-explorer-output></div>
    </section>
    <section class="panel">
      <h2>Important Limitation</h2>
      <p>The explorer intentionally labels each lane by basis and source. It does not convert incompatible obligations, disbursements, cumulative figures, point-in-time computations, or federal-plus-state totals into one blended federal total.</p>
    </section>`;

  return layout({
    title: "Traceability Explorer | The Citizen Audit",
    description: "Claim-to-source traceability explorer for The Citizen Audit.",
    eyebrow: "Traceability Explorer",
    heading: "Traceability Explorer",
    lede: "Follow each converted lane back to its linked Source IDs, Decision Log rules, and Open Question records. This page is a verification surface, not a replacement for the locked audit text.",
    body,
    footerLabel: "Traceability explorer"
  });
}

function renderPlatformPage(metrics) {
  const body = `<div class="actions">
      <a class="button primary" href="/claims.html">Claim database</a>
      <a class="button" href="/explorer.html">Explorer</a>
      <a class="button" href="/review.html">Reviewer portal</a>
    </div>
    <section class="grid">
      <article class="card stack"><p class="row-kicker">Published audits</p><h2>${escapeHtml(String(metrics.audits))}</h2></article>
      <article class="card stack"><p class="row-kicker">Sections</p><h2>${escapeHtml(String(metrics.sections))}</h2></article>
      <article class="card stack"><p class="row-kicker">Claims</p><h2>${escapeHtml(String(metrics.claims))}</h2></article>
      <article class="card stack"><p class="row-kicker">Sources</p><h2>${escapeHtml(String(metrics.sources))}</h2></article>
      <article class="card stack"><p class="row-kicker">Decision logs</p><h2>${escapeHtml(String(metrics.decisionLogs))}</h2></article>
      <article class="card stack"><p class="row-kicker">Open questions</p><h2>${escapeHtml(String(metrics.openQuestions))}</h2></article>
      <article class="card stack"><p class="row-kicker">Citation coverage</p><h2>${escapeHtml(String(metrics.citationCoverage.percentVerified))}%</h2></article>
      <article class="card stack"><p class="row-kicker">Traceability %</p><h2>${escapeHtml(String(metrics.traceabilityPercent))}%</h2></article>
      <article class="card stack"><p class="row-kicker">QA status</p><h2>${escapeHtml(metrics.qaStatus.status)}</h2></article>
      <article class="card stack"><p class="row-kicker">Build version</p><h2>${escapeHtml(metrics.buildVersion)}</h2></article>
      <article class="card stack"><p class="row-kicker">Platform health</p><h2>${escapeHtml(metrics.platformHealth)}</h2></article>
      <article class="card stack"><p class="row-kicker">HTML pages</p><h2>${escapeHtml(String(metrics.htmlPages))}</h2></article>
    </section>
    <section class="panel stack">
      <h2>Dashboard notes</h2>
      <p>This dashboard is generated from the same structured records that drive claim pages, source pages, search, explorer data, graph outputs, and QA.</p>
      <p>Adding a future audit should mean adding new audit, section, claim, source, decision, and open-question records, then running the build again without infrastructure changes.</p>
    </section>`;

  return layout({
    title: "Platform Dashboard | The Citizen Audit",
    description: "Platform dashboard for publication status, traceability, QA, and build health in The Citizen Audit.",
    eyebrow: "Platform Dashboard",
    heading: "Platform Dashboard",
    lede: "The platform now treats structured data as the source of truth and generates the evidence surfaces around it.",
    body,
    footerLabel: "Platform dashboard"
  });
}

function buildSearchIndex() {
  const items = [];
  for (const page of publication.pages) {
    items.push({
      type: "Page",
      id: page.id,
      title: page.heading,
      url: page.url,
      text: [
        page.title,
        page.description,
        page.eyebrow,
        page.lede,
        JSON.stringify(page.contentBlocks),
        page.relatedSectionIds.join(" "),
        page.relatedClaimIds.join(" "),
        page.relatedSourceIds.join(" "),
        page.relatedDecisionIds.join(" "),
        page.relatedOpenQuestionIds.join(" ")
      ].join(" ")
    });
  }
  for (const source of publication.sources) {
    items.push({
      type: "Source",
      id: source.id,
      title: source.title,
      url: `/sources/${source.slug}.html`,
      text: [
        source.summary,
        source.sections.join(" "),
        source.claims.join(" "),
        source.openQuestions.join(" "),
        source.publisher,
        source.documentType,
        source.classification,
        source.officialUrl || "",
        source.urlVerificationStatus
      ].join(" ")
    });
  }
  for (const item of publication.openQuestions) {
    items.push({
      type: "Open question",
      id: item.id,
      title: item.title,
      url: `/open-questions/${item.slug}.html`,
      text: [item.whyItMatters, item.currentState, item.recordNeeded, item.sections.join(" "), item.relatedSources.join(" ")].join(" ")
    });
  }
  for (const decision of publication.decisions) {
    items.push({
      type: "Decision",
      id: decision.id,
      title: decision.title,
      url: `/decision-log/${decision.slug}.html`,
      text: [decision.body, decision.references.join(" ")].join(" ")
    });
  }
  for (const section of publication.sectionRecords) {
    items.push({
      type: "Section",
      id: section.id,
      title: section.title,
      url: section.url,
      text: [
        section.summary,
        section.sources.join(" "),
        section.decisions.join(" "),
        section.openQuestions.join(" "),
        section.relatedSections.join(" ")
      ].join(" ")
    });
  }
  for (const claim of publication.traceClaims) {
    items.push({
      type: "Claim",
      id: claim.id,
      title: claim.title,
      url: `/claims/${claim.id.toLowerCase()}.html`,
      text: [
        claim.summary,
        claim.section,
        claim.sources.join(" "),
        claim.decisions.join(" "),
        claim.openQuestions.join(" ")
      ].join(" ")
    });
  }
  return items;
}

function buildClaimDatabase() {
  return {
    generatedAt: new Date().toISOString(),
    audits: publication.audits.map((audit) => ({ id: audit.id, title: audit.title })),
    sections: publication.sections.map((section) => ({
      id: section.id,
      auditId: section.auditId,
      title: section.title,
      url: section.url,
      claimIds: section.claimIds
    })),
    claims: publication.claims
  };
}

function buildCrossReferenceTables() {
  return {
    generatedAt: new Date().toISOString(),
    ...publication.crossReferences
  };
}

function buildEvidenceGraph() {
  return {
    generatedAt: new Date().toISOString(),
    pages: publication.pages.map((page) => ({
      id: page.id,
      title: page.heading,
      audits: page.relatedAuditIds,
      sections: page.relatedSectionIds,
      claims: page.relatedClaimIds,
      sources: page.relatedSourceIds,
      decisions: page.relatedDecisionIds,
      openQuestions: page.relatedOpenQuestionIds,
      connectedIds: unique([
        ...page.relatedAuditIds,
        ...page.relatedSectionIds,
        ...page.relatedClaimIds,
        ...page.relatedSourceIds,
        ...page.relatedDecisionIds,
        ...page.relatedOpenQuestionIds
      ])
    })),
    audits: publication.audits.map((audit) => ({
      id: audit.id,
      title: audit.title,
      sections: audit.sectionIds,
      claims: audit.claimIds,
      sources: audit.sourceIds,
      decisions: audit.decisionIds,
      openQuestions: audit.openQuestionIds,
      connectedIds: unique([
        ...audit.sectionIds,
        ...audit.claimIds,
        ...audit.sourceIds,
        ...audit.decisionIds,
        ...audit.openQuestionIds
      ])
    })),
    sections: publication.sections.map((section) => ({
      id: section.id,
      title: section.title,
      audits: [section.auditId],
      claims: section.claimIds,
      sources: section.sourceIds,
      decisions: section.decisionIds,
      openQuestions: section.openQuestionIds,
      relatedSections: section.relatedSectionIds,
      connectedIds: unique([
        section.auditId,
        ...section.claimIds,
        ...section.sourceIds,
        ...section.decisionIds,
        ...section.openQuestionIds,
        ...section.relatedSectionIds
      ])
    })),
    claims: publication.claims.map((claim) => ({
      id: claim.id,
      title: claim.title,
      audits: [claim.auditId],
      sections: [claim.sectionId],
      sources: claim.sources,
      decisions: claim.decisions,
      openQuestions: claim.openQuestions,
      relatedClaims: claim.relatedClaims,
      connectedIds: unique([
        claim.auditId,
        claim.sectionId,
        ...claim.sources,
        ...claim.decisions,
        ...claim.openQuestions,
        ...claim.relatedClaims
      ])
    })),
    sources: publication.sources.map((source) => ({
      id: source.id,
      title: source.title,
      audits: source.auditIds || [],
      sections: source.sectionIds || source.sections || [],
      claims: source.claimIds || [],
      decisions: source.decisionIds || [],
      openQuestions: source.openQuestionIds || [],
      connectedIds: unique([
        ...(source.auditIds || []),
        ...(source.sectionIds || source.sections || []),
        ...(source.claimIds || []),
        ...(source.decisionIds || []),
        ...(source.openQuestionIds || [])
      ])
    })),
    decisions: publication.decisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      audits: decision.auditIds || [],
      sections: decision.sectionIds || decision.references || [],
      claims: decision.claimIds || [],
      sources: decision.sourceIds || [],
      openQuestions: decision.openQuestionIds || [],
      connectedIds: unique([
        ...(decision.auditIds || []),
        ...(decision.sectionIds || decision.references || []),
        ...(decision.claimIds || []),
        ...(decision.sourceIds || []),
        ...(decision.openQuestionIds || [])
      ])
    })),
    openQuestions: publication.openQuestions.map((question) => ({
      id: question.id,
      title: question.title,
      audits: question.auditIds || [],
      sections: question.sectionIds || question.sections || [],
      claims: question.claimIds || [],
      sources: question.sourceIds || question.relatedSources || [],
      decisions: question.decisionIds || [],
      connectedIds: unique([
        ...(question.auditIds || []),
        ...(question.sectionIds || question.sections || []),
        ...(question.claimIds || []),
        ...(question.sourceIds || question.relatedSources || []),
        ...(question.decisionIds || [])
      ])
    }))
  };
}

function buildManifest(outputs) {
  const generatedSectionPages = publication.sections.filter((section) => /^Section \d+$/.test(section.id));
  return {
    generatedAt: new Date().toISOString(),
    buildVersion: publication.primaryAudit?.currentReleaseVersion || "0.0",
    auditId: publication.primaryAudit?.id || null,
    outputs,
    counts: {
      generatedPublicationPages: publication.pages.length,
      generatedSectionPages: generatedSectionPages.length,
      generatedClaimPages: publication.claims.length
    },
    invariants: [
      "Version 1.0 analytical conclusions remain locked by edition.",
      "Decision history remains public.",
      "Open questions remain public.",
      "Unknown values are not estimated without published support."
    ]
  };
}

function buildPlatformStatus(metrics, manifest) {
  return {
    generatedAt: new Date().toISOString(),
    status: metrics.platformHealth,
    qaStatus: metrics.qaStatus.status,
    buildVersion: metrics.buildVersion,
    traceabilityPercent: metrics.traceabilityPercent,
    citationCoveragePercent: metrics.citationCoverage.percentVerified,
    generatedPublicationPages: metrics.generatedPublicationPages,
    generatedSectionPages: metrics.generatedSectionPages,
    generatedClaimPages: metrics.generatedClaimPages,
    manifestOutputs: manifest.outputs.length
  };
}

function buildTraceRecords() {
  return {
    generatedAt: new Date().toISOString(),
    scaleExplorerRows: [
      ["International assistance obligations, FY2023 basis", 99.9, "S-038"],
      ["International assistance disbursements, FY2023 basis", 71.9, "S-038 / S-039"],
      ["Net-new military assistance, Ukraine-surge cumulative obligations", 50.9, "Section 5"],
      ["Recurring security assistance lanes", 1.6, "Section 5"],
      ["Noncitizen SSI, Dec. 2021 basis", 2.21, "S-073"],
      ["Emergency Medicaid, federal + state, FY2023", 3.8, "Section 7 / A-037"]
    ],
    sections: publication.sectionRecords,
    claims: publication.traceClaims,
    sources: publication.sources.map((source) => ({
      id: source.id,
      slug: source.slug,
      title: source.title,
      officialUrl: source.officialUrl,
      archiveUrl: source.archiveUrl,
      publisher: source.publisher,
      publicationDate: source.publicationDate,
      retrievalDate: source.retrievalDate,
      documentType: source.documentType,
      classification: source.classification,
      sections: source.sections,
      urlVerificationStatus: source.urlVerificationStatus
    })),
    decisions: publication.decisions,
    openQuestions: publication.openQuestions
  };
}

function countHtmlFiles(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += countHtmlFiles(next);
      continue;
    }
    if (entry.name.endsWith(".html")) {
      total += 1;
    }
  }
  return total;
}

function buildPlatformMetrics(searchIndex, traceRecords) {
  const verifiedSources = publication.sources.filter((source) => source.urlVerificationStatus === "verified");
  const highPriorityMissing = publication.sources
    .filter((source) => source.citationPriority === "high" && !source.officialUrl)
    .map((source) => source.id);
  const traceableClaims = publication.claims.filter((claim) => claim.sources.length && claim.confidence && claim.revisionHistory.length);
  const traceabilityPercent = Number(((traceableClaims.length / publication.claims.length) * 100).toFixed(2));
  const generatedSectionPages = publication.sections.filter((section) => /^Section \d+$/.test(section.id)).length;
  return {
    generatedAt: new Date().toISOString(),
    buildVersion: publication.primaryAudit?.currentReleaseVersion || "0.0",
    audits: publication.audits.length,
    sections: publication.sections.length,
    htmlPages: countHtmlFiles(publicDir),
    generatedPublicationPages: publication.pages.length,
    generatedSectionPages,
    generatedClaimPages: publication.claims.length,
    sources: publication.sources.length,
    citationCoverage: {
      verified: verifiedSources.length,
      pending: publication.sources.length - verifiedSources.length,
      percentVerified: Number(((verifiedSources.length / publication.sources.length) * 100).toFixed(2)),
      highPriorityMissingCanonicalUrls: highPriorityMissing
    },
    decisionLogs: publication.decisions.length,
    openQuestions: publication.openQuestions.length,
    claims: publication.claims.length,
    traceabilityPercent,
    platformHealth: highPriorityMissing.length ? "degraded" : "healthy",
    traceRecords: {
      sections: traceRecords.sections.length,
      claims: traceRecords.claims.length
    },
    searchRecords: searchIndex.length,
    qaStatus: {
      status: "build-generated",
      checksExpected: [
        "required source metadata",
        "high-priority canonical URLs",
        "orphaned trace records",
        "search coverage for trace claims",
        "explorer reference integrity",
        "generated-file consistency"
      ]
    }
  };
}

function build() {
  const searchIndex = buildSearchIndex();
  const traceRecords = buildTraceRecords();
  const claimDatabase = buildClaimDatabase();
  const crossReferences = buildCrossReferenceTables();
  const evidenceGraph = buildEvidenceGraph();
  const modeledPageOutputs = publication.pages.map((page) => page.url);
  const sectionOutputs = publication.sections
    .filter((item) => /^Section \d+$/.test(item.id))
    .map((section) => section.url);
  const sourceOutputs = publication.sources.map((source) => `/sources/${source.slug}.html`);
  const claimOutputs = publication.claims.map((claim) => `/claims/${claim.id.toLowerCase()}.html`);
  const openQuestionOutputs = publication.openQuestions.map((item) => `/open-questions/${item.slug}.html`);
  const decisionOutputs = publication.decisions.map((decision) => `/decision-log/${decision.slug}.html`);
  const manifestOutputs = [
    ...modeledPageOutputs,
    ...sectionOutputs,
    ...sourceOutputs,
    ...claimOutputs,
    ...openQuestionOutputs,
    ...decisionOutputs,
    "/search.html",
    "/explorer.html",
    "/audit/appendix-a-open-questions.html",
    "/audit/appendix-b-transparency-scorecard.html",
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
    writeFile(page.url.replace(/^\//, ""), renderPublicationPage(page));
  }
  for (const section of publication.sections.filter((item) => /^Section \d+$/.test(item.id))) {
    writeFile(section.url.replace(/^\//, ""), renderSectionPage(section));
  }
  for (const source of publication.sources) {
    writeFile(`sources/${source.slug}.html`, renderSourceDetail(source));
  }
  for (const claim of publication.claims) {
    writeFile(`claims/${claim.id.toLowerCase()}.html`, renderClaimDetail(claim));
  }
  for (const item of publication.openQuestions) {
    writeFile(`open-questions/${item.slug}.html`, renderOpenQuestionDetail(item));
  }
  for (const decision of publication.decisions) {
    writeFile(`decision-log/${decision.slug}.html`, renderDecisionDetail(decision));
  }
  writeFile("search.html", renderSearchPage());
  writeFile("explorer.html", renderExplorerPage());
  writeFile("audit/appendix-a-open-questions.html", renderAppendixA());
  writeFile("audit/appendix-b-transparency-scorecard.html", renderAppendixB());
  writeFile("data/claim-database.json", `${JSON.stringify(claimDatabase, null, 2)}\n`);
  writeFile("data/cross-reference-tables.json", `${JSON.stringify(crossReferences, null, 2)}\n`);
  writeFile("data/evidence-graph.json", `${JSON.stringify(evidenceGraph, null, 2)}\n`);
  writeFile("data/publication-search.json", `${JSON.stringify(searchIndex, null, 2)}\n`);
  writeFile("data/trace-records.json", `${JSON.stringify(traceRecords, null, 2)}\n`);
  const manifest = buildManifest(manifestOutputs);
  const provisionalMetrics = buildPlatformMetrics(searchIndex, traceRecords);
  const provisionalStatus = buildPlatformStatus(provisionalMetrics, manifest);
  writeFile("platform.html", renderPublicationPage(getPage("PAGE-PLATFORM"), { metrics: provisionalMetrics }));
  writeFile(
    "status.html",
    renderPublicationPage(getPage("PAGE-STATUS"), {
      metrics: provisionalMetrics,
      status: provisionalStatus,
      manifest
    })
  );
  const platformMetrics = buildPlatformMetrics(searchIndex, traceRecords);
  const platformStatus = buildPlatformStatus(platformMetrics, manifest);
  writeFile("platform.html", renderPublicationPage(getPage("PAGE-PLATFORM"), { metrics: platformMetrics }));
  writeFile(
    "status.html",
    renderPublicationPage(getPage("PAGE-STATUS"), {
      metrics: platformMetrics,
      status: platformStatus,
      manifest
    })
  );
  writeFile("data/platform-status.json", `${JSON.stringify(platformStatus, null, 2)}\n`);
  writeFile("data/publication-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(
    "data/platform-metrics.json",
    `${JSON.stringify(platformMetrics, null, 2)}\n`
  );
}

build();
