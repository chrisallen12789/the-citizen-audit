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

function nav() {
  return `<header class="site-header">
    <a class="brand" href="/"><span class="seal">CA</span><span>The Citizen Audit</span></a>
    <button class="menu" data-menu aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" data-nav>
      <a href="/audit.html">Audit</a>
      <a href="/sources.html">Sources</a>
      <a href="/search.html">Search</a>
      <a href="/explorer.html">Explorer</a>
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

function linkList(items, basePath) {
  return items
    .map((item) => `<a class="tag" href="${basePath}${item.toLowerCase()}.html">${escapeHtml(item)}</a>`)
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
  "Appendix B": "/audit/appendix-b-transparency-scorecard.html"
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

function renderSourceIndex() {
  const rows = publication.sources
    .map(
      (source) => `<article class="source-row" data-filterable data-search="${escapeHtml(
        [source.id, source.title, source.summary, source.sections.join(" "), source.claims.join(" ")].join(" ")
      )}">
        <div class="source-row-head">
          <div>
            <p class="row-kicker">${escapeHtml(source.type)} - ${escapeHtml(source.agency)}</p>
            <h2 class="row-title"><a href="/sources/${source.slug}.html">${escapeHtml(source.id)} - ${escapeHtml(source.title)}</a></h2>
          </div>
          <span class="tag">${escapeHtml(source.confidence)}</span>
        </div>
        <p>${escapeHtml(source.summary)}</p>
        <p class="meta-line"><strong>Evidence class:</strong> ${escapeHtml(source.evidenceClass)}</p>
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
      <p>This release publishes the sources already cited in converted sections and connects them to the claims and open questions they support. Additional Source IDs should be added from the canonical PDF as they are extracted and verified.</p>
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
  const claims = source.claims.map((claim) => `<li>${escapeHtml(claim)}</li>`).join("");
  const relatedDecisions = relatedDecisionsForSections(source.sections);
  const body = `<div class="actions">
      <a class="button" href="/sources.html">Back to source index</a>
      <a class="button" href="/search.html?q=${encodeURIComponent(source.id)}">Search related records</a>
    </div>
    <section class="panel">
      <h2>Source summary</h2>
      <p>${escapeHtml(source.summary)}</p>
      <div class="meta-grid">
        <p><strong>Source ID:</strong> ${escapeHtml(source.id)}</p>
        <p><strong>Agency:</strong> ${escapeHtml(source.agency)}</p>
        <p><strong>Type:</strong> ${escapeHtml(source.type)}</p>
        <p><strong>Confidence:</strong> ${escapeHtml(source.confidence)}</p>
        <p><strong>Evidence class:</strong> ${escapeHtml(source.evidenceClass)}</p>
        <p><strong>Sections:</strong> ${linkSections(source.sections)}</p>
      </div>
    </section>
    <section class="panel">
      <h2>Claims supported in the current web edition</h2>
      <ul>${claims}</ul>
    </section>
    <section class="panel">
      <h2>Related open questions</h2>
      ${
        source.openQuestions.length
          ? `<p>${linkList(source.openQuestions, "/open-questions/")}</p>`
          : "<p>No open question is directly attached to this source in the current web edition.</p>"
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
  const body = `<div class="actions">
      <a class="button" href="/open-questions.html">Back to open questions</a>
      <a class="button" href="/audit/appendix-a-open-questions.html">Appendix A</a>
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
  const body = `<div class="actions">
      <a class="button" href="/decision-log.html">Back to decision log</a>
      <a class="button" href="/search.html?q=${encodeURIComponent(item.id)}">Search related records</a>
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

function buildSearchIndex() {
  const items = [];
  for (const source of publication.sources) {
    items.push({
      type: "Source",
      id: source.id,
      title: source.title,
      url: `/sources/${source.slug}.html`,
      text: [source.summary, source.sections.join(" "), source.claims.join(" "), source.openQuestions.join(" ")].join(" ")
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
  items.push(
    {
      type: "Section",
      id: "Section 1",
      title: "Executive Summary",
      url: "/audit/section-01-executive-summary.html",
      text: "known minimum incompatible bases no blended grand total noncitizen SSI emergency Medicaid open questions A-005 A-018 A-028 A-037"
    },
    {
      type: "Section",
      id: "Section 2",
      title: "Definitions and Methodology",
      url: "/audit/section-02-definitions-methodology.html",
      text: "recipient economic beneficiary appropriation obligation outlay evidence class confidence estimation standard category separation"
    },
    {
      type: "Section",
      id: "Section 3",
      title: "International Assistance",
      url: "/audit/section-03-international-assistance.html",
      text: "ForeignAssistance.gov obligations disbursements Total A Total B A-005"
    },
    {
      type: "Section",
      id: "Section 5",
      title: "Military Aid",
      url: "/audit/section-05-military-aid.html",
      text: "USAI PDA replacement Section 333 CTEF A-017 drawdown replacement"
    },
    {
      type: "Section",
      id: "Section 4",
      title: "Ukraine and Israel Examples",
      url: "/audit/section-04-ukraine-israel-examples.html",
      text: "ukraine israel non-additive D-017 A-006 A-010 A-011 A-012 appropriated disbursed delivered OSP FMF MOU"
    },
    {
      type: "Section",
      id: "Section 6",
      title: "Refugee Resettlement",
      url: "/audit/section-06-refugee-resettlement.html",
      text: "ORR refugee entrant assistance USAspending 075-1503 provider capture A-018 A-019 A-020 A-021"
    },
    {
      type: "Section",
      id: "Section 7",
      title: "Medicaid / Emergency Medical",
      url: "/audit/section-07-medicaid-emergency-medical.html",
      text: "emergency Medicaid A-037 provider capture federal-only share"
    },
    {
      type: "Section",
      id: "Section 8",
      title: "Food Assistance",
      url: "/audit/section-08-food-assistance.html",
      text: "SNAP no modeled share citizen-child exclusion Section 13"
    },
    {
      type: "Section",
      id: "Section 9",
      title: "Cash Welfare / Income",
      url: "/audit/section-09-cash-welfare-income.html",
      text: "SSA SSI S-073 365714 2.21B A-028"
    },
    {
      type: "Section",
      id: "Section 10",
      title: "Federal Housing",
      url: "/audit/section-10-federal-housing.html",
      text: "Section 214 proration HUD eligible noncitizen housing A-030 A-031 S-067 S-068 S-077"
    },
    {
      type: "Section",
      id: "Section 11",
      title: "Education / Public Services",
      url: "/audit/section-11-education-public-services.html",
      text: "Plyler K-12 status blind federal student aid eligible noncitizen A-032 A-033 S-069"
    },
    {
      type: "Section",
      id: "Section 12",
      title: "State-Administered Federal Dollars",
      url: "/audit/section-12-state-administered-federal-dollars.html",
      text: "state administered non-additive D-020 D-021 A-034 reconciliation lens double count guard"
    },
    {
      type: "Section",
      id: "Section 13",
      title: "Programs Without Citizenship Breakouts",
      url: "/audit/section-13-programs-without-citizenship-breakouts.html",
      text: "gap register no figures no fabricated estimate A-023 A-025 A-027 A-030 A-032 A-033 A-034 A-035 A-036 transparency"
    },
    {
      type: "Section",
      id: "Section 14",
      title: "Conservative Total",
      url: "/audit/section-14-conservative-total.html",
      text: "D-022 D-023 no blended grand total set of subtotals A-017 A-018 A-037 Lane 1 Lane 3 Lane 4 conservative total"
    },
    {
      type: "Section",
      id: "Section 15",
      title: "What Is Missing",
      url: "/audit/section-15-what-is-missing.html",
      text: "permanent limitations A-005 A-018 A-028 A-037 transparency missing evidence D-024"
    },
    {
      type: "Section",
      id: "Section 16",
      title: "Final Argument",
      url: "/audit/section-16-final-argument.html",
      text: "bounded synthesis D-025 no advocacy final argument SSI SNAP emergency Medicaid basis segregation"
    }
  );
  return items;
}

function build() {
  writeFile("sources.html", renderSourceIndex());
  for (const source of publication.sources) {
    writeFile(`sources/${source.slug}.html`, renderSourceDetail(source));
  }
  writeFile("open-questions.html", renderOpenQuestionIndex());
  for (const item of publication.openQuestions) {
    writeFile(`open-questions/${item.slug}.html`, renderOpenQuestionDetail(item));
  }
  writeFile("decision-log.html", renderDecisionLog());
  for (const decision of publication.decisions) {
    writeFile(`decision-log/${decision.slug}.html`, renderDecisionDetail(decision));
  }
  writeFile("release-notes.html", renderReleasePage("release-notes"));
  writeFile("version-history.html", renderReleasePage("version-history"));
  writeFile("changelog.html", renderReleasePage("changelog"));
  writeFile("search.html", renderSearchPage());
  writeFile("audit/appendix-a-open-questions.html", renderAppendixA());
  writeFile("audit/appendix-b-transparency-scorecard.html", renderAppendixB());
  writeFile("data/publication-search.json", `${JSON.stringify(buildSearchIndex(), null, 2)}\n`);
}

build();
