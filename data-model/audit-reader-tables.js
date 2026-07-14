module.exports = [
  {
    id: "R03-F08",
    sectionId: "Section 6",
    anchor: "table-6-1-orr-assistance",
    title: "Table 6-1 — ORR Refugee & Entrant Assistance figures",
    pdfPages: [50, 51],
    caption: "Table 6-1 — ORR Refugee & Entrant Assistance figures",
    columns: ["Item", "Figure", "FY", "Number type", "Class/Source", "Confidence"],
    rows: [
      {
        key: "orr-emergency-fy2023",
        cells: [
          "Refugee & Entrant Assistance — emergency-designated",
          "≈$4.2B",
          "FY2023",
          "Appropriation/BA (emergency)",
          "B [S-070]",
          "High"
        ]
      },
      {
        key: "orr-emergency-fy2024",
        cells: [
          "Refugee & Entrant Assistance — emergency-designated",
          "≈$481M",
          "FY2024",
          "Appropriation/BA (emergency, P.L.118-50)",
          "B [S-070]",
          "High"
        ]
      },
      {
        key: "orr-rss-fy2024",
        cells: [
          "Refugee Support Services (RSS) base",
          "≈$307M",
          "FY2024",
          "Appropriation (base)",
          "A [S-060]",
          "High"
        ]
      },
      {
        key: "orr-tms-fy2024",
        cells: [
          "Transitional & Medical Services (T&MS) base",
          "≈$564M",
          "FY2024",
          "Appropriation (base)",
          "A [S-060]",
          "High"
        ]
      },
      {
        key: "orr-discretionary-fy2019",
        cells: [
          "ORR total discretionary (historical ref.)",
          "≈$1.905B (UC ≈$1.303B = 68%)",
          "FY2019",
          "Appropriation",
          "D→ORR CBJ",
          "Medium"
        ]
      },
      {
        key: "orr-consolidated-pending",
        cells: [
          "Consolidated ORR obligations/outlays",
          "PENDING (A-018)",
          "FY2023–25",
          "Obligation/Outlay",
          "S-062",
          "— (carried)"
        ]
      }
    ],
    notes: [
      "Note (canonical, from QA correction): the $4.2B / $481M figures are appropriations / budget authority, not outlays, and are not consolidated ORR spending. Consolidated obligations/outlays remain pending the USAspending 075-1503 pull (A-018)."
    ]
  },
  {
    id: "R03-F09",
    sectionId: "Section 7",
    anchor: "table-7-1-emergency-medicaid",
    title: "Table 7-1 — Emergency Medicaid primary figure",
    pdfPages: [52],
    caption: "Table 7-1 — Emergency Medicaid primary figure",
    columns: ["Item", "Figure", "FY", "Number type", "Class/Source", "Confidence"],
    rows: [
      {
        key: "emergency-medicaid-fy2023",
        cells: [
          "Emergency Medicaid spending",
          "≈$3.8B (≈0.4% of total Medicaid) — federal + state",
          "FY2023",
          "Outlay/Expenditure",
          "D [S-064] → primary CMS-64/MACPAC [S-065]",
          "Medium-High"
        ]
      }
    ],
    notes: [
      "Permanent flagged limitation (A-037): the published $3.8B is fed + state; the federal-only share (FMAP-dependent, < $3.8B) is the Total A figure and is not yet isolated. Section 14 carries this line with no value until A-037 is resolved."
    ]
  },
  {
    id: "R03-F10",
    sectionId: "Section 8",
    anchor: "table-8-1-snap-program-totals",
    title: "Table 8-1 — SNAP program totals; citizenship composition",
    pdfPages: [54, 55],
    caption: "Table 8-1 — SNAP program totals [S-074, USDA-FNS]",
    columns: ["Item", "Figure", "FY", "Number type", "Class", "Confidence"],
    rows: [
      {
        key: "snap-participants",
        cells: ["SNAP participants", "42.2M people/month (avg)", "FY2023", "Caseload/Participation", "A", "High"]
      },
      {
        key: "snap-total-cost",
        cells: ["SNAP total cost", "$113.2B", "FY2023", "Outlay (benefits + admin)", "A", "High"]
      },
      {
        key: "snap-benefits",
        cells: ["SNAP benefits", "$107.1B", "FY2023", "Outlay (benefits)", "A", "High"]
      },
      {
        key: "snap-retailers",
        cells: ["Authorized retailers / meal providers", "255,594 / 6,176", "FY2023", "Count", "A", "High"]
      }
    ],
    supplemental: [
      {
        heading: "8.2 Citizenship composition (primary) [S-074]",
        text:
          "89.4% U.S.-born citizens; foreign-born <11% (6.2% naturalized citizens — out of scope; 1.1% refugees; 3.3% other noncitizens). Non-citizen participants ≈4–5% (~1.7M). 39% of participants are children. Most SNAP households with a non-citizen still include U.S.-citizen members."
      }
    ],
    notes: []
  }
];
