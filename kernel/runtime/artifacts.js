const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { writeCanonicalJsonAtomic } = require("../execution/durable-io");

function runtimeArtifactPath(rootDir, invocationId) {
  return path.join(rootDir, "kernel", "runtime", "state", "artifacts", `${invocationId}.json`);
}

function writeRuntimeArtifact(rootDir, invocationId, result) {
  const body = {
    version: "1.0.0",
    invocationId,
    exitCode: result.status === null ? null : result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
  const artifactHash = sha256(canonicalStringify(body));
  const artifact = Object.freeze({ ...body, artifactHash });
  writeCanonicalJsonAtomic(runtimeArtifactPath(rootDir, invocationId), artifact);
  return artifact;
}

module.exports = { runtimeArtifactPath, writeRuntimeArtifact };
