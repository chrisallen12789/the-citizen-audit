const fs = require("fs");
const path = require("path");
const publication = require("./publication-data");
const sectionTraceClaims = require("./section-trace-claims");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

const sectionTitles = [
  ["Section 1", "Executive Summary", "/audit/section-01-executive-summary.html"],
  ["Section 2", "Definitions and Methodology", "/audit/section-02-definitions-methodology.html"],
  ["Section 3", "International Assistance", "/audit/section-03-international-assistance.html"],
  ["Section 4", "Ukraine and Israel Examples", "/audit/section-04-ukraine-israel-examples.html"],
  ["Section 5", "Military Aid", "/audit/section-05-military-aid.html"],
  ["Section 6", "Refugee Resettlement", "/audit/section-06-refugee-resettlement.html"],
  ["Section 7", "Emergency Medical", "/audit/section-07-medicaid-emergency-medical.html"],
  ["Section 8", "Food Assistance", "/audit/section-08-food-assistance.html"],
  ["Section 9", "Cash Welfare / Income", "/audit/section-09-cash-welfare-income.html"],
  ["Section 10", "Federal Housing", "/audit/section-10-federal-housing.html"],
  ["Section 11", "Education / Public Services", "/audit/section-11-education-public-services.html"],
  ["Section 12", "State-Administered Federal Dollars", "/audit/section-12-state-administered-federal-dollars.html"],
  ["Section 13", "Programs Without Citizenship Breakouts", "/audit/section-13-programs-without-citizenship-breakouts.html"],
  ["Section 14", "Conservative Total", "/audit/section-14-conservative-total.html"],
  ["Section 15", "What Is Missing", "/audit/section-15-what-is-missing.html"],
  ["Section 16", "Final Argument", "/audit/section-16-final-argument.html"]
];

function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function recordsFor(sectionId, collection, field = "sections") {
  return collection.filter((item) => Array.isArray(item[field]) && item[field].includes(sectionId));
}

function confidenceFor(sourceCount, openQuestionCount) {
  if (sourceCount === 0 && openQuestionCount > 0) return "Limited until the linked open questions are resolved.";
  if (sourceCount >= 3 && openQuestionCount === 0) return "High for the records currently linked in the structured data layer.";
  if (sourceCount >= 3) return "Moderate to high for sourced claims; limited where open questions remain.";
  if (sourceCount > 0) return "Moderate; the section has linked records but needs deeper claim-level expansion.";
  return "Pending deeper normalization; no source record is currently linked in publication-data.js.";
}

function evidenceFor(sourceCount, decisionCount, openQuestionCount) {
  const parts = [];
  if (sourceCount) parts.push(`${sourceCount} source record${sourceCount === 1 ? "" : "s"}`);
  if (decisionCount) parts.push(`${decisionCount} decision record${decisionCount === 1 ? "" : "s"}`);
  if (openQuestionCount) parts.push(`${openQuestionCount} open question${openQuestionCount === 1 ? "" : "s"}`);
  return parts.length
    ? `Generated from publication-data.js: ${parts.join(", ")}.`
    : "Generated from publication-data.js; linked evidence records have not yet been attached.";
}

function linkedIds(ids, basePath) {
  return ids.map((id) => `<a href='${basePath}${id.toLowerCase()}.html'>${id}</a>`).join(", ");
}

function generatedClaimRecordsForSection(sectionId, sources, decisions, openQuestions) {
  const decisionIds = uniq(decisions.map((decision) => decision.id));
  const openQuestionIds = uniq(openQuestions.map((question) => question.id));
  return sources.flatMap((source) =>
    (source.claims || []).map((claim, index) => ({
      title: `${source.id} supports ${sectionId}`,
      body: `<p>${claim}</p><p><strong>Source:</strong> <a href='/sources/${source.slug}.html'>${source.id} - ${source.title}</a></p>${
        decisionIds.length ? `<p><strong>Related decisions:</strong> ${linkedIds(decisionIds, "/decision-log/")}</p>` : ""
      }${
        openQuestionIds.length ? `<p><strong>Open questions:</strong> ${linkedIds(openQuestionIds, "/open-questions/")}</p>` : ""
      }`,
      sourceId: source.id,
      sourceTitle: source.title,
      claimIndex: index
    }))
  );
}

function curatedClaimRecordsForSection(sectionId) {
  return (sectionTraceClaims[sectionId] || []).map((claim, index) => ({
    ...claim,
    curated: true,
    claimIndex: index
  }));
}

function claimRecordsForSection(sectionId, sources, decisions, openQuestions) {
  const curated = curatedClaimRecordsForSection(sectionId);
  if (curated.length) return curated;
  return generatedClaimRecordsForSection(sectionId, sources, decisions, openQuestions);
}

function buildTraceabilityData() {
  const records = sectionTitles.map(([id, title, url]) => {
    const sources = recordsFor(id, publication.sources);
    const decisions = recordsFor(id, publication.decisions, "references");
    const openQuestions = recordsFor(id, publication.openQuestions);
    const sourceIds = uniq(sources.map((source) => source.id));
    const decisionIds = uniq(decisions.map((decision) => decision.id));
    const openQuestionIds = uniq(openQuestions.map((question) => question.id));
    const claimRecords = claimRecordsForSection(id, sources, decisions, openQuestions);
    return {
      id,
      title,
      url,
      summary: claimRecords[0]?.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || evidenceFor(sourceIds.length, decisionIds.length, openQuestionIds.length),
      sources: sourceIds,
      decisions: decisionIds,
      openQuestions: openQuestionIds,
      verification: {
        confidence: confidenceFor(sourceIds.length, openQuestionIds.length),
        evidence: evidenceFor(sourceIds.length, decisionIds.length, openQuestionIds.length)
      },
      claims: claimRecords.map((claim, index) => ({
        index,
        title: claim.title,
        body: claim.body,
        sourceId: claim.sourceId || null,
        sourceTitle: claim.sourceTitle || null,
        claimIndex: claim.claimIndex,
        curated: Boolean(claim.curated)
      }))
    };
  });

  return {
    generatedFrom: "scripts/publication-data.js + scripts/section-trace-claims.js",
    generatedAt: "deterministic-build",
    records
  };
}

function build() {
  const target = path.join(publicDir, "data", "section-traceability.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(buildTraceabilityData(), null, 2)}\n`, "utf8");
}

build();
