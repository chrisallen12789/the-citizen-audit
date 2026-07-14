"use strict";

const fs = require("fs");
const path = require("path");
const { COLLECTIONS } = require("./config");
const { addError } = require("./errors");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCollections(rootDir, errors) {
  const catalogRoot = path.join(rootDir, "platform", "records");
  const collections = {};
  for (const [collection, config] of Object.entries(COLLECTIONS)) {
    const directory = path.join(catalogRoot, collection);
    collections[collection] = [];
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const file = path.relative(rootDir, path.join(directory, entry.name)).split(path.sep).join("/");
      try {
        const data = readJson(path.join(directory, entry.name));
        const id = data && typeof data === "object" ? data[config.idField] : null;
        const item = { collection, file, id, data };
        collections[collection].push(item);
        if (id && entry.name !== `${id}.json`) addError(errors, "FILENAME_ID_MISMATCH", item, "$", `Filename must be ${id}.json.`);
      } catch (error) {
        addError(errors, "INVALID_JSON", { collection, file, id: null }, "$", error.message);
      }
    }
  }
  return collections;
}

function buildIndexes(collections, errors) {
  const byCollection = {};
  const byId = new Map();
  for (const [collection, items] of Object.entries(collections)) {
    byCollection[collection] = new Map();
    for (const item of items) {
      if (!item.id) continue;
      if (byId.has(item.id)) {
        addError(errors, "DUPLICATE_ID", item, "$", `Identifier ${item.id} is already used by ${byId.get(item.id).file}.`);
        continue;
      }
      byId.set(item.id, item);
      byCollection[collection].set(item.id, item);
    }
  }
  return { byCollection, byId };
}

module.exports = { buildIndexes, loadCollections };
