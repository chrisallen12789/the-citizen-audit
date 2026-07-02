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
      id: "A-001",
      slug: "a-001",
      title: "ForeignAssistance.gov live sum and version date",
      sections: ["Section 3"],
      status: "Open (primary execution)",
      whyItMatters: "Section 3 relies on published aggregate foreign-assistance reporting, but the live-sum and version-stamp execution path still needs a fully pinned primary extraction record.",
      currentState: "Appendix A carries this as the primary-execution item behind the international-assistance aggregate.",
      recordNeeded: "A version-stamped primary extraction from ForeignAssistance.gov showing the live sum and retrieval date used for the locked figure.",
      relatedSources: ["S-038"]
    },
    {
      id: "A-002",
      slug: "a-002",
      title: "GAO budget-glossary edition",
      sections: ["Section 2", "Section 3"],
      status: "Open",
      whyItMatters: "If a superseding GAO glossary materially changed an adopted accounting definition, the methodology notes would need to carry that custody update explicitly.",
      currentState: "The audit uses GAO-05-734SP and flags the edition-confirmation question instead of silently assuming there is no later definitional change.",
      recordNeeded: "Confirmation that no later GAO budget-glossary edition changes the adopted definitions used in the publication.",
      relatedSources: ["S-005", "S-006"]
    },
    {
      id: "A-003",
      slug: "a-003",
      title: "Post-2025 USAID-State administering offices",
      sections: ["Section 3"],
      status: "Open",
      whyItMatters: "The 2025 realignment creates a continuity problem when later-year international-assistance reporting is compared to prior administrative structures.",
      currentState: "Section 3 carries the post-2025 office realignment as a reporting discontinuity rather than pretending the series is perfectly continuous.",
      recordNeeded: "A reconciled post-2025 administrative mapping that ties later reporting offices back to the pre-realignment foreign-assistance series.",
      relatedSources: ["S-040", "S-042"]
    },
    {
      id: "A-004",
      slug: "a-004",
      title: "IMF budget-scoring treatment",
      sections: ["Section 3"],
      status: "Open",
      whyItMatters: "International financial institution support can score differently from direct grant aid, so IMF-related treatment affects scope discipline in the international-assistance universe.",
      currentState: "The publication flags IMF scoring treatment instead of assuming a simple add-or-exclude rule where the budget basis may differ.",
      recordNeeded: "A primary budget-scoring record clarifying how the relevant IMF support should be treated on the audit's chosen basis.",
      relatedSources: []
    },
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
      id: "A-006",
      slug: "a-006",
      title: "Ukraine stage figures from the primary portal",
      sections: ["Section 4"],
      status: "Mostly resolved",
      whyItMatters: "Ukraine assistance is often quoted across incompatible stages, so a primary stage-by-stage portal view is necessary to keep appropriation, obligation, disbursement, and delivery claims distinct.",
      currentState: "Section 4 confirms the structural stage gap but still notes that dynamic portal extraction was not fully captured in the locked artifact path.",
      recordNeeded: "A stable primary-portal extract that shows Ukraine aid by stage using consistent definitions.",
      relatedSources: ["S-044", "S-045"]
    },
    {
      id: "A-007",
      slug: "a-007",
      title: "PDA valuation treatment",
      sections: ["Section 4"],
      status: "Mostly resolved",
      whyItMatters: "Presidential Drawdown Authority values can diverge from replacement cost, and valuation ambiguity can create false inflation if the wrong measure is reused elsewhere.",
      currentState: "The publication treats drawdown value and replacement appropriation separately and carries the valuation problem as a reporting-quality issue.",
      recordNeeded: "Primary valuation documentation clarifying the exact basis used for PDA transfer values in the compared reporting streams.",
      relatedSources: ["S-046", "S-053", "S-054"]
    },
    {
      id: "A-008",
      slug: "a-008",
      title: "Ukraine grant-versus-loan treatment",
      sections: ["Section 4"],
      status: "Mostly resolved",
      whyItMatters: "Some Ukraine support is repayable or collateralized, so grant-versus-loan treatment changes what can be treated as direct transferred value.",
      currentState: "Section 4 flags the issue and avoids flattening repayable or collateralized support into simple grant totals.",
      recordNeeded: "A primary classification record separating grant-value support from loans, guarantees, or other repayable structures.",
      relatedSources: ["S-044", "S-045"]
    },
    {
      id: "A-009",
      slug: "a-009",
      title: "Israel FMF/MOU staging details",
      sections: ["Section 4"],
      status: "Mostly resolved",
      whyItMatters: "Israel aid lines are cleaner than Ukraine's, but stage discipline still matters when distinguishing base MOU commitments from supplemental appropriations and execution status.",
      currentState: "Section 4 confirms the main Israel statutory lines while carrying narrower staging details as a residual verification item.",
      recordNeeded: "A fully staged primary record that ties MOU, supplemental, and execution-state views into one reference chain.",
      relatedSources: ["S-049"]
    },
    {
      id: "A-010",
      slug: "a-010",
      title: "Capture share for Ukraine and Israel military aid",
      sections: ["Section 4", "Section 5"],
      status: "Open",
      whyItMatters: "Gross military-aid figures do not equal value ultimately reaching the foreign recipient because replenishment, U.S. manufacturing, and domestic capture can absorb a large share.",
      currentState: "The publication keeps Total B open for these military cases rather than inventing a capture rate.",
      recordNeeded: "Program-level evidence showing what share of military-aid appropriations and obligations is captured in the United States versus reaching the foreign recipient.",
      relatedSources: ["S-043", "S-047", "S-049", "S-057"]
    },
    {
      id: "A-011",
      slug: "a-011",
      title: "Israel OSP share",
      sections: ["Section 4"],
      status: "Open",
      whyItMatters: "The offshore-procurement share affects how much FMF can be spent in Israel rather than on U.S. defense articles.",
      currentState: "Section 4 uses the published OSP framing but flags the exact current share as an open verification item.",
      recordNeeded: "A current primary record for the exact OSP share and its implementation window.",
      relatedSources: ["S-049"]
    },
    {
      id: "A-012",
      slug: "a-012",
      title: "Israel 2024 supplemental obligated-versus-outlaid status",
      sections: ["Section 4"],
      status: "Open",
      whyItMatters: "Appropriation alone does not show execution stage, and the 2024 supplemental should not be narrated as outlaid if only obligated or appropriated.",
      currentState: "The publication keeps the stage distinction explicit and records the unresolved execution-state detail as an open item.",
      recordNeeded: "Primary execution reporting showing whether the relevant supplemental amount is appropriated, obligated, or outlaid.",
      relatedSources: ["S-045", "S-049"]
    },
    {
      id: "A-013",
      slug: "a-013",
      title: "DoD execution-level annual figures for Section 333, CTEF, and ASFF",
      sections: ["Section 5"],
      status: "Open",
      whyItMatters: "The recurring military lane is built from annual programs, so execution-level figures matter for staying on the right basis and year.",
      currentState: "Section 5 carries approximate recurring figures while noting that exact current-year execution detail is still incomplete.",
      recordNeeded: "Primary DoD execution-level annual figures for Section 333, CTEF, and related annual security-cooperation programs.",
      relatedSources: ["S-055", "S-058", "S-059"]
    },
    {
      id: "A-014",
      slug: "a-014",
      title: "EDA marginal taxpayer cost versus acquisition value",
      sections: ["Section 5"],
      status: "Open",
      whyItMatters: "Excess Defense Articles can be described by acquisition value or marginal taxpayer cost, and the distinction affects whether any figure belongs in a transfer total.",
      currentState: "The publication leaves EDA as a marginal or pending item instead of forcing a misleading value into the annual military lane.",
      recordNeeded: "A primary cost treatment record showing the marginal taxpayer cost basis for EDA transfers.",
      relatedSources: ["S-050"]
    },
    {
      id: "A-015",
      slug: "a-015",
      title: "WRSA transferred value versus retained U.S.-owned stock",
      sections: ["Section 5"],
      status: "Open",
      whyItMatters: "War Reserve Stockpiles for Allies can blur the line between transferred value and still-U.S.-owned stock, which affects whether a taxpayer transfer has actually occurred.",
      currentState: "Section 5 leaves WRSA out of the adopted subtotal until a defensible transfer-value basis is available.",
      recordNeeded: "A primary record separating transferred WRSA value from stock that remains U.S.-owned or merely positioned.",
      relatedSources: ["S-050"]
    },
    {
      id: "A-016",
      slug: "a-016",
      title: "SDAF revolving treatment",
      sections: ["Section 5"],
      status: "Resolved",
      whyItMatters: "The Special Defense Acquisition Fund could look like an added military-aid pool if its revolving nature is ignored.",
      currentState: "Appendix A marks this resolved: SDAF is revolving, nets to approximately $0 in the audit frame, and is excluded from adopted totals.",
      recordNeeded: "No further record needed for v1.0; carried as resolved in the register.",
      relatedSources: []
    },
    {
      id: "A-017",
      slug: "a-017",
      title: "Cross-section harmonization between foreign-assistance and military-aid lanes",
      sections: ["Section 5"],
      status: "Resolved into lanes",
      whyItMatters: "Section 3 uses single-year obligations while Section 5 uses cumulative multi-year military lanes, so a blended headline would overstate precision.",
      currentState: "Appendix A marks this resolved into lanes: the platform preserves basis-segregated subtotals instead of forcing a synthetic grand total.",
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
      id: "A-019",
      slug: "a-019",
      title: "ORR entrant-versus-provider split",
      sections: ["Section 6"],
      status: "Open",
      whyItMatters: "A large share of ORR funds flows to states, voluntary agencies, and shelter operators rather than directly as cash to entrants.",
      currentState: "Section 6 states that the entrant-versus-provider split is unpublished and therefore leaves Total B materially below but not measurable from the public record.",
      recordNeeded: "Program-level public reporting that separates entrant-directed value from provider, operator, and administrative capture.",
      relatedSources: ["S-060", "S-061", "S-063"]
    },
    {
      id: "A-020",
      slug: "a-020",
      title: "UC in-scope versus custodial share",
      sections: ["Section 6"],
      status: "Open",
      whyItMatters: "The Unaccompanied Children program dominates ORR spending, but its custodial and support components are not cleanly partitioned for this audit's beneficiary logic.",
      currentState: "Section 6 carries UC's dominance openly while leaving the in-scope beneficiary split unresolved.",
      recordNeeded: "A public breakout distinguishing the UC share that should count as entrant-directed support from custodial or operator-heavy expenditures.",
      relatedSources: ["S-060", "S-070"]
    },
    {
      id: "A-021",
      slug: "a-021",
      title: "Afghan and Ukrainian parolee supplemental amounts",
      sections: ["Section 6"],
      status: "Open",
      whyItMatters: "Supplemental entrant populations can change ORR composition materially, but the public record does not fully isolate the amounts attributable to those parolee cohorts.",
      currentState: "Section 6 keeps the parolee supplements visible as a data-gap item rather than allocating them heuristically.",
      recordNeeded: "Public ORR reporting that isolates Afghan and Ukrainian parolee supplemental amounts on the same basis as the main ORR lane.",
      relatedSources: ["S-061", "S-071"]
    },
    {
      id: "A-022",
      slug: "a-022",
      title: "CMS-64 emergency Medicaid federal share by year",
      sections: ["Section 7"],
      status: "Open (carried; corroborated by MACPAC/CBO)",
      whyItMatters: "The publication has a published emergency Medicaid total, but the federal-only share by year is needed for a cleaner federal total.",
      currentState: "The item is carried in the register with MACPAC and CBO corroboration but without the federal-only annual breakout.",
      recordNeeded: "A year-specific CMS-64-based federal-share breakout for emergency Medicaid.",
      relatedSources: ["S-065", "S-078"]
    },
    {
      id: "A-023",
      slug: "a-023",
      title: "Eligible-immigrant Medicaid outlay",
      sections: ["Section 7"],
      status: "Open -> Section 13",
      whyItMatters: "Eligible-immigrant Medicaid spending may be material, but the public record does not publish a clean status-based outlay line for that population.",
      currentState: "Section 7 routes this gap to Section 13 rather than fabricating a status-based Medicaid figure.",
      recordNeeded: "A published eligible-immigrant Medicaid outlay series on a federal basis.",
      relatedSources: ["S-065"]
    },
    {
      id: "A-024",
      slug: "a-024",
      title: "Reconcile House Budget and CBO figures versus KFF $3.8B",
      sections: ["Section 7"],
      status: "Reconciled",
      whyItMatters: "Large emergency Medicaid figures from different sources can look contradictory unless their time windows are made explicit.",
      currentState: "Appendix A marks this reconciled: the figures rest on the same dataset family but different time windows, as shown in Table 14-H.",
      recordNeeded: "No additional v1.0 record is needed beyond the time-window explanation already carried in the publication.",
      relatedSources: ["S-064", "S-078", "S-079"]
    },
    {
      id: "A-025",
      slug: "a-025",
      title: "SNAP noncitizen participant share and benefit attribution",
      sections: ["Section 8"],
      status: "Open -> Section 13",
      whyItMatters: "Participant composition is published, but a benefit-dollar breakout net of citizen children is not, and multiplying the participation share by the total would be prohibited modeling.",
      currentState: "Section 8 publishes the participation mix and explicitly routes the missing dollar attribution to Section 13.",
      recordNeeded: "A published SNAP spending breakout isolating noncitizen-attributable benefits net of citizen-child portions.",
      relatedSources: ["S-074"]
    },
    {
      id: "A-026",
      slug: "a-026",
      title: "WIC and school-meals status-neutrality",
      sections: ["Section 8"],
      status: "Open -> Section 13",
      whyItMatters: "Programs without status conditions may be legally or operationally unable to generate a noncitizen-specific spending line.",
      currentState: "The publication treats these programs as unresolved Section 13 gaps rather than inferring a noncitizen share.",
      recordNeeded: "A lawful published record showing whether any status-based breakout exists for these status-neutral nutrition programs.",
      relatedSources: []
    },
    {
      id: "A-027",
      slug: "a-027",
      title: "TANF eligible-noncitizen share net of ORR",
      sections: ["Section 9"],
      status: "Open -> Section 13",
      whyItMatters: "TANF is heavily citizen-child-dominated and can overlap with ORR-routed assistance, so the noncitizen share cannot be cleanly derived from published totals.",
      currentState: "Section 9 fences ORR-routed support back to Section 6 and sends the unresolved TANF share question to Section 13.",
      recordNeeded: "A published TANF breakout for eligible noncitizen benefits net of ORR-routed assistance.",
      relatedSources: ["S-075"]
    },
    {
      id: "A-028",
      slug: "a-028",
      title: "SSI point-in-time basis versus annual flow basis",
      sections: ["Section 1", "Section 9"],
      status: "Open (figure carried at Medium, Dec-2021 basis)",
      whyItMatters: "The SSI figure is computed from a published December 2021 basis, which is strong for that point in time but not a full annual transactional ledger.",
      currentState: "Section 9 keeps the figure labeled on its Dec. 2021 basis and avoids overstating it as a harmonized annual program total.",
      recordNeeded: "A published annual SSI spending breakout for noncitizen recipients or a fully reconciled monthly series.",
      relatedSources: ["S-072", "S-073"]
    },
    {
      id: "A-029",
      slug: "a-029",
      title: "ACTC/CTC via ITIN and citizen-child share",
      sections: ["Section 9"],
      status: "Open -> Section 13",
      whyItMatters: "Tax-credit flows can involve ITIN filers and citizen children, which makes noncitizen-specific attribution impossible without a published IRS breakout.",
      currentState: "Section 9 names the gap and routes it to Section 13 instead of deriving a figure from mixed-status tax filing patterns.",
      recordNeeded: "An IRS-published breakout isolating ACTC or CTC amounts attributable to the noncitizen population without citizen-child overlap.",
      relatedSources: []
    },
    {
      id: "A-030",
      slug: "a-030",
      title: "HUD eligible-noncitizen prorated outlay",
      sections: ["Section 10"],
      status: "Open -> Section 13",
      whyItMatters: "Housing assistance is already screened for ineligible members, but a clean eligible-noncitizen spending line is still not published.",
      currentState: "Section 10 documents the structural rules and closest figure, then routes the missing noncitizen-specific outlay to Section 13.",
      recordNeeded: "A HUD-published outlay breakout for eligible noncitizen housing assistance after proration and citizen-member separation.",
      relatedSources: ["S-067", "S-068", "S-077"]
    },
    {
      id: "A-031",
      slug: "a-031",
      title: "No-verification grant housing programs",
      sections: ["Section 10"],
      status: "Open -> Section 13",
      whyItMatters: "Grant-funded housing programs that do not verify immigration status cannot easily produce a status-based spending breakout.",
      currentState: "Section 10 marks these programs as unresolved rather than assigning them a modeled share.",
      recordNeeded: "A published program-level record showing whether any status breakout exists inside no-verification housing grants.",
      relatedSources: ["S-067", "S-068"]
    },
    {
      id: "A-032",
      slug: "a-032",
      title: "Federal K-12 noncitizen spending",
      sections: ["Section 11"],
      status: "Open -> Section 13 (legally uncollectable, Plyler)",
      whyItMatters: "K-12 schooling is constitutionally status-blind, so the public record may not be able to produce a status-based federal spending line at all.",
      currentState: "Section 11 treats this as a legal collection limit rather than a simple missing dataset.",
      recordNeeded: "No ordinary status-based spending dataset is expected; any lawful resolution would need to respect Plyler's status-collection limits.",
      relatedSources: ["S-069"]
    },
    {
      id: "A-033",
      slug: "a-033",
      title: "Eligible-noncitizen federal student aid",
      sections: ["Section 11"],
      status: "Open -> Section 13",
      whyItMatters: "Undocumented students are barred from federal aid, but eligible-noncitizen aid is still not published as a separate spending line.",
      currentState: "Section 11 names the eligibility boundary clearly and routes the missing eligible-noncitizen spending breakout to Section 13.",
      recordNeeded: "A Department of Education breakout isolating federal student-aid amounts for eligible noncitizens.",
      relatedSources: ["S-069"]
    },
    {
      id: "A-034",
      slug: "a-034",
      title: "CCDF, SSBG, CSBG, and LIHEAP no-breakout",
      sections: ["Section 12", "Section 13"],
      status: "Open -> Section 13",
      whyItMatters: "State-administered federal streams can lose citizenship detail in the federal-state-local chain, preventing a clean noncitizen spending breakout.",
      currentState: "Section 12 documents the reconciliation role and routes these no-breakout programs into the Section 13 gap register.",
      recordNeeded: "Published program breakouts showing whether any of these state-administered federal streams isolate status-level spending.",
      relatedSources: []
    },
    {
      id: "A-035",
      slug: "a-035",
      title: "Per-program responsible agency for missing status data",
      sections: ["Section 13"],
      status: "Open -> Section 13",
      whyItMatters: "Readers need to know which agency would have to publish a missing status-based breakout before a gap can ever be resolved.",
      currentState: "Section 13 frames this as part of the gap register rather than pretending every missing line has the same administrative owner.",
      recordNeeded: "A program-by-program ownership map tying each missing breakout to the responsible federal reporting agency.",
      relatedSources: []
    },
    {
      id: "A-036",
      slug: "a-036",
      title: "Whether Class C or D modeled estimates exist as bounded context only",
      sections: ["Section 13"],
      status: "Open",
      whyItMatters: "Modeled or secondary estimates may exist for some gaps, but using them as adopted totals would violate the audit's evidence hierarchy unless they are clearly bounded as context only.",
      currentState: "Section 13 leaves this open instead of backfilling opaque programs with secondary modeled estimates.",
      recordNeeded: "A bounded inventory of Class C or D estimates that can be published as context without replacing missing primary evidence.",
      relatedSources: ["S-076"]
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

function unique(values) {
  return [...new Set(values)];
}

const sourceMetadataById = {
  "S-001": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Issue brief",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "Automated verification of the exact Congress.gov CRS product page was blocked during this pass, so no canonical URL is published yet."
  },
  "S-002": {
    officialUrl:
      "https://uscode.house.gov/view.xhtml?req=%28title%3A8+section%3A1641+edition%3Aprelim%29",
    archiveUrl: null,
    publisher: "Office of the Law Revision Counsel, U.S. House of Representatives",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Statute",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official U.S. Code site."
  },
  "S-003": {
    officialUrl:
      "https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title8-section1611",
    archiveUrl: null,
    publisher: "Office of the Law Revision Counsel, U.S. House of Representatives",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Statute",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official U.S. Code site."
  },
  "S-004": {
    officialUrl: "https://uscode.house.gov/quicksearch/get.plx?section=1613&title=8",
    archiveUrl: null,
    publisher: "Office of the Law Revision Counsel, U.S. House of Representatives",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Statute",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official U.S. Code site."
  },
  "S-005": {
    officialUrl: "https://www.gao.gov/products/gao-05-734sp",
    archiveUrl: "https://www.gao.gov/assets/gao-05-734sp.pdf",
    publisher: "U.S. Government Accountability Office",
    publicationDate: "2005-09-01",
    retrievalDate: "2026-07-01",
    documentType: "Glossary",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the GAO product page."
  },
  "S-006": {
    officialUrl: "https://www.cbo.gov/publication/57660",
    archiveUrl: null,
    publisher: "Congressional Budget Office",
    publicationDate: "2021-12-09",
    retrievalDate: "2026-07-01",
    documentType: "Glossary",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official CBO publication page."
  },
  "S-038": {
    officialUrl: "https://foreignassistance.gov/data",
    archiveUrl: "https://foreignassistance.gov/",
    publisher: "U.S. Department of State / USAID / reporting agencies",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Dataset landing page",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official ForeignAssistance.gov data portal."
  },
  "S-039": {
    officialUrl: "https://www.pewresearch.org/short-reads/2024/05/08/the-us-spends-billions-on-foreign-aid-each-year/",
    archiveUrl: null,
    publisher: "Pew Research Center",
    publicationDate: "2024-05-08",
    retrievalDate: "2026-07-01",
    documentType: "Research summary",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "A Pew foreign-aid explainer is the likely canonical reference, but the exact article used in the audit needs line-by-line confirmation before it is treated as verified."
  },
  "S-040": {
    officialUrl: "https://usafacts.org/articles/how-much-does-the-us-give-in-foreign-aid/",
    archiveUrl: null,
    publisher: "USAFacts",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Data explainer",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "USAFacts foreign-aid reporting was identified, but the exact article and edition used in the audit still need canonical verification."
  },
  "S-042": {
    officialUrl:
      "https://www.state.gov/wp-content/uploads/2024/03/Supplementary-Tables-Foreign-Assistance.pdf",
    archiveUrl:
      "https://2021-2025.state.gov/wp-content/uploads/2024/04/Supplementary-Tables-Foreign-Assistance.pdf",
    publisher: "U.S. Department of State",
    publicationDate: "2024-03-01",
    retrievalDate: "2026-07-01",
    documentType: "Budget tables PDF",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the State Department PDF path."
  },
  "S-043": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Issue brief",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The exact official CRS product page could not be confirmed automatically because Congress.gov blocked verification requests during this pass."
  },
  "S-044": {
    officialUrl: "https://www.ukraineoversight.gov/Funding/",
    archiveUrl: "https://www.gao.gov/ukraine-oversight",
    publisher: "UkraineOversight.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Oversight portal",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official oversight portal."
  },
  "S-045": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "U.S. Department of State",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Agency reporting",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "Official State reporting pages for both Ukraine and Israel were located, but the exact canonical page used by this source record remains ambiguous."
  },
  "S-046": {
    officialUrl: "https://www.gao.gov/products/gao-24-106934",
    archiveUrl: "https://www.gao.gov/assets/gao-24-106934.pdf",
    publisher: "U.S. Government Accountability Office",
    publicationDate: "2024-07-22",
    retrievalDate: "2026-07-01",
    documentType: "Oversight report",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the GAO product page."
  },
  "S-047": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Center for Economic and Policy Research",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Contextual analysis",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The exact CEPR article used as contrary context has not been verified in this pass."
  },
  "S-048": {
    officialUrl: "https://www.cfr.org/article/how-much-us-aid-going-ukraine",
    archiveUrl: null,
    publisher: "Council on Foreign Relations",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Tracker / explainer",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the CFR article page."
  },
  "S-049": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Report",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The CRS report number is known, but automated verification of the official Congress.gov product page was blocked."
  },
  "S-050": {
    officialUrl: "https://samm.dsca.mil/",
    archiveUrl: null,
    publisher: "Defense Security Cooperation Agency",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Program manual",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official DSCA SAMM site."
  },
  "S-051": {
    officialUrl: "https://www.state.gov/reports/foreign-military-training-and-dod-engagement-activities-of-interest-2022-2023",
    archiveUrl: "https://www.state.gov/wp-content/uploads/2025/03/01-Front-Sections.pdf",
    publisher: "U.S. Department of State / U.S. Department of Defense",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Joint report",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the State Department report landing page."
  },
  "S-052": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Issue brief",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The CRS identifier is known, but the exact official product page could not be verified automatically."
  },
  "S-053": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Insight",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The CRS identifier is known, but the exact official product page could not be verified automatically."
  },
  "S-054": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Report",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The CRS identifier is known, but the exact official product page could not be verified automatically."
  },
  "S-055": {
    officialUrl: "https://www.gao.gov/products/gao-23-105842",
    archiveUrl: "https://www.gao.gov/assets/gao-23-105842.pdf",
    publisher: "U.S. Government Accountability Office",
    publicationDate: "2023-08-29",
    retrievalDate: "2026-07-01",
    documentType: "Oversight report",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the GAO product page."
  },
  "S-056": {
    officialUrl: "https://www.gao.gov/products/gao-24-107232",
    archiveUrl: "https://www.gao.gov/assets/870/869711.pdf",
    publisher: "U.S. Government Accountability Office",
    publicationDate: "2024-05-30",
    retrievalDate: "2026-07-01",
    documentType: "Oversight report",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the GAO product page."
  },
  "S-057": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "U.S. Department of Defense / Defense Security Cooperation Agency",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Infographic",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "A DoD/DSCA infographic was used for lane separation context, but the exact canonical file has not yet been verified."
  },
  "S-058": {
    officialUrl:
      "https://comptroller.defense.gov/Portals/45/Documents/defbudget/FY2026/FY2026_CTEF_J-Book.pdf",
    archiveUrl: null,
    publisher: "Office of the Under Secretary of Defense (Comptroller)",
    publicationDate: "2025-01-01",
    retrievalDate: "2026-07-01",
    documentType: "Budget justification PDF",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official DoD Comptroller budget document path."
  },
  "S-059": {
    officialUrl:
      "https://uscode.house.gov/view.xhtml?req=%28title%3A10+section%3A333+edition%3Aprelim%29",
    archiveUrl: null,
    publisher: "Office of the Law Revision Counsel, U.S. House of Representatives",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Statute",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official U.S. Code site."
  },
  "S-060": {
    officialUrl: "https://www.acf.hhs.gov/orr/programs/refugees",
    archiveUrl: null,
    publisher: "Administration for Children and Families, Office of Refugee Resettlement",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Program documentation",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official ORR refugee program page."
  },
  "S-061": {
    officialUrl: "https://www.acf.hhs.gov/orr/programs/refugees/cma",
    archiveUrl: null,
    publisher: "Administration for Children and Families, Office of Refugee Resettlement",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Program documentation",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official ORR Cash and Medical Assistance page."
  },
  "S-062": {
    officialUrl: "https://www.usaspending.gov/account/075-1503",
    archiveUrl: null,
    publisher: "USAspending.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Federal spending account page",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official USAspending account record."
  },
  "S-063": {
    officialUrl: "https://www.acf.hhs.gov/orr/fact-sheet/refugee-benefits",
    archiveUrl: null,
    publisher: "Administration for Children and Families, Office of Refugee Resettlement",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Fact sheet",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official ORR benefits fact sheet."
  },
  "S-064": {
    officialUrl:
      "https://www.kff.org/quick-insights/less-than-1-of-total-medicaid-spending-goes-to-emergency-care-for-noncitizen-immigrants/",
    archiveUrl: null,
    publisher: "KFF",
    publicationDate: "2024-10-24",
    retrievalDate: "2026-07-01",
    documentType: "Quick take",
    classification: "Secondary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the KFF publication page."
  },
  "S-065": {
    officialUrl: "https://www.cms.gov/newsroom/press-releases/cms-increasing-oversight-states-illegally-using-federal-medicaid-funding-health-care-illegal",
    archiveUrl: null,
    publisher: "Centers for Medicare & Medicaid Services",
    publicationDate: "2025-05-27",
    retrievalDate: "2026-07-01",
    documentType: "Federal administrative guidance / press release",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote:
      "This official CMS page is a verified anchor for the emergency-services rule set, but the exact CMS-64 or MACPAC breakout used in future editions still needs a tighter canonical citation."
  },
  "S-067": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Report",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The CRS report number is known, but the exact official Congress.gov product page was not machine-verifiable during this pass."
  },
  "S-068": {
    officialUrl:
      "https://www.hud.gov/sites/dfiles/PIH/documents/PHA-Letter-on-Citizenship-and-Immigration-Status-Verification.pdf",
    archiveUrl:
      "https://www.hud.gov/sites/dfiles/PIH/documents/PHOG_Eligibility_Det_Denial_Assistance.pdf",
    publisher: "U.S. Department of Housing and Urban Development",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Agency guidance PDF",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against official HUD guidance PDFs."
  },
  "S-069": {
    officialUrl:
      "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2025-2026/vol1/ch2-us-citizenship-eligible-noncitizens",
    archiveUrl: null,
    publisher: "U.S. Department of Education Federal Student Aid",
    publicationDate: "2025-01-01",
    retrievalDate: "2026-07-01",
    documentType: "Eligibility guidance",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote:
      "Verified against the official Department of Education eligible-noncitizen guidance; the broader Plyler legal record remains a framework source rather than one canonical page."
  },
  "S-070": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Congressional Research Service via Congress.gov",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Report",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The CRS report number is known, but the exact official Congress.gov product page was not machine-verifiable during this pass."
  },
  "S-071": {
    officialUrl: "https://www.acf.hhs.gov/orr",
    archiveUrl: null,
    publisher: "Administration for Children and Families, Office of Refugee Resettlement",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Program documentation",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote:
      "Mapped to the official ORR portal pending narrower identification of the exact support-material page."
  },
  "S-072": {
    officialUrl: "https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2023/index.html",
    archiveUrl: "https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2023/ssi_asr23.pdf",
    publisher: "Social Security Administration",
    publicationDate: "2023-01-01",
    retrievalDate: "2026-07-01",
    documentType: "Annual statistical report",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official SSA statistical compilation."
  },
  "S-073": {
    officialUrl: "https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2021/sect05.html",
    archiveUrl: null,
    publisher: "Social Security Administration",
    publicationDate: "2021-01-01",
    retrievalDate: "2026-07-01",
    documentType: "Statistical report section",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official SSA statistical report section."
  },
  "S-074": {
    officialUrl: "https://www.fns.usda.gov/research/snap/community-characteristics",
    archiveUrl: null,
    publisher: "USDA Food and Nutrition Service",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Research / characteristics page",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote:
      "Verified against the official USDA-FNS characteristics landing page; the exact edition year remains to be pinned more tightly if future line-level citations require it."
  },
  "S-075": {
    officialUrl:
      "https://www.acf.hhs.gov/ofa/data/characteristics-and-financial-circumstances-tanf-recipients-fiscal-year-2021",
    archiveUrl: "https://www.acf.hhs.gov/ofa/programs/temporary-assistance-needy-families-tanf",
    publisher: "Administration for Children and Families",
    publicationDate: "2024-08-30",
    retrievalDate: "2026-07-01",
    documentType: "Administrative data report",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official ACF data report."
  },
  "S-076": {
    officialUrl: null,
    archiveUrl: null,
    publisher: "Cato Institute",
    publicationDate: null,
    retrievalDate: "2026-07-01",
    documentType: "Modeled analysis",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "pending",
    urlVerificationNote:
      "The exact Cato modeling piece used as contextual evidence was not verified in this pass."
  },
  "S-077": {
    officialUrl: "https://www.hud.gov/news/hud-no-26-008",
    archiveUrl: null,
    publisher: "U.S. Department of Housing and Urban Development",
    publicationDate: "2026-01-27",
    retrievalDate: "2026-07-01",
    documentType: "Agency reporting",
    classification: "Primary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote:
      "Verified against official HUD reporting on citizenship-status verification and ineligible-tenant enforcement."
  },
  "S-078": {
    officialUrl: "https://www.cbo.gov/publication/60805",
    archiveUrl: null,
    publisher: "Congressional Budget Office",
    publicationDate: "2025-01-17",
    retrievalDate: "2026-07-01",
    documentType: "Cost estimate / analysis",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official CBO publication page."
  },
  "S-079": {
    officialUrl:
      "https://budget.house.gov/press-release/cbo-medicaid-spending-on-illegal-aliens-has-cost-taxpayers-over-162-billion-under-open-border-czar-harris",
    archiveUrl: "https://budget.house.gov/download/cbo-on-medicaid-for-illegal-immigrants",
    publisher: "U.S. House Budget Committee",
    publicationDate: "2025-01-17",
    retrievalDate: "2026-07-01",
    documentType: "Congressional press / memo",
    classification: "Secondary",
    citationPriority: "standard",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official House Budget Committee page."
  },
  "S-080": {
    officialUrl: "https://www.cbo.gov/publication/60569",
    archiveUrl: null,
    publisher: "Congressional Budget Office",
    publicationDate: "2024-06-18",
    retrievalDate: "2026-07-01",
    documentType: "Projection",
    classification: "Primary",
    citationPriority: "high",
    urlVerificationStatus: "verified",
    urlVerificationNote: "Verified against the official CBO publication page."
  }
};

publication.sources = publication.sources.map((source) => {
  const metadata = sourceMetadataById[source.id] || {};
  return {
    ...source,
    publisher: metadata.publisher || source.agency,
    officialUrl: Object.prototype.hasOwnProperty.call(metadata, "officialUrl")
      ? metadata.officialUrl
      : null,
    archiveUrl: Object.prototype.hasOwnProperty.call(metadata, "archiveUrl")
      ? metadata.archiveUrl
      : null,
    publicationDate: Object.prototype.hasOwnProperty.call(metadata, "publicationDate")
      ? metadata.publicationDate
      : null,
    retrievalDate: Object.prototype.hasOwnProperty.call(metadata, "retrievalDate")
      ? metadata.retrievalDate
      : null,
    documentType: metadata.documentType || source.type,
    classification:
      metadata.classification ||
      (source.evidenceClass.toLowerCase().includes("primary") ? "Primary" : "Secondary"),
    citationPriority: metadata.citationPriority || "standard",
    urlVerificationStatus: metadata.urlVerificationStatus || "pending",
    urlVerificationNote: metadata.urlVerificationNote
      ? metadata.urlVerificationStatus === "pending" &&
        !metadata.urlVerificationNote.toLowerCase().includes("pending")
        ? `URL verification pending because ${metadata.urlVerificationNote.charAt(0).toLowerCase()}${metadata.urlVerificationNote.slice(1)}`
        : metadata.urlVerificationNote
      : "URL verification pending because no canonical source URL has been verified yet."
  };
});

const sectionCatalog = [
  {
    id: "Section 1",
    title: "Executive Summary",
    url: "/audit/section-01-executive-summary.html",
    summary: "Basis-segregated summary of measurable lanes and permanent limitations."
  },
  {
    id: "Section 2",
    title: "Definitions and Methodology",
    url: "/audit/section-02-definitions-methodology.html",
    summary: "Primary legal and accounting definitions that bind the rest of the publication."
  },
  {
    id: "Section 3",
    title: "International Assistance",
    url: "/audit/section-03-international-assistance.html",
    summary: "Aggregate foreign-assistance obligations and disbursements with unresolved capture share."
  },
  {
    id: "Section 4",
    title: "Ukraine and Israel Examples",
    url: "/audit/section-04-ukraine-israel-examples.html",
    summary: "Illustrative, non-additive examples showing stage differences and beneficiary-chain complexity."
  },
  {
    id: "Section 5",
    title: "Military Aid",
    url: "/audit/section-05-military-aid.html",
    summary: "Net-new military lanes separated from already-counted foreign assistance and non-taxpayer flows."
  },
  {
    id: "Section 6",
    title: "Refugee Resettlement",
    url: "/audit/section-06-refugee-resettlement.html",
    summary: "Domestic refugee and entrant assistance with unresolved provider-capture and beneficiary-split limits."
  },
  {
    id: "Section 7",
    title: "Medicaid / Emergency Medical",
    url: "/audit/section-07-medicaid-emergency-medical.html",
    summary: "Emergency-medical assistance lane with an explicit federal-only share gap."
  },
  {
    id: "Section 8",
    title: "Food Assistance",
    url: "/audit/section-08-food-assistance.html",
    summary: "Eligibility structure and limits of SNAP attribution without unsupported noncitizen dollar estimates."
  },
  {
    id: "Section 9",
    title: "Cash Welfare / Income",
    url: "/audit/section-09-cash-welfare-income.html",
    summary: "SSI and welfare lanes where direct-cash structure is more measurable than many domestic programs."
  },
  {
    id: "Section 10",
    title: "Federal Housing",
    url: "/audit/section-10-federal-housing.html",
    summary: "Housing eligibility and proration mechanics without a published status-specific outlay ledger."
  },
  {
    id: "Section 11",
    title: "Education / Public Services",
    url: "/audit/section-11-education-public-services.html",
    summary: "Legal and eligibility structure for K-12 and student-aid analysis where status spending is not cleanly published."
  },
  {
    id: "Section 12",
    title: "State-Administered Federal Dollars",
    url: "/audit/section-12-state-administered-federal-dollars.html",
    summary: "A reconciliation lens for routed federal dollars, not a net-new spending subtotal."
  },
  {
    id: "Section 13",
    title: "Programs Without Citizenship Breakouts",
    url: "/audit/section-13-programs-without-citizenship-breakouts.html",
    summary: "Gap register for programs where the public record does not support a defensible status-based spending figure."
  },
  {
    id: "Section 14",
    title: "Conservative Total",
    url: "/audit/section-14-conservative-total.html",
    summary: "A reproducible set of basis-segregated subtotals rather than one blended grand total."
  },
  {
    id: "Section 15",
    title: "What Is Missing",
    url: "/audit/section-15-what-is-missing.html",
    summary: "Publication-wide limitations register preserving unresolved evidence constraints."
  },
  {
    id: "Section 16",
    title: "Final Argument",
    url: "/audit/section-16-final-argument.html",
    summary: "Closing synthesis bounded by the same evidence and basis-separation rules as the rest of Version 1.0."
  }
];

const relatedSectionsById = {
  "Section 1": ["Section 3", "Section 5", "Section 7", "Section 9", "Section 14"],
  "Section 2": ["Section 1", "Section 3", "Section 5", "Section 8", "Section 9"],
  "Section 3": ["Section 1", "Section 4", "Section 5", "Section 6", "Section 14"],
  "Section 4": ["Section 3", "Section 5", "Section 14"],
  "Section 5": ["Section 1", "Section 3", "Section 4", "Section 14"],
  "Section 6": ["Section 1", "Section 3", "Section 12", "Section 14"],
  "Section 7": ["Section 1", "Section 13", "Section 14", "Section 16"],
  "Section 8": ["Section 2", "Section 13", "Section 16"],
  "Section 9": ["Section 1", "Section 2", "Section 14", "Section 16"],
  "Section 10": ["Section 11", "Section 13"],
  "Section 11": ["Section 10", "Section 13"],
  "Section 12": ["Section 6", "Section 13", "Section 14"],
  "Section 13": ["Section 7", "Section 8", "Section 10", "Section 11", "Section 12", "Section 15"],
  "Section 14": ["Section 1", "Section 3", "Section 5", "Section 15", "Section 16"],
  "Section 15": ["Section 13", "Section 14", "Section 16"],
  "Section 16": ["Section 14", "Section 15"]
};

publication.sectionRecords = sectionCatalog.map((section) => ({
  ...section,
  sources: unique(publication.sources.filter((source) => source.sections.includes(section.id)).map((source) => source.id)),
  decisions: unique(
    publication.decisions.filter((decision) => decision.references.includes(section.id)).map((decision) => decision.id)
  ),
  openQuestions: unique(
    publication.openQuestions.filter((question) => question.sections.includes(section.id)).map((question) => question.id)
  ),
  relatedSections: relatedSectionsById[section.id] || []
}));

publication.traceClaims = [
  {
    id: "C-001",
    title: "Executive summary keeps measurable lanes on their native bases",
    summary: "The opening section preserves lane separation instead of collapsing obligations, outlays, cumulative military lines, and domestic program examples into one number.",
    section: "Section 1",
    sources: ["S-038", "S-039", "S-040", "S-073"],
    decisions: ["D-001", "D-020"],
    openQuestions: ["A-005", "A-018", "A-028", "A-037"]
  },
  {
    id: "C-002",
    title: "Methodology distinguishes legal status categories and number types",
    summary: "Qualified status categories, waiting-period rules, appropriations, obligations, outlays, and transfer values are treated as distinct analytical objects.",
    section: "Section 2",
    sources: ["S-002", "S-003", "S-004", "S-005", "S-006"],
    decisions: ["D-001", "D-005", "D-012"],
    openQuestions: ["A-002"]
  },
  {
    id: "C-003",
    title: "International assistance obligations and disbursements are not interchangeable",
    summary: "Section 3 preserves separate accounting states while carrying the unresolved beneficiary-capture share as an open question.",
    section: "Section 3",
    sources: ["S-001", "S-038", "S-039", "S-040", "S-042", "S-043"],
    decisions: ["D-013", "D-014", "D-017"],
    openQuestions: ["A-001", "A-003", "A-004", "A-005"]
  },
  {
    id: "C-004",
    title: "Ukraine and Israel examples are illustrative and non-additive",
    summary: "Section 4 exists to show stage differences and beneficiary chains without adding its examples back into the running totals.",
    section: "Section 4",
    sources: ["S-043", "S-044", "S-045", "S-046", "S-049"],
    decisions: ["D-017", "D-018", "D-019"],
    openQuestions: ["A-006", "A-010", "A-011", "A-012"]
  },
  {
    id: "C-005",
    title: "Ukraine stage labels cannot be netted casually",
    summary: "Appropriations, drawdowns, disbursements, and delivered-value estimates sit at different stages and remain analytically separate.",
    section: "Section 4",
    sources: ["S-044", "S-046", "S-047", "S-048"],
    decisions: ["D-017", "D-018"],
    openQuestions: ["A-006", "A-007", "A-008"]
  },
  {
    id: "C-006",
    title: "Military aid keeps net-new lanes separate from already-counted foreign assistance",
    summary: "Section 5 excludes allied-funded sales and already-counted assistance while preserving drawdown value versus replacement-cost separation.",
    section: "Section 5",
    sources: ["S-043", "S-050", "S-051", "S-052", "S-053", "S-054", "S-055", "S-056", "S-057", "S-058", "S-059"],
    decisions: ["D-012", "D-017", "D-019", "D-020"],
    openQuestions: ["A-013", "A-014", "A-015", "A-016", "A-017"]
  },
  {
    id: "C-007",
    title: "ORR is owned as a domestic lane, not an overseas add-on",
    summary: "Refugee and entrant assistance stays in one canonical domestic section so it is not double-counted against foreign-assistance accounts.",
    section: "Section 6",
    sources: ["S-060", "S-062", "S-070"],
    decisions: ["D-013", "D-021"],
    openQuestions: ["A-018", "A-020", "A-021"]
  },
  {
    id: "C-008",
    title: "ORR provider capture remains a first-class unresolved limitation",
    summary: "The public record identifies the ORR lane but does not yet publish a defensible entrant-versus-provider split.",
    section: "Section 6",
    sources: ["S-060", "S-061", "S-063", "S-071"],
    decisions: ["D-021"],
    openQuestions: ["A-018", "A-019", "A-021"]
  },
  {
    id: "C-009",
    title: "Emergency Medicaid is measurable on a federal-plus-state basis, not a federal-only basis",
    summary: "Section 7 preserves the measurable lane while carrying the missing federal-only share as an explicit open question.",
    section: "Section 7",
    sources: ["S-003", "S-064", "S-065", "S-078", "S-079"],
    decisions: ["D-021"],
    openQuestions: ["A-022", "A-023", "A-024", "A-037"]
  },
  {
    id: "C-010",
    title: "SNAP noncitizen dollars are not backfilled with modeled estimates",
    summary: "Section 8 documents the eligibility framework and refuses unsupported benefit attribution by population share.",
    section: "Section 8",
    sources: ["S-003", "S-074"],
    decisions: ["D-021"],
    openQuestions: ["A-025", "A-026"]
  },
  {
    id: "C-011",
    title: "SSI is one of the clearest direct-cash domestic lanes",
    summary: "The current edition relies on SSA-published noncitizen recipient and payment inputs while preserving the point-in-time limitation.",
    section: "Section 9",
    sources: ["S-072", "S-073", "S-075"],
    decisions: ["D-001", "D-021"],
    openQuestions: ["A-027", "A-028", "A-029"]
  },
  {
    id: "C-012",
    title: "Housing eligibility rules already exclude many ineligible uses through Section 214 and proration",
    summary: "Section 10 is strongest on program mechanics, not on a missing published eligible-noncitizen outlay total.",
    section: "Section 10",
    sources: ["S-067", "S-068", "S-077"],
    decisions: ["D-021"],
    openQuestions: ["A-030", "A-031"]
  },
  {
    id: "C-013",
    title: "K-12 and student-aid analysis is constrained by legal collection limits and eligibility structure",
    summary: "Section 11 treats missing education spending ledgers as a real transparency limit rather than something to impute.",
    section: "Section 11",
    sources: ["S-069"],
    decisions: ["D-021"],
    openQuestions: ["A-032", "A-033"]
  },
  {
    id: "C-014",
    title: "State-administered federal dollars add zero net-new dollars by design",
    summary: "Section 12 is a routing and reconciliation lens that guards against double counting once federal money passes through state systems.",
    section: "Section 12",
    sources: ["S-062", "S-065"],
    decisions: ["D-020", "D-021"],
    openQuestions: ["A-034"]
  },
  {
    id: "C-015",
    title: "The gap register is itself a finding, not an empty placeholder",
    summary: "Section 13 names programs where the record does not support a defensible citizenship breakout and refuses to fabricate missing values.",
    section: "Section 13",
    sources: ["S-076"],
    decisions: ["D-021"],
    openQuestions: ["A-023", "A-025", "A-027", "A-030", "A-032", "A-033", "A-034", "A-035", "A-036"]
  },
  {
    id: "C-016",
    title: "The conservative total is a reproducible set of subtotals, not one synthetic number",
    summary: "Section 14 is locked to a blueprint that preserves incompatible bases instead of flattening them into a false grand total.",
    section: "Section 14",
    sources: ["S-038", "S-055", "S-058", "S-064", "S-073"],
    decisions: ["D-014", "D-020", "D-022", "D-023"],
    openQuestions: ["A-017", "A-018", "A-037"]
  },
  {
    id: "C-017",
    title: "Publication limits remain visible and binding",
    summary: "Section 15 preserves missing-record constraints as governance rules for what the audit may claim.",
    section: "Section 15",
    sources: ["S-038", "S-072", "S-078"],
    decisions: ["D-024"],
    openQuestions: ["A-005", "A-018", "A-028", "A-037"]
  },
  {
    id: "C-018",
    title: "The final argument inherits the same basis rules and evidence limits",
    summary: "Section 16 does not create a new theory of the numbers; it restates bounded findings from the locked sections.",
    section: "Section 16",
    sources: ["S-064", "S-073", "S-074"],
    decisions: ["D-020", "D-025"],
    openQuestions: ["A-005", "A-018", "A-028", "A-037"]
  }
].map((claim) => ({
  ...claim,
  sectionRecord: publication.sectionRecords.find((section) => section.id === claim.section)?.url || null
}));

module.exports = publication;
