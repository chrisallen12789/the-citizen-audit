const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
function hashAuthorityState(state) { return sha256(canonicalStringify(state)); }
module.exports = { hashAuthorityState };
