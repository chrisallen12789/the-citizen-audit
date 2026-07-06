"use strict";

const { TARGET_COLLECTIONS } = require("./config");
const { addError, asArray } = require("./errors");
const { requireBacklink, requireLinkedItem } = require("./link-checks");

function validateChallengeLinks(collections, indexes, errors) {
  for (const item of collections.challenges) {
    const challenge = item.data || {};
    const targetCollection = TARGET_COLLECTIONS[challenge.targetType];
    if (targetCollection) {
      const target = requireLinkedItem(errors, indexes, item, "$.targetId", challenge.targetId, targetCollection);
      if (target && ["audits", "findings"].includes(targetCollection)) requireBacklink(errors, item, "$.targetId", target, "challengeIds", challenge.challengeId);
    }
    asArray(challenge.evidenceArtifactIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.evidenceArtifactIds[${index}]`, id, "artifacts"));
    asArray(challenge.responseIds).forEach((id, index) => {
      const response = requireLinkedItem(errors, indexes, item, `$.responseIds[${index}]`, id, "responses");
      if (response && response.data.challengeId !== challenge.challengeId) addError(errors, "RELATIONSHIP_MISMATCH", item, `$.responseIds[${index}]`, `${id}.challengeId must equal ${challenge.challengeId}.`);
    });
    asArray(challenge.correctionIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.correctionIds[${index}]`, id, "corrections"));
  }

  for (const item of collections.responses) {
    const response = item.data || {};
    const challenge = requireLinkedItem(errors, indexes, item, "$.challengeId", response.challengeId, "challenges");
    if (challenge) requireBacklink(errors, item, "$.challengeId", challenge, "responseIds", response.responseId);
    asArray(response.evidenceArtifactIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.evidenceArtifactIds[${index}]`, id, "artifacts"));
    asArray(response.correctionIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.correctionIds[${index}]`, id, "corrections"));
  }

  for (const item of collections.corrections) {
    const correction = item.data || {};
    requireLinkedItem(errors, indexes, item, "$.affectedReleaseId", correction.affectedReleaseId, "releases");
    requireLinkedItem(errors, indexes, item, "$.effectiveReleaseId", correction.effectiveReleaseId, "releases");
    asArray(correction.affectedObjectIds).forEach((id, index) => {
      if (!indexes.byId.has(id)) addError(errors, "DANGLING_REFERENCE", item, `$.affectedObjectIds[${index}]`, `Affected item ${id} does not exist.`, { referencedId: id });
    });
    asArray(correction.evidenceSourceIds).forEach((id, index) => requireLinkedItem(errors, indexes, item, `$.evidenceSourceIds[${index}]`, id, "sources"));
  }
}

module.exports = { validateChallengeLinks };
