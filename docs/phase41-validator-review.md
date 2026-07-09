# Phase 4.1 - Validator Registry Source-Boundary Review

Base checkpoint: `a47e93a`
Review commit: `(this checkpoint)`
Ruling: **HOLD - parent-process registry execution removed; OS confinement still pending by instruction**

## Scope
This checkpoint addresses the two blocking defects in the validator registry/orchestrator path:

1. registry loading executed validator code in the parent process through ordinary `require` behavior
2. production execution accepted a caller-selected `projectRoot`

OS-level validator confinement was explicitly not started in this checkpoint.

## Architecture verified

### Registry contract inspection
`kernel/execution/validators/index.js` no longer executes validator bytes in the parent process.

The registry now:
- builds the verified validator closure first
- reads the exact verified entry-module bytes with `inspectAndRead(...)`
- parses a static `module.exports = { ... }` contract with `acorn`
- rejects dynamic contract construction, indirection, non-literal arrays, duplicate properties, and non-semver versions
- deep-freezes descriptor internals, contracts, actions, phases, manifests, and nested module entries

No ordinary validator `require.resolve`, cache deletion, or `require(modulePath)` remains in the registry path.

### Worker contract verification
`kernel/execution/validation-cycle.js` now sends the expected contract into the worker, and
`kernel/execution/validator-worker.js` verifies:
- `id`
- `version`
- `semantic`
- `actions`
- `supportedPhases`

Execution still occurs only from the verified closure bytes.

### Production root locking
Production and test loading are now split:
- `loadValidatorRegistry()` always anchors to the reviewed repository root
- `loadValidatorRegistryForTest()` is the only loader that accepts an explicit test root
- `executeApprovedTransaction()` rejects caller-supplied `projectRoot`
- `executeApprovedTransactionForTest()` is the separate test-only path used by fixtures
- `kernel/runtime/transactional-runtime.js` rejects `projectRoot` in the public production API

### Validator-set binding
`validatorSetHash` now binds:
- contract metadata
- closure hash
- closure policy version
- validator runner hash and version
- closure loader hash and version
- authoritative production-root policy identifier

All root references remain root-relative rather than machine-specific absolute paths.

## Attack evidence
Added regressions prove that registry loading does not execute validator or dependency code in the parent process.

Validated attacks:
- top-level `fs.writeFileSync`
- top-level rename / unlink / chmod
- top-level `child_process.spawnSync`
- top-level `worker_threads.Worker`
- top-level network listener creation
- top-level environment access
- top-level approval-store access
- top-level ledger access
- direct dependency side effect
- transitive dependency side effect

Each attack first demonstrates the legacy `require` behavior in a separate subprocess helper, then proves the hardened registry load causes no side effect.

## Additional hardening verified
- descriptors are deep-frozen after registry loading
- closure manifests and nested module entries are deep-frozen
- action and phase arrays are deep-frozen
- production root override cannot be reached through the public orchestrator API
- test-only temporary-root authorization does not leak into production
- no broad capability declarations were added
- no `platform/**` or `schemas/platform-*` files were changed

## Test totals observed in this workspace
- validator-security: 74/74
- execution-orchestrator: 47/47
- execution suite: 261/261
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 88/88 owned, 0 violations
- JavaScript syntax sweep: passed
- QA: 159 HTML files passed

## Residual hold
This checkpoint intentionally stops before OS-level validator confinement. The parent-process source-boundary defect is corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
