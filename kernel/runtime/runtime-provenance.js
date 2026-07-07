const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ISOLATION_ADAPTER_VERSION = "2.1.0";
const SANDBOX_HELPER_SOURCE_PATH = path.join(__dirname, "sandbox-exec.c");

function reviewedSandboxHelperSourceHash() {
  const stat = fs.lstatSync(SANDBOX_HELPER_SOURCE_PATH);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("Reviewed sandbox-helper source is not a regular file.");
  }
  return crypto.createHash("sha256").update(fs.readFileSync(SANDBOX_HELPER_SOURCE_PATH)).digest("hex");
}

module.exports = {
  ISOLATION_ADAPTER_VERSION,
  SANDBOX_HELPER_SOURCE_PATH,
  reviewedSandboxHelperSourceHash
};
