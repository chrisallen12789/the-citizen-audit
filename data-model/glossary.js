module.exports = {
  "evidenceClasses": [
    {
      "id": "EVIDENCE-PRIMARY",
      "label": "Primary",
      "description": "Direct legal text, official datasets, agency publications, or oversight records."
    },
    {
      "id": "EVIDENCE-SECONDARY",
      "label": "Secondary",
      "description": "Corroborating analysis, context sources, or explanatory materials that do not replace primary evidence."
    }
  ],
  "confidenceModel": [
    {
      "id": "CONF-STRUCTURED",
      "label": "Structured confidence note",
      "description": "Claims inherit bounded confidence from linked sections and source records."
    }
  ],
  "transparencyScorecard": [
    {
      "area": "International assistance",
      "section": "Section 3",
      "transparency": "High for published aggregate obligations/disbursements; limited for beneficiary capture",
      "measurable": "Aggregate Total A yes; Total B no",
      "limitation": "A-005"
    },
    {
      "area": "Military aid and replacement costs",
      "section": "Section 5",
      "transparency": "Moderate",
      "measurable": "Net-new lanes measurable; cross-section harmonization unresolved",
      "limitation": "A-017"
    },
    {
      "area": "Refugee resettlement",
      "section": "Section 6",
      "transparency": "Low to moderate",
      "measurable": "Program/account visible; entrant-versus-provider split unpublished",
      "limitation": "A-018"
    },
    {
      "area": "Emergency Medicaid",
      "section": "Section 7",
      "transparency": "Moderate",
      "measurable": "Federal-plus-state figure measurable; federal-only share unresolved",
      "limitation": "A-037"
    },
    {
      "area": "Food assistance",
      "section": "Section 8",
      "transparency": "Low for non-citizen dollar breakout",
      "measurable": "Eligibility boundary visible; counted dollar share not isolable",
      "limitation": "Section 13 routing"
    },
    {
      "area": "Cash welfare / SSI",
      "section": "Section 9",
      "transparency": "High on published point-in-time basis",
      "measurable": "Approximate annualized SSI lane measurable",
      "limitation": "A-028"
    }
  ],
  "methodologyTerms": [
    {
      "id": "TERM-TOTAL-A",
      "term": "Total A",
      "definition": "Gross directed resources without netting or beneficiary-capture adjustments."
    },
    {
      "id": "TERM-TOTAL-B",
      "term": "Total B",
      "definition": "Estimated value ultimately reaching the non-U.S. recipient after U.S.-captured share."
    },
    {
      "id": "TERM-BASIS-SEPARATION",
      "term": "Basis separation",
      "definition": "Incompatible obligations, outlays, cumulative totals, and federal-plus-state figures are not collapsed into a single number."
    }
  ]
};
