"use strict";

const { addError, asArray } = require("./errors");

function validateReleaseRules(collections, indexes, errors) {
  const publishedStatuses = new Set(["published", "published_with_limitations", "corrected", "superseded", "withdrawn"]);

  for (const record of collections.audits) {
    const audit = record.data || {};
    if (!publishedStatuses.has(audit.status)) continue;
    if (!audit.currentReleaseId) addError(errors, "PUBLICATION_RELEASE_REQUIRED", record, "$.currentReleaseId", "Published audit must identify its current release.");
    if (audit.currentReleaseId && !asArray(audit.releaseIds).includes(audit.currentReleaseId)) addError(errors, "PUBLICATION_CURRENT_RELEASE_NOT_LISTED", record, "$.currentReleaseId", "Current release must appear in releaseIds.");
    const currentRelease = audit.currentReleaseId && indexes.byCollection.releases.get(audit.currentReleaseId);
    if (currentRelease && currentRelease.data.version !== audit.currentVersion) addError(errors, "PUBLICATION_VERSION_MISMATCH", record, "$.currentVersion", `Current version must match ${audit.currentReleaseId}.version.`);
    if (!audit.methodologyId || !indexes.byCollection.methodologies.has(audit.methodologyId)) addError(errors, "PUBLICATION_METHODOLOGY_REQUIRED", record, "$.methodologyId", "Published audit must bind a valid methodology version.");
    if (!audit.confidenceRationale || !audit.confidenceRationale.trim()) addError(errors, "PUBLICATION_CONFIDENCE_RATIONALE_REQUIRED", record, "$.confidenceRationale", "Published audit must explain its confidence level.");
    if (!audit.bottomLine || !audit.bottomLine.trim()) addError(errors, "PUBLICATION_BOTTOM_LINE_REQUIRED", record, "$.bottomLine", "Published audit must state a bottom-line finding or indeterminate conclusion.");
    if (audit.confidence !== "indeterminate" && asArray(audit.findingIds).length === 0) addError(errors, "PUBLICATION_FINDING_REQUIRED", record, "$.findingIds", "Published audit with a determinate conclusion must contain at least one finding.");
    if (asArray(audit.sourceIds).length === 0) addError(errors, "PUBLICATION_SOURCE_REQUIRED", record, "$.sourceIds", "Published audit must cite at least one source.");
    if (audit.status === "published_with_limitations") {
      if (!audit.limitationSummary || !audit.limitationSummary.trim()) addError(errors, "PUBLICATION_LIMITATION_SUMMARY_REQUIRED", record, "$.limitationSummary", "Published-with-limitations audit must display a limitation summary.");
      if (asArray(audit.unknownIds).length === 0) addError(errors, "PUBLICATION_UNKNOWN_REQUIRED", record, "$.unknownIds", "Published-with-limitations audit must reference at least one unknown record.");
    }
    if (audit.status === "corrected" && asArray(audit.correctionIds).length === 0) addError(errors, "PUBLICATION_CORRECTION_REQUIRED", record, "$.correctionIds", "Corrected audit must reference a correction record.");
    if (audit.status === "withdrawn" && !audit.withdrawalReason) addError(errors, "PUBLICATION_WITHDRAWAL_REASON_REQUIRED", record, "$.withdrawalReason", "Withdrawn audit must state a withdrawal reason.");
  }

  for (const record of collections.findings) {
    const finding = record.data || {};
    const auditRecord = indexes.byCollection.audits.get(finding.auditId);
    if (!auditRecord || !publishedStatuses.has(auditRecord.data.status)) continue;
    if (finding.materiality !== "contextual" && asArray(finding.supportingSourceIds).length === 0) addError(errors, "PUBLICATION_FINDING_SOURCE_REQUIRED", record, "$.supportingSourceIds", "Material published finding must cite supporting evidence.");
    if (finding.confidence === "high") {
      const tiers = asArray(finding.supportingSourceIds).map((id) => indexes.byCollection.sources.get(id)).filter(Boolean).map((source) => source.data.sourceTier);
      if (tiers.length === 0 || tiers.every((tier) => tier === "D")) addError(errors, "PUBLICATION_HIGH_CONFIDENCE_LOW_TIER", record, "$.supportingSourceIds", "High-confidence finding cannot rely exclusively on Tier D evidence.");
    }
  }

  for (const record of collections.claims) {
    const claim = record.data || {};
    if (claim.claimType === "quantitative" && asArray(claim.calculationIds).length === 0 && !claim.directSourceValue) addError(errors, "PUBLICATION_QUANTITATIVE_LINEAGE_REQUIRED", record, "$.calculationIds", "Quantitative claim must reference a calculation or direct authoritative value.");
  }

  for (const record of collections.sources) {
    const source = record.data || {};
    const usedByPublishedAudit = asArray(source.supportedClaimIds).some((claimId) => {
      const claim = indexes.byCollection.claims.get(claimId);
      return claim && asArray(claim.data.findingIds).some((findingId) => {
        const finding = indexes.byCollection.findings.get(findingId);
        const audit = finding && indexes.byCollection.audits.get(finding.data.auditId);
        return audit && publishedStatuses.has(audit.data.status);
      });
    });
    if (!usedByPublishedAudit) continue;
    if (!source.originalUrl && !source.originalUrlUnavailableReason) addError(errors, "PUBLICATION_SOURCE_ORIGIN_REQUIRED", record, "$.originalUrl", "Published source must provide an original URL or explain why none is available.");
    if (asArray(source.captureIds).length === 0) addError(errors, "PUBLICATION_SOURCE_CAPTURE_REQUIRED", record, "$.captureIds", "Published source must have a preservation-status record.");
    if (asArray(source.relevantLocations).length === 0) addError(errors, "PUBLICATION_SOURCE_LOCATION_REQUIRED", record, "$.relevantLocations", "Published source must identify the relevant page, table, or section.");
  }

  for (const record of collections.unknowns) {
    const unknown = record.data || {};
    if (unknown.effectOnConclusion !== "prevents_conclusion" || unknown.status !== "open") continue;
    asArray(unknown.auditIds).forEach((auditId) => {
      const audit = indexes.byCollection.audits.get(auditId);
      if (audit && publishedStatuses.has(audit.data.status) && audit.data.confidence !== "indeterminate") addError(errors, "PUBLICATION_PREVENTED_CONCLUSION", record, "$.effectOnConclusion", `${auditId} cannot publish a determinate conclusion while this unknown remains open.`);
    });
  }

  for (const record of collections.releases) {
    const release = record.data || {};
    const audit = indexes.byCollection.audits.get(release.auditId);
    if (!audit || !publishedStatuses.has(audit.data.status)) continue;
    if (asArray(release.artifactIds).length === 0) addError(errors, "PUBLICATION_ARTIFACT_REQUIRED", record, "$.artifactIds", "Published release must contain downloadable artifacts.");
    if (!asArray(release.artifactIds).includes(release.fileManifestArtifactId)) addError(errors, "PUBLICATION_MANIFEST_NOT_LISTED", record, "$.fileManifestArtifactId", "File manifest artifact must appear in artifactIds.");
    const failedGate = asArray(release.publicationGateResults).find((gate) => gate && gate.passed !== true);
    if (failedGate) addError(errors, "PUBLICATION_GATE_FAILED", record, "$.publicationGateResults", `Publication gate ${failedGate.gate || "unknown"} did not pass.`);
  }
}

module.exports = { validateReleaseRules };
