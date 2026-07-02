const {
  escapeHtml,
  layout,
  linkList,
  renderActionLinks,
  renderContentBlock,
  renderRecordLinks,
  formatDate
} = require("./shared");

function createDetailRenderers(publication, relationships) {
  function renderSourceUrl(source, key) {
    const value = source[key];
    if (!value) return "<span class='empty-state'>Not available</span>";
    return `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  }

  function renderDetailSections(sections) {
    return sections
      .map(
        (section) => `<section class="panel${section.stack ? " stack" : ""}">
          <h2>${escapeHtml(section.heading)}</h2>
          ${(section.blocks || []).map(renderContentBlock).join("")}
        </section>`
      )
      .join("");
  }

  function buildSourceDetailSections(source) {
    const relatedClaims = relationships.relatedClaimsForSource(source.id);
    const relatedDecisions = relationships.relatedDecisionsForSource(source.id, source.sections);
    const relatedOpenQuestions = relationships.relatedOpenQuestionsForSource(source.id);

    return [
      {
        heading: "Source summary",
        blocks: [
          { type: "paragraph", text: source.summary },
          {
            type: "metadataGrid",
            items: [
              { label: "Source ID", value: source.id },
              { label: "Publisher", value: source.publisher },
              { label: "Agency label", value: source.agency },
              { label: "Document type", value: source.documentType },
              { label: "Classification", value: source.classification },
              { label: "Confidence", value: source.confidence },
              { label: "Evidence class", value: source.evidenceClass },
              { label: "Publication date", value: formatDate(source.publicationDate) },
              { label: "Retrieval date", value: formatDate(source.retrievalDate) },
              { label: "Citation priority", value: source.citationPriority },
              { label: "URL verification", value: source.urlVerificationStatus }
            ]
          }
        ]
      },
      {
        heading: "Source links",
        blocks: [
          { type: "paragraph", html: `<p><strong>Official URL</strong><br>${renderSourceUrl(source, "officialUrl")}</p>` },
          { type: "paragraph", html: `<p><strong>Archive URL</strong><br>${renderSourceUrl(source, "archiveUrl")}</p>` },
          { type: "paragraph", html: `<p><strong>Verification note</strong><br>${escapeHtml(source.urlVerificationNote)}</p>` }
        ]
      },
      {
        heading: "Referenced By",
        blocks: [
          {
            type: "metadataGrid",
            items: [{ label: "Sections", valueHtml: relationships.linkSections(source.sections) }]
          }
        ]
      },
      {
        heading: "Claims supported",
        blocks: [
          {
            type: "paragraph",
            html: relatedClaims.length
              ? `<p>${renderRecordLinks(
                  relatedClaims.map((item) => item.id),
                  "/claims/"
                )}</p>`
              : "<p>No linked claims yet.</p>"
          }
        ]
      },
      {
        heading: "Related decisions",
        blocks: [
          {
            type: "paragraph",
            html: relatedDecisions.length
              ? `<p>${renderRecordLinks(
                  relatedDecisions.map((item) => item.id),
                  "/decision-log/"
                )}</p>`
              : "<p>No linked decisions yet.</p>"
          }
        ]
      },
      {
        heading: "Related open questions",
        blocks: [
          {
            type: "paragraph",
            html: relatedOpenQuestions.length
              ? `<p>${renderRecordLinks(
                  relatedOpenQuestions.map((item) => item.id),
                  "/open-questions/"
                )}</p>`
              : "<p>No linked open questions yet.</p>"
          }
        ]
      },
      {
        heading: "Revision History",
        blocks: [
          {
            type: "list",
            items: source.revisionHistory.map(
              (entry) => `${entry.date} - ${entry.version} - ${entry.summary}`
            )
          }
        ]
      }
    ];
  }

  function renderSourceDetail(source) {
    const body = `${renderActionLinks([
      { label: "Back to source index", href: "/sources.html" },
      { label: "Search related records", href: `/search.html?q=${encodeURIComponent(source.id)}` },
      { label: "Open explorer", href: "/explorer.html" }
    ])}<div class="sr-only" data-generated-source="typed-detail-renderer" data-detail-kind="source"></div>${renderDetailSections(
      buildSourceDetailSections(source)
    )}`;

    return layout({
      title: `${source.id} | The Citizen Audit`,
      description: `${source.id} source record for The Citizen Audit.`,
      eyebrow: "Source Record",
      heading: `${source.id} - ${source.title}`,
      lede:
        "Source pages preserve canonical links, metadata, and cross-references so reviewers can inspect the exact evidence behind published claims.",
      body,
      footerLabel: `${source.id} - source record`
    });
  }

  function buildOpenQuestionSections(item) {
    const relatedDecisions = relationships.relatedDecisionsForSections(item.sections);
    const relatedClaims = relationships.relatedClaimsForOpenQuestion(item.id);
    return [
      {
        heading: "Why it matters",
        blocks: [{ type: "paragraph", text: item.whyItMatters }]
      },
      {
        heading: "Current web-edition status",
        blocks: [
          { type: "paragraph", text: item.currentState },
          {
            type: "metadataGrid",
            items: [
              { label: "Status", value: item.status },
              { label: "Raised in", valueHtml: relationships.linkSections(item.sections) }
            ]
          }
        ]
      },
      {
        heading: "Record required to resolve it",
        blocks: [{ type: "paragraph", text: item.recordNeeded }]
      },
      {
        heading: "Related source IDs",
        blocks: [
          {
            type: "paragraph",
            html: item.relatedSources.length
              ? `<p>${linkList(item.relatedSources, "/sources/")}</p>`
              : "<p>No source record has been linked yet in the current web edition.</p>"
          }
        ]
      },
      {
        heading: "Claims blocked or limited",
        blocks: [
          {
            type: "relationshipGrid",
            layout: "stack",
            items: relatedClaims.map((claim) => ({
              eyebrow: `${claim.id} - ${claim.sectionId}`,
              title: claim.title,
              href: `/claims/${claim.id.toLowerCase()}.html`,
              text: claim.statement
            }))
          }
        ]
      },
      {
        heading: "Related decisions",
        blocks: [
          {
            type: "paragraph",
            html: relatedDecisions.length
              ? `<p>${renderRecordLinks(
                  relatedDecisions.map((decision) => decision.id),
                  "/decision-log/"
                )}</p>`
              : "<p>No linked decision records yet.</p>"
          }
        ]
      }
    ];
  }

  function renderOpenQuestionDetail(item) {
    const relatedClaims = relationships.relatedClaimsForOpenQuestion(item.id);
    const sections = buildOpenQuestionSections(item).map((section) =>
      section.heading === "Claims blocked or limited" && !relatedClaims.length
        ? {
            ...section,
            blocks: [{ type: "paragraph", html: "<p>No specific claim record has been linked yet.</p>" }]
          }
        : section
    );
    const body = `${renderActionLinks([
      { label: "Back to open questions", href: "/open-questions.html" },
      { label: "Appendix A", href: "/audit/appendix-a-open-questions.html" },
      { label: "Open explorer", href: "/explorer.html" }
    ])}<div class="sr-only" data-generated-source="typed-detail-renderer" data-detail-kind="open-question"></div>${renderDetailSections(
      sections
    )}`;

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

  function buildDecisionSections(item) {
    const relatedSources = relationships.relatedSourcesForDecision(item);
    const relatedOpenQuestions = relationships.relatedOpenQuestionsForDecision(item);
    const relatedClaims = relationships.relatedClaimsForDecision(item.id);
    return [
      {
        heading: "Published rule",
        blocks: [
          { type: "paragraph", text: item.body },
          {
            type: "metadataGrid",
            items: [
              { label: "Decision ID", value: item.id },
              { label: "References", valueHtml: relationships.linkSections(item.references) }
            ]
          }
        ]
      },
      {
        heading: "Why this page exists",
        blocks: [
          {
            type: "paragraph",
            text:
              "This record makes the numbered methodology rule addressable in the web edition so sources, sections, and future traceability features can point back to the same canonical decision."
          }
        ]
      },
      {
        heading: "Related Sources",
        blocks: [
          {
            type: "paragraph",
            html: relatedSources.length
              ? `<p>${renderRecordLinks(
                  relatedSources.map((source) => source.id),
                  "/sources/"
                )}</p>`
              : "<p>No linked source records.</p>"
          }
        ]
      },
      {
        heading: "Related Open Questions",
        blocks: [
          {
            type: "paragraph",
            html: relatedOpenQuestions.length
              ? `<p>${renderRecordLinks(
                  relatedOpenQuestions.map((question) => question.id),
                  "/open-questions/"
                )}</p>`
              : "<p>No linked open-question records.</p>"
          }
        ]
      },
      {
        heading: "Related Claims",
        blocks: [
          {
            type: "paragraph",
            html: relatedClaims.length
              ? `<p>${renderRecordLinks(
                  relatedClaims.map((claim) => claim.id),
                  "/claims/"
                )}</p>`
              : "<p>No linked claim records.</p>"
          }
        ]
      }
    ];
  }

  function renderDecisionDetail(item) {
    const body = `${renderActionLinks([
      { label: "Back to decision log", href: "/decision-log.html" },
      { label: "Search related records", href: `/search.html?q=${encodeURIComponent(item.id)}` },
      { label: "Open explorer", href: "/explorer.html" }
    ])}<div class="sr-only" data-generated-source="typed-detail-renderer" data-detail-kind="decision"></div>${renderDetailSections(
      buildDecisionSections(item)
    )}`;

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

  function buildClaimSections(claim) {
    const section = publication.sections.find((item) => item.id === claim.sectionId);
    const relatedSources = relationships.relatedSourcesForClaim(claim);
    const relatedDecisions = relationships.relatedDecisionsForClaim(claim);
    const relatedOpenQuestions = relationships.relatedOpenQuestionsForClaim(claim);
    const siblingClaims = relationships.relatedClaimsForClaim(claim);
    return [
      {
        heading: "Claim record",
        blocks: [
          {
            type: "metadataGrid",
            items: [
              { label: "Claim ID", value: claim.id },
              { label: "Audit ID", value: claim.auditId },
              { label: "Section ID", value: claim.sectionId },
              { label: "Status", value: claim.status },
              { label: "Confidence", value: claim.confidence }
            ]
          },
          { type: "paragraph", text: claim.statement }
        ]
      },
      {
        heading: "Referenced By",
        blocks: [
          {
            type: "metadataGrid",
            items: [
              {
                label: "Audit",
                valueHtml: `<a class="tag" href="/audit.html">${escapeHtml(
                  publication.primaryAudit?.title || "Audit"
                )}</a>`
              },
              {
                label: "Section",
                valueHtml: section
                  ? `<a class="tag" href="${section.url}">${escapeHtml(section.id)}</a>`
                  : "<span class='empty-state'>No linked section</span>"
              }
            ]
          }
        ]
      },
      {
        heading: "Related Sources",
        blocks: [
          {
            type: "paragraph",
            html: relatedSources.length
              ? `<p>${renderRecordLinks(
                  relatedSources.map((item) => item.id),
                  "/sources/"
                )}</p>`
              : "<p>No linked source records.</p>"
          }
        ]
      },
      {
        heading: "Related Decisions",
        blocks: [
          {
            type: "paragraph",
            html: relatedDecisions.length
              ? `<p>${renderRecordLinks(
                  relatedDecisions.map((item) => item.id),
                  "/decision-log/"
                )}</p>`
              : "<p>No linked decision records.</p>"
          }
        ]
      },
      {
        heading: "Related Open Questions",
        blocks: [
          {
            type: "paragraph",
            html: relatedOpenQuestions.length
              ? `<p>${renderRecordLinks(
                  relatedOpenQuestions.map((item) => item.id),
                  "/open-questions/"
                )}</p>`
              : "<p>No linked open-question records.</p>"
          }
        ]
      },
      {
        heading: "Related Claims",
        blocks: siblingClaims.length
          ? [
              {
                type: "relationshipGrid",
                layout: "stack",
                items: siblingClaims.map((item) => ({
                  eyebrow: `${item.id} - ${item.sectionId}`,
                  title: item.title,
                  href: `/claims/${item.id.toLowerCase()}.html`,
                  text: item.statement
                }))
              }
            ]
          : [{ type: "paragraph", html: "<p>No related-claim records are linked yet.</p>" }]
      },
      {
        heading: "Revision History",
        blocks: [
          {
            type: "list",
            items: claim.revisionHistory.map(
              (entry) => `${entry.date} - ${entry.version} - ${entry.summary}`
            )
          }
        ]
      }
    ];
  }

  function renderClaimDetail(claim) {
    const section = publication.sections.find((item) => item.id === claim.sectionId);
    const body = `${renderActionLinks([
      { label: "Back to claims", href: "/claims.html" },
      { label: "Open section", href: section?.url || "/audit.html" },
      { label: "Search related records", href: `/search.html?q=${encodeURIComponent(claim.id)}` }
    ])}<div class="sr-only" data-generated-source="typed-detail-renderer" data-detail-kind="claim"></div>${renderDetailSections(
      buildClaimSections(claim)
    )}`;

    return layout({
      title: `${claim.id} | The Citizen Audit`,
      description: `${claim.id} claim record for The Citizen Audit.`,
      eyebrow: "Claim Record",
      heading: `${claim.id} - ${claim.title}`,
      lede:
        "Claims are first-class structured records so the evidence platform can point every published conclusion back to its sources, decisions, and unresolved questions.",
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
