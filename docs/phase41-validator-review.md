# Phase 4.1 - Validator Registry Source-Boundary Review

Base checkpoint: `8681dae`
Review commit: `(this checkpoint)`
Ruling: **HOLD - configurable validator and orchestrator cores are no longer directly importable; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `8681daeae981af197f84ed582fe0098893c1740a` and closes the remaining direct-import production-surface defect:

1. configurable validator-registry and orchestrator core exports are removed from `kernel/**`
2. production validator loading remains fixed to the reviewed repository root and reviewed validator directory
3. test configurability is confined to `tests/support/**`
4. immutable lookup handling now rejects inherited-object key confusion and unsafe validator ids

OS-level validator confinement was not started.

## Architecture verified

### Fixed production kernel surface
Direct-path `require()` of production kernel modules no longer exposes configurable execution or registry loading.

Fixed production modules:
- `kernel/execution/orchestrator.js`
- `kernel/execution/orchestrator-core.js`
- `kernel/execution/validators/index.js`
- `kernel/execution/validators/registry-core.js`

None exports:
- `executeApprovedTransactionInternal`
- `loadValidatorRegistryAtDirectory`
- test mode selection
- alternate `projectRoot` or `validatorsDir` selection
- injected execution surfaces or override flags

Direct-require regressions prove:
- no configurable execution function is exported from `kernel/**`
- direct import of `orchestrator-core.js` still rejects caller-selected `projectRoot` and `validatorsDir`
- direct import of `registry-core.js` still rejects caller-selected validator directories

### Test-only configurability confinement
Alternate validator roots remain available only through test support:
- `tests/support/orchestrator-test-harness.js`
- `tests/support/validator-test-harness.js`
- `tests/support/validator-registry-test-core.js`

Production code does not import `tests/support/**`. An import-graph regression scans every `kernel/**/*.js` file and proves no production module reaches test support.

### Production validator registry lock
Production registry loading is still bound to the reviewed validator tree:
- `loadValidatorRegistry()` accepts no source-location options
- the reviewed repository root is always authoritative
- the reviewed validator directory is always authoritative
- no alternate-directory loader is exported from any kernel module

### Immutable lookup hardening
Registry collections remain immutable and no longer expose inherited object-prototype values:
- lookup backing objects use a null prototype
- `get()` returns a value only for own keys
- `has()` uses own-property checks
- unsafe validator ids are rejected: `__proto__`, `prototype`, `constructor`

Regressions prove callers cannot:
- add, replace, delete, or clear descriptor or contract collections
- retrieve inherited prototype values through lookup keys
- register unsafe validator ids

## Security outcome
The validator registry still avoids parent-process validator execution:
- closure is built first
- verified bytes are read directly
- contract metadata is parsed statically from exact module bytes
- dynamic contract construction is rejected

Production no longer leaves a direct-import path to:
- alternate validator directories
- alternate project roots
- injected registry loaders
- injected execution surfaces

## Test totals observed in this workspace
- validator-security: 79/79
- execution-orchestrator: 55/55
- execution suite: 274/274
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 90/90 owned, 0 unexplained, 0 violations
- JavaScript syntax sweep: passed
- Institutional QA: 159 HTML files passed

## Additional confirmations
- no configurable execution function is exported from `kernel/**`
- no alternate validator source can be selected by direct module import
- production modules do not import test support
- immutable lookup does not expose inherited properties
- no broad capability declarations were added
- no `platform/**`, `schemas/platform-*`, or generated `public/data/platform-*` changes remain in the checkpoint

## Residual hold
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, and direct-import surface defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
