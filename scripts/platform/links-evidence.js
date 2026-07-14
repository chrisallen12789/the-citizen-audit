"use strict";

const { addError, asArray } = require("./errors");
const { requireBacklink, requireLinkedItem } = require("./link-checks");

function validateEvidenceLinks(collections, indexes, errors) {
  for (const item of collections.sources) {
    const source = item.data || {};
    if (source.institutionId) requireLinkedItem(errors, indexes, item, "$.institutionId", source.institutionId, "institutions");
    asArray(source.captureIds).forEach((id, index) => {
      const capture = requireLinkedItem(errors, indexes, item, `$.captureIds[${index}]`, id, "source-captures");
      if (capture && capture.data.sourceId !== source.sourceId) addError(errors, "RELATIONSHIP_MISMATCH", item, `$.captureIds[${index}]`, `${id}.sourceId must equal ${source.sourceId}.`);
    });
    asArray(source.supportedClaimIds).forEach((id, index) => {
      const claim = requireLinkedItem(errors, indexes, item, `$.supportedClaimIds[${index}]`, id, "claims");
      if (claim) requireBacklink(errors, item, `$.supportedClaimIds[${index}]`, claim, "supportingSourceIds", source.sourceId);
    });
  }

  for (const item of collections["source-captures"]) {
    const capture = item.data || {};
    const source = requireLinkedItem(errors, indexes, item, "$.sourceId", capture.sourceId, "sources");
    if (source) requireBacklink(errors, item, "$.sourceId", source, "captureIds", capture.captureId);
    if (capture.artifactId) requireLinkedItem(errors, indexes, item, "$.artifactId", capture.artifactId, "artifacts");
  }

  for (const item of collections.calculations) {
    const calculation = item.data || {};
    asArray(calculation.inputs).forEach((input, index) => requireLinkedItem(errors, indexes, item, `$.inputs[${index}].sourceId`, input && input.sourceId, "sources"));
    asArray(calculation.findingIds).forEach((id, index) => {
      const finding = requireLinkedItem(errors, indexes, item, `$.findingIds[${index}]`, id, "findings");
      if (finding) requireBacklink(errors, item, `$.findingIds[${index}]`, finding, "calculationIds", calculation.calculationId);
    });
  }

  for (const item of collections.unknowns) {
    const unknown = item.data || {};
    asArray(unknown.auditIds).forEach((id, index) => {
      const audit = requireLinkedItem(errors, indexes, item, `$.auditIds[${index}]`, id, "audits");
      if (audit) requireBacklink(errors, item, `$.auditIds[${index}]`, audit, "unknownIds", unknown.unknownId);
    });
    asArray(unknown.findingIds).forEach((id, index) => {
      const finding = requireLinkedItem(errors, indexes, item, `$.findingIds[${index}]`, id, "findings");
      if (finding) requireBacklink(errors, item, `$.findingIds[${index}]`, finding, "unknownIds", unknown.unknownId);
    });
  }

  for (const item of collections.methodologies) {
    const methodology = item.data || {};
    if (methodology.supersedesMethodologyId) requireLinkedItem(errors, indexes, item, "$.supersedesMethodologyId", methodology.supersedesMethodologyId, "methodologies");
  }
}

module.exports = { validateEvidenceLinks };
