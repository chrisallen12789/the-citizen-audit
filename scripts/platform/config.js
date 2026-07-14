"use strict";

const COLLECTIONS = Object.freeze({
  audits: { schema: "platform-audit.schema.json", idField: "auditId" },
  findings: { schema: "platform-finding.schema.json", idField: "findingId" },
  claims: { schema: "platform-claim.schema.json", idField: "claimId" },
  sources: { schema: "platform-source.schema.json", idField: "sourceId" },
  "source-captures": { schema: "platform-source-capture.schema.json", idField: "captureId" },
  calculations: { schema: "platform-calculation.schema.json", idField: "calculationId" },
  unknowns: { schema: "platform-unknown.schema.json", idField: "unknownId" },
  methodologies: { schema: "platform-methodology.schema.json", idField: "methodologyId" },
  challenges: { schema: "platform-challenge.schema.json", idField: "challengeId" },
  responses: { schema: "platform-response.schema.json", idField: "responseId" },
  corrections: { schema: "platform-correction.schema.json", idField: "correctionId" },
  releases: { schema: "platform-release.schema.json", idField: "releaseId" },
  artifacts: { schema: "platform-artifact.schema.json", idField: "artifactId" },
  institutions: { schema: "platform-institution.schema.json", idField: "institutionId" }
});

const TARGET_COLLECTIONS = Object.freeze({
  audit: "audits",
  finding: "findings",
  claim: "claims",
  source: "sources",
  calculation: "calculations",
  methodology: "methodologies",
  correction: "corrections"
});

module.exports = { COLLECTIONS, TARGET_COLLECTIONS };
