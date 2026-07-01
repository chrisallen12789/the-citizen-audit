const publication = {
  sources: [
    {
      id: "S-001",
      slug: "s-001",
      title: "CRS IF10183",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Corroborating conduit for the Section 3 FY2023 foreign-assistance obligations total of approximately $99.9B.",
      sections: ["Section 1", "Section 3"],
      claims: [
        "Corroborates the published FY2023 foreign-assistance obligations figure used in Section 3.",
        "Supports the audit's separation between obligations and disbursements."
      ],
      openQuestions: [],
      confidence: "Medium-high as corroboration",
      evidenceClass: "Class B corroborating source"
    },
    {
      id: "S-002",
      slug: "s-002",
      title: "8 U.S.C. Sec. 1641(b)",
      agency: "Congress / U.S. Code",
      type: "Statute",
      summary: "Qualified-alien definition used throughout the domestic eligibility framework.",
      sections: ["Section 2", "Section 8", "Section 9"],
      claims: [
        "Defines the lawful-status categories used in domestic-program analysis.",
        "Supports the rule against collapsing different immigration-status categories into one figure."
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
      summary: "Federal public-benefit restriction baseline for non-qualified aliens, including the emergency-medical exception structure.",
      sections: ["Section 2", "Section 7", "Section 8", "Section 9"],
      claims: [
        "Supports the default ineligibility baseline for undocumented immigrants in most federal benefits.",
        "Provides the emergency-medical exception framework carried into Section 7."
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
      summary: "Five-year bar and related exceptions for federal means-tested public benefits.",
      sections: ["Section 2", "Section 8", "Section 9"],
      claims: [
        "Supports the methodology distinction between qualified categories and waiting-period restrictions."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary legal text"
    },
    {
      id: "S-005",
      slug: "s-005",
      title: "GAO Budget Glossary (GAO-05-734SP)",
      agency: "Government Accountability Office",
      type: "Federal glossary",
      summary: "Primary budget-accounting terminology for appropriation, obligation, outlay, and number-type separation.",
      sections: ["Section 2", "Section 3"],
      claims: [
        "Defines appropriation, obligation, and budget authority for the audit's accounting rules.",
        "Supports the rule that unlike number types cannot be merged."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary federal reference"
    },
    {
      id: "S-006",
      slug: "s-006",
      title: "CBO Common Budgetary Terms Explained",
      agency: "Congressional Budget Office",
      type: "Federal glossary",
      summary: "Companion budgetary definitions used to corroborate number-type discipline throughout the publication.",
      sections: ["Section 2"],
      claims: [
        "Reinforces the audit's separation of appropriations, obligations, outlays, and projections."
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
      sections: ["Section 1", "Section 3", "Section 6"],
      claims: [
        "Supports the FY2023 obligations figure of approximately $99.9B.",
        "Supports the FY2023 disbursements figure of approximately $71.9B.",
        "Supports the FY2024 obligations figure of approximately $85.8B and later reported-to-date figures."
      ],
      openQuestions: ["A-005"],
      confidence: "High for published aggregates; limited for ultimate-recipient capture",
      evidenceClass: "Primary federal dataset"
    },
    {
      id: "S-039",
      slug: "s-039",
      title: "Pew foreign-aid reporting summary",
      agency: "Pew Research Center",
      type: "Corroborating analysis",
      summary: "Corroborating conduit for FY2023 foreign-assistance disbursements, agency composition, and military-share context.",
      sections: ["Section 3"],
      claims: [
        "Corroborates the FY2023 disbursement total near $71.9B.",
        "Corroborates agency and military-share breakdowns used in Section 3."
      ],
      openQuestions: ["A-005"],
      confidence: "Medium as corroboration",
      evidenceClass: "Class D corroborating source"
    },
    {
      id: "S-040",
      slug: "s-040",
      title: "USAFacts foreign-aid reporting summary",
      agency: "USAFacts",
      type: "Corroborating analysis",
      summary: "Corroborating conduit for later-year obligations in the international-assistance lane.",
      sections: ["Section 3"],
      claims: [
        "Corroborates approximately $85.8B FY2024 obligations and the lower-confidence FY2025 to-date and FY2026 to-date figures."
      ],
      openQuestions: ["A-005"],
      confidence: "Medium as corroboration",
      evidenceClass: "Class D corroborating source"
    },
    {
      id: "S-042",
      slug: "s-042",
      title: "State Supplementary Tables FY2025",
      agency: "Department of State",
      type: "Agency budget tables",
      summary: "Account-level foreign-assistance tables retained for next-pass pulls and account composition checks.",
      sections: ["Section 3"],
      claims: [
        "Supports account-level breakdowns behind the international-assistance universe."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary agency publication"
    },
    {
      id: "S-043",
      slug: "s-043",
      title: "CRS IF11437",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Used to distinguish taxpayer-funded military aid from allied-funded foreign military sales.",
      sections: ["Section 3", "Section 4", "Section 5"],
      claims: [
        "Supports exclusion of allied-funded FMS from taxpayer totals.",
        "Supports the Section 3 to Section 5 netting rule around military-aid overlap."
      ],
      openQuestions: ["A-017"],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-044",
      slug: "s-044",
      title: "UkraineOversight.gov",
      agency: "Special Inspector General / oversight reporting",
      type: "Federal oversight portal",
      summary: "Primary oversight source for Ukraine appropriated-versus-disbursed context used in the illustrative Section 4 lane.",
      sections: ["Section 4"],
      claims: [
        "Supports the publication's Ukraine stage and delivery-context framing without making Section 4 additive to the totals."
      ],
      openQuestions: [],
      confidence: "High for published oversight figures",
      evidenceClass: "Primary federal reporting"
    },
    {
      id: "S-045",
      slug: "s-045",
      title: "State Department Ukraine/Israel aid reporting",
      agency: "Department of State",
      type: "Agency reporting",
      summary: "Primary State reporting used in the illustrative Section 4 examples for identifiable aid flows.",
      sections: ["Section 4", "Section 5"],
      claims: [
        "Supports identifiable Ukraine and Israel aid lines discussed in Section 4."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary agency publication"
    },
    {
      id: "S-046",
      slug: "s-046",
      title: "GAO drawdown valuation reporting",
      agency: "Government Accountability Office",
      type: "Oversight report",
      summary: "Used for the reported drawdown overvaluation issue and to keep transfer value separate from replacement appropriations.",
      sections: ["Section 4", "Section 5"],
      claims: [
        "Supports the GAO-reported drawdown misvaluation issue.",
        "Supports excluding drawdown transfer value from net-new taxpayer replacement totals."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B oversight source"
    },
    {
      id: "S-047",
      slug: "s-047",
      title: "CEPR Ukraine valuation context",
      agency: "Center for Economic and Policy Research",
      type: "Contrary context",
      summary: "Retained as disconfirming or bounding context for delivered-value discussions in Section 4.",
      sections: ["Section 4"],
      claims: [
        "Provides lower-bound contextual estimates for value reaching Ukraine without being adopted as the canonical total."
      ],
      openQuestions: [],
      confidence: "Low as canonical evidence; useful as contrary context",
      evidenceClass: "Class D contextual source"
    },
    {
      id: "S-048",
      slug: "s-048",
      title: "Council on Foreign Relations aid tracker context",
      agency: "Council on Foreign Relations",
      type: "Corroborating analysis",
      summary: "Used as contextual corroboration for Section 4's illustrative examples.",
      sections: ["Section 4"],
      claims: [
        "Corroborates broad Ukraine and Israel aid-stage context without serving as the primary figure source."
      ],
      openQuestions: [],
      confidence: "Low-medium as corroboration",
      evidenceClass: "Class D corroborating source"
    },
    {
      id: "S-049",
      slug: "s-049",
      title: "CRS RL33222",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Primary congressional source for Israel FMF, missile-defense, and OSP context used in Section 4.",
      sections: ["Section 4"],
      claims: [
        "Supports the identifiable Israel FMF and missile-defense appropriations discussed in Section 4.",
        "Supports the offshore-procurement share used in the Article 15 beneficiary discussion."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-050",
      slug: "s-050",
      title: "DSCA SAMM and related security-cooperation materials",
      agency: "Defense Security Cooperation Agency",
      type: "Program framework",
      summary: "Program framework source for marginal or pending security-cooperation lanes surrounding Section 5 Block B.",
      sections: ["Section 5"],
      claims: [
        "Supports scoping and exclusion treatment for marginal security-cooperation mechanisms around the recurring annual lane."
      ],
      openQuestions: [],
      confidence: "Medium-high",
      evidenceClass: "Primary program documentation"
    },
    {
      id: "S-051",
      slug: "s-051",
      title: "State FMTR",
      agency: "Department of State",
      type: "Agency reporting",
      summary: "Foreign Military Training Report used as supporting context in the military-aid lane.",
      sections: ["Section 5"],
      claims: [
        "Supports military-assistance program context and classification in Section 5."
      ],
      openQuestions: [],
      confidence: "Medium-high",
      evidenceClass: "Primary agency publication"
    },
    {
      id: "S-052",
      slug: "s-052",
      title: "CRS IF12040",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Component-level CRS source for Ukraine security-assistance figures used in Section 5 reconciliation.",
      sections: ["Section 5"],
      claims: [
        "Supports the component-level USAI and PDA-replacement reconciliation in Section 5."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-053",
      slug: "s-053",
      title: "CRS IN12453",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "CRS source for cumulative PDA replacement and related Ukraine security-assistance figures.",
      sections: ["Section 5"],
      claims: [
        "Supports the cumulative PDA-replacement appropriation and obligation figures used in Block A."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-054",
      slug: "s-054",
      title: "CRS R48182",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "CRS source for USAI and related Ukraine military-assistance figures used in Block A.",
      sections: ["Section 5"],
      claims: [
        "Supports the USAI available and obligated figures used in the Block A subtotal."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-055",
      slug: "s-055",
      title: "GAO-23-105842",
      agency: "Government Accountability Office",
      type: "Oversight report",
      summary: "Primary source for the Section 333 Build Partner Capacity historical figure used in the recurring annual lane.",
      sections: ["Section 5", "Section 14"],
      claims: [
        "Supports the approximately $5.6B FY2018-2022 Section 333 figure and the annualized recurring lane near $1.1B."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B oversight source"
    },
    {
      id: "S-056",
      slug: "s-056",
      title: "GAO-24-107232",
      agency: "Government Accountability Office",
      type: "Oversight report",
      summary: "GAO source for the FY2022-2023 subset of PDA replacement figures retained in reconciliation.",
      sections: ["Section 5"],
      claims: [
        "Supports the narrower FY2022-2023 subset retained alongside the larger cumulative PDA replacement total."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B oversight source"
    },
    {
      id: "S-057",
      slug: "s-057",
      title: "DoD / DSCA infographic",
      agency: "Department of Defense / DSCA",
      type: "Agency infographic",
      summary: "DoD summary used to verify separation between USAI and PDA replacement lines in Section 5.",
      sections: ["Section 5"],
      claims: [
        "Supports the non-overlap of USAI and PDA replacement lines.",
        "Supports the cumulative military-assistance line items used in Block A."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary agency publication"
    },
    {
      id: "S-058",
      slug: "s-058",
      title: "DoD CTEF J-Books",
      agency: "Department of Defense",
      type: "Budget justification",
      summary: "Primary source for the Counter-ISIS Train and Equip Fund figure used in the recurring annual lane.",
      sections: ["Section 5", "Section 14"],
      claims: [
        "Supports the approximately $0.5B recurring annual CTEF lane."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary budget document"
    },
    {
      id: "S-059",
      slug: "s-059",
      title: "10 U.S.C. Sec. 333",
      agency: "Congress / U.S. Code",
      type: "Statute",
      summary: "Statutory authority for the Section 333 Build Partner Capacity lane.",
      sections: ["Section 5"],
      claims: [
        "Supports the legal basis and lane identity for Section 333 funding in Section 5."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary legal text"
    },
    {
      id: "S-060",
      slug: "s-060",
      title: "ORR program documents",
      agency: "Office of Refugee Resettlement / HHS",
      type: "Program documentation",
      summary: "Program documents used to identify ORR base program lines such as RSS and T&MS in Section 6.",
      sections: ["Section 6", "Section 14"],
      claims: [
        "Supports the FY2024 base figures for Refugee Support Services and Transitional and Medical Services.",
        "Supports the program-level structure of the ORR lane."
      ],
      openQuestions: ["A-018"],
      confidence: "High",
      evidenceClass: "Primary program documentation"
    },
    {
      id: "S-061",
      slug: "s-061",
      title: "ORR entrant-assistance program materials",
      agency: "Office of Refugee Resettlement / HHS",
      type: "Program documentation",
      summary: "Supporting ORR materials for entrant cash, medical, or service pathways discussed in Section 6.",
      sections: ["Section 6"],
      claims: [
        "Supports the routed treatment of entrant-directed cash and medical assistance inside the ORR lane."
      ],
      openQuestions: ["A-018"],
      confidence: "Medium-high",
      evidenceClass: "Primary program documentation"
    },
    {
      id: "S-062",
      slug: "s-062",
      title: "USAspending account 075-1503",
      agency: "USAspending / HHS",
      type: "Federal spending record",
      summary: "Federal account reference for Refugee and Entrant Assistance used to anchor the Section 6 lane.",
      sections: ["Section 6", "Section 14"],
      claims: [
        "Supports the identification of Refugee and Entrant Assistance as the central federal account in Section 6."
      ],
      openQuestions: ["A-018"],
      confidence: "High",
      evidenceClass: "Primary federal spending record"
    },
    {
      id: "S-063",
      slug: "s-063",
      title: "ORR service-delivery and provider-route materials",
      agency: "Office of Refugee Resettlement / HHS",
      type: "Program documentation",
      summary: "Supporting ORR material for provider, state, and voluntary-agency delivery pathways in Section 6.",
      sections: ["Section 6"],
      claims: [
        "Supports the conclusion that a large share of ORR dollars is routed through states, operators, and voluntary agencies rather than directly as cash."
      ],
      openQuestions: ["A-018"],
      confidence: "Medium-high",
      evidenceClass: "Primary program documentation"
    },
    {
      id: "S-064",
      slug: "s-064",
      title: "KFF emergency Medicaid analysis",
      agency: "KFF",
      type: "Corroborating analysis",
      summary: "Corroborating source for the Section 7 emergency Medicaid figure and the provider-capture framing.",
      sections: ["Section 7", "Section 14", "Section 16"],
      claims: [
        "Corroborates the approximately $3.8B FY2023 emergency Medicaid figure.",
        "Supports the explanation that emergency Medicaid reimburses hospitals rather than paying cash to patients."
      ],
      openQuestions: ["A-037"],
      confidence: "Medium-high as corroboration",
      evidenceClass: "Class D corroborating source"
    },
    {
      id: "S-065",
      slug: "s-065",
      title: "CMS-64 / MACPAC emergency Medicaid reporting",
      agency: "CMS / MACPAC",
      type: "Federal administrative data",
      summary: "Primary source of record for the Section 7 emergency Medicaid figure.",
      sections: ["Section 7"],
      claims: [
        "Supports the approximately $3.8B FY2023 emergency Medicaid figure on a federal-plus-state basis."
      ],
      openQuestions: ["A-037"],
      confidence: "High",
      evidenceClass: "Primary federal administrative data"
    },
    {
      id: "S-067",
      slug: "s-067",
      title: "CRS R46462",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Primary structural source for housing-program eligibility, Section 214 limits, and status-verification rules.",
      sections: ["Section 10"],
      claims: [
        "Supports the claim that major HUD rental-assistance programs are limited to citizens and eligible noncitizens under Section 214."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-068",
      slug: "s-068",
      title: "HUD program guidance",
      agency: "Department of Housing and Urban Development",
      type: "Agency guidance",
      summary: "HUD guidance used alongside CRS to explain proration and status-verification rules in Section 10.",
      sections: ["Section 10"],
      claims: [
        "Supports proration treatment under mixed-status housing households and the exclusion of ineligible members."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary agency guidance"
    },
    {
      id: "S-069",
      slug: "s-069",
      title: "Plyler / federal education-aid legal framework",
      agency: "Federal legal and education framework",
      type: "Legal framework",
      summary: "Primary legal framework for status-blind K-12 access and federal student-aid eligibility boundaries used in Section 11.",
      sections: ["Section 11"],
      claims: [
        "Supports the claim that K-12 schooling is status-blind under Plyler v. Doe.",
        "Supports the claim that undocumented students are barred from federal student aid while eligible noncitizen breakout data is not published."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary legal framework"
    },
    {
      id: "S-070",
      slug: "s-070",
      title: "CRS R47936",
      agency: "Congressional Research Service",
      type: "Congressional analysis",
      summary: "Appropriations source for Refugee and Entrant Assistance and related ORR emergency funding in Section 6.",
      sections: ["Section 6", "Section 14"],
      claims: [
        "Supports the approximately $4.2B FY2023 emergency-designated Refugee and Entrant Assistance figure.",
        "Supports the approximately $481M FY2024 emergency appropriation figure."
      ],
      openQuestions: ["A-018"],
      confidence: "High",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-071",
      slug: "s-071",
      title: "ORR / HHS additional resettlement support materials",
      agency: "Office of Refugee Resettlement / HHS",
      type: "Program documentation",
      summary: "Supporting ORR documentation used to map the service and provider structure of Section 6.",
      sections: ["Section 6"],
      claims: [
        "Supports the ownership map that keeps ORR-routed assistance inside Section 6 rather than duplicating it elsewhere."
      ],
      openQuestions: ["A-018"],
      confidence: "Medium-high",
      evidenceClass: "Primary program documentation"
    },
    {
      id: "S-072",
      slug: "s-072",
      title: "SSA SSI program totals",
      agency: "Social Security Administration",
      type: "Federal administrative data",
      summary: "Primary SSI program totals used in Section 9 for the overall payment baseline and average payment amount.",
      sections: ["Section 9"],
      claims: [
        "Supports approximately $61B in SSI total payments in FY/CY2023.",
        "Supports the average monthly SSI payment baseline used in the Section 9 calculation."
      ],
      openQuestions: ["A-028"],
      confidence: "High",
      evidenceClass: "Primary federal administrative data"
    },
    {
      id: "S-073",
      slug: "s-073",
      title: "SSA noncitizen SSI data",
      agency: "Social Security Administration",
      type: "Federal administrative data",
      summary: "Primary source for the noncitizen SSI recipient count used in Section 9.",
      sections: ["Section 1", "Section 9", "Section 14"],
      claims: [
        "Supports the published noncitizen SSI recipient count of 365,714 in December 2021.",
        "Supports the computed approximately $2.21B annualized SSI line on the December 2021 basis."
      ],
      openQuestions: ["A-028"],
      confidence: "High for point-in-time basis; medium for annualization beyond that basis",
      evidenceClass: "Primary federal administrative data"
    },
    {
      id: "S-074",
      slug: "s-074",
      title: "USDA-FNS SNAP characteristics data",
      agency: "USDA Food and Nutrition Service",
      type: "Federal administrative data",
      summary: "Primary SNAP program and participant-composition data used in Section 8.",
      sections: ["Section 8", "Section 16"],
      claims: [
        "Supports the FY2023 SNAP participation figures used in Section 8.",
        "Supports the composition finding that approximately 89.4 percent of participants are U.S.-born citizens and approximately 3.3 percent are other noncitizens."
      ],
      openQuestions: [],
      confidence: "High",
      evidenceClass: "Primary federal administrative data"
    },
    {
      id: "S-075",
      slug: "s-075",
      title: "ACF TANF totals and characteristics",
      agency: "Administration for Children and Families",
      type: "Federal administrative data",
      summary: "Published TANF totals and characteristics used only to frame why TANF remains largely routed to Section 13.",
      sections: ["Section 9"],
      claims: [
        "Supports the claim that TANF totals are published but noncitizen-attributable benefit dollars are not cleanly isolated."
      ],
      openQuestions: [],
      confidence: "High for published totals; low for noncitizen-dollar isolation",
      evidenceClass: "Primary federal administrative data"
    },
    {
      id: "S-076",
      slug: "s-076",
      title: "Cato SIPP-modeled welfare context",
      agency: "Cato Institute",
      type: "Contextual model",
      summary: "Directional, non-canonical context retained in Section 9 but not adopted as a Total A figure.",
      sections: ["Section 9"],
      claims: [
        "Provides modeled context for noncitizen welfare use while remaining outside the audit's adopted topline because of scope and methodology mismatches."
      ],
      openQuestions: [],
      confidence: "Low as canonical evidence",
      evidenceClass: "Class D contextual source"
    },
    {
      id: "S-077",
      slug: "s-077",
      title: "HUD ineligible-tenant reporting",
      agency: "Department of Housing and Urban Development",
      type: "Agency reporting",
      summary: "Closest primary figure used in Section 10 for ineligible individuals inside assisted housing structures.",
      sections: ["Section 10"],
      claims: [
        "Supports the heavily caveated closest primary housing figure discussed in Section 10."
      ],
      openQuestions: [],
      confidence: "Medium due to caveats",
      evidenceClass: "Primary agency reporting"
    },
    {
      id: "S-078",
      slug: "s-078",
      title: "CBO emergency Medicaid cost reporting",
      agency: "Congressional Budget Office",
      type: "Congressional analysis",
      summary: "CBO time-window context for emergency Medicaid, retained in reconciliation but not as a competing annual figure.",
      sections: ["Section 7"],
      claims: [
        "Supports the publication's time-window reconciliation showing why multi-year CBO totals do not compete with the FY2023 figure."
      ],
      openQuestions: ["A-037"],
      confidence: "High for the stated time window",
      evidenceClass: "Class B analytical source"
    },
    {
      id: "S-079",
      slug: "s-079",
      title: "House Budget Committee emergency Medicaid context",
      agency: "House Budget Committee",
      type: "Congressional context",
      summary: "Subset-period emergency Medicaid context retained in Table 14-H reconciliation.",
      sections: ["Section 7"],
      claims: [
        "Supports the claim that larger emergency Medicaid numbers cited elsewhere are different-period figures rather than contradictions of the FY2023 annual figure."
      ],
      openQuestions: ["A-037"],
      confidence: "Medium as reconciliation context",
      evidenceClass: "Class B contextual source"
    },
    {
      id: "S-080",
      slug: "s-080",
      title: "CBO immigration-surge projection context",
      agency: "Congressional Budget Office",
      type: "Projection",
      summary: "Forward-looking context explicitly kept out of adopted totals because it is a projection and includes out-of-scope categories.",
      sections: ["Section 7"],
      claims: [
        "Supports the publication's explicit distinction between current-year measured figures and future projections."
      ],
      openQuestions: [],
      confidence: "High for projected-scope description; not used as an adopted total",
      evidenceClass: "Projected federal analysis"
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
      relatedSources: ["S-060", "S-062", "S-070"]
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
      relatedSources: ["S-072", "S-073"]
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
      relatedSources: ["S-003", "S-064", "S-065", "S-078", "S-079"]
    }
  ],
  decisions: [
    {
      id: "D-001",
      slug: "d-001",
      title: "Gross, not net",
      body: "Every adopted figure is gross money directed toward non-U.S. recipients or noncitizens. The audit does not offset those figures against taxes paid or any net-fiscal-impact model.",
      references: ["Section 1", "Section 2", "Section 9"]
    },
    {
      id: "D-005",
      slug: "d-005",
      title: "Status categories are never collapsed",
      body: "Lawful permanent residents, refugees, asylees, parolees, temporary statuses, and undocumented persons are analytically distinct categories and are never merged into one undifferentiated headline.",
      references: ["Section 2"]
    },
    {
      id: "D-012",
      slug: "d-012",
      title: "Number type and resource category are recorded separately",
      body: "Each figure keeps both its number type and its resource category visible. Drawdown transfer value, replacement appropriations, obligations, outlays, and program authorities are tracked as different things.",
      references: ["Section 2", "Section 5"]
    },
    {
      id: "D-013",
      slug: "d-013",
      title: "Universe-of-programs completeness artifact",
      body: "Sections with broad program scope publish their universe explicitly, including residual or immaterial lines, so no material account is silently dropped from the research frame.",
      references: ["Section 3", "Section 4", "Section 6"]
    },
    {
      id: "D-014",
      slug: "d-014",
      title: "The Two Running Totals",
      body: "The audit preserves two permanent running concepts: Total A for gross directed resources and Total B for estimated value ultimately reaching the non-U.S. recipient after U.S.-captured share. They are never merged.",
      references: ["Section 3", "Section 14"]
    },
    {
      id: "D-017",
      slug: "d-017",
      title: "Section 3 to Section 5 netting rule",
      body: "Military-aid lines already embedded in the foreign-assistance aggregate are counted once. Section 5 aggregates only NET-NEW military lanes and excludes allied-funded FMS, DCS, and other non-taxpayer or already-counted amounts.",
      references: ["Section 3", "Section 4", "Section 5", "Section 14"]
    },
    {
      id: "D-018",
      slug: "d-018",
      title: "Research docket publication rule",
      body: "Illustrative sections may publish their search path, source classes, and unresolved pulls so readers can see what was investigated even when those sections are non-additive.",
      references: ["Section 4"]
    },
    {
      id: "D-019",
      slug: "d-019",
      title: "Standardized key-findings opening",
      body: "Certain locked sections begin with a standardized key-findings block that summarizes already-established evidence without introducing new evidence or new methodology in the summary itself.",
      references: ["Section 4", "Section 5"]
    },
    {
      id: "D-020",
      slug: "d-020",
      title: "No blended grand total",
      body: "Where lane subtotals sit on incompatible bases such as disbursement versus obligation, annual versus cumulative, or federal versus federal-plus-state, the rigorous output is a set of basis-segregated subtotals rather than one synthetic total.",
      references: ["Section 1", "Section 5", "Section 12", "Section 14", "Section 16"]
    },
    {
      id: "D-021",
      slug: "d-021",
      title: "Ownership map for domestic sections",
      body: "Domestic federal dollars are owned by one canonical section so routed programs are not counted twice. ORR, Medicaid, TANF-related pathways, and state-administered lenses keep their owning section explicit.",
      references: ["Section 6", "Section 7", "Section 8", "Section 9", "Section 10", "Section 11", "Section 12", "Section 13"]
    },
    {
      id: "D-022",
      slug: "d-022",
      title: "Section 14 blueprint frozen",
      body: "The conservative-total section is built to a fixed blueprint that preserves lane separation, forbids invented gap estimates, and requires reproducibility from the locked source sections.",
      references: ["Section 14"]
    },
    {
      id: "D-023",
      slug: "d-023",
      title: "Section 14 locked",
      body: "After the blueprint was populated and checked, Section 14 was locked as the publication's conservative set-of-subtotals representation.",
      references: ["Section 14"]
    },
    {
      id: "D-024",
      slug: "d-024",
      title: "Section 15 locked",
      body: "The limitations section was locked to carry forward the publication's missing-record constraints without backfilling them with modeled certainty.",
      references: ["Section 15"]
    },
    {
      id: "D-025",
      slug: "d-025",
      title: "Section 16 locked",
      body: "The final argument was locked after assembly so the publication's closing synthesis reflects the same basis-separation and limitation rules as the rest of Version 1.0.",
      references: ["Section 16"]
    },
    {
      id: "D-026",
      slug: "d-026",
      title: "Repository completion assembly",
      body: "Repository completion for Version 1.0 means the locked sections, appendices, source library, and decision log are assembled as publication assets without rewriting the underlying analytical conclusions.",
      references: ["Appendix A", "Appendix B", "Repository assets"]
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
