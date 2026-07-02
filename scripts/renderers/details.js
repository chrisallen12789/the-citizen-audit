const {
  escapeHtml,
  layout,
  linkList,
  renderRecordLinks,
  formatDate
} = require("./shared");

function createDetailRenderers(publication, relationships) {
  function renderSourceUrl(source, key) {
    const value = source[key];
    if (!value) return "<span class='empty-state'>Not available</span>";
    return `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  }

  function renderSourceDetail(source) {
    const relatedClaims = relationships.relatedClaimsForSource(source.id);
    const relatedDecisions = relationships.relatedDecisionsForSource(source.id, source.sections);
    const relatedOpenQuestions = relationships.relatedOpenQuestionsForSource(source.id);
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
        </div>
      </section>
      <section class="panel">
        <h2>Source links</h2>
        <p><strong>Official URL</strong><br>${renderSourceUrl(source, "officialUrl")}</p>
        <p><strong>Archive URL</strong><br>${renderSourceUrl(source, "archiveUrl")}</p>
        <p><strong>Verification note</strong><br>${escapeHtml(source.urlVerificationNote)}</p>
      </section>
      <section class="panel">
        <h2>Referenced By</h2>
        <p><strong>Sections</strong><br>${relationships.linkSections(source.sections)}</p>
      </section>
      <section class="panel">
        <h2>Claims supported</h2>
        ${relatedClaims.length ? `<p>${renderRecordLinks(relatedClaims.map((item) => item.id), "/claims/")}</p>` : "<p>No linked claims yet.</p>"}
      </section>
      <section class="panel">
        <h2>Related decisions</h2>
        ${relatedDecisions.length ? `<p>${renderRecordLinks(relatedDecisions.map((item) => item.id), "/decision-log/")}</p>` : "<p>No linked decisions yet.</p>"}
      </section>
      <section class="panel">
        <h2>Related open questions</h2>
        ${relatedOpenQuestions.length ? `<p>${renderRecordLinks(relatedOpenQuestions.map((item) => item.id), "/open-questions/")}</p>` : "<p>No linked open questions yet.</p>"}
      </section>
      <section class="panel">
        <h2>Revision History</h2>
        <ul>${source.revisionHistory
          .map(
            (entry) =>
              `<li>${escapeHtml(entry.date)} - ${escapeHtml(entry.version)} - ${escapeHtml(entry.summary)}</li>`
          )
          .join("")}</ul>
      </section>`;

    return layout({
      title: `${source.id} | The Citizen Audit`,
      description: `${source.id} source record for The Citizen Audit.`,
      eyebrow: "Source Record",
      heading: `${source.id} - ${source.title}`,
      lede: "Source pages preserve canonical links, metadata, and cross-references so reviewers can inspect the exact evidence behind published claims.",
      body,
      footerLabel: `${source.id} - source record`
    });
  }

  function renderOpenQuestionDetail(item) {
    const relatedDecisions = relationships.relatedDecisionsForSections(item.sections);
    const relatedClaims = relationships.relatedClaimsForOpenQuestion(item.id);
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
          <p><strong>Raised in:</strong> ${relationships.linkSections(item.sections)}</p>
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
                    <p class="row-kicker">${escapeHtml(claim.id)} - ${escapeHtml(claim.sectionId)}</p>
                    <h3><a href="/claims/${claim.id.toLowerCase()}.html">${escapeHtml(claim.title)}</a></h3>
                    <p>${escapeHtml(claim.statement)}</p>
                  </article>`
                )
                .join("")}</div>`
            : "<p>No specific claim record has been linked yet.</p>"
        }
      </section>
      <section class="panel">
        <h2>Related decisions</h2>
        ${relatedDecisions.length ? `<p>${renderRecordLinks(relatedDecisions.map((decision) => decision.id), "/decision-log/")}</p>` : "<p>No linked decision records yet.</p>"}
      </section>`;

    return layout({
      title: `${item.id} | The Citizen Audit`,
      description: `${item.id} open-question record for The Citizen Audit.`,
      eyebrow: "Open Question",
      heading: `${item.id} - ${item.title}`,
      lede: "Open questions are published to keep the limits of the current record explicit.",
      body,
      footerLabel: `${item.id} - open question`
    });
  }

  function renderDecisionDetail(item) {
    const relatedSources = relationships.relatedSourcesForDecision(item);
    const relatedOpenQuestions = relationships.relatedOpenQuestionsForDecision(item);
    const relatedClaims = relationships.relatedClaimsForDecision(item.id);
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
          <p><strong>References:</strong> ${relationships.linkSections(item.references)}</p>
        </div>
      </section>
      <section class="panel">
        <h2>Why this page exists</h2>
        <p>This record makes the numbered methodology rule addressable in the web edition so sources, sections, and future traceability features can point back to the same canonical decision.</p>
      </section>
      <section class="panel">
        <h2>Related Sources</h2>
        ${relatedSources.length ? `<p>${renderRecordLinks(relatedSources.map((source) => source.id), "/sources/")}</p>` : "<p>No linked source records.</p>"}
      </section>
      <section class="panel">
        <h2>Related Open Questions</h2>
        ${relatedOpenQuestions.length ? `<p>${renderRecordLinks(relatedOpenQuestions.map((question) => question.id), "/open-questions/")}</p>` : "<p>No linked open-question records.</p>"}
      </section>
      <section class="panel">
        <h2>Related Claims</h2>
        ${relatedClaims.length ? `<p>${renderRecordLinks(relatedClaims.map((claim) => claim.id), "/claims/")}</p>` : "<p>No linked claim records.</p>"}
      </section>`;

    return layout({
      title: `${item.id} | The Citizen Audit`,
      description: `${item.id} decision-log record for The Citizen Audit.`,
      eyebrow: "Decision Record",
      heading: `${item.id} - ${item.title}`,
      lede: "Decision records keep the publication's numbered methodology rules visible and linkable.",
      body,
      footerLabel: `${item.id} - decision record`
    });
  }

  function renderClaimDetail(claim) {
    const section = publication.sections.find((item) => item.id === claim.sectionId);
    const relatedSources = relationships.relatedSourcesForClaim(claim);
    const relatedDecisions = relationships.relatedDecisionsForClaim(claim);
    const relatedOpenQuestions = relationships.relatedOpenQuestionsForClaim(claim);
    const siblingClaims = relationships.relatedClaimsForClaim(claim);
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

  return {
    renderSourceDetail,
    renderOpenQuestionDetail,
    renderDecisionDetail,
    renderClaimDetail
  };
}

module.exports = {
  createDetailRenderers
};
