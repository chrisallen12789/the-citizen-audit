const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publication = require("../scripts/publication-data");
const { createRelationships } = require("../scripts/renderers/relationships");
const { createSectionRenderer } = require("../scripts/renderers/sections");
const { createPageRenderer } = require("../scripts/renderers/page-model");

const root = path.resolve(__dirname, "..");
const { renderSectionPage } = createSectionRenderer(publication, createRelationships(publication));
const { renderPublicationPage } = createPageRenderer(publication);
const figures = new Map(publication.figureMetadata.map((figure) => [figure.id, figure]));
const tables = new Map(publication.auditReaderTables.map((table) => [table.id, table]));
const approvedIds = [
  "R03-F01", "R03-F02", "R03-F03", "R03-F04", "R03-F05", "R03-F06", "R03-F07",
  "R03-F08", "R03-F09", "R03-F10", "R03-F11", "R03-F13", "R03-F17", "R03-F18",
  "R03-F19", "R03-F20", "R03-F21", "R03-F23", "R03-F24", "R03-F27"
];
const canonicalNotice =
  "The Citizen Audit v1.0 PDF remains the canonical publication. These web pages are a structured reader conversion provided for navigation and inspection.";

function section(id) {
  return publication.sections.find((item) => item.id === id);
}

function renderSection(id) {
  return renderSectionPage(section(id));
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function renderedFigureFragment(figure) {
  const html = figure.sectionId
    ? renderSection(figure.sectionId)
    : renderPublicationPage(publication.pages.find((page) => page.id === figure.pageId));
  const match = html.match(
    new RegExp(`<aside class="figure-metadata"[^>]*data-figure-id="${figure.id}"[\\s\\S]*?</aside>`)
  );
  assert.ok(match, `${figure.id} renders one metadata panel`);
  return match[0];
}

function publicPath(route) {
  return path.join(root, "public", route.replace(/^\//, ""));
}

test("authoritative overlay contains only the approved major-figure set", () => {
  assert.deepEqual([...figures.keys()].sort(), approvedIds.sort());
  for (const excluded of ["R03-F12", "R03-F14", "R03-F15", "R03-F16", "R03-F22", "R03-F25", "R03-F26", "R03-F28"]) {
    assert.equal(figures.has(excluded), false, excluded);
  }
  assert.equal(new Set(publication.figureMetadata.map((figure) => figure.id)).size, approvedIds.length);
});

test("every null figure confidence has an explicit accurate rendered display state", () => {
  const expected = new Map([
    ["R03-F01", "Component-specific; no combined rating"],
    ["R03-F02", "Component-specific; no combined rating"],
    ["R03-F03", "Row-specific; no combined rating"],
    ["R03-F04", "Not assigned — contextual sources only"],
    ["R03-F05", "Stage-specific; no combined rating"],
    ["R03-F06", "Not assigned"],
    ["R03-F07", "Component-specific; no combined rating"],
    ["R03-F08", "Row-specific; no combined rating"],
    ["R03-F13", "Not assigned"],
    ["R03-F18", "Row-specific; no combined rating"],
    ["R03-F17", "Row-specific; no combined rating"],
    ["R03-F19", "Not assigned — authority register has no confidence field"],
    ["R03-F20", "Lane-specific; no combined rating"],
    ["R03-F21", "Not assigned — capture-share bridge has no confidence rating"],
    ["R03-F23", "Row-specific; no combined rating"],
    ["R03-F24", "Lane-specific; no combined rating"],
    ["R03-F27", "Not applicable — non-fiscal scorecard"]
  ]);
  const nullFigures = publication.figureMetadata.filter((figure) => figure.confidence === null);
  assert.deepEqual(
    nullFigures.map((figure) => figure.id).sort(),
    [...expected.keys()].sort()
  );

  for (const figure of nullFigures) {
    assert.equal(figure.confidenceDisplay, expected.get(figure.id), `${figure.id} model display`);
    const fragment = renderedFigureFragment(figure);
    assert.ok(
      fragment.includes(`<dt>Confidence</dt><dd>${expected.get(figure.id)}</dd>`),
      `${figure.id} rendered display`
    );
  }

  for (const id of ["R03-F04", "R03-F06", "R03-F13", "R03-F19", "R03-F21", "R03-F27"]) {
    assert.doesNotMatch(figures.get(id).confidenceDisplay, /component-|row-|lane-|stage-specific/i, id);
  }

  const rendererSource = fs.readFileSync(
    path.join(root, "scripts", "renderers", "figure-metadata.js"),
    "utf8"
  );
  assert.doesNotMatch(rendererSource, /Component- or lane-specific; no combined rating/);
  assert.doesNotMatch(rendererSource, /figure\.confidence\s*\|\|/);
});

test("established figure-level confidence values remain exact and are not inferred", () => {
  for (const id of ["R03-F09", "R03-F10", "R03-F11"]) {
    const figure = figures.get(id);
    assert.equal(figure.confidenceDisplay, figure.confidence);
    assert.ok(
      renderedFigureFragment(figure).includes(
        `<dt>Confidence</dt><dd>${figure.confidence}</dd>`
      )
    );
  }
  assert.ok(
    publication.figureMetadata
      .filter((figure) => figure.confidence === null)
      .every((figure) => figure.confidence === null)
  );
});

test("owner decisions preserve component, source-role, and confidence boundaries", () => {
  const f01 = figures.get("R03-F01");
  assert.equal(f01.fiscalBasis, null);
  assert.equal(f01.confidence, null);
  assert.deepEqual(
    [...new Set(f01.parts.flatMap((part) => part.sourceIds))].sort(),
    ["S-038", "S-053", "S-054", "S-055", "S-058"]
  );

  const f02 = figures.get("R03-F02");
  assert.equal(f02.figureType, "Composite card with basis-separated components");
  assert.deepEqual(f02.parts.map((part) => part.label), ["Noncitizen SSI", "Emergency Medicaid"]);
  assert.notEqual(f02.parts[0].basis, f02.parts[1].basis);

  const f04 = figures.get("R03-F04");
  assert.deepEqual(f04.sourceIds, []);
  assert.deepEqual(f04.contextualSourceIds, ["S-038", "S-039"]);

  const f05 = figures.get("R03-F05");
  assert.deepEqual(f05.sourceIds, ["S-044"]);
  assert.deepEqual(f05.parts.slice(0, 2).map((part) => part.sourceIds), [["S-044"], ["S-044"]]);
  assert.equal(f05.parts[2].label, "$50.9B context");
  assert.equal(f05.parts[2].confidence, "Low");
  assert.deepEqual(f05.parts[2].contextualSourceIds, ["S-047"]);

  const f06 = figures.get("R03-F06");
  assert.deepEqual(f06.sourceIds, ["S-049"]);
  assert.deepEqual(f06.contextualSourceIds, ["S-045"]);
  assert.ok(f06.limitationStatus.includes("No cross-program aggregate"));
});

test("partial and row-specific decisions remain explicitly bounded", () => {
  const f08 = figures.get("R03-F08");
  const fy2019 = f08.parts.find((part) => part.label.includes("FY2019"));
  assert.deepEqual(fy2019.sourceIds, []);
  assert.equal(fy2019.confidence, null);
  assert.match(fy2019.limitation, /Source ID and metadata confidence are unresolved/);

  const f23 = figures.get("R03-F23");
  assert.deepEqual(
    f23.parts.map((part) => ({ label: part.label, sources: part.sourceIds, context: part.contextualSourceIds || [] })),
    [
      { label: "Audit FY2023 $3.8B", sources: ["S-065"], context: ["S-064"] },
      { label: "House Budget Committee $16.2B", sources: ["S-079"], context: [] },
      { label: "CBO $27B", sources: ["S-078"], context: [] }
    ]
  );
  assert.equal(f23.fiscalBasis, null);

  const f24 = figures.get("R03-F24");
  assert.equal(f24.confidence, null);
  assert.equal(f24.parts.length, 4);
  assert.ok(f24.parts.every((part) => part.confidence && part.basis));
});

test("Appendix B figure binds only accepted categories, rows, and references", () => {
  const f27 = figures.get("R03-F27");
  assert.deepEqual(f27.sourceIds, []);
  assert.equal(f27.afterBlockType, "appendixTransparencyScorecard");
  const page = publication.pages.find((item) => item.id === "PAGE-APPENDIX-B");
  const html = renderPublicationPage(page);
  for (const category of publication.appendixB.categories) assert.ok(html.includes(category.label));
  for (const row of publication.appendixB.rows) assert.ok(html.includes(row.key));
  for (const id of ["A-024", "A-026", "A-027", "A-029", "A-030", "A-032", "A-033", "A-034", "A-035"]) {
    assert.ok(html.includes(id));
  }
  assert.equal(count(html, /data-figure-id="R03-F27"/g), 1);
});

test("Sections 6–8 table models reproduce all canonical cells, rows, and notes", () => {
  assert.deepEqual(tables.get("R03-F08").columns, ["Item", "Figure", "FY", "Number type", "Class/Source", "Confidence"]);
  assert.deepEqual(tables.get("R03-F08").rows.map((row) => row.cells), [
    ["Refugee & Entrant Assistance — emergency-designated", "≈$4.2B", "FY2023", "Appropriation/BA (emergency)", "B [S-070]", "High"],
    ["Refugee & Entrant Assistance — emergency-designated", "≈$481M", "FY2024", "Appropriation/BA (emergency, P.L.118-50)", "B [S-070]", "High"],
    ["Refugee Support Services (RSS) base", "≈$307M", "FY2024", "Appropriation (base)", "A [S-060]", "High"],
    ["Transitional & Medical Services (T&MS) base", "≈$564M", "FY2024", "Appropriation (base)", "A [S-060]", "High"],
    ["ORR total discretionary (historical ref.)", "≈$1.905B (UC ≈$1.303B = 68%)", "FY2019", "Appropriation", "D→ORR CBJ", "Medium"],
    ["Consolidated ORR obligations/outlays", "PENDING (A-018)", "FY2023–25", "Obligation/Outlay", "S-062", "— (carried)"]
  ]);
  assert.deepEqual(tables.get("R03-F08").notes, [
    "Note (canonical, from QA correction): the $4.2B / $481M figures are appropriations / budget authority, not outlays, and are not consolidated ORR spending. Consolidated obligations/outlays remain pending the USAspending 075-1503 pull (A-018)."
  ]);

  assert.deepEqual(tables.get("R03-F09").rows.map((row) => row.cells), [[
    "Emergency Medicaid spending", "≈$3.8B (≈0.4% of total Medicaid) — federal + state", "FY2023", "Outlay/Expenditure", "D [S-064] → primary CMS-64/MACPAC [S-065]", "Medium-High"
  ]]);
  assert.deepEqual(tables.get("R03-F09").notes, [
    "Permanent flagged limitation (A-037): the published $3.8B is fed + state; the federal-only share (FMAP-dependent, < $3.8B) is the Total A figure and is not yet isolated. Section 14 carries this line with no value until A-037 is resolved."
  ]);

  assert.deepEqual(tables.get("R03-F10").rows.map((row) => row.cells), [
    ["SNAP participants", "42.2M people/month (avg)", "FY2023", "Caseload/Participation", "A", "High"],
    ["SNAP total cost", "$113.2B", "FY2023", "Outlay (benefits + admin)", "A", "High"],
    ["SNAP benefits", "$107.1B", "FY2023", "Outlay (benefits)", "A", "High"],
    ["Authorized retailers / meal providers", "255,594 / 6,176", "FY2023", "Count", "A", "High"]
  ]);
  assert.equal(tables.get("R03-F10").supplemental[0].text,
    "89.4% U.S.-born citizens; foreign-born <11% (6.2% naturalized citizens — out of scope; 1.1% refugees; 3.3% other noncitizens). Non-citizen participants ≈4–5% (~1.7M). 39% of participants are children. Most SNAP households with a non-citizen still include U.S.-citizen members."
  );
});

test("restored tables use semantic headers and bounded mobile overflow", () => {
  const expectations = [
    ["Section 6", "R03-F08", 6],
    ["Section 7", "R03-F09", 1],
    ["Section 8", "R03-F10", 4]
  ];
  for (const [sectionId, figureId, rows] of expectations) {
    const html = renderSection(sectionId);
    assert.equal(count(html, new RegExp(`data-reader-table-id="${figureId}"`, "g")), 1);
    assert.equal(count(html, /class="reader-table-scroll" role="region"[^>]*tabindex="0"/g), 1);
    assert.equal(count(html, /<caption>/g), 1);
    assert.equal(count(html, /data-reader-table-row=/g), rows);
    assert.equal(count(html, /data-reader-table-row="[^"]+">\s*<th scope="row">/g), rows);
  }
  const css = fs.readFileSync(path.join(root, "public", "audit-reader.css"), "utf8");
  assert.match(css, /\.reader-table-scroll,[\s\S]*max-width:\s*100%;[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.reader-figure\s*{[^}]*max-width:\s*100%;[^}]*min-width:\s*0/s);
  assert.match(css, /\.reader-table-card,[\s\S]*box-sizing:\s*border-box;[^}]*max-width:\s*100%;[^}]*min-width:\s*0/s);
  assert.match(css, /\.audit-reader-content\s*{[^}]*min-width:\s*0/s);
});

test("all affected pages retain navigation, canonical hierarchy, controls, and SEO", () => {
  const affected = ["Section 1", "Section 3", "Section 4", "Section 5", "Section 6", "Section 7", "Section 8", "Section 9", "Section 10", "Section 14"];
  for (const id of affected) {
    const item = section(id);
    const html = renderSectionPage(item);
    assert.equal(count(html, /data-audit-contents-entry=/g), 18, id);
    assert.equal(count(html, /aria-current="page"/g), 1, id);
    assert.equal(count(html, new RegExp(canonicalNotice, "g")), 1, id);
    assert.ok(html.includes('href="/downloads/the-citizen-audit-v1.0.pdf"'));
    assert.ok(html.includes('<a class="button" href="/audit.html">Audit Index</a>'));
    assert.ok(html.includes(
      `<link rel="canonical" href="https://thecitizenaudit.org${item.url}">`
    ));
    assert.ok(html.includes(
      `Structured web reader conversion of ${id} from The Citizen Audit v1.0; the PDF remains canonical.`
    ));
  }
});

test("generated affected pages match renderers and no metadata record creates a blended total", () => {
  for (const id of ["Section 1", "Section 3", "Section 4", "Section 5", "Section 6", "Section 7", "Section 8", "Section 9", "Section 10", "Section 14"]) {
    const item = section(id);
    assert.equal(fs.readFileSync(publicPath(item.url), "utf8"), renderSectionPage(item));
  }
  const appendix = publication.pages.find((item) => item.id === "PAGE-APPENDIX-B");
  assert.equal(fs.readFileSync(publicPath(appendix.url), "utf8"), renderPublicationPage(appendix));
  assert.doesNotMatch(JSON.stringify(publication.figureMetadata), /blended grand total/i);
  assert.ok(publication.figureMetadata.every((figure) => !figure.aggregate));
});

test("canonical PDF hash remains unchanged", () => {
  const bytes = fs.readFileSync(path.join(root, "public", "downloads", "the-citizen-audit-v1.0.pdf"));
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    "30d7a44cfedf8b5c654466dd69a0f18b3e93837b18dba0c1f2db4b71fb0f1a49"
  );
});
