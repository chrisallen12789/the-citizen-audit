const { escapeHtml } = require("./shared");

function createAuditReaderRenderer(publication) {
  const { contents, canonicalPdf } = publication.auditReader;

  function renderAuditContents(currentStableId) {
    const current = contents.find((entry) => entry.stableId === currentStableId);
    if (!current) {
      throw new Error(`Unknown audit contents entry: ${currentStableId}`);
    }

    const entries = contents
      .map((entry) => {
        const currentAttribute = entry.stableId === currentStableId ? ' aria-current="page"' : "";
        return `<li data-audit-contents-entry="${escapeHtml(entry.stableId)}">
            <a href="${escapeHtml(entry.route)}"${currentAttribute}>
              <span>${escapeHtml(entry.label)}</span>
              <small>${escapeHtml(entry.title)}</small>
            </a>
          </li>`;
      })
      .join("");

    return `<details class="audit-contents" data-audit-contents-count="${contents.length}" open>
        <summary>Audit contents &mdash; ${escapeHtml(current.label)}</summary>
        <nav aria-label="Audit contents">
          <ol>${entries}</ol>
        </nav>
      </details>`;
  }

  function renderReaderLayout(currentStableId, body) {
    return `<div class="audit-reader-layout">
        ${renderAuditContents(currentStableId)}
        <div class="audit-reader-content">${body}</div>
      </div>`;
  }

  function renderCanonicalityNotice() {
    return `<aside class="panel reader-canonicality-notice" aria-label="Canonical publication notice">
        <p>${escapeHtml(canonicalPdf.notice)}</p>
        <p><a href="${escapeHtml(canonicalPdf.href)}">${escapeHtml(canonicalPdf.label)}</a></p>
      </aside>`;
  }

  return {
    renderAuditContents,
    renderReaderLayout,
    renderCanonicalityNotice
  };
}

module.exports = {
  createAuditReaderRenderer
};
