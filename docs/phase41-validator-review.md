# Phase 4.1 - Validator Worker Source-Boundary Review

Base checkpoint: `d92f69c`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection, fabricated descriptor execution, and direct worker source bypass are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `d92f69c132c5c958cd2ac22ee1c2fbeb96b1727b` and closes the rejected production validator-worker bypass:

1. production `validator-worker.js` no longer accepts caller-supplied closure, contract, manifest, entry-path, or equivalent validator-source material
2. production `validation-cycle.js` now passes only validator identity data plus the expected authoritative `validatorSetHash`
3. production worker independently reloads the authoritative production registry and verifies `validatorSetHash` before validator execution
4. closure-loader identity remains bound to the actual closure-building implementation bytes
5. test-only descriptor execution and alternate validator roots remain confined to `tests/support/**`
6. immutable lookup handling continues to reject inherited-object key confusion and unsafe validator ids

OS-level validator confinement was not started.

## Architecture verified

### Fixed production kernel surface
Direct-path `require()` of production kernel modules and the executable worker entry no longer expose configurable execution, registry loading, validator-closure construction, arbitrary descriptor execution, or caller-selected closure material.

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
- caller-supplied worker closure or contract execution
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
- direct launch of `kernel/execution/validator-worker.js` with a fabricated external closure now fails closed before any external validator bytes execute

### Test-only configurability confinement
Alternate validator roots remain available only through test support:
- `tests/support/orchestrator-test-harness.js`
- `tests/support/validation-cycle-test-core.js`
- `tests/support/validator-worker-test-core.js`
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

### Production validator-worker lock
Production `kernel/execution/validator-worker.js` now accepts only:
- `validatorId`
- `expectedValidatorSetHash`
- `phase`
- serializable validation context
- bounded result limits

Inside the worker, it now independently:
- loads the fixed authoritative production validator registry
- verifies the authoritative `validatorSetHash` equals the caller-provided expected hash
- rejects unsafe validator ids
- resolves the authoritative descriptor only from the reviewed registry
- obtains closure and contract only from that authoritative descriptor
- ignores any caller-supplied closure, manifest, contract, module hash, or closure hash fields

Direct worker regressions prove:
- a fabricated external validator under a temporary root cannot execute through the production worker
- no external validator top-level or validate-function marker file is created
- `validatorSetHash` mismatch fails closed before execution
- caller-supplied `closureHash` values are irrelevant because caller-supplied closure material is ignored
- authoritative validators still execute through the normal production validation-cycle path

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
- alternate worker closure or contract material
- injected registry loaders
- injected execution surfaces

## Test totals observed in this workspace
- validator-security: 84/84
- execution-orchestrator: 56/56
- execution suite: 280/280
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 92/92 owned, 0 unexplained, 0 violations
- capability audit stale classifications: 0
- JavaScript syntax sweep: passed on 146 files
- `git diff --check`: passed
- `git fsck --full`: passed
- Institutional QA: 159 HTML files passed
- runtime-integration and aggregate execution suite both terminated normally on this host

Linux-host note:
- an installed Linux verification environment was not available in this desktop session, so the reproduced termination evidence above is from the current local host only

## Additional confirmations
- no configurable execution function is exported from `kernel/**`
- no alternate validator source can be selected by direct module import
- no production worker accepts caller-supplied closure or contract material
- no production import accepts arbitrary validator descriptors or closure material
- no alternate validator root, directory, entry path, or source can execute through the production worker
- `validatorSetHash` is verified inside the worker before validator execution
- production modules do not import test support
- immutable lookup does not expose inherited properties
- actual closure implementation bytes are bound into `validatorSetHash`
- capability report contains zero stale classifications
- no broad capability declarations were added
- no `platform/**`, `schemas/platform-*`, or generated `public/data/platform-*` changes remain in the checkpoint

## Residual hold
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, fabricated-descriptor execution, and direct worker source-bypass defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
