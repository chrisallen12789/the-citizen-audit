var runtimeTraceabilityRecords = [];
var runtimeTraceClaims = [];
var runtimeScaleExplorerRows = [];

async function loadTraceabilityData() {
  try {
    const response = await fetch("/data/trace-records.json");
    if (!response.ok) return;
    const payload = await response.json();
    runtimeTraceabilityRecords = Array.isArray(payload.sections) ? payload.sections : [];
    runtimeTraceClaims = Array.isArray(payload.claims) ? payload.claims : [];
    runtimeScaleExplorerRows = Array.isArray(payload.scaleExplorerRows) ? payload.scaleExplorerRows : [];
  } catch (error) {
    runtimeTraceabilityRecords = [];
    runtimeTraceClaims = [];
    runtimeScaleExplorerRows = [];
  }
}

function ensureTraceDrawer() {
  if (document.querySelector("[data-trace-drawer]")) return;
  const drawer = document.createElement("aside");
  drawer.className = "drawer";
  drawer.setAttribute("data-trace-drawer", "");
  drawer.setAttribute("aria-live", "polite");
  drawer.innerHTML =
    "<div class='drawer-head'><div><p class='row-kicker'>Trace</p><h3></h3></div><button type='button' aria-label='Close trace panel' data-close-trace>&times;</button></div><div class='drawer-body'></div>";
  document.body.appendChild(drawer);
}

function traceClaim(title, body) {
  ensureTraceDrawer();
  const drawer = document.querySelector("[data-trace-drawer]");
  if (!drawer) return;
  drawer.querySelector("h3").textContent = title;
  drawer.querySelector(".drawer-body").innerHTML = body;
  drawer.classList.add("open");
}

function closeTrace() {
  document.querySelector("[data-trace-drawer]")?.classList.remove("open");
}

function updateMenuState(button) {
  button.setAttribute(
    "aria-expanded",
    document.body.classList.contains("nav-open") ? "true" : "false"
  );
}

function filterList(input) {
  const query = (input.value || "").toLowerCase().trim();
  const target = input.getAttribute("data-filter-target") || "[data-filterable]";
  document.querySelectorAll(target).forEach((row) => {
    const haystack = (row.getAttribute("data-search") || row.textContent || "").toLowerCase();
    row.style.display = haystack.includes(query) ? "block" : "none";
  });
}

function renderTagLinks(ids, basePath) {
  if (!ids.length) return "<span class='empty-state'>None linked yet</span>";
  return ids
    .map((id) => `<a class="tag" href="${basePath}${id.toLowerCase()}.html">${id}</a>`)
    .join(" ");
}

function renderSectionLinks(sectionIds) {
  if (!sectionIds.length) return "<span class='empty-state'>No section links published yet</span>";
  return sectionIds
    .map((sectionId) => {
      const record = runtimeTraceabilityRecords.find((item) => item.id === sectionId);
      if (!record) return "";
      return `<a class="tag" href="${record.url}">${record.id}</a>`;
    })
    .join(" ");
}

function renderTraceabilityExplorer() {
  const input = document.querySelector("[data-traceability-search]");
  const grid = document.querySelector("[data-traceability-grid]");
  if (!input || !grid) return;
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") || "";

  const render = () => {
    const query = (input.value || "").toLowerCase().trim();
    const matches = !query
      ? runtimeTraceabilityRecords
      : runtimeTraceabilityRecords.filter((record) =>
          [
            record.id,
            record.title,
            record.summary,
            record.sources.join(" "),
            record.decisions.join(" "),
            record.openQuestions.join(" "),
            (record.relatedSections || []).join(" ")
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );

    grid.innerHTML = matches.length
      ? matches
          .map(
            (record) => `<article class="card stack">
              <div>
                <p class="row-kicker">${record.id}</p>
                <h3 class="row-title"><a href="${record.url}">${record.title}</a></h3>
              </div>
              <p>${record.summary}</p>
              <p><strong>Sources</strong><br>${renderTagLinks(record.sources, "/sources/")}</p>
              <p><strong>Decisions</strong><br>${renderTagLinks(record.decisions, "/decision-log/")}</p>
              <p><strong>Open Questions</strong><br>${renderTagLinks(record.openQuestions, "/open-questions/")}</p>
              <p><strong>Related Sections</strong><br>${renderSectionLinks(record.relatedSections || [])}</p>
            </article>`
          )
          .join("")
      : "<p class='empty-state'>No traceability record matched that filter.</p>";
  };

  if (initialQuery && !input.value) input.value = initialQuery;
  render();
  input.addEventListener("input", render);
}

function renderClaimExplorer() {
  const input = document.querySelector("[data-claim-search]");
  const grid = document.querySelector("[data-claim-grid]");
  if (!input || !grid) return;
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") || "";

  const render = () => {
    const query = (input.value || "").toLowerCase().trim();
    const matches = !query
      ? runtimeTraceClaims
      : runtimeTraceClaims.filter((claim) =>
          [
            claim.id,
            claim.title,
            claim.summary,
            claim.section,
            claim.sources.join(" "),
            claim.decisions.join(" "),
            claim.openQuestions.join(" ")
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );

    grid.innerHTML = matches.length
      ? matches
          .map(
            (claim) => `<article class="card stack">
              <div>
                <p class="row-kicker">${claim.id} - ${claim.section}</p>
                <h3 class="row-title"><a href="/claims/${claim.id.toLowerCase()}.html">${claim.title}</a></h3>
              </div>
              <p>${claim.summary}</p>
              <p><strong>Section</strong><br><a class="tag" href="${claim.sectionRecord || "#"}">${claim.section}</a></p>
              <p><strong>Sources</strong><br>${renderTagLinks(claim.sources, "/sources/")}</p>
              <p><strong>Decisions</strong><br>${renderTagLinks(claim.decisions, "/decision-log/")}</p>
              <p><strong>Open Questions</strong><br>${renderTagLinks(claim.openQuestions, "/open-questions/")}</p>
            </article>`
          )
          .join("")
      : "<p class='empty-state'>No claim record matched that filter.</p>";
  };

  if (initialQuery && !input.value) input.value = initialQuery;
  render();
  input.addEventListener("input", render);
}

function calcDollar() {
  const input = document.querySelector("[data-tax-amount]");
  const out = document.querySelector("[data-explorer-output]");
  if (!input || !out || !runtimeScaleExplorerRows.length) return;
  const amount = Math.max(1, Number(input.value || 100));
  const total = runtimeScaleExplorerRows.reduce((sum, row) => sum + Number(row[1] || 0), 0);
  out.innerHTML =
    runtimeScaleExplorerRows
      .map(
        (row) =>
          `<div class="source-row"><strong>${row[0]}</strong><br><span class="tag">${row[2]}</span> $${(
            amount *
            ((Number(row[1] || 0) || 0) / total)
          ).toFixed(2)} of $${amount.toLocaleString()}</div>`
      )
      .join("") +
    '<p class="lede">Prototype only. These lanes use incompatible bases and are not a blended grand total.</p>';
}

async function runPublicationSearch(initialQuery) {
  const input = document.querySelector("[data-publication-search]");
  const results = document.querySelector("[data-search-results]");
  if (!input || !results) return;

  let index = [];
  try {
    const response = await fetch("/data/publication-search.json");
    index = await response.json();
  } catch (error) {
    results.innerHTML = "<p class='empty-state'>Search index failed to load in this environment.</p>";
    return;
  }

  const render = () => {
    const query = (input.value || "").toLowerCase().trim();
    const matches = !query
      ? index
      : index.filter((item) =>
          [item.type, item.id, item.title, item.text].join(" ").toLowerCase().includes(query)
        );
    results.innerHTML = matches.length
      ? matches
          .map(
            (item) =>
              `<article class="search-result"><p class="row-kicker">${item.type} - ${item.id}</p><h3><a href="${item.url}">${item.title}</a></h3><p>${item.text.slice(0, 220)}${
                item.text.length > 220 ? "..." : ""
              }</p></article>`
          )
          .join("")
      : "<p class='empty-state'>No current publication record matched that search.</p>";
  };

  if (initialQuery) input.value = initialQuery;
  render();
  input.addEventListener("input", render);
}

document.addEventListener("click", (event) => {
  const menuButton = event.target.closest("[data-menu]");
  if (menuButton) {
    document.body.classList.toggle("nav-open");
    updateMenuState(menuButton);
  }

  const traceButton = event.target.closest("[data-trace-title]");
  if (traceButton) {
    const encodedBody = traceButton.getAttribute("data-trace-body-encoded");
    traceClaim(
      traceButton.getAttribute("data-trace-title") || "",
      encodedBody
        ? decodeURIComponent(encodedBody)
        : traceButton.getAttribute("data-trace-body") || ""
    );
  }

  if (event.target.closest("[data-close-trace]")) {
    closeTrace();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-tax-amount]")) calcDollar();
  if (event.target.matches("[data-filter-input]")) filterList(event.target);
});

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll("[data-menu]").forEach(updateMenuState);
  await loadTraceabilityData();
  ensureTraceDrawer();
  calcDollar();
  renderTraceabilityExplorer();
  renderClaimExplorer();
  document.querySelectorAll("[data-filter-input]").forEach(filterList);
  if (document.querySelector("[data-publication-search]")) {
    const params = new URLSearchParams(location.search);
    runPublicationSearch(params.get("q") || "");
  }
});
