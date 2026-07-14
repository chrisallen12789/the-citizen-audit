module.exports = {
  title: "APPENDIX B — TRANSPARENCY SCORECARD — Version 1.0 LOCKED (authoritative)",
  introduction: [
    {
      text: "Federal Taxpayer Expenditures Benefiting Non-U.S. Recipients: A Living Forensic Audit",
      emphasis: "strong"
    },
    {
      text: "Repository v1.0 · Owner: Repository Engineering · Constitution Art. 10. Lineage: compiled from approved findings in Section 15 (§15.2), Sections 6–13, and Section 14."
    },
    {
      text: "No new metric created; no missing value inferred.",
      emphasis: "strong"
    },
    {
      text: "Ratings restate the approved transparency findings using the categories already established in Section 15 (most transparent → uncollectable)."
    }
  ],
  categoriesHeading: "B.1 Rating categories (as established in Section 15)",
  categories: [
    {
      label: "Transparent",
      description: "agency publishes status-level data permitting a primary/reproducible figure."
    },
    {
      label: "Partially transparent",
      description: "a published figure exists but is not resolved to the federal-only and/or population-isolated line."
    },
    {
      label: "Opaque by reporting choice",
      description: "data exist internally but are not published by status."
    },
    {
      label: "Opaque by technical limit",
      description: "data systems cannot isolate the population."
    },
    {
      label: "Uncollectable by law/design",
      description: "status is not (or may not be) collected."
    }
  ],
  scorecardHeading: "B.2 Scorecard",
  caption: "Appendix B transparency scorecard",
  columns: [
    { key: "program", label: "Program / domain" },
    { key: "agency", label: "Agency" },
    { key: "published", label: "Status-level spending published?" },
    { key: "category", label: "Category" },
    { key: "treatment", label: "Audit treatment" },
    { key: "oq", label: "OQ" }
  ],
  rows: [
    {
      key: "ssi",
      program: "SSI",
      agency: "SSA",
      published: "Yes (noncitizen counts + average payment)",
      category: "Transparent (benchmark)",
      treatment: "reproducible ≈ no**",
      oq: "Opaque by reporting",
      emphasis: { program: "all", published: "prefix:Yes", category: "all" }
    },
    {
      key: "tanf",
      program: "TANF",
      agency: "HHS-ACF",
      published: "No",
      category: "Opaque by reporting",
      treatment: "→ §13",
      oq: "A-027"
    },
    {
      key: "actc-ctc-itin",
      program: "ACTC/CTC via ITIN",
      agency: "IRS/Treasury",
      published: "No",
      category: "Opaque by reporting",
      treatment: "→ §13",
      oq: "A-029"
    },
    {
      key: "eligible-noncitizen-housing",
      program: "Eligible-noncitizen housing",
      agency: "HUD",
      published: "No (proration; $218M mostly citizen members)",
      category: "Opaque by reporting/methodological",
      treatment: "→ §13",
      oq: "A-030"
    },
    {
      key: "federal-student-aid",
      program: "Federal student aid by status",
      agency: "ED",
      published: "No",
      category: "Opaque by reporting",
      treatment: "→ §13",
      oq: "A-033"
    },
    {
      key: "undocumented-emergency-medicaid",
      program: "Undocumented isolation (emergency Medicaid)",
      agency: "CMS",
      published: "No (T-MSIS lacks indicator)",
      category: "Opaque by technical limit",
      treatment: "→ §13",
      oq: "A-024",
      emphasis: { category: "all" }
    },
    {
      key: "wic-school-meals",
      program: "WIC; School Lunch/Breakfast",
      agency: "USDA-FNS",
      published: "No (no status condition)",
      category: "Uncollectable by design",
      treatment: "→ §13",
      oq: "A-026"
    },
    {
      key: "federal-k12",
      program: "Federal K-12 share",
      agency: "ED",
      published: "No (Plyler — status not collected)",
      category: "Uncollectable by law",
      treatment: "→ §13",
      oq: "A-032",
      emphasis: { category: "all" },
      italics: { published: ["Plyler"] }
    },
    {
      key: "head-start-status-neutral",
      program: "Head Start; CCDF/SSBG/CSBG/LIHEAP",
      agency: "HHS",
      published: "No (status-neutral)",
      category: "Uncollectable by design",
      treatment: "→ §13",
      oq: "A-034"
    },
    {
      key: "fqhc-public-health-fema",
      program: "FQHCs; public health; FEMA",
      agency: "HRSA/CDC/FEMA",
      published: "No (universal/emergency)",
      category: "Uncollectable by design",
      treatment: "→ §13",
      oq: "A-035"
    }
  ],
  netFindingHeading: "B.3 Net finding (restated from Section 15)",
  netFinding: [
    {
      text: "Transparency is highest for the smallest identifiable program (SSI) and lowest for the largest potential exposures",
      emphasis: "strong"
    },
    {
      text: "— the inverse of what a complete forensic accounting would require. No row asserts a hidden dollar amount; each “no” is a documented gap with a named resolving data product (Appendix A; Section 13)."
    }
  ],
  closing: [
    { text: "APPENDIX B — v1.0 LOCKED.", emphasis: "strong" },
    { text: "Compiled from approved findings only; no new metric, no inferred value." }
  ]
};
