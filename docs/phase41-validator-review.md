# Phase 4.1 - Validator Registry Source-Boundary Review

Base checkpoint: `8681dae`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator root selection is no longer directly importable; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `8681daeae981af197f84ed582fe0098893c1740a` and closes the rejected direct-import validator-source defect:

1. production `validator-closure.js` no longer exports a configurable closure builder or root resolver
2. production validator loading remains fixed to the reviewed repository root and reviewed validator directory
3. test-only configurable closure construction is confined to `tests/support/**`
4. immutable lookup handling continues to reject inherited-object key confusion and unsafe validator ids
5. the delivered replacement patch is generated as a genuine line-delimited unified diff and verified with `git apply --check`

OS-level validator confinement was not started.

## Architecture verified

### Fixed production kernel surface
Direct-path `require()` of production kernel modules no longer exposes configurable execution, registry loading, or validator-closure construction.

Fixed production modules:
- `kernel/execution/orchestrator.js`
- `kernel/execution/orchestrator-core.js`
- `kernel/execution/validator-closure.js`
- `kernel/execution/validators/index.js`
- `kernel/execution/validators/registry-core.js`

None exports:
- `executeApprovedTransactionInternal`
- `loadValidatorRegistryAtDirectory`
- `buildValidatorClosure`
- `resolveAuthoritativeRoot`
- `inspectAndRead`
- test mode selection
- alternate `projectRoot` or `validatorsDir` selection
- injected execution surfaces or override flags

Direct-require regressions prove:
- no configurable execution function is exported from `kernel/**`
- direct import of `orchestrator-core.js` still rejects caller-selected `projectRoot` and `validatorsDir`
- direct import of `registry-core.js` still rejects caller-selected validator directories
- direct import of `validator-closure.js` exposes no callable production closure builder, root selector, or entry-source inspector

### Test-only configurability confinement
Alternate validator roots remain available only through test support:
- `tests/support/orchestrator-test-harness.js`
- `tests/support/validator-closure-test-core.js`
- `tests/support/validator-test-harness.js`
- `tests/support/validator-registry-test-core.js`

Production code does not import `tests/support/**`. An import-graph regression scans every `kernel/**/*.js` file and proves no production module reaches test support.

### Production validator registry lock
Production registry loading is still bound to the reviewed validator tree:
- `loadValidatorRegistry()` accepts no source-location options
- the reviewed repository root is always authoritative
- the reviewed validator directory is always authoritative
- no alternate-directory loader is exported from any kernel module

### Production validator-closure lock
Production `kernel/execution/validator-closure.js` now exports only fixed reviewed-source policy metadata.

The configurable closure-building implementation remains available only in test support:
- `tests/support/validator-closure-test-core.js`

Production imports cannot construct a validator closure from:
- an alternate project root
- an alternate validator directory
- an alternate validator entry path
- an equivalent indirect source override

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
- alternate validator entry sources
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
- capability audit stale classifications: 0
- JavaScript syntax sweep: passed
- `git diff --check`: passed
- `git fsck --full`: passed
- Institutional QA: 159 HTML files passed

## Additional confirmations
- no configurable execution function is exported from `kernel/**`
- no alternate validator source can be selected by direct module import
- production modules do not import test support
- immutable lookup does not expose inherited properties
- capability report contains zero stale classifications
- generated patch is line-delimited and passes `git apply --check`
- no broad capability declarations were added
- no `platform/**`, `schemas/platform-*`, or generated `public/data/platform-*` changes remain in the checkpoint

## Residual hold
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, and direct-import surface defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
