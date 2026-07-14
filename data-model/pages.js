const sections = require("./sections");
const claims = require("./claims");
const sources = require("./sources");
const decisions = require("./decisions");
const openQuestions = require("./open-questions");
const appendixB = require("./appendix-b");

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
const overviewSectionIds = ["Section 1", "Section 2", "Section 14", "Section 15", "Section 16"];
const overviewClaimIds = ["C-001", "C-002", "C-016", "C-017", "C-018"];
const summaryClaimIds = ["C-001", "C-006", "C-009", "C-011", "C-015", "C-016", "C-017", "C-018"];
const summarySourceIds = ["S-038", "S-055", "S-058", "S-064", "S-073", "S-074"];
const summaryDecisionIds = ["D-001", "D-020", "D-021", "D-022", "D-023", "D-024", "D-025"];
const summaryOpenQuestionIds = ["A-005", "A-017", "A-018", "A-028", "A-037"];
const correctionMailto =
  "mailto:corrections@thecitizenaudit.org?subject=Citizen%20Audit%20Correction%20Challenge";
const reviewMailto =
  "mailto:review@thecitizenaudit.org?subject=Citizen%20Audit%20Formal%20Review";

const sectionTocEntries = sections
  .filter((section) => /^Section \d+$/.test(section.id) || /^Appendix /.test(section.id))
  .map((section) => ({
    href: section.url,
    label: /^Section \d+$/.test(section.id) ? section.id : section.id.replace("Appendix ", "Appendix "),
    detail: section.title
  }));

module.exports = [
  {
    id: "PAGE-START-HERE",
    title: "Start Here | The Citizen Audit",
    heading: "Start Here",
    slug: "start-here",
    description: "Orientation page for first-time readers of The Citizen Audit.",
    eyebrow: "Reader Orientation",
    lede:
      "The Citizen Audit is built as a civic research publication: readers should be able to understand what is being claimed, how those claims are bounded, and how to verify them without relying on institutional trust alone.",
    footerLabel: "Reader orientation",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: overviewSectionIds,
    relatedClaimIds: overviewClaimIds,
    relatedSourceIds: summarySourceIds,
    relatedDecisionIds: ["D-001", "D-020", "D-021", "D-024"],
    relatedOpenQuestionIds: ["A-005", "A-018", "A-028", "A-037"],
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Read the executive summary", href: "/executive-summary.html", variant: "primary" },
          { label: "How to verify this work", href: "/verify.html" },
          { label: "Open the full audit", href: "/audit.html" },
          { label: "Challenge the audit", href: "/challenge.html" }
        ]
      },
      {
        type: "panel",
        heading: "What The Citizen Audit is",
        stack: true,
        texts: [
          "The Citizen Audit is a structured public publication focused on identifiable federal spending lanes, the records used to support them, and the point where public evidence stops.",
          "It is not a commentary site, personality brand, or opinion feed. The project is organized around claims, sources, decisions, limitations, and revision history so readers can inspect the work directly."
        ]
      },
      {
        type: "panel",
        heading: "Why it exists",
        stack: true,
        texts: [
          "Public disputes over government spending often collapse into slogans, selective screenshots, or blended numbers that hide incompatible accounting bases.",
          "This project exists to separate what can be documented from what cannot yet be documented, publish the reasoning in public, and leave unresolved gaps visible instead of smoothing them over."
        ]
      },
      {
        type: "panel",
        heading: "How this differs from opinion content",
        contentBlocks: [
          {
            type: "list",
            items: [
              "Claims are linked to Source IDs, Decision Log rules, Open Question records, and section context.",
              "Unsupported estimates are excluded instead of inserted for rhetorical effect.",
              "Known limitations remain visible even when they weaken a cleaner narrative.",
              "Corrections are expected to identify a specific claim, page, section, and source trail."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "Reading path for first-time visitors",
        contentBlocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "Start here for orientation and publication scope.",
              "Read the executive summary for the bounded findings and major takeaways.",
              "Read the methodology before treating any topline as interchangeable with another basis.",
              "Inspect the source library and decision log.",
              "Read the full audit and appendices.",
              "Use the challenge page if you believe a claim should be corrected."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "PAGE-AUDIT",
    title: "Audit Reader",
    heading: "Read the Audit",
    slug: "audit",
    description: "Audit reader for The Citizen Audit with appendices and verification links.",
    eyebrow: "Audit Reader",
    lede:
      "This web edition publishes the locked Version 1.0 audit as a structured web reader while preserving the canonical PDF, numbered sections, source records, appendices, and traceability pathways used for independent review.",
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
    id: "PAGE-EXECUTIVE-SUMMARY",
    title: "Executive Summary | The Citizen Audit",
    heading: "Executive Summary",
    slug: "executive-summary",
    description: "Concise summary of the current published audit, its key findings, and what readers should review next.",
    eyebrow: "Current Published Audit",
    lede:
      "Version 1.0 is presented as a bounded, evidence-first publication. Its strongest claim is not that every spending lane is fully measured, but that measurable lanes, unresolved limits, and non-additive bases are disclosed clearly enough for independent review.",
    footerLabel: "Executive summary",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: overviewSectionIds,
    relatedClaimIds: summaryClaimIds,
    relatedSourceIds: summarySourceIds,
    relatedDecisionIds: summaryDecisionIds,
    relatedOpenQuestionIds: summaryOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Read the full audit", href: "/audit.html", variant: "primary" },
          { label: "Read methodology", href: "/methodology.html" },
          { label: "Browse source library", href: "/sources.html" },
          { label: "Review decision log", href: "/decision-log.html" }
        ]
      },
      {
        type: "cardGrid",
        cards: [
          {
            eyebrow: "Key finding",
            title: "The publication keeps measurable lanes on their native bases",
            body: "Appropriations, obligations, drawdowns, outlays, and domestic program examples are not blended into a synthetic grand total."
          },
          {
            eyebrow: "Key finding",
            title: "The conservative total is a reproducible set of subtotals",
            body: "The platform preserves lane discipline and makes the supporting blueprint visible instead of asking readers to trust a flattened topline."
          },
          {
            eyebrow: "Key finding",
            title: "Evidence gaps remain part of the publication",
            body: "Open questions and non-measurable programs stay visible so the site does not claim certainty where public records do not support it."
          },
          {
            eyebrow: "Key finding",
            title: "The final argument is bounded by the same rules as the rest of the audit",
            body: "The publication does not introduce a looser theory at the end than it uses in the numbered sections."
          }
        ]
      },
      {
        type: "panel",
        heading: "Major takeaways",
        contentBlocks: [
          {
            type: "list",
            items: [
              "This is a verification-oriented audit, not a persuasion-first narrative.",
              "Some lanes are publishable now; others remain governed by missing federal breakout data.",
              "Domestic examples such as ORR, emergency Medicaid, and SSI are treated differently because the public record supports them differently.",
              "The gap register is itself a substantive transparency finding."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "What to review next",
        stack: true,
        texts: [
          "If you are testing the work, read methodology before comparing numbers across sections. Then inspect the source records, decision rules, and open-question pages that sit behind the published claims.",
          "If you want the full wording of the locked edition, continue into the audit reader or download the canonical PDF from the downloads page."
        ]
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
        type: "actions",
        links: [
          { label: "How to verify this work", href: "/verify.html", variant: "primary" },
          { label: "Browse source library", href: "/sources.html" },
          { label: "Review decision log", href: "/decision-log.html" },
          { label: "Read the full audit", href: "/audit.html" }
        ]
      },
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
    id: "PAGE-VERIFY",
    title: "How to Verify This Work | The Citizen Audit",
    heading: "How To Verify This Work",
    slug: "verify",
    description: "Step-by-step verification guidance for readers reviewing The Citizen Audit.",
    eyebrow: "Verification Path",
    lede:
      "Readers should not trust the audit blindly. The publication is designed so claims can be checked against methodology rules, source records, archived artifacts where available, and documented decision history.",
    footerLabel: "Verification path",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: overviewSectionIds,
    relatedClaimIds: overviewClaimIds,
    relatedSourceIds: allSourceIds,
    relatedDecisionIds: allDecisionIds,
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Read methodology", href: "/methodology.html", variant: "primary" },
          { label: "Browse source library", href: "/sources.html" },
          { label: "Open decision log", href: "/decision-log.html" },
          { label: "Challenge the audit", href: "/challenge.html" }
        ]
      },
      {
        type: "panel",
        heading: "Verification checklist",
        contentBlocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "Read the methodology so basis discipline, exclusions, and evidence classes are clear before comparing numbers.",
              "Open the source pages attached to the claim or section you want to test.",
              "Review archive links or alternate official artifacts where available.",
              "Check the decision log entries that explain inclusion, exclusion, or reconciliation choices.",
              "Compare the published claim against the primary source record whenever the source library points to one.",
              "If you believe a claim fails the record, submit a challenge with evidence rather than a generalized objection."
            ]
          }
        ]
      },
      {
        type: "cardGrid",
        cards: [
          {
            eyebrow: "Method first",
            title: "Do not compare unlike figures",
            body: "A disagreement is not resolved until the figure type, accounting stage, and beneficiary basis match."
          },
          {
            eyebrow: "Source trail",
            title: "Start with primary records where possible",
            body: "The source library labels official and secondary artifacts so readers can prioritize the strongest available evidence."
          },
          {
            eyebrow: "Transparency rule",
            title: "Treat open questions as part of the result",
            body: "If a lane still depends on missing records, that limit belongs in the evaluation rather than outside it."
          }
        ]
      },
      {
        type: "panel",
        heading: "What a serious challenge should do",
        stack: true,
        texts: [
          "Identify the exact claim, page, or section involved. Then show the source trail you believe is incomplete, inconsistent, or contradicted by a stronger public record.",
          "Opinion-only objections are not enough. The platform is built for evidence-backed review, including disagreement that narrows or overturns a published claim."
        ]
      },
      {
        type: "panel",
        heading: "Submit a correction or challenge",
        paragraphs: [
          `<p>Email <a href="${correctionMailto}">corrections@thecitizenaudit.org</a> with the subject line <strong>Citizen Audit Correction Challenge</strong>.</p>`
        ],
        contentBlocks: [
          {
            type: "list",
            items: [
              "Claim or page being challenged",
              "Source or archive link",
              "Explanation of the proposed correction",
              "Whether the issue is factual, methodological, citation-related, or wording-related"
            ]
          }
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
    id: "PAGE-CHALLENGE",
    title: "Challenge The Audit | The Citizen Audit",
    heading: "Challenge The Audit",
    slug: "challenge",
    description: "Evidence-first correction and challenge guidance for The Citizen Audit.",
    eyebrow: "Challenge And Correction Standard",
    lede:
      "Readers are invited to challenge the publication, but challenges should identify the exact record at issue and provide evidence strong enough to test or correct the claim.",
    footerLabel: "Challenge standard",
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
          { label: "Browse claims", href: "/claims.html", variant: "primary" },
          { label: "Browse sources", href: "/sources.html" },
          { label: "How to verify this work", href: "/verify.html" },
          { label: "Read correction policy", href: "/corrections.html" }
        ]
      },
      {
        type: "cardGrid",
        cards: [
          {
            eyebrow: "Identify the target",
            title: "Name the specific claim, page, or section",
            body: "A usable challenge should point to the exact place in the publication that you believe is wrong or incomplete."
          },
          {
            eyebrow: "Bring the record",
            title: "Supply a source or archived source",
            body: "Link the primary record, official artifact, or archived copy you believe changes the published result."
          },
          {
            eyebrow: "Explain the change",
            title: "State the proposed correction clearly",
            body: "Explain what should change and why the evidence supports that change better than the current record set."
          }
        ]
      },
      {
        type: "panel",
        heading: "Minimum standard for a challenge",
        contentBlocks: [
          {
            type: "list",
            items: [
              "Identify the claim ID, section, page, or table you are challenging.",
              "Cite the source record you believe is controlling, including an archive link if the live source is unstable.",
              "Explain whether the issue is a factual error, a source mismatch, a basis mismatch, or an omission.",
              "Describe the proposed correction precisely enough that it could be logged in public release history."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "Practical review path",
        contentBlocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "Open the relevant claim, section, or source page so the exact record under dispute is identified.",
              "Compare the published wording against the linked source, decision, and open-question trail.",
              "Write the narrowest correction the evidence supports, rather than a broader policy objection.",
              "Check the corrections page to see how a valid challenge should appear in public release history."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "What is not enough",
        stack: true,
        texts: [
          "Opinion-only objections, broad political disagreement, or unsupported claims that a figure feels too high or too low are not enough to correct the publication.",
          "The standard is evidence-first: if a challenge is sound, it should survive direct comparison against the linked claim, source, decision, and open-question trail."
        ]
      },
      {
        type: "panel",
        heading: "Submit a correction or challenge",
        paragraphs: [
          `<p>Email <a href="${correctionMailto}">corrections@thecitizenaudit.org</a> with the subject line <strong>Citizen Audit Correction Challenge</strong>.</p>`
        ],
        contentBlocks: [
          {
            type: "list",
            items: [
              "Claim or page being challenged",
              "Source or archive link",
              "Explanation of the proposed correction",
              "Whether the issue is factual, methodological, citation-related, or wording-related"
            ]
          }
        ]
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
          { label: "How to verify this work", href: "/verify.html", variant: "primary" },
          { label: "Open Explorer", href: "/explorer.html" },
          { label: "Browse sources", href: "/sources.html" },
          { label: "Challenge the audit", href: "/challenge.html" }
        ]
      },
      {
        type: "panel",
        heading: "How to verify the audit",
        stack: true,
        texts: [
          "Start from a section page, open its verification panel, then follow each claim into its source, decision, and open-question records. The platform is designed so readers can move from published prose to supporting evidence without changing the Version 1.0 conclusions.",
          "Where the public record is incomplete, the platform keeps that incompleteness visible instead of filling it with modeled certainty.",
          "The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements."
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
        heading: "Formal review contact",
        paragraphs: [
          `<p>Email <a href="${reviewMailto}">review@thecitizenaudit.org</a> with the subject line <strong>Citizen Audit Formal Review</strong>.</p>`
        ],
        contentBlocks: [
          {
            type: "list",
            items: [
              "Reviewer background",
              "Scope of review",
              "Section reviewed",
              "Findings"
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "Recommended reviewer sequence",
        contentBlocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "Start with methodology so the basis rules are clear.",
              "Move to the relevant section or claim page.",
              "Check the linked source and decision records before judging the figure.",
              "Use the challenge and corrections pages only after you can name the exact record that should change."
            ]
          }
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
    id: "PAGE-ROADMAP",
    title: "Research Roadmap | The Citizen Audit",
    heading: "Research Roadmap",
    slug: "roadmap",
    description: "What is next for The Citizen Audit, including future volumes, revision practice, and verification priorities.",
    eyebrow: "What Is Next",
    lede:
      "The current publication preserves a locked Volume I evidence platform. Future work should expand publication readiness and later editions without quietly rewriting the locked v1.0 conclusions.",
    footerLabel: "Research roadmap",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: overviewSectionIds,
    relatedClaimIds: ["C-016", "C-017", "C-018"],
    relatedSourceIds: ["S-038", "S-064", "S-073"],
    relatedDecisionIds: ["D-020", "D-024", "D-025"],
    relatedOpenQuestionIds: ["A-005", "A-018", "A-028", "A-037"],
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "View release notes", href: "/release-notes.html", variant: "primary" },
          { label: "Review open questions", href: "/open-questions.html" },
          { label: "Challenge the audit", href: "/challenge.html" },
          { label: "Browse downloads", href: "/downloads.html" }
        ]
      },
      {
        type: "cardGrid",
        cards: [
          {
            eyebrow: "Current status",
            title: "Research complete",
            body: "The current claim set is complete in the governing research state and remains available through the locked audit, source library, decision log, and release assets."
          },
          {
            eyebrow: "Publication state",
            title: "Publication pending archive session",
            body: "The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements."
          },
          {
            eyebrow: "Revision rule",
            title: "Corrections create visible history",
            body: "Challenges, metadata fixes, and future evidence should appear in release notes, version history, and public correction records."
          }
        ]
      },
      {
        type: "panel",
        heading: "Future audit topics",
        contentBlocks: [
          {
            type: "list",
            items: [
              "Complete the author-controlled archive session so publication status can advance automatically without reopening claims.",
              "Package later volumes or companion audits as separate editions rather than rewriting the locked Version 1.0 claim set.",
              "Preserve open questions, release history, and challenge records as later publication layers accumulate."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "Verification priorities",
        contentBlocks: [
          {
            type: "list",
            items: [
              "Execute the archive manifest session against the author-controlled capture list.",
              "Keep the review and corrections workflow pointed at exact claims, pages, and source trails.",
              "Publish later engineering refinements without changing the current claim set unless a later edition is issued."
            ]
          }
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
            href: "/downloads/the-citizen-audit-v1.0.pdf",
            title: "Audit PDF",
            body: "Download the canonical Version 1.0 audit PDF as the locked publication artifact."
          },
          {
            href: "/start-here.html",
            title: "Start Here",
            body: "Orientation page for first-time readers before they enter the full audit or source system."
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
          "<p>Version 1.0 is analytically frozen. Future evidence creates v1.1+ and does not silently rewrite locked conclusions.</p>",
          "<p>The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements.</p>"
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
          "A correction request should identify the claim, section, table if applicable, Source ID, alleged error, replacement evidence, and proposed correction. If the challenge is correct, the correction should be logged publicly.",
          "Readers who want to challenge a claim should use the evidence-first standard set out on the challenge page rather than submitting generalized disagreement.",
          "The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements."
        ]
      },
      {
        type: "actions",
        links: [
          { label: "Challenge the audit", href: "/challenge.html", variant: "primary" },
          { label: "How to verify this work", href: "/verify.html" },
          { label: "Browse claims", href: "/claims.html" },
          { label: "Release notes", href: "/release-notes.html" }
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
        heading: "How a valid correction should move",
        contentBlocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "A reviewer identifies a specific claim, section, table, or source record.",
              "The reviewer provides replacement evidence strong enough to test the published record.",
              "The challenge is checked against the current claim, source, decision, and open-question trail.",
              "If sustained, the correction is logged publicly in release notes, version history, and changelog rather than hidden in place."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "Submit a correction or challenge",
        paragraphs: [
          `<p>Email <a href="${correctionMailto}">corrections@thecitizenaudit.org</a> with the subject line <strong>Citizen Audit Correction Challenge</strong>.</p>`
        ],
        contentBlocks: [
          {
            type: "list",
            items: [
              "Claim or page being challenged",
              "Source or archive link",
              "Explanation of the proposed correction",
              "Whether the issue is factual, methodological, citation-related, or wording-related"
            ]
          }
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
    id: "PAGE-TRANSPARENCY",
    title: "How We Could Be Wrong | The Citizen Audit",
    heading: "How We Could Be Wrong",
    slug: "transparency",
    description: "Known limitations, open questions, evidence gaps, and future-correction pathways for The Citizen Audit.",
    eyebrow: "Transparency And Limits",
    lede:
      "Credible research publishes not only what it thinks it knows, but also where the record is incomplete, where interpretations remain contestable, and where future corrections may change the platform around the locked edition.",
    footerLabel: "Transparency and limits",
    relatedAuditIds: ["AUDIT-001"],
    relatedSectionIds: allSectionIds,
    relatedClaimIds: ["C-009", "C-015", "C-016", "C-017", "C-018"],
    relatedSourceIds: ["S-038", "S-064", "S-072", "S-073", "S-078"],
    relatedDecisionIds: ["D-021", "D-024", "D-025"],
    relatedOpenQuestionIds: allOpenQuestionIds,
    contentBlocks: [
      {
        type: "actions",
        links: [
          { label: "Review open questions", href: "/open-questions.html", variant: "primary" },
          { label: "Read known limitations", href: "/downloads.html" },
          { label: "Challenge the audit", href: "/challenge.html" },
          { label: "Read the full audit", href: "/audit.html" }
        ]
      },
      {
        type: "panel",
        heading: "Known limitations",
        texts: [
          "The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements."
        ],
        contentBlocks: [
          {
            type: "list",
            items: [
              "Some program lanes do not publish citizenship-status breakouts needed for a defensible count.",
              "Several domestic examples are strongest on legal framework or program mechanics rather than recipient-attributable outlays.",
              "Certain lanes remain measurable only on a blended federal-plus-state or point-in-time basis."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "Areas still under review",
        contentBlocks: [
          {
            type: "list",
            items: [
              "Beneficiary-versus-provider capture in ORR-related spending.",
              "Federal-only emergency Medicaid breakout clarity.",
              "Programs listed in the gap register where public records still do not support a citizenship breakout."
            ]
          }
        ]
      },
      {
        type: "panel",
        heading: "How future corrections should work",
        stack: true,
        texts: [
          "Future corrections should tighten metadata, add records, or revise later editions in public. They should not hide the fact that the record was incomplete at the time of Version 1.0 publication.",
          "Readers can review the open-question register, release notes, and changelog to see where the platform remains provisional even while the current edition stays locked."
        ]
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
      "Each publication state should explain what shipped, what remains author-gated, and what changed in the platform around the locked edition.",
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
    heading: "Appendix B",
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
        type: "canonicalPdfNotice",
        text:
          "The Citizen Audit v1.0 PDF remains the canonical publication. This page is a structured reader conversion of Appendix B provided for navigation and inspection.",
        href: "/downloads/the-citizen-audit-v1.0.pdf",
        label: "Open the canonical PDF"
      },
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
      "This page reports build health, publication readiness, generated output coverage, and the invariants the platform keeps around the locked Version 1.0 edition.",
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
        type: "researchHeatMap"
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
      "The platform treats structured data as the source of truth and distinguishes completed research from author-gated publication readiness.",
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
        type: "researchHeatMap"
      },
      {
        type: "panel",
        heading: "Dashboard notes",
        stack: true,
        texts: [
          "This dashboard is generated from the same structured records that drive claim pages, source pages, search, explorer data, graph outputs, and QA.",
          "The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements.",
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
