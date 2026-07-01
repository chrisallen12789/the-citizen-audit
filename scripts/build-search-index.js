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

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function recordsFor(sectionId, collection, field = "sections") {
  return collection.filter((item) => Array.isArray(item[field]) && item[field].includes(sectionId));
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

  for (const [id, title, url] of sectionTitles) {
    const sources = recordsFor(id, publication.sources);
    const decisions = recordsFor(id, publication.decisions, "references");
    const openQuestions = recordsFor(id, publication.openQuestions);
    const curatedClaims = sectionTraceClaims[id] || [];
    items.push({
      type: "Section",
      id,
      title,
      url,
      text: [
        title,
        sources.map((source) => `${source.id} ${source.title} ${source.summary} ${(source.claims || []).join(" ")}`).join(" "),
        decisions.map((decision) => `${decision.id} ${decision.title} ${decision.body}`).join(" "),
        openQuestions.map((question) => `${question.id} ${question.title} ${question.whyItMatters} ${question.recordNeeded}`).join(" "),
        curatedClaims.map((claim) => `${claim.title} ${stripHtml(claim.body)}`).join(" ")
      ].join(" ")
    });

    for (const [index, claim] of curatedClaims.entries()) {
      items.push({
        type: "Claim trace",
        id: `${id} Trace ${index + 1}`,
        title: claim.title,
        url,
        text: [id, title, claim.title, stripHtml(claim.body)].join(" ")
      });
    }
  }

  return items;
}

function build() {
  const target = path.join(publicDir, "data", "publication-search.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(buildSearchIndex(), null, 2)}\n`, "utf8");
}

build();
