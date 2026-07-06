"use strict";

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function addError(errors, code, record, fieldPath, message, details = {}) {
  errors.push({
    code,
    collection: record && record.collection ? record.collection : null,
    recordId: record && record.id ? record.id : null,
    file: record && record.file ? record.file : null,
    path: fieldPath || "$",
    message,
    ...details
  });
}

function sortErrors(errors) {
  return errors.sort((a, b) => {
    const left = JSON.stringify([a.collection || "", a.recordId || "", a.file || "", a.path || "", a.code || "", a.message || ""]);
    const right = JSON.stringify([b.collection || "", b.recordId || "", b.file || "", b.path || "", b.code || "", b.message || ""]);
    return left.localeCompare(right);
  });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = { addError, asArray, sortErrors, stableStringify };
