"use strict";

const { addError, asArray } = require("./errors");
const { requireBacklink, requireLinkedItem } = require("./link-checks");

function validateAuditLinks(collections, indexes, errors) {
  for (const item of collections.audits) {
    const audit = item.data || {};
    requireLinkedItem(errors, indexes, item, "$.methodologyId", audit.methodologyId, "methodologies");
    asArray(audit.institutionIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.institutionIds[${index}]`, id, "institutions"));
    asArray(audit.findingIds).forEach((id, index) => {
      const finding = requireLinkedItem(errors, indexes, item, `$.findingIds[${index}]`, id, "findings");
      if (finding && finding.data.auditId !== audit.auditId) addError(errors, "RELATIONSHIP_MISMATCH", item, `$.findingIds[${index}]`, `${id}.auditId must equal ${audit.auditId}.`);
    });
    asArray(audit.unknownIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.unknownIds[${index}]`, id, "unknowns"));
    asArray(audit.calculationIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.calculationIds[${index}]`, id, "calculations"));
    asArray(audit.sourceIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.sourceIds[${index}]`, id, "sources"));
    asArray(audit.challengeIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.challengeIds[${index}]`, id, "challenges"));
    asArray(audit.correctionIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.correctionIds[${index}]`, id, "corrections"));
    asArray(audit.releaseIds).forEach((id, index) => {
      const release = requireLinkedItem(errors, indexes, item, `$.releaseIds[${index}]`, id, "releases");
      if (release && release.data.auditId !== audit.auditId) addError(errors, "RELATIONSHIP_MISMATCH", item, `$.releaseIds[${index}]`, `${id}.auditId must equal ${audit.auditId}.`);
    });
    if (audit.currentReleaseId) requireLinkedItem(errors, indexes, item, "$.currentReleaseId", audit.currentReleaseId, "releases");
  }

  for (const item of collections.findings) {
    const finding = item.data || {};
    const audit = requireLinkedItem(errors, indexes, item, "$.auditId", finding.auditId, "audits");
    if (audit) requireBacklink(errors, item, "$.auditId", audit, "findingIds", finding.findingId);
    asArray(finding.claimIds).forEach((id, index) => {
      const claim = requireLinkedItem(errors, indexes, item, `$.claimIds[${index}]`, id, "claims");
      if (claim) requireBacklink(errors, item, `$.claimIds[${index}]`, claim, "findingIds", finding.findingId);
    });
    asArray(finding.supportingSourceIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.supportingSourceIds[${index}]`, id, "sources"));
    asArray(finding.qualifyingSourceIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.qualifyingSourceIds[${index}]`, id, "sources"));
    asArray(finding.calculationIds).forEach((id, index) => {
      const calculation = requireLinkedItem(errors, indexes, item, `$.calculationIds[${index}]`, id, "calculations");
      if (calculation) requireBacklink(errors, item, `$.calculationIds[${index}]`, calculation, "findingIds", finding.findingId);
    });
    asArray(finding.unknownIds).forEach((id, index) => {
      const unknown = requireLinkedItem(errors, indexes, item, `$.unknownIds[${index}]`, id, "unknowns");
      if (unknown) requireBacklink(errors, item, `$.unknownIds[${index}]`, unknown, "findingIds", finding.findingId);
    });
    asArray(finding.challengeIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.challengeIds[${index}]`, id, "challenges"));
    asArray(finding.correctionIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.correctionIds[${index}]`, id, "corrections"));
  }

  for (const item of collections.claims) {
    const claim = item.data || {};
    asArray(claim.findingIds).forEach((id, index) => {
      const finding = requireLinkedItem(errors, indexes, item, `$.findingIds[${index}]`, id, "findings");
      if (finding) requireBacklink(errors, item, `$.findingIds[${index}]`, finding, "claimIds", claim.claimId);
    });
    asArray(claim.supportingSourceIds).forEach((id, index) => {
      const source = requireLinkedItem(errors, indexes, item, `$.supportingSourceIds[${index}]`, id, "sources");
      if (source) requireBacklink(errors, item, `$.supportingSourceIds[${index}]`, source, "supportedClaimIds", claim.claimId);
    });
    asArray(claim.calculationIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.calculationIds[${index}]`, id, "calculations"));
    if (claim.directSourceValue) requireLinkedItem(errors, indexes, item, "$.directSourceValue.sourceId", claim.directSourceValue.sourceId, "sources");
  }
}

module.exports = { validateAuditLinks };
