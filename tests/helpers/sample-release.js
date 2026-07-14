"use strict";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function releaseSamples() {
  const calculation = {
    schemaVersion: "1.0.0",
    calculationId: "CALC-000001",
    title: "Test percentage change",
    purpose: "Calculate the synthetic percentage change.",
    formula: "(currentValue - priorValue) / priorValue * 100",
    inputs: [
      { name: "priorValue", value: 100, unit: "USD", period: "Prior", sourceId: "SRC-000001", sourceLocation: "Table 1" },
      { name: "currentValue", value: 110, unit: "USD", period: "Current", sourceId: "SRC-000001", sourceLocation: "Table 1" }
    ],
    assumptions: [],
    exclusions: [],
    rounding: { method: "half_up", decimalPlaces: 1 },
    result: { value: 10, unit: "percent" },
    findingIds: ["TCA-TST-2026-001-F01"],
    verificationStatus: "verified"
  };

  const unknown = {
    schemaVersion: "1.0.0",
    unknownId: "UNK-000001",
    description: "One downstream test detail is incomplete.",
    category: "incomplete_record",
    reasonUnresolved: "The synthetic source omits one detail.",
    effectOnConclusion: "may_affect_subsidiary_finding",
    evidenceNeeded: "A complete synthetic detail table.",
    auditIds: ["TCA-TST-2026-001"],
    findingIds: ["TCA-TST-2026-001-F01"],
    status: "open"
  };

  const release = {
    schemaVersion: "1.0.0",
    releaseId: "REL-TCA-TST-2026-001-V1.0",
    auditId: "TCA-TST-2026-001",
    version: "1.0",
    status: "published_with_limitations",
    methodologyId: "METHOD-001-V1.0",
    releasedAt: "2026-07-01T00:00:00Z",
    recordSnapshotHash: HASH_A,
    artifactIds: ["ART-000001", "ART-000002"],
    fileManifestArtifactId: "ART-000002",
    supersedesReleaseId: null,
    supersededByReleaseId: null,
    correctionIds: [],
    publicationGateResults: [{ gate: "evidence-lineage", passed: true, details: "All test claims trace to evidence." }],
    authorizedBy: "PUB-TEST"
  };

  const reportArtifact = {
    schemaVersion: "1.0.0",
    artifactId: "ART-000001",
    releaseId: "REL-TCA-TST-2026-001-V1.0",
    sourceId: null,
    filename: "test-audit-v1.0.pdf",
    mediaType: "application/pdf",
    artifactType: "public_report",
    byteSize: 2048,
    sha256: HASH_A,
    publicPath: "/downloads/test-audit-v1.0.pdf",
    createdAt: "2026-07-01T00:00:00Z"
  };

  const manifestArtifact = {
    schemaVersion: "1.0.0",
    artifactId: "ART-000002",
    releaseId: "REL-TCA-TST-2026-001-V1.0",
    sourceId: null,
    filename: "test-audit-v1.0-hashes.json",
    mediaType: "application/json",
    artifactType: "hash_manifest",
    byteSize: 512,
    sha256: HASH_B,
    publicPath: "/downloads/test-audit-v1.0-hashes.json",
    createdAt: "2026-07-01T00:00:00Z"
  };

  const challenge = {
    schemaVersion: "1.0.0",
    challengeId: "CH-2026-000001",
    targetType: "finding",
    targetId: "TCA-TST-2026-001-F01",
    submittedAt: "2026-07-10T00:00:00Z",
    status: "rejected_with_explanation",
    disputedStatement: "The test amount increased by 10 percent.",
    challengeSummary: "The synthetic challenger disputes an input.",
    evidenceArtifactIds: [],
    responseIds: ["RESP-2026-000001"],
    correctionIds: [],
    publicDisplay: true
  };

  const response = {
    schemaVersion: "1.0.0",
    responseId: "RESP-2026-000001",
    challengeId: "CH-2026-000001",
    analysis: "The input was checked against the synthetic source.",
    evidenceArtifactIds: [],
    decision: "rejected",
    rationale: "The test evidence did not change the input.",
    decidedAt: "2026-07-12T00:00:00Z",
    correctionIds: [],
    authorizedBy: "REV-TEST"
  };

  const correction = {
    schemaVersion: "1.0.0",
    correctionId: "COR-2026-000001",
    affectedReleaseId: "REL-TCA-TST-2026-001-V1.0",
    effectiveReleaseId: "REL-TCA-TST-2026-001-V1.0",
    affectedObjectIds: ["TCA-TST-2026-001-F01"],
    priorValue: "Old wording",
    correctedValue: "Corrected wording",
    reason: "Synthetic correction sample.",
    severity: "typographical",
    evidenceSourceIds: ["SRC-000001"],
    authorizedBy: "PUB-TEST",
    effectiveAt: "2026-07-02T00:00:00Z"
  };

  return { calculation, challenge, correction, manifestArtifact, release, reportArtifact, response, unknown };
}

module.exports = { HASH_A, HASH_B, releaseSamples };
