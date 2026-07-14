"use strict";

const { addError } = require("./errors");

function requireLinkedItem(errors, indexes, item, fieldPath, id, collection) {
  if (!id) return null;
  const linked = indexes.byCollection[collection] && indexes.byCollection[collection].get(id);
  if (!linked) addError(errors, "DANGLING_REFERENCE", item, fieldPath, `Referenced ${collection} item ${id} does not exist.`, { referencedId: id, referencedCollection: collection });
  return linked || null;
}

function requireBacklink(errors, item, fieldPath, linkedItem, backlinkField, expectedId) {
  if (!linkedItem || !Array.isArray(linkedItem.data[backlinkField]) || !linkedItem.data[backlinkField].includes(expectedId)) {
    addError(errors, "REVERSE_REFERENCE_MISSING", item, fieldPath, `${linkedItem ? linkedItem.id : "Linked item"}.${backlinkField} must include ${expectedId}.`);
  }
}

module.exports = { requireBacklink, requireLinkedItem };
