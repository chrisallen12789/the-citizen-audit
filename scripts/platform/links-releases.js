"use strict";

const { addError, asArray } = require("./errors");
const { requireBacklink, requireLinkedItem } = require("./link-checks");

function validateReleaseLinks(collections, indexes, errors) {
  for (const item of collections.releases) {
    const release = item.data || {};
    const audit = requireLinkedItem(errors, indexes, item, "$.auditId", release.auditId, "audits");
    if (audit) requireBacklink(errors, item, "$.auditId", audit, "releaseIds", release.releaseId);
    requireLinkedItem(errors, indexes, item, "$.methodologyId", release.methodologyId, "methodologies");
    asArray(release.artifactIds).forEach((id, index) => {
      const artifact = requireLinkedItem(errors, indexes, item, `$.artifactIds[${index}]`, id, "artifacts");
      if (artifact && artifact.data.releaseId !== release.releaseId) addError(errors, "RELATIONSHIP_MISMATCH", item, `$.artifactIds[${index}]`, `${id}.releaseId must equal ${release.releaseId}.`);
    });
    requireLinkedItem(errors, indexes, item, "$.fileManifestArtifactId", release.fileManifestArtifactId, "artifacts");
    if (release.supersedesReleaseId) requireLinkedItem(errors, indexes, item, "$.supersedesReleaseId", release.supersedesReleaseId, "releases");
    if (release.supersededByReleaseId) requireLinkedItem(errors, indexes, item, "$.supersededByReleaseId", release.supersededByReleaseId, "releases");
    asArray(release.correctionIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.correctionIds[${index}]`, id, "corrections"));
  }

  for (const item of collections.artifacts) {
    const artifact = item.data || {};
    if (artifact.releaseId) {
      const release = requireLinkedItem(errors, indexes, item, "$.releaseId", artifact.releaseId, "releases");
      if (release) requireBacklink(errors, item, "$.releaseId", release, "artifactIds", artifact.artifactId);
    }
    if (artifact.sourceId) requireLinkedItem(errors, indexes, item, "$.sourceId", artifact.sourceId, "sources");
  }

  for (const item of collections.institutions) {
    const institution = item.data || {};
    if (institution.parentInstitutionId) requireLinkedItem(errors, indexes, item, "$.parentInstitutionId", institution.parentInstitutionId, "institutions");
    asArray(institution.predecessorIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.predecessorIds[${index}]`, id, "institutions"));
    asArray(institution.successorIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.successorIds[${index}]`, id, "institutions"));
  }
}

module.exports = { validateReleaseLinks };
