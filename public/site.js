const sectionEnhancements = {
  "/audit/section-01-executive-summary.html": {
    verification: {
      confidence:
        "High for lane descriptions and stated limitations; low for any blended reading the section explicitly forbids.",
      evidence:
        "Section-level synthesis built from published figures already surfaced in Sections 3, 5, 7, and 9.",
      sources: ["S-038", "S-039", "S-040", "S-073"],
      openQuestions: ["A-005", "A-018", "A-028", "A-037"]
    },
    claims: [
      {
        index: 0,
        title: "Methodological lock",
        body:
          "<p>The Executive Summary keeps each figure on its original basis instead of merging them.</p><ul><li>International assistance obligations/disbursements: <a href='/sources/s-038.html'>S-038</a>, <a href='/sources/s-039.html'>S-039</a>, <a href='/sources/s-040.html'>S-040</a></li><li>Military harmonization limit: <a href='/open-questions/a-017.html'>A-017</a></li><li>Emergency Medicaid federal-only limit: <a href='/open-questions/a-037.html'>A-037</a></li><li>SSI point-in-time basis: <a href='/open-questions/a-028.html'>A-028</a></li></ul>"
      }
    ]
  },
  "/audit/section-02-definitions-methodology.html": {
    verification: {
      confidence:
        "High for definitions and rule statements because the section is grounded in primary legal and federal-accounting references.",
      evidence:
        "Primary statutes and federal budget glossaries define the core vocabulary and measurement rules.",
      sources: ["S-002", "S-003", "S-004", "S-005", "S-006"],
      openQuestions: []
    },
    claims: [
      {
        index: 0,
        title: "Category separation rule",
        body:
          "<p>The category-separation rule is tied to statutory distinctions in the U.S. Code and preserved as a binding methodology rule.</p><ul><li><a href='/sources/s-002.html'>S-002</a> qualified-alien categories</li><li><a href='/sources/s-003.html'>S-003</a> federal public-benefit restrictions</li><li><a href='/sources/s-004.html'>S-004</a> five-year bar framework</li></ul>"
      }
    ]
  },
  "/audit/section-03-international-assistance.html": {
    verification: {
      confidence:
        "High for published aggregate obligations/disbursements; limited for value-capture analysis beyond the public record.",
      evidence:
        "Primary foreign-assistance reporting datasets support the aggregate totals, while beneficiary-capture share remains unresolved.",
      sources: ["S-038", "S-039", "S-040"],
      openQuestions: ["A-005"]
    },
    claims: [
      {
        index: 0,
        title: "Reading rule for obligations versus disbursements",
        body:
          "<p>Section 3 treats obligations and disbursements as separate accounting states, not interchangeable totals.</p><ul><li><a href='/sources/s-038.html'>S-038</a> aggregate obligations/disbursements</li><li><a href='/sources/s-039.html'>S-039</a> supporting agency-published disbursement context</li><li><a href='/sources/s-040.html'>S-040</a> published reporting framework</li><li><a href='/open-questions/a-005.html'>A-005</a> unresolved U.S.-capture share</li></ul>"
      }
    ]
  },
  "/audit/section-05-military-aid.html": {
    verification: {
      confidence:
        "Moderate to high for lane separation and countable military-aid categories; unresolved for cross-section harmonization.",
      evidence:
        "The section is strongest where it separates already-counted foreign assistance from net-new military lanes and keeps drawdown value distinct from replacement cost.",
      sources: ["S-043"],
      openQuestions: ["A-017"]
    },
    claims: [
      {
        index: 0,
        title: "No cross-section grand total",
        body:
          "<p>Section 5 keeps multi-year military lanes separate from the single-year Section 3 international-assistance aggregates.</p><ul><li><a href='/open-questions/a-017.html'>A-017</a> explains why harmonization remains open</li><li><a href='/sources/s-043.html'>S-043</a> helps distinguish taxpayer-funded assistance from foreign-funded sales</li></ul>"
      }
    ]
  },
  "/audit/section-07-medicaid-emergency-medical.html": {
    verification: {
      confidence:
        "Moderate for the published federal-plus-state figure; lower for federal-only conclusions the section does not claim.",
      evidence:
        "The section preserves the measurable emergency-medical lane while flagging the missing federal-only share.",
      sources: ["S-003"],
      openQuestions: ["A-037"]
    },
    claims: [
      {
        index: 0,
        title: "Provider capture dominates the beneficiary chain",
        body:
          "<p>The section states that emergency Medicaid dollars are usually paid to domestic medical providers even when the patient receives emergency treatment.</p><ul><li><a href='/sources/s-003.html'>S-003</a> statutory exception context</li><li><a href='/open-questions/a-037.html'>A-037</a> missing federal-only breakout</li></ul>"
      }
    ]
  },
  "/audit/section-08-food-assistance.html": {
    verification: {
      confidence:
        "High for the methodology rule against modeled non-citizen dollar shares; low for any precise SNAP dollar breakout because the section rejects that claim.",
      evidence:
        "The section uses eligibility and publication limits to explain why a counted dollar share is not published here.",
      sources: ["S-003"],
      openQuestions: []
    },
    claims: [
      {
        index: 0,
        title: "No modeled share",
        body:
          "<p>Section 8 refuses to estimate non-citizen SNAP dollars by population share because doing so would blur citizen-child benefits and overstate certainty.</p><ul><li>Bound by the methodology page's anti-modeling rule</li><li>Connected to the citizen-child exclusion preserved in <a href='/decision-log.html'>Decision Log</a></li></ul>"
      }
    ]
  },
  "/audit/section-09-cash-welfare-income.html": {
    verification: {
      confidence:
        "High for the published SSI point-in-time basis; moderate for annualization beyond that basis.",
      evidence:
        "SSA primary data publishes the noncitizen recipient count and average payment inputs used for the current calculation.",
      sources: ["S-073"],
      openQuestions: ["A-028"]
    },
    claims: [
      {
        index: 0,
        title: "SSI Total B approximately equals Total A",
        body:
          "<p>The section treats SSI as a rare domestic lane where provider capture is minimal because the benefit is direct cash.</p><ul><li><a href='/sources/s-073.html'>S-073</a> published SSI recipient and payment inputs</li><li><a href='/open-questions/a-028.html'>A-028</a> point-in-time basis limitation</li></ul>"
      }
    ]
  }
};

const traceabilityRecords = [
  {
    id: "Section 1",
    title: "Executive Summary",
    url: "/audit/section-01-executive-summary.html",
    summary: "Basis-segregated summary of measurable lanes and permanent limitations.",
    sources: ["S-038", "S-039", "S-040", "S-073"],
    decisions: ["D-001", "D-020"],
    openQuestions: ["A-005", "A-018", "A-028", "A-037"],
    relatedSections: ["Section 3", "Section 5", "Section 7", "Section 9", "Section 14"]
  },
  {
    id: "Section 2",
    title: "Definitions and Methodology",
    url: "/audit/section-02-definitions-methodology.html",
    summary: "Primary legal and accounting definitions that bind the rest of the publication.",
    sources: ["S-002", "S-003", "S-004", "S-005", "S-006"],
    decisions: ["D-001", "D-005", "D-012"],
    openQuestions: ["A-002"],
    relatedSections: ["Section 1", "Section 3", "Section 5", "Section 8", "Section 9"]
  },
  {
    id: "Section 3",
    title: "International Assistance",
    url: "/audit/section-03-international-assistance.html",
    summary: "Aggregate foreign-assistance obligations and disbursements with unresolved capture share.",
    sources: ["S-001", "S-038", "S-039", "S-040", "S-042", "S-043"],
    decisions: ["D-013", "D-014", "D-017"],
    openQuestions: ["A-001", "A-003", "A-004", "A-005"],
    relatedSections: ["Section 1", "Section 4", "Section 5", "Section 6", "Section 14"]
  },
  {
    id: "Section 4",
    title: "Ukraine and Israel Examples",
    url: "/audit/section-04-ukraine-israel-examples.html",
    summary: "Illustrative, non-additive examples showing stage differences and beneficiary-chain complexity.",
    sources: ["S-043", "S-044", "S-045", "S-046", "S-047", "S-048", "S-049"],
    decisions: ["D-013", "D-017", "D-018", "D-019"],
    openQuestions: ["A-006", "A-007", "A-008", "A-009", "A-010", "A-011", "A-012"],
    relatedSections: ["Section 3", "Section 5", "Section 14"]
  },
  {
    id: "Section 5",
    title: "Military Aid",
    url: "/audit/section-05-military-aid.html",
    summary: "NET-NEW military lanes separated from already-counted foreign assistance and non-taxpayer flows.",
    sources: ["S-043", "S-050", "S-051", "S-052", "S-053", "S-054", "S-055", "S-056", "S-057", "S-058", "S-059"],
    decisions: ["D-012", "D-017", "D-019", "D-020"],
    openQuestions: ["A-013", "A-014", "A-015", "A-016", "A-017"],
    relatedSections: ["Section 1", "Section 3", "Section 4", "Section 14"]
  },
  {
    id: "Section 6",
    title: "Refugee Resettlement",
    url: "/audit/section-06-refugee-resettlement.html",
    summary: "ORR lane with visible accounts but unresolved entrant-versus-provider and outlay splits.",
    sources: ["S-060", "S-061", "S-062", "S-063", "S-070", "S-071"],
    decisions: ["D-013", "D-014", "D-021"],
    openQuestions: ["A-018", "A-019", "A-020", "A-021"],
    relatedSections: ["Section 3", "Section 7", "Section 9", "Section 12", "Section 14"]
  },
  {
    id: "Section 7",
    title: "Emergency Medical",
    url: "/audit/section-07-medicaid-emergency-medical.html",
    summary: "Published emergency Medicaid figure with unresolved federal-only share and status isolation limits.",
    sources: ["S-003", "S-064", "S-065", "S-078", "S-079", "S-080"],
    decisions: ["D-021"],
    openQuestions: ["A-022", "A-023", "A-024", "A-037"],
    relatedSections: ["Section 1", "Section 6", "Section 12", "Section 13", "Section 14"]
  },
  {
    id: "Section 8",
    title: "Food Assistance",
    url: "/audit/section-08-food-assistance.html",
    summary: "SNAP eligibility and participation composition without a publishable noncitizen dollar breakout.",
    sources: ["S-002", "S-003", "S-004", "S-074"],
    decisions: ["D-021"],
    openQuestions: ["A-025", "A-026"],
    relatedSections: ["Section 2", "Section 9", "Section 13", "Section 16"]
  },
  {
    id: "Section 9",
    title: "Cash Welfare / Income",
    url: "/audit/section-09-cash-welfare-income.html",
    summary: "SSI is measurable on a published point-in-time basis while TANF and tax credits remain routed to Section 13.",
    sources: ["S-072", "S-073", "S-075", "S-076"],
    decisions: ["D-001", "D-021"],
    openQuestions: ["A-027", "A-028", "A-029"],
    relatedSections: ["Section 1", "Section 6", "Section 8", "Section 13", "Section 14"]
  },
  {
    id: "Section 10",
    title: "Federal Housing",
    url: "/audit/section-10-federal-housing.html",
    summary: "Housing rules strongly constrain ineligible use, but no clean eligible-noncitizen outlay is published.",
    sources: ["S-067", "S-068", "S-077"],
    decisions: ["D-021"],
    openQuestions: ["A-030", "A-031"],
    relatedSections: ["Section 12", "Section 13", "Section 16"]
  },
  {
    id: "Section 11",
    title: "Education / Public Services",
    url: "/audit/section-11-education-public-services.html",
    summary: "K-12 is status-blind under law and federal student-aid data are not published by eligible-noncitizen status.",
    sources: ["S-069"],
    decisions: ["D-021"],
    openQuestions: ["A-032", "A-033"],
    relatedSections: ["Section 12", "Section 13"]
  },
  {
    id: "Section 12",
    title: "State-Administered Federal Dollars",
    url: "/audit/section-12-state-administered-federal-dollars.html",
    summary: "Non-additive reconciliation lens showing where status detail disappears in state-administered federal streams.",
    sources: [],
    decisions: ["D-020", "D-021"],
    openQuestions: ["A-034"],
    relatedSections: ["Section 6", "Section 7", "Section 10", "Section 11", "Section 13"]
  },
  {
    id: "Section 13",
    title: "Programs Without Citizenship Breakouts",
    url: "/audit/section-13-programs-without-citizenship-breakouts.html",
    summary: "Central gap register for programs where the public record does not support a defensible noncitizen figure.",
    sources: [],
    decisions: ["D-021"],
    openQuestions: ["A-023", "A-024", "A-025", "A-026", "A-027", "A-029", "A-030", "A-032", "A-033", "A-034", "A-035", "A-036"],
    relatedSections: ["Section 7", "Section 8", "Section 9", "Section 10", "Section 11", "Section 12"]
  },
  {
    id: "Section 14",
    title: "Conservative Total",
    url: "/audit/section-14-conservative-total.html",
    summary: "Basis-segregated set of subtotals built to a frozen blueprint rather than a blended grand total.",
    sources: ["S-038", "S-055", "S-058", "S-064", "S-073"],
    decisions: ["D-014", "D-020", "D-022", "D-023"],
    openQuestions: ["A-017", "A-018", "A-037"],
    relatedSections: ["Section 1", "Section 3", "Section 5", "Section 6", "Section 7", "Section 9"]
  },
  {
    id: "Section 15",
    title: "What Is Missing",
    url: "/audit/section-15-what-is-missing.html",
    summary: "Named limitations and transparency failures carried into the locked publication without manufactured certainty.",
    sources: [],
    decisions: ["D-024"],
    openQuestions: ["A-005", "A-018", "A-028", "A-037"],
    relatedSections: ["Section 13", "Section 14", "Section 16"]
  },
  {
    id: "Section 16",
    title: "Final Argument",
    url: "/audit/section-16-final-argument.html",
    summary: "Closing synthesis bounded by the same basis rules, evidence hierarchy, and unresolved limits as the rest of v1.0.",
    sources: ["S-064", "S-073", "S-074"],
    decisions: ["D-020", "D-025"],
    openQuestions: ["A-005", "A-018", "A-028", "A-037"],
    relatedSections: ["Section 1", "Section 8", "Section 10", "Section 14", "Section 15"]
  }
];

const traceabilityByPath = Object.fromEntries(
  traceabilityRecords.map((record) => [record.url, record])
);

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
  if (!ids.length) return "<span class='empty-state'>None linked yet</span>";
  return ids
    .map((id) => `<a class="tag" href="${basePath}${id.toLowerCase()}.html">${id}</a>`)
    .join(" ");
}

function renderSectionLinks(sectionIds) {
  if (!sectionIds.length) return "<span class='empty-state'>No section links published yet</span>";
  return sectionIds
    .map((sectionId) => {
      const record = traceabilityRecords.find((item) => item.id === sectionId);
      if (!record) return "";
      return `<a class="tag" href="${record.url}">${record.id}</a>`;
    })
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
            record.sources.join(" "),
            record.decisions.join(" "),
            record.openQuestions.join(" ")
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
  const traceRecord = traceabilityByPath[location.pathname];
  const actions = document.querySelector(".actions");
  if (!actions || document.querySelector("[data-verification-panel]")) return;

  if (!config && !traceRecord) return;

  const panel = document.createElement("section");
  panel.className = "panel verification";
  panel.setAttribute("data-verification-panel", "");
  panel.innerHTML = `<div>
      <p class="row-kicker">Verification metadata</p>
      <h2>Inspect this section before trusting its headline.</h2>
      <p><strong>Confidence:</strong> ${
        config?.verification.confidence || "Structured traceability published; section-specific confidence note not yet expanded."
      }</p>
      <p><strong>Evidence posture:</strong> ${
        config?.verification.evidence || traceRecord?.summary || "Repository-backed section traceability record."
      }</p>
      <p class="note">The platform exposes the current repository-backed traceability layer without altering the locked section text.</p>
    </div>
    <div class="stack">
      <p><strong>Linked source IDs</strong><br>${
        (config?.verification.sources || traceRecord?.sources || []).length
          ? (config?.verification.sources || traceRecord?.sources || [])
              .map((id) => `<a class="tag" href="/sources/${id.toLowerCase()}.html">${id}</a>`)
              .join(" ")
          : "None linked yet"
      }</p>
      <p><strong>Open questions</strong><br>${
        (config?.verification.openQuestions || traceRecord?.openQuestions || []).length
          ? (config?.verification.openQuestions || traceRecord?.openQuestions || [])
              .map(
                (id) => `<a class="tag" href="/open-questions/${id.toLowerCase()}.html">${id}</a>`
              )
              .join(" ")
          : "No section-level open question linked"
      }</p>
      <p><strong>Decision links</strong><br>${
        traceRecord ? renderTagLinks(traceRecord.decisions, "/decision-log/") : "<span class='empty-state'>No decision links published yet</span>"
      }</p>
      <p><strong>Related sections</strong><br>${
        traceRecord ? renderSectionLinks(traceRecord.relatedSections || []) : "<span class='empty-state'>No related-section map published yet</span>"
      }</p>
      <p><strong>More context</strong><br><a class="button subtle" href="/explorer.html">Traceability explorer</a> <a class="button subtle" href="/search.html">Search</a></p>
    </div>`;
  actions.insertAdjacentElement("afterend", panel);

  const claims = document.querySelectorAll(".claim");
  (config?.claims || []).forEach((claim) => {
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

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-menu]").forEach(updateMenuState);
  ensureTraceDrawer();
  injectVerificationPanel();
  calcDollar();
  renderTraceabilityExplorer();
  document.querySelectorAll("[data-filter-input]").forEach(filterList);
  if (document.querySelector("[data-publication-search]")) {
    const params = new URLSearchParams(location.search);
    runPublicationSearch(params.get("q") || "");
  }
});
