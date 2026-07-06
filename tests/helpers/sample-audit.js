"use strict";

function auditSamples() {
  const institution = {
    schemaVersion: "1.0.0",
    institutionId: "INST-TEST",
    officialName: "Test Public Agency",
    commonName: "Test Agency",
    institutionType: "agency",
    parentInstitutionId: null,
    jurisdiction: "Test Jurisdiction",
    officialUrl: "https://example.gov/",
    activeFrom: "2000-01-01",
    activeTo: null,
    predecessorIds: [],
    successorIds: []
  };

  const methodology = {
    schemaVersion: "1.0.0",
    methodologyId: "METHOD-001-V1.0",
    version: "1.0",
    title: "Test Audit Methodology",
    effectiveDate: "2026-07-01",
    definitions: { trace: "A value linked to a cited record." },
    inclusionRules: ["Include records inside scope."],
    exclusionRules: ["Exclude unsupported estimates."],
    sourceRankingRules: ["Prefer primary records."],
    calculationStandards: ["Disclose inputs and rounding."],
    confidenceRules: ["Do not exceed the evidence."],
    challengeRules: ["Preserve challenge outcomes."],
    correctionRules: ["Corrections create a release."],
    publicationGates: ["Claims trace to evidence."],
    supersedesMethodologyId: null
  };

  const audit = {
    schemaVersion: "1.0.0",
    auditId: "TCA-TST-2026-001",
    slug: "test-public-audit",
    title: "Test Public Audit",
    shortTitle: "Test Audit",
    question: "How was the examined amount distributed?",
    summary: "A synthetic audit used only for validation tests.",
    bottomLine: "The cited records support the test finding with a disclosed limitation.",
    status: "published_with_limitations",
    currentVersion: "1.0",
    currentReleaseId: "REL-TCA-TST-2026-001-V1.0",
    institutionIds: ["INST-TEST"],
    subjectTags: ["testing"],
    period: { type: "fiscal_year", start: "2026-01-01", end: "2026-12-31", label: "Test Year" },
    methodologyId: "METHOD-001-V1.0",
    confidence: "moderate",
    confidenceRationale: "Primary test evidence exists, with one documented limitation.",
    evidenceCoverage: "substantially_evidenced",
    limitationSummary: "One downstream detail remains unresolved.",
    findingIds: ["TCA-TST-2026-001-F01"],
    unknownIds: ["UNK-000001"],
    calculationIds: ["CALC-000001"],
    sourceIds: ["SRC-000001"],
    challengeIds: [],
    correctionIds: [],
    releaseIds: ["REL-TCA-TST-2026-001-V1.0"],
    createdAt: "2026-06-01T00:00:00Z",
    publishedAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    withdrawalReason: null
  };

  return { audit, institution, methodology };
}

module.exports = { auditSamples };
