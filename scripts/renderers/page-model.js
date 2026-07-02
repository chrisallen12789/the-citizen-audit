const {
  escapeHtml,
  layout,
  renderActionLinks,
  renderPanelBlock,
  renderCardGrid,
  renderTocBlock,
  renderSearchFilter
} = require("./shared");

function createPageRenderer(publication) {
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
            source.primaryOrSecondary,
            source.canonicalUrl || "",
            source.verificationStatus,
            source.notes || ""
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
          <p class="meta-line"><strong>Primary / Secondary:</strong> ${escapeHtml(source.primaryOrSecondary)} | <strong>Verification:</strong> ${escapeHtml(source.verificationStatus)}</p>
          <p class="meta-line"><strong>Archive:</strong> ${escapeHtml(source.archiveStatus)}${source.archiveUrl ? ` | <a href="${escapeHtml(source.archiveUrl)}">alternate artifact</a>` : ""}</p>
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
      { label: "Verified sources", value: metrics.verifiedSourceCount },
      { label: "Pending sources", value: metrics.pendingSourceCount },
      { label: "Archive coverage", value: metrics.archiveCoverageCount },
      { label: "High-priority citation completion", value: `${metrics.highPriorityCitationCompletionPercent}%` },
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

  function renderSearchInterface() {
    return `<section class="panel">
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
  }

  function renderExplorerInterface() {
    return `${renderActionLinks([
      { label: "Search the publication", href: "/search.html", variant: "primary" },
      { label: "Browse sources", href: "/sources.html" },
      { label: "Reviewer portal", href: "/review.html" },
      { label: "Review decisions", href: "/decision-log.html" }
    ])}
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
  }

  function renderAppendixOpenQuestions() {
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
    return `<section class="panel">
        <h2>Appendix A register</h2>
        <p>This appendix turns the current web edition's unresolved items into a readable public register. It does not add new conclusions; it surfaces the limits already named in converted sections.</p>
        <table data-appendix-source="open-questions">
          <tr><th>ID</th><th>Question</th><th>Raised in</th><th>Record needed</th></tr>
          ${rows}
        </table>
      </section>`;
  }

  function renderAppendixTransparency() {
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
    return `<section class="panel">
        <h2>Transparency scorecard</h2>
        <p>The scorecard summarizes how far the current public record goes in the converted sections already present in the repository. It distinguishes measurable lanes from lanes that remain bounded by missing public breakouts.</p>
        <table data-appendix-source="transparency-scorecard">
          <tr><th>Area</th><th>Section</th><th>Transparency</th><th>What is measurable</th><th>Main limitation</th></tr>
          ${rows}
        </table>
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
      case "searchInterface":
        return renderSearchInterface();
      case "explorerInterface":
        return renderExplorerInterface();
      case "appendixOpenQuestions":
        return renderAppendixOpenQuestions();
      case "appendixTransparencyScorecard":
        return renderAppendixTransparency();
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
      footerLabel: page.footerLabel || page.heading,
      canonicalPath: page.url
    });
  }

  return {
    renderPublicationPage
  };
}

module.exports = {
  createPageRenderer
};
