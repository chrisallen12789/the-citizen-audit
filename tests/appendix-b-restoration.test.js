const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publication = require("../scripts/publication-data");
const { createPageRenderer } = require("../scripts/renderers/page-model");

const appendixPage = publication.pages.find((page) => page.id === "PAGE-APPENDIX-B");
const { renderPublicationPage } = createPageRenderer(publication);
const html = renderPublicationPage(appendixPage);

const expectedCategories = [
  "Transparent",
  "Partially transparent",
  "Opaque by reporting choice",
  "Opaque by technical limit",
  "Uncollectable by law/design"
];

const expectedRows = [
  ["SSI", "SSA", "Yes (noncitizen counts + average payment)", "Transparent (benchmark)", "reproducible ≈ no**", "Opaque by reporting"],
  ["TANF", "HHS-ACF", "No", "Opaque by reporting", "→ §13", "A-027"],
  ["ACTC/CTC via ITIN", "IRS/Treasury", "No", "Opaque by reporting", "→ §13", "A-029"],
  ["Eligible-noncitizen housing", "HUD", "No (proration; $218M mostly citizen members)", "Opaque by reporting/methodological", "→ §13", "A-030"],
  ["Federal student aid by status", "ED", "No", "Opaque by reporting", "→ §13", "A-033"],
  ["Undocumented isolation (emergency Medicaid)", "CMS", "No (T-MSIS lacks indicator)", "Opaque by technical limit", "→ §13", "A-024"],
  ["WIC; School Lunch/Breakfast", "USDA-FNS", "No (no status condition)", "Uncollectable by design", "→ §13", "A-026"],
  ["Federal K-12 share", "ED", "No (Plyler — status not collected)", "Uncollectable by law", "→ §13", "A-032"],
  ["Head Start; CCDF/SSBG/CSBG/LIHEAP", "HHS", "No (status-neutral)", "Uncollectable by design", "→ §13", "A-034"],
  ["FQHCs; public health; FEMA", "HRSA/CDC/FEMA", "No (universal/emergency)", "Uncollectable by design", "→ §13", "A-035"]
];

test("canonical Appendix B data preserves every category and row in order", () => {
  assert.deepEqual(
    publication.appendixB.categories.map((category) => category.label),
    expectedCategories
  );
  assert.deepEqual(
    publication.appendixB.rows.map((row) => [
      row.program,
      row.agency,
      row.published,
      row.category,
      row.treatment,
      row.oq
    ]),
    expectedRows
  );
});

test("canonical Appendix B reader renders rows, categories, and locked language", () => {
  let lastIndex = -1;
  for (const row of publication.appendixB.rows) {
    const index = html.indexOf(`data-scorecard-row="${row.key}"`);
    assert.ok(index > lastIndex, `${row.key} is rendered in canonical order`);
    lastIndex = index;
  }
  for (const category of expectedCategories) {
    assert.ok(html.includes(category), `${category} is rendered`);
  }
  assert.ok(html.includes("No new metric created; no missing value inferred."));
  assert.ok(html.includes("No row asserts a hidden dollar amount"));
  assert.ok(html.includes("APPENDIX B — v1.0 LOCKED."));
});

test("former simplified scorecard and invented score labels are absent", () => {
  for (const formerText of [
    "Military aid and replacement costs",
    "High for published aggregate obligations/disbursements",
    "Low to moderate",
    "Low for non-citizen dollar breakout",
    "High on published point-in-time basis",
    "Aggregate Total A yes; Total B no"
  ]) {
    assert.ok(!html.includes(formerText), `${formerText} is absent`);
  }
  assert.doesNotMatch(html, /<td>Moderate<\/td>/);
});

test("Appendix B includes canonical notice, PDF link, stable anchor, and route", () => {
  assert.equal(appendixPage.url, "/audit/appendix-b-transparency-scorecard.html");
  assert.ok(
    html.includes(
      "The Citizen Audit v1.0 PDF remains the canonical publication. This page is a structured reader conversion of Appendix B provided for navigation and inspection."
    )
  );
  assert.ok(html.includes('href="/downloads/the-citizen-audit-v1.0.pdf"'));
  assert.ok(html.includes('id="transparency-scorecard"'));
});

test("Appendix B table is semantic, accessible, and mobile-scrollable without omitted cells", () => {
  assert.ok(html.includes("<caption>Appendix B transparency scorecard</caption>"));
  assert.ok(html.includes("<thead><tr>"));
  assert.ok(html.includes("<tbody>"));
  assert.equal((html.match(/scope="col"/g) || []).length, 6);
  assert.equal((html.match(/scope="row"/g) || []).length, 10);
  assert.ok(html.includes('role="region" aria-labelledby="appendix-b-scorecard-heading" tabindex="0"'));
  assert.ok(html.includes('style="max-width:100%;overflow-x:auto"'));
  assert.ok(html.includes('style="display:table;min-width:880px;overflow:visible"'));

  for (const row of publication.appendixB.rows) {
    for (const column of publication.appendixB.columns) {
      assert.notEqual(row[column.key], undefined, `${row.key}.${column.key} remains in mobile HTML`);
    }
  }
});

test("generated Appendix B artifact matches the renderer and every internal link resolves", () => {
  const publicRoot = path.resolve(__dirname, "..", "public");
  const generatedPath = path.join(publicRoot, "audit", "appendix-b-transparency-scorecard.html");
  const generatedHtml = fs.readFileSync(generatedPath, "utf8");

  assert.equal(generatedHtml, html);

  const hrefs = [...generatedHtml.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") && !href.startsWith("//"));

  for (const href of new Set(hrefs)) {
    const pathname = href.split(/[?#]/, 1)[0];
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    assert.ok(fs.existsSync(path.join(publicRoot, relativePath)), `${href} resolves inside public/`);
  }
});
