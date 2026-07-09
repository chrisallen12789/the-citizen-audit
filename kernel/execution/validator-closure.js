"use strict";

const ROOT_POLICY_VERSION = "1.0.0";
const PRODUCTION_VALIDATOR_SOURCE_POLICY = Object.freeze({
  id: "authoritative-reviewed-repository-root",
  version: ROOT_POLICY_VERSION,
  description: "Production validator source is locked to the reviewed repository root and reviewed validator directory."
});

module.exports = Object.freeze({
  PRODUCTION_VALIDATOR_SOURCE_POLICY,
  ROOT_POLICY_VERSION
});
