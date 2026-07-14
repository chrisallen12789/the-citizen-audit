const { escapeHtml } = require("./shared");

function createFigureMetadataRenderer(publication) {
  const figures = publication.figureMetadata || [];
  const tablesById = new Map((publication.auditReaderTables || []).map((table) => [table.id, table]));

  function renderSourceLinks(sourceIds = [], emptyLabel = "None assigned") {
    if (!sourceIds.length) {
      return `<span class="figure-metadata-empty">${escapeHtml(emptyLabel)}</span>`;
    }
    return sourceIds
      .map(
        (sourceId) =>
          `<a href="/sources/${escapeHtml(sourceId.toLowerCase())}.html">${escapeHtml(sourceId)}</a>`
      )
      .join(", ");
  }

  function renderMetadataParts(figure) {
    if (!figure.parts?.length) {
      return "";
    }
    const headingId = `${figure.id.toLowerCase()}-parts-heading`;
    const rows = figure.parts
      .map(
        (part) => `<tr>
          <th scope="row">${escapeHtml(part.label)}</th>
          <td>${escapeHtml(part.basis || "Not applicable")}</td>
          <td>${renderSourceLinks(part.sourceIds)}${
            part.contextualSourceIds?.length
              ? `<br><span class="figure-source-role">Context: ${renderSourceLinks(part.contextualSourceIds)}</span>`
              : ""
          }</td>
          <td>${escapeHtml(part.confidence || "Not assigned")}</td>
          <td>${escapeHtml(part.limitation || "—")}</td>
        </tr>`
      )
      .join("");
    return `<div class="figure-table-scroll" role="region" aria-labelledby="${headingId}" tabindex="0">
      <table class="figure-parts-table">
        <caption id="${headingId}">${escapeHtml(figure.title)} component metadata</caption>
        <thead><tr><th scope="col">Component</th><th scope="col">Fiscal / accounting basis</th><th scope="col">Source IDs</th><th scope="col">Confidence</th><th scope="col">Limitation</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function findOpenQuestionIds(value) {
    const matches = JSON.stringify(value).match(/A-\d{3}/g) || [];
    return [...new Set(matches)].sort();
  }

  function renderAppendixBinding(figure) {
    if (figure.id !== "R03-F27") {
      return "";
    }
    const appendix = publication.appendixB;
    const categories = appendix.categories.map((item) => item.label);
    const rows = appendix.rows.map((item) => item.key);
    const openQuestions = findOpenQuestionIds(appendix);
    return `<dl class="figure-binding-list">
      <div><dt>Accepted categories</dt><dd>${escapeHtml(categories.join("; "))}</dd></div>
      <div><dt>Accepted scorecard rows</dt><dd>${escapeHtml(rows.join("; "))}</dd></div>
      <div><dt>Referenced open questions</dt><dd>${escapeHtml(openQuestions.join(", "))}</dd></div>
    </dl>`;
  }

  function renderReaderTable(table) {
    const headingId = `${table.anchor}-heading`;
    const headerCells = table.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("");
    const rows = table.rows
      .map(
        (row) => `<tr data-reader-table-row="${escapeHtml(row.key)}">
          ${row.cells
            .map((cell, index) =>
              index === 0 ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`
            )
            .join("")}
        </tr>`
      )
      .join("");
    const supplemental = (table.supplemental || [])
      .map(
        (item) => `<section class="reader-table-supplemental">
          <h3>${escapeHtml(item.heading)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </section>`
      )
      .join("");
    const notes = (table.notes || [])
      .map((note) => `<p class="reader-table-note">${escapeHtml(note)}</p>`)
      .join("");
    return `<section class="reader-table-card" id="${escapeHtml(table.anchor)}" data-reader-table-id="${escapeHtml(
      table.id
    )}">
      <h3 id="${headingId}">${escapeHtml(table.title)}</h3>
      <div class="reader-table-scroll" role="region" aria-labelledby="${headingId}" tabindex="0">
        <table class="reader-table">
          <caption>${escapeHtml(table.caption)}</caption>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${supplemental}${notes}
    </section>`;
  }

  function renderFigureMetadata(figure) {
    if (typeof figure.confidenceDisplay !== "string" || !figure.confidenceDisplay.trim()) {
      throw new Error(`${figure.id} requires an explicit confidenceDisplay`);
    }
    const hasPartSources = figure.parts?.some((part) => part.sourceIds?.length);
    const hasPartContext = figure.parts?.some((part) => part.contextualSourceIds?.length);
    const primary = renderSourceLinks(
      figure.sourceIds,
      hasPartSources ? "Component- or row-specific; see below" : "None assigned"
    );
    const contextual = renderSourceLinks(
      figure.contextualSourceIds,
      hasPartContext ? "Component- or row-specific; see below" : "None assigned"
    );
    const limitations = (figure.limitationStatus || [])
      .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
      .join("");
    const unresolved = figure.unresolved?.length
      ? `<p><strong>Unresolved evidence:</strong> ${escapeHtml(figure.unresolved.join("; "))}</p>`
      : "";
    const details = [
      limitations ? `<div class="figure-limitations"><strong>Limitations</strong><ul>${limitations}</ul></div>` : "",
      unresolved,
      renderMetadataParts(figure),
      renderAppendixBinding(figure)
    ]
      .filter(Boolean)
      .join("\n");
    return `<aside class="figure-metadata" id="${escapeHtml(figure.id.toLowerCase())}" data-figure-id="${escapeHtml(
      figure.id
    )}">
      <div class="figure-metadata-heading">
        <div><p class="row-kicker">Release 0.3 figure metadata</p><h3>${escapeHtml(figure.id)} — ${escapeHtml(
          figure.title
        )}</h3></div>
        <span class="tag">${escapeHtml(figure.mappingStatus)}</span>
      </div>
      <dl class="figure-metadata-grid">
        <div><dt>Figure type</dt><dd>${escapeHtml(figure.figureType)}</dd></div>
        <div><dt>Fiscal / accounting basis</dt><dd>${escapeHtml(figure.fiscalBasis || "Component-specific; no combined basis")}</dd></div>
        <div><dt>Confidence</dt><dd>${escapeHtml(figure.confidenceDisplay)}</dd></div>
        <div><dt>Primary source IDs</dt><dd>${primary}</dd></div>
        <div><dt>Contextual source IDs</dt><dd>${contextual}</dd></div>
      </dl>
      ${details}
    </aside>`;
  }

  function renderFigure(figure) {
    const table = figure.readerTableId ? tablesById.get(figure.readerTableId) : null;
    const content = [table ? renderReaderTable(table) : "", renderFigureMetadata(figure)]
      .filter(Boolean)
      .join("\n");
    return `<div class="reader-figure" data-reader-figure="${escapeHtml(figure.id)}">
      ${content}
    </div>`;
  }

  function renderAfterSectionBlock(sectionId, blockIndex) {
    return figures
      .filter((figure) => figure.sectionId === sectionId && figure.afterBlockIndex === blockIndex)
      .map(renderFigure)
      .join("");
  }

  function renderAfterPageBlock(pageId, blockType) {
    return figures
      .filter((figure) => figure.pageId === pageId && figure.afterBlockType === blockType)
      .map(renderFigure)
      .join("");
  }

  return {
    renderAfterPageBlock,
    renderAfterSectionBlock
  };
}

module.exports = {
  createFigureMetadataRenderer
};
