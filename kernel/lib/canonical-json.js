function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);

  const result = {};
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if (child !== undefined) result[key] = canonicalize(child);
  }
  return result;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

module.exports = { canonicalize, canonicalStringify };
