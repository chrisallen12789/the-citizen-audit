# Phase 4.1 - Validator Registry Source-Boundary Review

Base checkpoint: `21de95c`
Review commit: `(this checkpoint)`
Ruling: **HOLD - parent-process registry execution removed; production override surfaces removed; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `21de95cc49556756e9e8e5429ecea394de3cc386` and closes three remaining issues:

1. the mode-change regression now uses a genuinely different bound mode
2. production validator-directory override is removed
3. mutable registry/test-only export surfaces are removed

OS-level validator confinement was not started.

## Architecture verified

### Production validator registry lock
Production loading is now locked to the reviewed validator directory:
- `kernel/execution/validators/index.js` rejects caller-supplied `validatorsDir`
- production `loadValidatorRegistry()` always loads the reviewed directory
- production `executeApprovedTransaction()` rejects caller-supplied `validatorsDir`
- alternate validator directories remain available only through `tests/support/validator-test-harness.js`

Regression coverage proves production rejects:
- another directory inside the repository
- a temporary validator directory
- a copied registry with the same validator ids
- an always-pass replacement registry

### Test-only surface removal
Production entrypoints no longer export:
- `executeApprovedTransactionForTest`
- `loadValidatorRegistryForTest`

Test-only alternate-root execution now lives behind:
- `tests/support/orchestrator-test-harness.js`
- `tests/support/validator-test-harness.js`

Production export tests prove the override path is no longer reachable through the orchestrator or validator-registry entrypoints.

### Registry immutability fix
The registry no longer exposes mutable `Map` instances. Internal maps remain private and the public result now exposes immutable lookup objects with frozen:
- `get`
- `has`
- `keys`
- `values`
- `entries`
- `forEach`
- iterator support

There is no exposed `set`, `delete`, or `clear` surface. Callers cannot add, replace, delete, or clear descriptor or contract collections through the returned registry object.

### Mode-change regression fix
The execution-time mode-change test now reads the original recorded mode and then selects a different expected mode:
- `0o400` when the original is `0o600`
- otherwise `0o600`

The test asserts the replacement mode differs from the recorded mode before running the worker. Runtime mode verification itself was not weakened.

## Security outcome
The validator registry still avoids parent-process validator execution:
- closure is built first
- verified bytes are read directly
- contract metadata is parsed statically from exact module bytes
- dynamic contract construction is rejected

Production also no longer allows caller control over validator root or validator directory selection.

## Test totals observed in this workspace
- validator-security: 76/76
- execution-orchestrator: 52/52
- execution suite: 268/268
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 92/92 owned, 0 unexplained, 0 violations
- JavaScript syntax sweep: passed
- Institutional QA: 159 HTML files passed

## Additional confirmations
- no production `validatorsDir` override remains
- no test-only functions are exported from production modules
- registry collections are actually immutable
- no broad capability declarations were added
- no `platform/**` or `schemas/platform-*` files were changed

## Residual hold
This checkpoint intentionally stops before OS-level validator confinement. The registry/source-boundary and production override defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
