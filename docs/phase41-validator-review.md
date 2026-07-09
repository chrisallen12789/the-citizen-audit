# Phase 4.1 - Validator Execution Surface Review

Base checkpoint: `eef24a4`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection and fabricated descriptor execution are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `eef24a40c27daeeee7bc04813751d50238cec411` and closes the rejected production validation-surface defects:

1. production `validation-cycle.js` no longer accepts caller-supplied validator descriptors or closure material
2. production validator loading remains fixed to the reviewed repository root and reviewed validator directory
3. closure-loader identity is now bound to the actual closure-building implementation bytes
4. test-only descriptor execution and alternate validator roots remain confined to `tests/support/**`
5. immutable lookup handling continues to reject inherited-object key confusion and unsafe validator ids

OS-level validator confinement was not started.

## Architecture verified

### Fixed production kernel surface
Direct-path `require()` of production kernel modules no longer exposes configurable execution, registry loading, validator-closure construction, or arbitrary descriptor execution.

Fixed production modules:
- `kernel/execution/orchestrator.js`
- `kernel/execution/orchestrator-core.js`
- `kernel/execution/validation-cycle.js`
- `kernel/execution/validator-worker.js`
- `kernel/execution/validator-closure.js`
- `kernel/execution/validators/index.js`
- `kernel/execution/validators/registry-core.js`

None exports:
- `executeApprovedTransactionInternal`
- `loadValidatorRegistryAtDirectory`
- `buildValidatorClosure`
- `resolveAuthoritativeRoot`
- `inspectAndRead`
- descriptor-driven validator execution
- test mode selection
- alternate `projectRoot` or `validatorsDir` selection
- injected execution surfaces or override flags

Direct-require regressions prove:
- no configurable execution function is exported from `kernel/**`
- direct import of `orchestrator-core.js` still rejects caller-selected `projectRoot` and `validatorsDir`
- direct import of `registry-core.js` still rejects caller-selected validator directories
- direct import of `validator-closure.js` exposes no callable production closure builder, root selector, or entry-source inspector
- direct import of `validation-cycle.js` accepts only authoritative validator ids plus the expected authoritative `validatorSetHash`
- a fabricated descriptor built from an external temporary validator root fails closed and never executes through any production import surface

### Test-only configurability confinement
Alternate validator roots remain available only through test support:
- `tests/support/orchestrator-test-harness.js`
- `tests/support/validation-cycle-test-core.js`
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

### Production validation-cycle lock
Production `kernel/execution/validation-cycle.js` no longer accepts validator descriptors, closure manifests, contracts, entry paths, closure roots, or equivalent source material from callers.

The production API now:
- accepts only validator ids
- reloads the authoritative production registry internally
- verifies the caller-provided expected `validatorSetHash` against the authoritative registry hash
- resolves descriptors exclusively from the authoritative registry before any worker execution occurs

Descriptor-driven execution required by adversarial tests is confined to:
- `tests/support/validation-cycle-test-core.js`

### Production validator-closure lock
Production `kernel/execution/validator-closure.js` now exports only fixed reviewed-source policy metadata.

The configurable closure-building implementation remains available only in test support:
- `tests/support/validator-closure-test-core.js`

Production imports cannot construct a validator closure from:
- an alternate project root
- an alternate validator directory
- an alternate validator entry path
- an equivalent indirect source override

### Closure implementation identity binding
Closure-loader identity is now bound to the real implementation bytes in:
- `kernel/execution/validators/registry-core.js`

The recorded `closureLoaderRuntime.hash` no longer hashes metadata-only policy bytes. A regression proves:
- the recorded loader hash equals the hash of `registry-core.js`
- mutating the real implementation hash would change the bound `validatorSetHash`

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
- alternate validator descriptors or closure manifests
- injected registry loaders
- injected execution surfaces

## Test totals observed in this workspace
- validator-security: 80/80
- execution-orchestrator: 56/56
- execution suite: 276/276
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 91/91 owned, 0 unexplained, 0 violations
- capability audit stale classifications: 0
- JavaScript syntax sweep: passed on 145 files
- `git diff --check`: passed
- `git fsck --full`: passed
- Institutional QA: 159 HTML files passed
- runtime-integration and aggregate execution suite both terminated normally on this host

Linux-host note:
- an installed Linux verification environment was not available in this desktop session, so the reproduced termination evidence above is from the current local host only

## Additional confirmations
- no configurable execution function is exported from `kernel/**`
- no alternate validator source can be selected by direct module import
- no production import accepts arbitrary validator descriptors or closure material
- production modules do not import test support
- immutable lookup does not expose inherited properties
- actual closure implementation bytes are bound into `validatorSetHash`
- capability report contains zero stale classifications
- no broad capability declarations were added
- no `platform/**`, `schemas/platform-*`, or generated `public/data/platform-*` changes remain in the checkpoint

## Residual hold
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, and fabricated-descriptor execution defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
