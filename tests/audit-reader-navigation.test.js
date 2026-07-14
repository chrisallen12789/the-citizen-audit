const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publication = require("../scripts/publication-data");
const rawSectionContent = require("../data-model/section-content");
const rawSources = require("../data-model/sources");
const { createPageRenderer } = require("../scripts/renderers/page-model");
const { createRelationships } = require("../scripts/renderers/relationships");
const { createSectionRenderer } = require("../scripts/renderers/sections");
const { escapeHtml, renderContentBlock } = require("../scripts/renderers/shared");

const root = path.resolve(__dirname, "..");
const publicRoot = path.join(root, "public");
const numberedSections = publication.sections.filter((section) => /^Section \d+$/.test(section.id));
const auditPage = publication.pages.find((page) => page.id === "PAGE-AUDIT");
const appendixPages = ["PAGE-APPENDIX-A", "PAGE-APPENDIX-B"].map((id) =>
  publication.pages.find((page) => page.id === id)
);
const { renderPublicationPage } = createPageRenderer(publication);
const { renderSectionPage } = createSectionRenderer(publication, createRelationships(publication));
const sectionOutputs = numberedSections.map((section) => ({
  stableId: section.id,
  route: section.url,
  html: renderSectionPage(section),
  section
}));
const appendixOutputs = appendixPages.map((page, index) => ({
  stableId: `Appendix ${index === 0 ? "A" : "B"}`,
  route: page.url,
  html: renderPublicationPage(page),
  page
}));
const readerOutputs = [...sectionOutputs, ...appendixOutputs];
const auditIndexHtml = renderPublicationPage(auditPage);
const canonicalNotice =
  "The Citizen Audit v1.0 PDF remains the canonical publication. These web pages are a structured reader conversion provided for navigation and inspection.";

function publicPathForRoute(route) {
  const pathname = route.split(/[?#]/, 1)[0];
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  return path.join(publicRoot, relative.endsWith("/") ? `${relative}index.html` : relative);
}

function count(html, pattern) {
  return (html.match(pattern) || []).length;
}

test("shared audit contents model has exactly 18 canonical ordered entries", () => {
  assert.equal(publication.auditContents.length, 18);
  assert.deepEqual(
    publication.auditContents.map((entry) => entry.stableId),
    [...Array.from({ length: 16 }, (_, index) => `Section ${index + 1}`), "Appendix A", "Appendix B"]
  );
  assert.deepEqual(
    publication.auditContents.map((entry) => entry.order),
    Array.from({ length: 18 }, (_, index) => index + 1)
  );
  for (const entry of publication.auditContents) {
    assert.ok(entry.route.startsWith("/audit/"));
    assert.ok(entry.label);
    assert.ok(entry.title);
    assert.ok(entry.stableId);
  }
});

test("every shared audit contents route resolves to an existing generated file", () => {
  for (const entry of publication.auditContents) {
    assert.ok(fs.existsSync(publicPathForRoute(entry.route)), `${entry.route} exists`);
  }
});

test("all section and appendix pages render one complete current-aware contents control", () => {
  for (const output of readerOutputs) {
    assert.equal(count(output.html, /<details class="audit-contents"/g), 1, output.stableId);
    assert.equal(count(output.html, /<nav aria-label="Audit contents">/g), 1, output.stableId);
    assert.equal(count(output.html, /data-audit-contents-entry=/g), 18, output.stableId);
    assert.equal(count(output.html, /aria-current="page"/g), 1, output.stableId);
    assert.ok(
      output.html.includes(
        `data-audit-contents-entry="${output.stableId}">\n            <a href="${output.route}" aria-current="page"`
      ),
      `${output.stableId} marks its own route current`
    );
  }
});

test("mobile contents markup uses a native details and current-page summary", () => {
  for (const output of readerOutputs) {
    assert.ok(output.html.includes('<details class="audit-contents" data-audit-contents-count="18" open>'));
    assert.ok(output.html.includes(`<summary>Audit contents &mdash; ${output.stableId}</summary>`));
    assert.ok(output.html.includes('<nav aria-label="Audit contents">'));
  }
});

test("numbered sections retain Previous, Next, and Audit Index actions as applicable", () => {
  for (const [index, output] of sectionOutputs.entries()) {
    assert.ok(output.html.includes('<a class="button" href="/audit.html">Audit Index</a>'));
    assert.equal(output.html.includes(">Previous</a>"), index > 0, output.stableId);
    assert.equal(output.html.includes(">Next</a>"), index < sectionOutputs.length - 1, output.stableId);
  }
});

test("audit index and all 18 reader pages use the approved visible canonicality treatment", () => {
  assert.equal(count(auditIndexHtml, new RegExp(canonicalNotice, "g")), 1);
  assert.equal(count(auditIndexHtml, /href="\/downloads\/the-citizen-audit-v1\.0\.pdf"/g), 1);
  assert.doesNotMatch(auditIndexHtml, /<details class="audit-contents"/);

  for (const output of readerOutputs) {
    assert.equal(count(output.html, new RegExp(canonicalNotice, "g")), 1, output.stableId);
    assert.equal(
      count(output.html, /href="\/downloads\/the-citizen-audit-v1\.0\.pdf"/g),
      1,
      output.stableId
    );
  }
});

test("section descriptions use the approved wording and SEO canonical links remain exact", () => {
  for (const output of sectionOutputs) {
    const description = `Structured web reader conversion of ${output.section.id} from The Citizen Audit v1.0; the PDF remains canonical.`;
    assert.ok(output.html.includes(`<meta name="description" content="${description}">`));
    assert.doesNotMatch(output.html, /Canonical Section \d+ web conversion/);
    assert.ok(
      output.html.includes(
        `<link rel="canonical" href="https://thecitizenaudit.org${output.section.url}">`
      )
    );
  }

  for (const output of appendixOutputs) {
    assert.ok(
      output.html.includes(`<link rel="canonical" href="https://thecitizenaudit.org${output.route}">`)
    );
  }
});

test("accepted Appendix B categories, rows, anchor, and semantic table remain unchanged", () => {
  const appendixBHtml = appendixOutputs.find((output) => output.stableId === "Appendix B").html;
  assert.equal(publication.appendixB.categories.length, 5);
  assert.equal(publication.appendixB.rows.length, 10);
  assert.equal(count(appendixBHtml, /data-scorecard-row=/g), 10);
  assert.equal(count(appendixBHtml, /scope="col"/g), 6);
  assert.equal(count(appendixBHtml, /scope="row"/g), 10);
  assert.ok(appendixBHtml.includes('id="transparency-scorecard"'));
  assert.ok(appendixBHtml.includes('role="region" aria-labelledby="appendix-b-scorecard-heading"'));
});

test("reader layout preserves every section content block and raw source-record field", () => {
  for (const output of sectionOutputs) {
    assert.deepEqual(output.section.contentBlocks, rawSectionContent[output.section.id] || []);
    for (const block of output.section.contentBlocks) {
      if (block.type === "heading") {
        assert.ok(output.html.includes(`<h2>${escapeHtml(block.text)}</h2>`), output.stableId);
      } else {
        assert.ok(output.html.includes(renderContentBlock(block)), `${output.stableId} retains ${block.type}`);
      }
    }
  }

  const derivedSourceFields = new Set([
    "archiveStatus",
    "canonicalUrl",
    "claimIds",
    "classification",
    "decisionIds",
    "notes",
    "officialUrl",
    "openQuestionIds",
    "primaryOrSecondary",
    "sectionIds",
    "urlVerificationNote",
    "urlVerificationStatus",
    "verificationStatus"
  ]);
  for (const rawSource of rawSources) {
    const enriched = publication.sources.find((source) => source.id === rawSource.id);
    for (const [key, value] of Object.entries(rawSource)) {
      if (derivedSourceFields.has(key)) continue;
      assert.deepEqual(enriched[key], value, `${rawSource.id}.${key}`);
    }
  }
});

test("reader pages retain all internal links and generated HTML matches the committed renderer", () => {
  const outputs = [
    { route: auditPage.url, html: auditIndexHtml },
    ...readerOutputs.map(({ route, html }) => ({ route, html }))
  ];

  for (const output of outputs) {
    assert.equal(fs.readFileSync(publicPathForRoute(output.route), "utf8"), output.html, output.route);
    const hrefs = [...output.html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((href) => href.startsWith("/") && !href.startsWith("//"));
    for (const href of new Set(hrefs)) {
      assert.ok(fs.existsSync(publicPathForRoute(href)), `${output.route}: ${href} resolves`);
    }
  }
});

test("reader CSS defines the desktop sticky layout and bounded 360px mobile behavior", () => {
  const css = fs.readFileSync(path.join(publicRoot, "audit-reader.css"), "utf8");
  assert.match(css, /grid-template-columns:\s*minmax\(220px, 260px\) minmax\(0, 1fr\)/);
  assert.match(css, /\.audit-reader-content\s*{[^}]*min-width:\s*0/s);
  assert.match(css, /\.audit-contents\s*{[^}]*position:\s*sticky[^}]*top:\s*128px/s);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /\.audit-contents\s*{[^}]*position:\s*static[^}]*max-width:\s*100%/s);
  assert.match(css, /\.audit-contents > summary\s*{[^}]*display:\s*list-item/s);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /summary:focus-visible/);
});
