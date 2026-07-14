"use strict";

const DEFAULT_TIMEOUT_MS = 5000;

const REVIEWED_VALIDATOR_LIMITS = Object.freeze({
  maxResultBytes: 262144,
  maxArrayLen: 10000,
  maxStdBytes: 65536
});

module.exports = Object.freeze({
  DEFAULT_TIMEOUT_MS,
  REVIEWED_VALIDATOR_LIMITS
});
