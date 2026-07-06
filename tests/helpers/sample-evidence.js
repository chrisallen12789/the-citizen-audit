"use strict";

const HASH_C = "c".repeat(64);

function evidenceSamples() {
  const finding = {
    schemaVersion: "1.0.0",
    findingId: "TCA-TST-2026-001-F01",
    auditId: "TCA-TST-2026-001",
    sequence: 1,
    slug: "test-growth-finding",
    title: "The test amount increased",
    claimIds: ["CLAIM-000001"],
    explanation: "The cited values produce the stated percentage change.",
    materiality: "major",
    confidence: "moderate",
    confidenceRationale: "The calculation uses a primary test source.",
    evidenceStatus: "supported_with_limitations",
    supportingSourceIds: ["SRC-000001"],
    qualifyingSourceIds: [],
    calculationIds: ["CALC-000001"],
    unknownIds: ["UNK-000001"],
    challengeIds: [],
    correctionIds: []
  };

  const claim = {
    schemaVersion: "1.0.0",
    claimId: "CLAIM-000001",
    findingIds: ["TCA-TST-2026-001-F01"],
    statement: "The test amount increased by 10 percent.",
    claimType: "quantitative",
    status: "supported_with_limitations",
    supportingSourceIds: ["SRC-000001"],
    calculationIds: ["CALC-000001"],
    directSourceValue: null,
    introducedInVersion: "1.0",
    retiredInVersion: null
  };

  const source = {
    schemaVersion: "1.0.0",
    sourceId: "SRC-000001",
    title: "Test Agency Annual Table",
    issuer: "Test Public Agency",
    institutionId: "INST-TEST",
    publicationDate: "2026-03-01",
    sourceTier: "A",
    evidenceType: "agency_dataset",
    originalUrl: "https://example.gov/table.json",
    originalUrlUnavailableReason: null,
    captureIds: ["CAP-000001"],
    relevantLocations: [{ label: "Table 1", pageStart: null, pageEnd: null, section: "Totals" }],
    supportedClaimIds: ["CLAIM-000001"],
    reliabilityNotes: "Synthetic primary test record.",
    status: "active"
  };

  const sourceCapture = {
    schemaVersion: "1.0.0",
    captureId: "CAP-000001",
    sourceId: "SRC-000001",
    archiveProvider: "Test Archive",
    archiveUrl: "https://archive.example.org/test",
    archivedAt: "2026-06-15T12:00:00Z",
    retrievedAt: "2026-06-15T12:00:00Z",
    artifactId: null,
    mediaType: "application/json",
    byteSize: 1024,
    sha256: HASH_C,
    preservationStatus: "archived_and_verified"
  };

  return { claim, finding, source, sourceCapture };
}

module.exports = { HASH_C, evidenceSamples };
