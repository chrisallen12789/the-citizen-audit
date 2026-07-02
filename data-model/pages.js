const sections = require("./sections");
const claims = require("./claims");
const sources = require("./sources");
const decisions = require("./decisions");
const openQuestions = require("./open-questions");

const allSectionIds = sections
  .filter((section) => section.id !== "Repository assets")
  .map((section) => section.id);
const numberedSectionIds = sections
  .filter((section) => /^Section \d+$/.test(section.id))
  .map((section) => section.id);
const appendixSectionIds = sections
  .filter((section) => /^Appendix /.test(section.id))
  .map((section) => section.id);
const allClaimIds = claims.map((claim) => claim.id);
const allSourceIds = sources.map((source) => source.id);
const allDecisionIds = decisions.map((decision) => decision.id);
const allOpenQuestionIds = openQuestions.map((question) => question.id);

const sectionTocEntries = sections
  .filter((section) => /^Section \d+$/.test(section.id) || /^Appendix /.test(section.id))
  .map((section) => ({
    href: section.url,
    label: /^Section \d+$/.test(section.id) ? section.id : section.id.replace("Appendix ", "Appendix "),
    detail: section.title
  }));

module.exports = [
  {
    id: "PAGE-AUDIT",
    title: "Audit Reader",
    heading: "Read the Audit",
    slug: "audit",
    description: "Audit reader for The Citizen Audit with appendices and verification links.",
    eyebrow: "Audit Reader",
    lede:
      "This release candidate publishes the locked Version 1.0 audit as a structured web reader while preserving the canonical PDF, numbered sections, source records, appendices, and traceability pathways used for independent review.",
    footerLabel: "Audit reader",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: [...numberedSectionIds, ...appendixSectionIds],
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Search the publication", href: "/search.html", variant: "primary" },
          { label: "Browse source records", href: "/sources.html" },
          { label: "Review open questions", href: "/open-questions.html" },
          { label: "Read the decision log", href: "/decision-log.html" }
        ]
      },
      {
        type: "toc",
        heading: "Sections",
        entries: sectionTocEntries
      }
    ]
  },
  {
    id: "PAGE-METHODOLOGY",
    title: "Methodology | The Citizen Audit",
    heading: "Methodology",
    slug: "methodology",
    description: "Methodology rules, evidence classes, and basis-discipline for The Citizen Audit.",
    eyebrow: "Rules Before Results",
    lede:
      "The site preserves the audit's core discipline: measure only what the public record supports, label every number by type and basis, and document gaps rather than manufacturing certainty.",
    footerLabel: "Methodology foundation",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: ["Section 2"],
    relatedClaimIds: claims.filter((claim) => claim.sectionId === "Section 2").map((claim) => claim.id),
    relatedSourceIds: ["S-002", "S-003", "S-004", "S-005", "S-006"],
    relatedDecisionIds: ["D-001", "D-005", "D-012", "D-020"],
    relatedOpenQuestionIds: [],
    contentBlocks: [
      {
        type: "panel",
        heading: "Binding Rules",
        table: {
          headers: ["Rule", "Application"],
          rows: [
            ["Gross, not net", "Figures measure money directed toward non-citizens or non-U.S. recipients, not net fiscal impact."],
            [
              "Total A / Total B",
              "Total A is gross federal resources. Total B is value ultimately reaching non-U.S. recipients after documented U.S.-capture share."
            ],
            [
              "Never mix number types",
              "Appropriation, budget authority, obligation, outlay, payment, and caseload remain distinct."
            ],
            [
              "No population-share modeling",
              "If an agency does not publish status breakouts, the gap is documented instead of estimated."
            ],
            [
              "Citizen-child exclusion",
              "Benefits paid for U.S.-citizen children in mixed-status households are excluded as citizen benefits."
            ]
          ]
        }
      },
      {
        type: "panel",
        heading: "Evidence Classes",
        texts: [
          "Evidence hierarchy: federal accounting records and statutes first; non-partisan analyses next; then peer-reviewed sources; then policy organizations; advocacy sources last."
        ]
      }
    ]
  },
  {
    id: "PAGE-SOURCES",
    title: "Sources | The Citizen Audit",
    heading: "Sources",
    slug: "sources",
    description: "Structured and searchable source records for The Citizen Audit.",
    eyebrow: "Evidence Library",
    lede:
      "Every published figure should point to a source, a section, a basis, and any unresolved limitation.",
    footerLabel: "Evidence library",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Search the publication", href: "/search.html", variant: "primary" },
          { label: "Open questions register", href: "/audit/appendix-a-open-questions.html" },
          { label: "Decision log", href: "/decision-log.html" }
        ]
      },
      {
        type: "searchFilter",
        ariaLabel: "Search sources",
        target: "[data-filterable]",
        placeholder: "Search source IDs, agencies, sections, or claim summaries"
      },
      {
        type: "panel",
        heading: "Structured source records",
        texts: [
          "This release publishes source metadata, citation-verification status, and claim-level trace links for the records already cited in the converted sections. If an official canonical URL could not be verified, the page says so explicitly instead of guessing."
        ]
      },
      {
        type: "sourceIndex"
      }
    ]
  },
  {
    id: "PAGE-OPEN-QUESTIONS",
    title: "Open Questions | The Citizen Audit",
    heading: "Open Questions",
    slug: "open-questions",
    description: "Open question register and unresolved publication gaps for The Citizen Audit.",
    eyebrow: "Open Question Register",
    lede:
      "Unresolved items stay visible so the site never pretends a measurement is complete when the public record is not.",
    footerLabel: "Open-question register",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: [...appendixSectionIds, ...numberedSectionIds],
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Read Appendix A", href: "/audit/appendix-a-open-questions.html", variant: "primary" },
          { label: "Check supporting sources", href: "/sources.html" },
          { label: "Review decision log", href: "/decision-log.html" }
        ]
      },
      {
        type: "searchFilter",
        ariaLabel: "Search open questions",
        target: "[data-filterable]",
        placeholder: "Search A-IDs, sections, sources, agencies, or unresolved limits"
      },
      {
        type: "openQuestionIndex"
      }
    ]
  },
  {
    id: "PAGE-DECISION-LOG",
    title: "Decision Log | The Citizen Audit",
    heading: "Decision Log",
    slug: "decision-log",
    description: "Current methodology decision log for The Citizen Audit.",
    eyebrow: "Decision Log",
    lede:
      "Methodology decisions belong in public, and the numbered rules visible in Version 1.0 now have their own web records.",
    footerLabel: "Decision-log status",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Source library", href: "/sources.html", variant: "primary" },
          { label: "Open questions", href: "/open-questions.html" },
          { label: "Reviewer portal", href: "/review.html" }
        ]
      },
      {
        type: "searchFilter",
        ariaLabel: "Search decision log",
        target: "[data-filterable]",
        placeholder: "Search D-IDs, section references, rules, or methodology terms"
      },
      {
        type: "decisionIndex"
      }
    ]
  },
  {
    id: "PAGE-REVIEW",
    title: "Reviewer Portal | The Citizen Audit",
    heading: "Review And Verify The Audit",
    slug: "review",
    description: "Reviewer portal for verifying methodology, evidence, confidence, corrections, and version history in The Citizen Audit.",
    eyebrow: "Reviewer Portal",
    lede:
      "This portal explains how to test the publication, how evidence is classified, how confidence is communicated, and how corrections are carried without weakening transparency.",
    footerLabel: "Reviewer portal",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Open Explorer", href: "/explorer.html", variant: "primary" },
          { label: "Browse sources", href: "/sources.html" },
          { label: "Corrections page", href: "/corrections.html" }
        ]
      },
      {
        type: "panel",
        heading: "How to verify the audit",
        stack: true,
        texts: [
          "Start from a section page, open its verification panel, then follow each claim into its source, decision, and open-question records. The platform is designed so readers can move from published prose to supporting evidence without changing the Version 1.0 conclusions.",
          "Where the public record is incomplete, the platform keeps that incompleteness visible instead of filling it with modeled certainty."
        ]
      },
      {
        type: "cardGrid",
        cards: [
          {
            eyebrow: "Methodology",
            title: "What the platform preserves",
            body: "Number type, resource category, beneficiary chain, section ownership, and unresolved limitations stay separate across the generated site."
          },
          {
            eyebrow: "Evidence Standards",
            title: "Primary before secondary",
            body: "Source records now label document type, primary or secondary classification, evidence class, confidence, and citation-verification status."
          },
          {
            eyebrow: "Confidence Model",
            title: "Confidence is published, not implied",
            body: "The platform preserves section confidence notes and source confidence labels so readers can distinguish direct evidence from corroboration and context."
          }
        ]
      },
      {
        type: "panel",
        heading: "How to submit corrections",
        stack: true,
        texts: [
          "Use the published corrections workflow to report source mismatches, broken trace links, missing metadata, or verified public records that should resolve an open question. Corrections should cite the exact page, claim, and source record involved.",
          "Corrections are tracked in public release notes, version history, and changelog pages so the platform never hides what changed around the locked publication."
        ]
      },
      {
        type: "panel",
        heading: "How corrections are tracked",
        stack: true,
        texts: [
          "Every release should record platform-level changes without silently rewriting Version 1.0 analytical conclusions. Decision history is preserved, open questions remain public, and unresolved URL verification is flagged explicitly.",
          "Version history describes delivery milestones, changelog captures platform changes, and release notes summarize what shipped in each iteration."
        ]
      }
    ]
  },
  {
    id: "PAGE-DOWNLOADS",
    title: "Downloads | The Citizen Audit",
    heading: "Downloads",
    slug: "downloads",
    description: "Downloads and release artifacts for The Citizen Audit.",
    eyebrow: "Publication Assets",
    lede:
      "Download center for the locked audit, publication package, source library, methodology materials, and release artifacts.",
    footerLabel: "Downloads center",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: appendixSectionIds,
    relatedClaimIds: [],
    relatedSourceIds: [],
    relatedDecisionIds: [],
    relatedOpenQuestionIds: [],
    contentBlocks: [
      {
        type: "cardGrid",
        cards: [
          {
            title: "Audit PDF",
            body: "Canonical Version 1.0 publication. Repository asset still needs to be added."
          },
          {
            href: "/sources.html",
            title: "Source Library",
            body: "Browse the current structured Source ID pages published from converted sections."
          },
          {
            href: "/decision-log.html",
            title: "Decision Log",
            body: "Review the methodology decisions already surfaced in the current web edition."
          },
          {
            href: "/open-questions.html",
            title: "Open Questions",
            body: "Inspect unresolved records, limitations, and what evidence would resolve them."
          }
        ]
      },
      {
        type: "panel",
        heading: "Release artifacts",
        paragraphs: [
          "<p><a class=\"tag\" href=\"/release-notes.html\">Release notes</a><a class=\"tag\" href=\"/version-history.html\">Version history</a><a class=\"tag\" href=\"/changelog.html\">Changelog</a></p>",
          "<p>Version 1.0 is analytically frozen. Future evidence creates v1.1+ and does not silently rewrite locked conclusions.</p>"
        ]
      }
    ]
  },
  {
    id: "PAGE-CORRECTIONS",
    title: "Corrections | The Citizen Audit",
    heading: "Corrections",
    slug: "corrections",
    description: "Public correction policy and visible correction tracking for The Citizen Audit.",
    eyebrow: "Public Correction System",
    lede:
      "The credibility of the project depends on making corrections visible, not pretending errors will never happen.",
    footerLabel: "Corrections foundation",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "panel",
        heading: "Correction Standard",
        texts: [
          "A correction request should identify the claim, section, table if applicable, Source ID, alleged error, replacement evidence, and proposed correction. If the challenge is correct, the correction should be logged publicly."
        ]
      },
      {
        type: "panel",
        heading: "Version Rule",
        texts: [
          "Version 1.0 is analytically frozen. Corrections or new evidence create a later version rather than silently rewriting the locked edition."
        ]
      },
      {
        type: "panel",
        heading: "Current Public Corrections",
        texts: ["No public corrections logged in this web release."]
      }
    ]
  },
  {
    id: "PAGE-RELEASE-NOTES",
    title: "Release Notes | The Citizen Audit",
    heading: "Release Notes",
    slug: "release-notes",
    description: "Release notes for The Citizen Audit platform.",
    eyebrow: "Release Notes",
    lede:
      "Each release slice should explain what shipped, what remains, and what changed in the publication platform.",
    footerLabel: "release notes - platform history",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: [],
    relatedClaimIds: [],
    relatedSourceIds: [],
    relatedDecisionIds: [],
    relatedOpenQuestionIds: [],
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Release notes", href: "/release-notes.html" },
          { label: "Version history", href: "/version-history.html" },
          { label: "Changelog", href: "/changelog.html" }
        ]
      },
      {
        type: "releaseCards"
      }
    ]
  },
  {
    id: "PAGE-VERSION-HISTORY",
    title: "Version History | The Citizen Audit",
    heading: "Version History",
    slug: "version-history",
    description: "Version history for The Citizen Audit platform.",
    eyebrow: "Version History",
    lede:
      "The publication is analytically frozen by edition, but the platform around it should show its delivery history clearly.",
    footerLabel: "version history - platform history",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: [],
    relatedClaimIds: [],
    relatedSourceIds: [],
    relatedDecisionIds: [],
    relatedOpenQuestionIds: [],
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Release notes", href: "/release-notes.html" },
          { label: "Version history", href: "/version-history.html" },
          { label: "Changelog", href: "/changelog.html" }
        ]
      },
      {
        type: "releaseCards"
      }
    ]
  },
  {
    id: "PAGE-CHANGELOG",
    title: "Changelog | The Citizen Audit",
    heading: "Changelog",
    slug: "changelog",
    description: "Changelog for The Citizen Audit platform.",
    eyebrow: "Changelog",
    lede:
      "Platform changes are logged publicly so readers can track what improved around the locked publication.",
    footerLabel: "changelog - platform history",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: [],
    relatedClaimIds: [],
    relatedSourceIds: [],
    relatedDecisionIds: [],
    relatedOpenQuestionIds: [],
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Release notes", href: "/release-notes.html" },
          { label: "Version history", href: "/version-history.html" },
          { label: "Changelog", href: "/changelog.html" }
        ]
      },
      {
        type: "releaseCards"
      }
    ]
  },
  {
    id: "PAGE-SEARCH",
    title: "Search | The Citizen Audit",
    heading: "Search the publication",
    slug: "search",
    description: "Full-text publication search for The Citizen Audit.",
    eyebrow: "Search",
    lede:
      "The current static release uses a client-side search index generated from the repository's structured research records.",
    footerLabel: "Search - publication index",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "searchInterface"
      }
    ]
  },
  {
    id: "PAGE-EXPLORER",
    title: "Traceability Explorer | The Citizen Audit",
    heading: "Traceability Explorer",
    slug: "explorer",
    description: "Claim-to-source traceability explorer for The Citizen Audit.",
    eyebrow: "Traceability Explorer",
    lede:
      "Follow each converted lane back to its linked Source IDs, Decision Log rules, and Open Question records. This page is a verification surface, not a replacement for the locked audit text.",
    footerLabel: "Traceability explorer",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "explorerInterface"
      }
    ]
  },
  {
    id: "PAGE-APPENDIX-A",
    title: "Appendix A | The Citizen Audit",
    heading: "Appendix A - Open Questions Register",
    slug: "appendix-a-open-questions",
    url: "/audit/appendix-a-open-questions.html",
    description: "Appendix A open-question register for The Citizen Audit.",
    eyebrow: "Appendix A - Version 1.0 register",
    lede:
      "The publication names what it cannot yet measure, why that gap exists, and what record would resolve it.",
    footerLabel: "Appendix A - open-question register",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Open question pages", href: "/open-questions.html", variant: "primary" },
          { label: "Audit index", href: "/audit.html" }
        ]
      },
      {
        type: "appendixOpenQuestions"
      }
    ]
  },
  {
    id: "PAGE-APPENDIX-B",
    title: "Appendix B | The Citizen Audit",
    heading: "Appendix B - Transparency Scorecard",
    slug: "appendix-b-transparency-scorecard",
    url: "/audit/appendix-b-transparency-scorecard.html",
    description: "Appendix B transparency scorecard for The Citizen Audit.",
    eyebrow: "Appendix B - Version 1.0 scorecard",
    lede:
      "Readers should be able to see which lanes are well-published, which are only partly measurable, and where federal reporting stops.",
    footerLabel: "Appendix B - transparency scorecard",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: numberedSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Evidence library", href: "/sources.html", variant: "primary" },
          { label: "Audit index", href: "/audit.html" }
        ]
      },
      {
        type: "appendixTransparencyScorecard"
      }
    ]
  },
  {
    id: "PAGE-STATUS",
    title: "Status | The Citizen Audit",
    heading: "Build Status",
    slug: "status",
    description: "Build status, generated output status, and locked-edition invariants for The Citizen Audit.",
    eyebrow: "Publication Status",
    lede:
      "This page reports build health, generated output coverage, and the invariants the platform keeps around the locked Version 1.0 edition.",
    footerLabel: "Publication status",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Platform dashboard", href: "/platform.html", variant: "primary" },
          { label: "Reviewer portal", href: "/review.html" },
          { label: "Raw manifest", href: "/data/publication-manifest.json" }
        ]
      },
      {
        type: "statusSummary"
      },
      {
        type: "panel",
        heading: "Locked-edition invariants",
        stack: true,
        texts: [
          "Version 1.0 conclusions stay locked unless a later version is issued. The platform can add traceability, metadata, and reviewer tooling without silently changing analytical conclusions.",
          "Decision history remains public, open questions remain visible, and URL-verification gaps stay labeled as pending rather than guessed into existence."
        ]
      }
    ]
  },
  {
    id: "PAGE-PLATFORM",
    title: "Platform Dashboard | The Citizen Audit",
    heading: "Platform Dashboard",
    slug: "platform",
    description: "Platform dashboard for publication status, traceability, QA, and build health in The Citizen Audit.",
    eyebrow: "Platform Dashboard",
    lede:
      "The platform now treats structured data as the source of truth and generates the evidence surfaces around it.",
    footerLabel: "Platform dashboard",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Claim database", href: "/claims.html", variant: "primary" },
          { label: "Explorer", href: "/explorer.html" },
          { label: "Reviewer portal", href: "/review.html" }
        ]
      },
      {
        type: "platformMetrics"
      },
      {
        type: "panel",
        heading: "Dashboard notes",
        stack: true,
        texts: [
          "This dashboard is generated from the same structured records that drive claim pages, source pages, search, explorer data, graph outputs, and QA.",
          "Adding a future audit should mean adding new audit, section, claim, source, decision, and open-question records, then running the build again without infrastructure changes."
        ]
      }
    ]
  },
  {
    id: "PAGE-CLAIMS",
    title: "Claims | The Citizen Audit",
    heading: "Claims",
    slug: "claims",
    description: "Structured claim database for The Citizen Audit.",
    eyebrow: "Claim Database",
    lede:
      "Reviewers should be able to move from audit to section to claim in three clicks or fewer, then branch outward into the supporting evidence graph.",
    footerLabel: "Claim database",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: numberedSectionIds,
    relatedClaimIds: allClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Audit index", href: "/audit.html", variant: "primary" },
          { label: "Explorer", href: "/explorer.html" },
          { label: "Platform dashboard", href: "/platform.html" }
        ]
      },
      {
        type: "searchFilter",
        ariaLabel: "Search claims",
        target: "[data-filterable]",
        placeholder: "Search claim IDs, sections, sources, decision rules, or open questions"
      },
      {
        type: "claimIndex"
      }
    ]
  }
];
