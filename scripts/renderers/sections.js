const {
  escapeHtml,
  layout,
  linkClaims,
  renderContentBlock,
  renderRecordLinks
} = require("./shared");

function createSectionRenderer(publication, relationships) {
  function renderSectionActions(section) {
    const links = [];
    if (section.previousSectionId) {
      const previous = publication.maps.sectionsById.get(section.previousSectionId);
      links.push(`<a class="button" href="${previous.url}">Previous</a>`);
    }
    if (section.nextSectionId) {
      const next = publication.maps.sectionsById.get(section.nextSectionId);
      links.push(`<a class="button" href="${next.url}">Next</a>`);
    }
    links.push(`<a class="button" href="/audit.html">Audit Index</a>`);
    return `<div class="actions">${links.join("")}</div>`;
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
          <p><strong>Related Sections</strong><br>${relationships.renderSectionTagList(section.relatedSectionIds)}</p>
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
          ${group.blocks.map(renderContentBlock).join("")}
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
      footerLabel: `${section.id} - ${section.title}`,
      canonicalPath: section.url,
      ogType: "article"
    });
  }

  return {
    renderSectionPage
  };
}

module.exports = {
  createSectionRenderer
};
