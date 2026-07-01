let traceabilityRecords = [];
let sectionEnhancements = {};

async function loadTraceabilityData() {
  try {
    const response = await fetch("/data/section-traceability.json");
    if (!response.ok) throw new Error(`Traceability data failed: ${response.status}`);
    const data = await response.json();
    traceabilityRecords = Array.isArray(data.records) ? data.records : [];
    sectionEnhancements = Object.fromEntries(
      traceabilityRecords.map((record) => [
        record.url,
        {
          verification: record.verification || {
            confidence: "Pending deeper normalization.",
            evidence: "No generated verification metadata available."
          },
          claims: record.claims || [],
          sources: record.sources || [],
          decisions: record.decisions || [],
          openQuestions: record.openQuestions || []
        }
      ])
    );
  } catch (error) {
    traceabilityRecords = [];
    sectionEnhancements = {};
  }
}

function ensureTraceDrawer() {
  if (document.querySelector("[data-trace-drawer]")) return;
  const drawer = document.createElement("aside");
  drawer.className = "drawer";
  drawer.setAttribute("data-trace-drawer", "");
  drawer.setAttribute("aria-live", "polite");
  drawer.innerHTML =
    "<div class='drawer-head'><div><p class='row-kicker'>Trace This Claim</p><h3></h3></div><button type='button' aria-label='Close trace panel' data-close-trace>&times;</button></div><div class='drawer-body'></div>";
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
  if (!ids || !ids.length) return "<span class='empty-state'>None linked yet</span>";
  return ids
    .map((id) => `<a class="tag" href="${basePath}${id.toLowerCase()}.html">${id}</a>`)
    .join(" ");
}

function renderTraceabilityExplorer() {
  const input = document.querySelector("[data-traceability-search]");
  const grid = document.querySelector("[data-traceability-grid]");
  if (!input || !grid) return;

  const render = () => {
    const query = (input.value || "").toLowerCase().trim();
    const matches = !query
      ? traceabilityRecords
      : traceabilityRecords.filter((record) =>
          [
            record.id,
            record.title,
            record.summary,
            (record.sources || []).join(" "),
            (record.decisions || []).join(" "),
            (record.openQuestions || []).join(" ")
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
              <p><strong>Sources</strong><br>${renderTagLinks(record.sources || [], "/sources/")}</p>
              <p><strong>Decisions</strong><br>${renderTagLinks(record.decisions || [], "/decision-log/")}</p>
              <p><strong>Open Questions</strong><br>${renderTagLinks(record.openQuestions || [], "/open-questions/")}</p>
            </article>`
          )
          .join("")
      : "<p class='empty-state'>No traceability record matched that filter.</p>";
  };

  render();
  input.addEventListener("input", render);
}

function calcDollar() {
  const input = document.querySelector("[data-tax-amount]");
  const out = document.querySelector("[data-explorer-output]");
  if (!input || !out) return;
  const amount = Math.max(1, Number(input.value || 100));
  const rows = [
    ["International assistance obligations, FY2023 basis", 99.9, "S-038"],
    ["International assistance disbursements, FY2023 basis", 71.9, "S-038 / S-039"],
    ["Net-new military assistance, Ukraine-surge cumulative obligations", 50.9, "Section 5"],
    ["Recurring security assistance lanes", 1.6, "Section 5"],
    ["Noncitizen SSI, Dec. 2021 basis", 2.21, "S-073"],
    ["Emergency Medicaid, federal + state, FY2023", 3.8, "Section 7 / A-037"]
  ];
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  out.innerHTML =
    rows
      .map(
        ([label, value, source]) =>
          `<div class="source-row"><strong>${label}</strong><br><span class="tag">${source}</span> $${(
            amount *
            (value / total)
          ).toFixed(2)} of $${amount.toLocaleString()}</div>`
      )
      .join("") +
    '<p class="lede">Prototype only. These lanes use incompatible bases and are not a blended grand total.</p>';
}

function injectVerificationPanel() {
  const config = sectionEnhancements[location.pathname];
  const actions = document.querySelector(".actions");
  if (!config || !actions || document.querySelector("[data-verification-panel]")) return;

  const panel = document.createElement("section");
  panel.className = "panel verification";
  panel.setAttribute("data-verification-panel", "");
  panel.innerHTML = `<div>
      <p class="row-kicker">Verification metadata</p>
      <h2>Inspect this section before trusting its headline.</h2>
      <p><strong>Confidence:</strong> ${config.verification.confidence}</p>
      <p><strong>Evidence posture:</strong> ${config.verification.evidence}</p>
      <p class="note">This metadata is generated from repository-backed publication data, not hand-maintained browser logic.</p>
    </div>
    <div class="stack">
      <p><strong>Linked source IDs</strong><br>${renderTagLinks(config.sources || [], "/sources/")}</p>
      <p><strong>Open questions</strong><br>${renderTagLinks(config.openQuestions || [], "/open-questions/")}</p>
      <p><strong>More context</strong><br><a class="button subtle" href="/decision-log.html">Decision log</a> <a class="button subtle" href="/search.html">Search</a></p>
    </div>`;
  actions.insertAdjacentElement("afterend", panel);

  const claims = document.querySelectorAll(".claim");
  (config.claims || []).forEach((claim) => {
    const target = claims[claim.index];
    if (!target || target.querySelector("[data-trace-title]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trace-button";
    button.setAttribute("data-trace-title", claim.title);
    button.setAttribute("data-trace-body", claim.body);
    button.textContent = "Trace this claim";
    target.appendChild(button);
  });
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
    traceClaim(
      traceButton.getAttribute("data-trace-title") || "",
      traceButton.getAttribute("data-trace-body") || ""
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
  ensureTraceDrawer();
  await loadTraceabilityData();
  injectVerificationPanel();
  calcDollar();
  renderTraceabilityExplorer();
  document.querySelectorAll("[data-filter-input]").forEach(filterList);
  if (document.querySelector("[data-publication-search]")) {
    const params = new URLSearchParams(location.search);
    runPublicationSearch(params.get("q") || "");
  }
});
