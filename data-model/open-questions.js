module.exports = [
  {
    "id": "A-001",
    "slug": "a-001",
    "title": "ForeignAssistance.gov live sum and version date",
    "sections": [
      "Section 3"
    ],
    "status": "Open (primary execution)",
    "whyItMatters": "Section 3 relies on published aggregate foreign-assistance reporting, but the live-sum and version-stamp execution path still needs a fully pinned primary extraction record.",
    "currentState": "Appendix A carries this as the primary-execution item behind the international-assistance aggregate.",
    "recordNeeded": "A version-stamped primary extraction from ForeignAssistance.gov showing the live sum and retrieval date used for the locked figure.",
    "relatedSources": [
      "S-038"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 3"
    ],
    "sourceIds": [
      "S-038"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-002",
    "slug": "a-002",
    "title": "GAO budget-glossary edition",
    "sections": [
      "Section 2",
      "Section 3"
    ],
    "status": "Open",
    "whyItMatters": "If a superseding GAO glossary materially changed an adopted accounting definition, the methodology notes would need to carry that custody update explicitly.",
    "currentState": "The audit uses GAO-05-734SP and flags the edition-confirmation question instead of silently assuming there is no later definitional change.",
    "recordNeeded": "Confirmation that no later GAO budget-glossary edition changes the adopted definitions used in the publication.",
    "relatedSources": [
      "S-005",
      "S-006"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 2",
      "Section 3"
    ],
    "sourceIds": [
      "S-005",
      "S-006"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-003",
    "slug": "a-003",
    "title": "Post-2025 USAID-State administering offices",
    "sections": [
      "Section 3"
    ],
    "status": "Open",
    "whyItMatters": "The 2025 realignment creates a continuity problem when later-year international-assistance reporting is compared to prior administrative structures.",
    "currentState": "Section 3 carries the post-2025 office realignment as a reporting discontinuity rather than pretending the series is perfectly continuous.",
    "recordNeeded": "A reconciled post-2025 administrative mapping that ties later reporting offices back to the pre-realignment foreign-assistance series.",
    "relatedSources": [
      "S-040",
      "S-042"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 3"
    ],
    "sourceIds": [
      "S-040",
      "S-042"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-004",
    "slug": "a-004",
    "title": "IMF budget-scoring treatment",
    "sections": [
      "Section 3"
    ],
    "status": "Open",
    "whyItMatters": "International financial institution support can score differently from direct grant aid, so IMF-related treatment affects scope discipline in the international-assistance universe.",
    "currentState": "The publication flags IMF scoring treatment instead of assuming a simple add-or-exclude rule where the budget basis may differ.",
    "recordNeeded": "A primary budget-scoring record clarifying how the relevant IMF support should be treated on the audit's chosen basis.",
    "relatedSources": [],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 3"
    ],
    "sourceIds": [],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-005",
    "slug": "a-005",
    "title": "Unpublished U.S.-capture share in international assistance",
    "sections": [
      "Section 1",
      "Section 3"
    ],
    "status": "Open",
    "whyItMatters": "Without a published capture-share breakout, the site can report gross taxpayer assistance (Total A) but cannot compute a defensible Total B for international assistance.",
    "currentState": "Section 3 states that Total B is materially below Total A, but not measurable from the current public record.",
    "recordNeeded": "Program-level reporting that distinguishes value captured by U.S. entities from value reaching non-U.S. recipients.",
    "relatedSources": [
      "S-038",
      "S-039",
      "S-040"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 1",
      "Section 3"
    ],
    "sourceIds": [
      "S-038",
      "S-039",
      "S-040"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-006",
    "slug": "a-006",
    "title": "Ukraine stage figures from the primary portal",
    "sections": [
      "Section 4"
    ],
    "status": "Mostly resolved",
    "whyItMatters": "Ukraine assistance is often quoted across incompatible stages, so a primary stage-by-stage portal view is necessary to keep appropriation, obligation, disbursement, and delivery claims distinct.",
    "currentState": "Section 4 confirms the structural stage gap but still notes that dynamic portal extraction was not fully captured in the locked artifact path.",
    "recordNeeded": "A stable primary-portal extract that shows Ukraine aid by stage using consistent definitions.",
    "relatedSources": [
      "S-044",
      "S-045"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4"
    ],
    "sourceIds": [
      "S-044",
      "S-045"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-007",
    "slug": "a-007",
    "title": "PDA valuation treatment",
    "sections": [
      "Section 4"
    ],
    "status": "Mostly resolved",
    "whyItMatters": "Presidential Drawdown Authority values can diverge from replacement cost, and valuation ambiguity can create false inflation if the wrong measure is reused elsewhere.",
    "currentState": "The publication treats drawdown value and replacement appropriation separately and carries the valuation problem as a reporting-quality issue.",
    "recordNeeded": "Primary valuation documentation clarifying the exact basis used for PDA transfer values in the compared reporting streams.",
    "relatedSources": [
      "S-046",
      "S-053",
      "S-054"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4"
    ],
    "sourceIds": [
      "S-046",
      "S-053",
      "S-054"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-008",
    "slug": "a-008",
    "title": "Ukraine grant-versus-loan treatment",
    "sections": [
      "Section 4"
    ],
    "status": "Mostly resolved",
    "whyItMatters": "Some Ukraine support is repayable or collateralized, so grant-versus-loan treatment changes what can be treated as direct transferred value.",
    "currentState": "Section 4 flags the issue and avoids flattening repayable or collateralized support into simple grant totals.",
    "recordNeeded": "A primary classification record separating grant-value support from loans, guarantees, or other repayable structures.",
    "relatedSources": [
      "S-044",
      "S-045"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4"
    ],
    "sourceIds": [
      "S-044",
      "S-045"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-009",
    "slug": "a-009",
    "title": "Israel FMF/MOU staging details",
    "sections": [
      "Section 4"
    ],
    "status": "Mostly resolved",
    "whyItMatters": "Israel aid lines are cleaner than Ukraine's, but stage discipline still matters when distinguishing base MOU commitments from supplemental appropriations and execution status.",
    "currentState": "Section 4 confirms the main Israel statutory lines while carrying narrower staging details as a residual verification item.",
    "recordNeeded": "A fully staged primary record that ties MOU, supplemental, and execution-state views into one reference chain.",
    "relatedSources": [
      "S-049"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4"
    ],
    "sourceIds": [
      "S-049"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-010",
    "slug": "a-010",
    "title": "Capture share for Ukraine and Israel military aid",
    "sections": [
      "Section 4",
      "Section 5"
    ],
    "status": "Open",
    "whyItMatters": "Gross military-aid figures do not equal value ultimately reaching the foreign recipient because replenishment, U.S. manufacturing, and domestic capture can absorb a large share.",
    "currentState": "The publication keeps Total B open for these military cases rather than inventing a capture rate.",
    "recordNeeded": "Program-level evidence showing what share of military-aid appropriations and obligations is captured in the United States versus reaching the foreign recipient.",
    "relatedSources": [
      "S-043",
      "S-047",
      "S-049",
      "S-057"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4",
      "Section 5"
    ],
    "sourceIds": [
      "S-043",
      "S-047",
      "S-049",
      "S-057"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-011",
    "slug": "a-011",
    "title": "Israel OSP share",
    "sections": [
      "Section 4"
    ],
    "status": "Open",
    "whyItMatters": "The offshore-procurement share affects how much FMF can be spent in Israel rather than on U.S. defense articles.",
    "currentState": "Section 4 uses the published OSP framing but flags the exact current share as an open verification item.",
    "recordNeeded": "A current primary record for the exact OSP share and its implementation window.",
    "relatedSources": [
      "S-049"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4"
    ],
    "sourceIds": [
      "S-049"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-012",
    "slug": "a-012",
    "title": "Israel 2024 supplemental obligated-versus-outlaid status",
    "sections": [
      "Section 4"
    ],
    "status": "Open",
    "whyItMatters": "Appropriation alone does not show execution stage, and the 2024 supplemental should not be narrated as outlaid if only obligated or appropriated.",
    "currentState": "The publication keeps the stage distinction explicit and records the unresolved execution-state detail as an open item.",
    "recordNeeded": "Primary execution reporting showing whether the relevant supplemental amount is appropriated, obligated, or outlaid.",
    "relatedSources": [
      "S-045",
      "S-049"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 4"
    ],
    "sourceIds": [
      "S-045",
      "S-049"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-013",
    "slug": "a-013",
    "title": "DoD execution-level annual figures for Section 333, CTEF, and ASFF",
    "sections": [
      "Section 5"
    ],
    "status": "Open",
    "whyItMatters": "The recurring military lane is built from annual programs, so execution-level figures matter for staying on the right basis and year.",
    "currentState": "Section 5 carries approximate recurring figures while noting that exact current-year execution detail is still incomplete.",
    "recordNeeded": "Primary DoD execution-level annual figures for Section 333, CTEF, and related annual security-cooperation programs.",
    "relatedSources": [
      "S-055",
      "S-058",
      "S-059"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 5"
    ],
    "sourceIds": [
      "S-055",
      "S-058",
      "S-059"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-014",
    "slug": "a-014",
    "title": "EDA marginal taxpayer cost versus acquisition value",
    "sections": [
      "Section 5"
    ],
    "status": "Open",
    "whyItMatters": "Excess Defense Articles can be described by acquisition value or marginal taxpayer cost, and the distinction affects whether any figure belongs in a transfer total.",
    "currentState": "The publication leaves EDA as a marginal or pending item instead of forcing a misleading value into the annual military lane.",
    "recordNeeded": "A primary cost treatment record showing the marginal taxpayer cost basis for EDA transfers.",
    "relatedSources": [
      "S-050"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 5"
    ],
    "sourceIds": [
      "S-050"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-015",
    "slug": "a-015",
    "title": "WRSA transferred value versus retained U.S.-owned stock",
    "sections": [
      "Section 5"
    ],
    "status": "Open",
    "whyItMatters": "War Reserve Stockpiles for Allies can blur the line between transferred value and still-U.S.-owned stock, which affects whether a taxpayer transfer has actually occurred.",
    "currentState": "Section 5 leaves WRSA out of the adopted subtotal until a defensible transfer-value basis is available.",
    "recordNeeded": "A primary record separating transferred WRSA value from stock that remains U.S.-owned or merely positioned.",
    "relatedSources": [
      "S-050"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 5"
    ],
    "sourceIds": [
      "S-050"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-016",
    "slug": "a-016",
    "title": "SDAF revolving treatment",
    "sections": [
      "Section 5"
    ],
    "status": "Resolved",
    "whyItMatters": "The Special Defense Acquisition Fund could look like an added military-aid pool if its revolving nature is ignored.",
    "currentState": "Appendix A marks this resolved: SDAF is revolving, nets to approximately $0 in the audit frame, and is excluded from adopted totals.",
    "recordNeeded": "No further record needed for v1.0; carried as resolved in the register.",
    "relatedSources": [],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 5"
    ],
    "sourceIds": [],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-017",
    "slug": "a-017",
    "title": "Cross-section harmonization between foreign-assistance and military-aid lanes",
    "sections": [
      "Section 5"
    ],
    "status": "Resolved into lanes",
    "whyItMatters": "Section 3 uses single-year obligations while Section 5 uses cumulative multi-year military lanes, so a blended headline would overstate precision.",
    "currentState": "Appendix A marks this resolved into lanes: the platform preserves basis-segregated subtotals instead of forcing a synthetic grand total.",
    "recordNeeded": "A lawful harmonization method that keeps measure type, period, and duplication risks separated.",
    "relatedSources": [
      "S-043"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 5"
    ],
    "sourceIds": [
      "S-043"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-018",
    "slug": "a-018",
    "title": "ORR consolidated outlay and recipient/provider split",
    "sections": [
      "Section 1",
      "Section 6"
    ],
    "status": "Open",
    "whyItMatters": "The refugee-resettlement lane is routed through states, voluntary agencies, and providers, but the public record does not cleanly isolate value reaching entrants.",
    "currentState": "Section 6 names the program and the gap, but leaves Total B unresolved.",
    "recordNeeded": "Public ORR outlay reporting that isolates entrant-directed value versus provider or operator capture.",
    "relatedSources": [
      "S-060",
      "S-062",
      "S-070"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 1",
      "Section 6"
    ],
    "sourceIds": [
      "S-060",
      "S-062",
      "S-070"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-019",
    "slug": "a-019",
    "title": "ORR entrant-versus-provider split",
    "sections": [
      "Section 6"
    ],
    "status": "Open",
    "whyItMatters": "A large share of ORR funds flows to states, voluntary agencies, and shelter operators rather than directly as cash to entrants.",
    "currentState": "Section 6 states that the entrant-versus-provider split is unpublished and therefore leaves Total B materially below but not measurable from the public record.",
    "recordNeeded": "Program-level public reporting that separates entrant-directed value from provider, operator, and administrative capture.",
    "relatedSources": [
      "S-060",
      "S-061",
      "S-063"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 6"
    ],
    "sourceIds": [
      "S-060",
      "S-061",
      "S-063"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-020",
    "slug": "a-020",
    "title": "UC in-scope versus custodial share",
    "sections": [
      "Section 6"
    ],
    "status": "Open",
    "whyItMatters": "The Unaccompanied Children program dominates ORR spending, but its custodial and support components are not cleanly partitioned for this audit's beneficiary logic.",
    "currentState": "Section 6 carries UC's dominance openly while leaving the in-scope beneficiary split unresolved.",
    "recordNeeded": "A public breakout distinguishing the UC share that should count as entrant-directed support from custodial or operator-heavy expenditures.",
    "relatedSources": [
      "S-060",
      "S-070"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 6"
    ],
    "sourceIds": [
      "S-060",
      "S-070"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-021",
    "slug": "a-021",
    "title": "Afghan and Ukrainian parolee supplemental amounts",
    "sections": [
      "Section 6"
    ],
    "status": "Open",
    "whyItMatters": "Supplemental entrant populations can change ORR composition materially, but the public record does not fully isolate the amounts attributable to those parolee cohorts.",
    "currentState": "Section 6 keeps the parolee supplements visible as a data-gap item rather than allocating them heuristically.",
    "recordNeeded": "Public ORR reporting that isolates Afghan and Ukrainian parolee supplemental amounts on the same basis as the main ORR lane.",
    "relatedSources": [
      "S-061",
      "S-071"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 6"
    ],
    "sourceIds": [
      "S-061",
      "S-071"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-022",
    "slug": "a-022",
    "title": "CMS-64 emergency Medicaid federal share by year",
    "sections": [
      "Section 7"
    ],
    "status": "Open (carried; corroborated by MACPAC/CBO)",
    "whyItMatters": "The publication has a published emergency Medicaid total, but the federal-only share by year is needed for a cleaner federal total.",
    "currentState": "The item is carried in the register with MACPAC and CBO corroboration but without the federal-only annual breakout.",
    "recordNeeded": "A year-specific CMS-64-based federal-share breakout for emergency Medicaid.",
    "relatedSources": [
      "S-065",
      "S-078"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 7"
    ],
    "sourceIds": [
      "S-065",
      "S-078"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-023",
    "slug": "a-023",
    "title": "Eligible-immigrant Medicaid outlay",
    "sections": [
      "Section 7"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Eligible-immigrant Medicaid spending may be material, but the public record does not publish a clean status-based outlay line for that population.",
    "currentState": "Section 7 routes this gap to Section 13 rather than fabricating a status-based Medicaid figure.",
    "recordNeeded": "A published eligible-immigrant Medicaid outlay series on a federal basis.",
    "relatedSources": [
      "S-065"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 7"
    ],
    "sourceIds": [
      "S-065"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-024",
    "slug": "a-024",
    "title": "Reconcile House Budget and CBO figures versus KFF $3.8B",
    "sections": [
      "Section 7"
    ],
    "status": "Reconciled",
    "whyItMatters": "Large emergency Medicaid figures from different sources can look contradictory unless their time windows are made explicit.",
    "currentState": "Appendix A marks this reconciled: the figures rest on the same dataset family but different time windows, as shown in Table 14-H.",
    "recordNeeded": "No additional v1.0 record is needed beyond the time-window explanation already carried in the publication.",
    "relatedSources": [
      "S-064",
      "S-078",
      "S-079"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 7"
    ],
    "sourceIds": [
      "S-064",
      "S-078",
      "S-079"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-025",
    "slug": "a-025",
    "title": "SNAP noncitizen participant share and benefit attribution",
    "sections": [
      "Section 8"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Participant composition is published, but a benefit-dollar breakout net of citizen children is not, and multiplying the participation share by the total would be prohibited modeling.",
    "currentState": "Section 8 publishes the participation mix and explicitly routes the missing dollar attribution to Section 13.",
    "recordNeeded": "A published SNAP spending breakout isolating noncitizen-attributable benefits net of citizen-child portions.",
    "relatedSources": [
      "S-074"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 8"
    ],
    "sourceIds": [
      "S-074"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-026",
    "slug": "a-026",
    "title": "WIC and school-meals status-neutrality",
    "sections": [
      "Section 8"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Programs without status conditions may be legally or operationally unable to generate a noncitizen-specific spending line.",
    "currentState": "The publication treats these programs as unresolved Section 13 gaps rather than inferring a noncitizen share.",
    "recordNeeded": "A lawful published record showing whether any status-based breakout exists for these status-neutral nutrition programs.",
    "relatedSources": [],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 8"
    ],
    "sourceIds": [],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-027",
    "slug": "a-027",
    "title": "TANF eligible-noncitizen share net of ORR",
    "sections": [
      "Section 9"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "TANF is heavily citizen-child-dominated and can overlap with ORR-routed assistance, so the noncitizen share cannot be cleanly derived from published totals.",
    "currentState": "Section 9 fences ORR-routed support back to Section 6 and sends the unresolved TANF share question to Section 13.",
    "recordNeeded": "A published TANF breakout for eligible noncitizen benefits net of ORR-routed assistance.",
    "relatedSources": [
      "S-075"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 9"
    ],
    "sourceIds": [
      "S-075"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-028",
    "slug": "a-028",
    "title": "SSI point-in-time basis versus annual flow basis",
    "sections": [
      "Section 1",
      "Section 9"
    ],
    "status": "Open (figure carried at Medium, Dec-2021 basis)",
    "whyItMatters": "The SSI figure is computed from a published December 2021 basis, which is strong for that point in time but not a full annual transactional ledger.",
    "currentState": "Section 9 keeps the figure labeled on its Dec. 2021 basis and avoids overstating it as a harmonized annual program total.",
    "recordNeeded": "A published annual SSI spending breakout for noncitizen recipients or a fully reconciled monthly series.",
    "relatedSources": [
      "S-072",
      "S-073"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 1",
      "Section 9"
    ],
    "sourceIds": [
      "S-072",
      "S-073"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-029",
    "slug": "a-029",
    "title": "ACTC/CTC via ITIN and citizen-child share",
    "sections": [
      "Section 9"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Tax-credit flows can involve ITIN filers and citizen children, which makes noncitizen-specific attribution impossible without a published IRS breakout.",
    "currentState": "Section 9 names the gap and routes it to Section 13 instead of deriving a figure from mixed-status tax filing patterns.",
    "recordNeeded": "An IRS-published breakout isolating ACTC or CTC amounts attributable to the noncitizen population without citizen-child overlap.",
    "relatedSources": [],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 9"
    ],
    "sourceIds": [],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-030",
    "slug": "a-030",
    "title": "HUD eligible-noncitizen prorated outlay",
    "sections": [
      "Section 10"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Housing assistance is already screened for ineligible members, but a clean eligible-noncitizen spending line is still not published.",
    "currentState": "Section 10 documents the structural rules and closest figure, then routes the missing noncitizen-specific outlay to Section 13.",
    "recordNeeded": "A HUD-published outlay breakout for eligible noncitizen housing assistance after proration and citizen-member separation.",
    "relatedSources": [
      "S-067",
      "S-068",
      "S-077"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 10"
    ],
    "sourceIds": [
      "S-067",
      "S-068",
      "S-077"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-031",
    "slug": "a-031",
    "title": "No-verification grant housing programs",
    "sections": [
      "Section 10"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Grant-funded housing programs that do not verify immigration status cannot easily produce a status-based spending breakout.",
    "currentState": "Section 10 marks these programs as unresolved rather than assigning them a modeled share.",
    "recordNeeded": "A published program-level record showing whether any status breakout exists inside no-verification housing grants.",
    "relatedSources": [
      "S-067",
      "S-068"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 10"
    ],
    "sourceIds": [
      "S-067",
      "S-068"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-032",
    "slug": "a-032",
    "title": "Federal K-12 noncitizen spending",
    "sections": [
      "Section 11"
    ],
    "status": "Open -> Section 13 (legally uncollectable, Plyler)",
    "whyItMatters": "K-12 schooling is constitutionally status-blind, so the public record may not be able to produce a status-based federal spending line at all.",
    "currentState": "Section 11 treats this as a legal collection limit rather than a simple missing dataset.",
    "recordNeeded": "No ordinary status-based spending dataset is expected; any lawful resolution would need to respect Plyler's status-collection limits.",
    "relatedSources": [
      "S-069"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 11"
    ],
    "sourceIds": [
      "S-069"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-033",
    "slug": "a-033",
    "title": "Eligible-noncitizen federal student aid",
    "sections": [
      "Section 11"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Undocumented students are barred from federal aid, but eligible-noncitizen aid is still not published as a separate spending line.",
    "currentState": "Section 11 names the eligibility boundary clearly and routes the missing eligible-noncitizen spending breakout to Section 13.",
    "recordNeeded": "A Department of Education breakout isolating federal student-aid amounts for eligible noncitizens.",
    "relatedSources": [
      "S-069"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 11"
    ],
    "sourceIds": [
      "S-069"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-034",
    "slug": "a-034",
    "title": "CCDF, SSBG, CSBG, and LIHEAP no-breakout",
    "sections": [
      "Section 12",
      "Section 13"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "State-administered federal streams can lose citizenship detail in the federal-state-local chain, preventing a clean noncitizen spending breakout.",
    "currentState": "Section 12 documents the reconciliation role and routes these no-breakout programs into the Section 13 gap register.",
    "recordNeeded": "Published program breakouts showing whether any of these state-administered federal streams isolate status-level spending.",
    "relatedSources": [],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 12",
      "Section 13"
    ],
    "sourceIds": [],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-035",
    "slug": "a-035",
    "title": "Per-program responsible agency for missing status data",
    "sections": [
      "Section 13"
    ],
    "status": "Open -> Section 13",
    "whyItMatters": "Readers need to know which agency would have to publish a missing status-based breakout before a gap can ever be resolved.",
    "currentState": "Section 13 frames this as part of the gap register rather than pretending every missing line has the same administrative owner.",
    "recordNeeded": "A program-by-program ownership map tying each missing breakout to the responsible federal reporting agency.",
    "relatedSources": [],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 13"
    ],
    "sourceIds": [],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-036",
    "slug": "a-036",
    "title": "Whether Class C or D modeled estimates exist as bounded context only",
    "sections": [
      "Section 13"
    ],
    "status": "Open",
    "whyItMatters": "Modeled or secondary estimates may exist for some gaps, but using them as adopted totals would violate the audit's evidence hierarchy unless they are clearly bounded as context only.",
    "currentState": "Section 13 leaves this open instead of backfilling opaque programs with secondary modeled estimates.",
    "recordNeeded": "A bounded inventory of Class C or D estimates that can be published as context without replacing missing primary evidence.",
    "relatedSources": [
      "S-076"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 13"
    ],
    "sourceIds": [
      "S-076"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  },
  {
    "id": "A-037",
    "slug": "a-037",
    "title": "Federal-only emergency Medicaid share",
    "sections": [
      "Section 1",
      "Section 7"
    ],
    "status": "Open",
    "whyItMatters": "The site can publish the federal-plus-state emergency Medicaid figure used in the locked section, but not the federal-only share needed for a cleaner federal total.",
    "currentState": "The limitation is carried forward explicitly in the Executive Summary and Section 7.",
    "recordNeeded": "A public federal-only emergency Medicaid spending breakout for the same period and population basis.",
    "relatedSources": [
      "S-003",
      "S-064",
      "S-065",
      "S-078",
      "S-079"
    ],
    "auditIds": [
      "AUDIT-001"
    ],
    "sectionIds": [
      "Section 1",
      "Section 7"
    ],
    "sourceIds": [
      "S-003",
      "S-064",
      "S-065",
      "S-078",
      "S-079"
    ],
    "revisionHistory": [
      {
        "version": "1.0",
        "date": "2026-07-01",
        "summary": "Open-question record extracted into the modular publication data model."
      }
    ]
  }
];
