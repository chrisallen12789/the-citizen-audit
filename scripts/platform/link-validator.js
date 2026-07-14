"use strict";

const { validateAuditLinks } = require("./links-audit");
const { validateChallengeLinks } = require("./links-challenges");
const { validateEvidenceLinks } = require("./links-evidence");
const { validateReleaseLinks } = require("./links-releases");

function validateLinks(collections, indexes, errors) {
  validateAuditLinks(collections, indexes, errors);
  validateEvidenceLinks(collections, indexes, errors);
  validateChallengeLinks(collections, indexes, errors);
  validateReleaseLinks(collections, indexes, errors);
}

module.exports = { validateLinks };
