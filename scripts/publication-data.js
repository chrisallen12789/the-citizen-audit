const publication = {
  sources: [
    {
      id: "S-002",
      slug: "s-002",
      title: "8 U.S.C. Sec. 1641",
      agency: "Congress / U.S. Code",
      type: "Statute",
      summary: "Qualified alien definition used to separate lawful immigration categories in domestic-benefit analysis.",
      sections: ["Section 2"],
      claims: [
        "Defines qualified-alien categories used throughout domestic eligibility analysis.",
        "Supports the category-separation rule used in the methodology section."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary legal text"
    },
    {
      id: "S-003",
      slug: "s-003",
      title: "8 U.S.C. Sec. 1611",
      agency: "Congress / U.S. Code",
      type: "Statute",
      summary: "Federal public-benefit restrictions for non-qualified aliens, including the emergency-medical exception structure.",
      sections: ["Section 2", "Section 7", "Section 8"],
      claims: [
        "Supports the ineligibility baseline for undocumented immigrants in most federal public-benefit programs.",
        "Frames the emergency-medical exception carried into the Medicaid analysis."
      ],
      openQuestions: ["A-037"],
      confidence: "High",
      evidenceClass: "Primary legal text"
    },
    {
      id: "S-004",
      slug: "s-004",
      title: "8 U.S.C. Sec. 1613",
      agency: "Congress / U.S. Code",
      type: "Statute",
      summary: "Five-year bar for many federal means-tested public benefits used in domestic program scope analysis.",
      sections: ["Section 2"],
      claims: [
        "Supports the methodology distinction between qualified categories and waiting-period limits."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary legal text"
    },
    {
      id: "S-005",
      slug: "s-005",
      title: "GAO Budget Glossary",
      agency: "Government Accountability Office",
      type: "Federal glossary",
      summary: "Primary budget-accounting terminology for appropriation, obligation, outlay, and related measure-separation rules.",
      sections: ["Section 2"],
      claims: [
        "Supports the rule that appropriation, obligation, and outlay are different accounting states.",
        "Supports the anti-mixing rule used across all totals."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary federal reference"
    },
    {
      id: "S-006",
      slug: "s-006",
      title: "CBO Common Budgetary Terms",
      agency: "Congressional Budget Office",
      type: "Federal glossary",
      summary: "Budgetary terminology used to corroborate measure definitions and keep figure types separated.",
      sections: ["Section 2"],
      claims: [
        "Reinforces the methodology rule against mixing budget authority, obligations, outlays, and estimates."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary federal reference"
    },
    {
      id: "S-038",
      slug: "s-038",
      title: "ForeignAssistance.gov financial datasets",
      agency: "State / USAID and reporting agencies",
      type: "Federal dataset",
      summary: "Primary aggregate dataset for foreign-assistance obligations and disbursements used in Section 3.",
      sections: ["Section 1", "Section 3"],
      claims: [
        "Supports the approximately $99.9B FY2023 obligations figure.",
        "Supports the approximately $71.9B FY2023 disbursements figure when read alongside agency-published foreign-assistance data.",
        "Supports the rule that obligations and disbursements are different measures."
      ],
      openQuestions: ["A-005"],
      confidence: "High for published aggregates; limited for beneficiary-capture share",
      evidenceClass: "Primary federal dataset"
    },
    {
      id: "S-039",
      slug: "s-039",
      title: "State/USAID foreign-assistance budget data",
      agency: "Department of State / USAID",
      type: "Agency budget data",
      summary: "Supporting published foreign-assistance data used to corroborate disbursement totals and agency composition.",
      sections: ["Section 3"],
      claims: [
        "Corroborates FY2023 disbursement levels and agency composition in the international-assistance lane."
      ],
      openQuestions: ["A-005"],
      confidence: "High for published totals",
      evidenceClass: "Primary agency publication"
    },
    {
      id: "S-040",
      slug: "s-040",
      title: "Foreign-aid reporting under the Foreign Aid Transparency and Accountability Act",
      agency: "State / USAID and reporting agencies",
      type: "Statutory reporting regime",
      summary: "Published reporting lane used to frame FY2024 and to-date later-year obligations in the international-assistance section.",
      sections: ["Section 3"],
      claims: [
        "Supports the use of published assistance-reporting channels as the aggregate record of reference for Section 3."
      ],
      openQuestions: ["A-005"],
      confidence: "High for published obligations; incomplete for ultimate-recipient capture",
      evidenceClass: "Primary reporting framework"
    },
    {
      id: "S-043",
      slug: "s-043",
      title: "CRS IF11437",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Context source used to distinguish taxpayer-funded assistance from allied-funded foreign military sales.",
      sections: ["Section 5"],
      claims: [
        "Supports exclusion of foreign-funded sales from taxpayer totals in the military-aid lane."
      ],
      openQuestions: ["A-017"],
      confidence: "High for definitional routing",
      evidenceClass: "Congressional analytical source"
    },
    {
      id: "S-073",
      slug: "s-073",
      title: "SSA primary noncitizen SSI data",
      agency: "Social Security Administration",
      type: "Federal administrative data",
      summary: "Primary data for noncitizen SSI recipient counts and average payments used in Section 9.",
      sections: ["Section 1", "Section 9"],
      claims: [
        "Supports the published noncitizen SSI recipient count of 365,714 in December 2021.",
        "Supports the computed approximately $2.21B annualized SSI amount on the Dec. 2021 basis."
      ],
      openQuestions: ["A-028"],
      confidence: "High for the point-in-time basis; medium for annualization beyond that basis",
      evidenceClass: "Primary federal administrative data"
    }
  ],
  openQuestions: [
    {
      id: "A-005",
      slug: "a-005",
      title: "Unpublished U.S.-capture share in international assistance",
      sections: ["Section 1", "Section 3"],
      status: "Open",
      whyItMatters: "Without a published capture-share breakout, the site can report gross taxpayer assistance (Total A) but cannot compute a defensible Total B for international assistance.",
      currentState: "Section 3 states that Total B is materially below Total A, but not measurable from the current public record.",
      recordNeeded: "Program-level reporting that distinguishes value captured by U.S. entities from value reaching non-U.S. recipients.",
      relatedSources: ["S-038", "S-039", "S-040"]
    },
    {
      id: "A-017",
      slug: "a-017",
      title: "Cross-section harmonization between foreign-assistance and military-aid lanes",
      sections: ["Section 5"],
      status: "Open",
      whyItMatters: "Section 3 uses single-year obligations while Section 5 uses cumulative multi-year military lanes, so a blended headline would overstate precision.",
      currentState: "The site preserves separate lanes and explicitly forbids a synthetic grand total.",
      recordNeeded: "A lawful harmonization method that keeps measure type, period, and duplication risks separated.",
      relatedSources: ["S-043"]
    },
    {
      id: "A-018",
      slug: "a-018",
      title: "ORR consolidated outlay and recipient/provider split",
      sections: ["Section 1", "Section 6"],
      status: "Open",
      whyItMatters: "The refugee-resettlement lane is routed through states, voluntary agencies, and providers, but the public record does not cleanly isolate value reaching entrants.",
      currentState: "Section 6 names the program and the gap, but leaves Total B unresolved.",
      recordNeeded: "Public ORR outlay reporting that isolates entrant-directed value versus provider or operator capture.",
      relatedSources: []
    },
    {
      id: "A-028",
      slug: "a-028",
      title: "SSI point-in-time basis versus annual flow basis",
      sections: ["Section 1", "Section 9"],
      status: "Open",
      whyItMatters: "The SSI figure is computed from a published December 2021 basis, which is strong for that point in time but not a full annual transactional ledger.",
      currentState: "Section 9 keeps the figure labeled on its Dec. 2021 basis and avoids overstating it as a harmonized annual program total.",
      recordNeeded: "A published annual SSI spending breakout for noncitizen recipients or a fully reconciled monthly series.",
      relatedSources: ["S-073"]
    },
    {
      id: "A-037",
      slug: "a-037",
      title: "Federal-only emergency Medicaid share",
      sections: ["Section 1", "Section 7"],
      status: "Open",
      whyItMatters: "The site can publish the federal-plus-state emergency Medicaid figure used in the locked section, but not the federal-only share needed for a cleaner federal total.",
      currentState: "The limitation is carried forward explicitly in the Executive Summary and Section 7.",
      recordNeeded: "A public federal-only emergency Medicaid spending breakout for the same period and population basis.",
      relatedSources: ["S-003"]
    }
  ],
  decisions: [
    {
      slug: "gross-not-net",
      title: "Gross, not net",
      body: "The web edition preserves the audit rule that figures represent gross money directed toward non-U.S. recipients or non-citizens, not net fiscal impact after taxes.",
      references: ["Methodology", "Section 1", "Section 2"]
    },
    {
      slug: "no-grand-total",
      title: "No blended grand total",
      body: "The platform keeps incompatible bases separate and does not synthesize one headline total from disbursements, obligations, cumulative military lanes, and federal-plus-state figures.",
      references: ["Section 1", "Section 3", "Section 5", "Section 14 placeholder"]
    },
    {
      slug: "no-population-modeling",
      title: "No population-share modeling",
      body: "Where a federal program does not publish a citizenship-status spending breakout, the site records the gap instead of allocating dollars from population share.",
      references: ["Methodology", "Section 8", "Section 9", "Section 13 placeholder"]
    },
    {
      slug: "citizen-child-exclusion",
      title: "Citizen-child exclusion",
      body: "Benefits paid for U.S.-citizen children in mixed-status households remain excluded from non-citizen spending totals.",
      references: ["Section 1", "Methodology", "Section 8"]
    },
    {
      slug: "recipient-vs-beneficiary",
      title: "Recipient separated from economic beneficiary",
      body: "The publication distinguishes the direct recipient of federal spending from the economic beneficiary that ultimately captures value, especially in provider-heavy or contractor-heavy lanes.",
      references: ["Section 2", "Section 5", "Section 6", "Section 7"]
    },
    {
      slug: "drawdown-replacement-separation",
      title: "Drawdown value separated from replacement cost",
      body: "Military drawdown transfer values are not treated as the same thing as taxpayer replacement appropriations, preventing duplicate counting.",
      references: ["Section 2", "Section 5"]
    }
  ],
  transparencyScorecard: [
    {
      area: "International assistance",
      section: "Section 3",
      transparency: "High for published aggregate obligations/disbursements; limited for beneficiary capture",
      measurable: "Aggregate Total A yes; Total B no",
      limitation: "A-005"
    },
    {
      area: "Military aid and replacement costs",
      section: "Section 5",
      transparency: "Moderate",
      measurable: "Net-new lanes measurable; cross-section harmonization unresolved",
      limitation: "A-017"
    },
    {
      area: "Refugee resettlement",
      section: "Section 6",
      transparency: "Low to moderate",
      measurable: "Program/account visible; entrant-versus-provider split unpublished",
      limitation: "A-018"
    },
    {
      area: "Emergency Medicaid",
      section: "Section 7",
      transparency: "Moderate",
      measurable: "Federal-plus-state figure measurable; federal-only share unresolved",
      limitation: "A-037"
    },
    {
      area: "Food assistance",
      section: "Section 8",
      transparency: "Low for non-citizen dollar breakout",
      measurable: "Eligibility boundary visible; counted dollar share not isolable",
      limitation: "Section 13 routing"
    },
    {
      area: "Cash welfare / SSI",
      section: "Section 9",
      transparency: "High on published point-in-time basis",
      measurable: "Approximate annualized SSI lane measurable",
      limitation: "A-028"
    }
  ],
  releases: [
    {
      version: "0.1",
      date: "Initial repository baseline",
      title: "Deployment foundation",
      notes: [
        "Cloudflare Worker and static assets deployment established.",
        "Production domain and repository plumbing set up."
      ]
    },
    {
      version: "0.2",
      date: "Publication shell",
      title: "Initial public site",
      notes: [
        "Homepage, audit reader shell, methodology, downloads, press, corrections, and explorer prototype published.",
        "Static audit navigation established."
      ]
    },
    {
      version: "0.3",
      date: "Audit reader conversion in progress",
      title: "Locked section conversion began",
      notes: [
        "Sections 1 through 9 were converted into semantic web-reader pages.",
        "Appendix and later-section placeholders remained unfinished on main."
      ]
    },
    {
      version: "0.4",
      date: "Current branch work",
      title: "Verification layer foundation",
      notes: [
        "Structured source records, open-question records, publication search, and decision-log pages generated from repo-traceable material.",
        "Appendix A and Appendix B upgraded from placeholders into working research registers.",
        "Existing converted sections gain section-level verification metadata and trace-panel hooks."
      ]
    }
  ]
};

module.exports = publication;
