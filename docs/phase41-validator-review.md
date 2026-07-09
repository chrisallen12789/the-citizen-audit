# Phase 4.1 - Validator Worker Failure-Transport Review

Base checkpoint: `450bd28`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection, direct worker source bypass, immutable reviewed limits, UTF-8 result-byte enforcement, success transport binding, and failure transport binding are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `450bd28f5971e3fcf2a4f998b137a403c3c1f35f` and closes the remaining failure-transport defect in validator worker messaging:

1. production `validator-worker.js` now sends one bounded serialized JSON envelope for both success and failure
2. the reviewed `maxResultBytes` ceiling applies to the complete serialized worker response envelope
3. failure envelopes use fixed reviewed codes instead of transporting arbitrary validator exception messages
4. the parent independently rechecks the exact transported envelope string before parsing it
5. oversized thrown errors, promise rejections, non-Error thrown values, proxies, message getters, and top-level validator throws fail compactly
6. the previously fixed success-result `toJSON`, accessor, prototype, multibyte, immutable-limit, and external-validator attacks remain closed

OS-level validator confinement was not started.

## Architecture Verified

### Fixed production kernel surface
Direct-path `require()` of production kernel modules and the executable worker entry no longer expose configurable execution, registry loading, validator-closure construction, arbitrary descriptor execution, caller-selected closure material, mutable validator transport policy, or unbounded worker-to-parent transport.

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
- mutable production result or transport limits
- a raw validator result or failure object shared with worker internals

### Complete Worker Transport Contract
The reviewed `REVIEWED_VALIDATOR_LIMITS.maxResultBytes` ceiling now applies to the complete serialized worker response envelope, not only to the normalized validator result field.

The production contract is:
1. construct a plain JSON response envelope
2. for success, include only `{ ok: true, result: <normalized result> }`
3. for failure, include only `{ ok: false, code: <fixed reviewed code>, diagnostic?: <bounded reviewed diagnostic> }`
4. serialize that exact envelope once
5. measure that exact UTF-8 string with `Buffer.byteLength`
6. replace any oversized envelope with a compact deterministic failure envelope
7. transport only the checked serialized envelope string across `parentPort.postMessage`
8. remeasure that same string in `validation-cycle.js`
9. parse and structurally validate only that checked envelope
10. use only the parsed bounded value for validation result handling

No unmeasured validator-controlled success data, exception text, rejection reason, diagnostic object, raw `Error`, thrown value, or error string crosses the production worker boundary.

### Failure Codes
Validator-controlled failures now use fixed codes:
- `VALIDATOR_THROW`
- `VALIDATOR_REJECTION`
- `VALIDATOR_RESULT_INVALID`
- `VALIDATOR_TIMEOUT`
- `REGISTRY_MISMATCH`
- `CLOSURE_VERIFICATION_FAILURE`
- `WORKER_INTERNAL_FAILURE`

Validator-thrown exception messages are not transported. Diagnostics, where present, are fixed or byte-bounded and are never derived by invoking attacker-controlled `message` getters, `toString`, proxies, or raw `Error` object transport.

### Parent-Side Enforcement
Production `kernel/execution/validation-cycle.js` now:
- accepts worker messages only as serialized envelope strings
- rejects non-string worker messages
- rechecks the complete envelope UTF-8 byte length before parsing
- rejects invalid JSON and malformed success or failure envelopes
- accepts success only when normalized result fields are exactly present and well typed
- accepts failure only when the code is one of the reviewed fixed codes and the diagnostic is a string when present
- avoids incorporating unbounded worker `error.message` values from crash and startup paths

### Source and Registry Locks Retained
The previous Phase 4.1 source-boundary corrections remain in force:
- production registry loading uses the reviewed repository root and validator directory
- production `loadValidatorRegistry()` accepts no source-location options
- production validation cycle accepts only authoritative validator ids plus the expected authoritative `validatorSetHash`
- production worker reconstructs the authoritative descriptor from the reviewed registry
- caller-supplied closure, contract, manifest, module hash, closure hash, and worker limits are ignored
- `validatorSetHash` is verified in the worker before validator execution
- production modules do not import `tests/**` or `tests/support/**`

### Success Transport Retained
The successful-result correction remains in force:
- raw validator result objects never cross structured clone
- `toJSON` cannot shrink the checked representation while a larger object is transported
- accessor getters are rejected without invocation
- prototype-backed and custom class result values fail closed
- multibyte BMP and emoji payloads are measured by UTF-8 bytes
- caller-supplied worker limits cannot weaken or tighten reviewed bounds

## Regressions Added
New direct production-worker regressions prove:
- a validator throwing a 400,000-character ASCII `Error` returns a bounded failure envelope
- a validator throwing a large emoji `Error` returns a bounded failure envelope
- a rejected `Promise` containing a large `Error` returns a bounded failure envelope
- thrown strings, plain objects, proxies, and objects with `message` getters cannot bypass the failure bound
- top-level validator exceptions cannot create oversized worker responses
- oversized diagnostics are replaced by compact deterministic envelopes
- normal validator exceptions still fail closed through the production validation cycle and trigger rollback
- parent-side validation accepts only the checked serialized envelope

Retained regressions prove:
- successful validator transport remains exact and bounded
- the `toJSON` structured-clone attack remains closed
- multibyte and emoji result-bound attacks remain closed
- immutable reviewed limits remain immutable
- caller-supplied worker limits remain ignored
- external direct-worker validator-source injection remains closed
- unsafe registry lookup keys remain rejected

## Test Totals Observed In This Workspace
- validator-security: 108/108
- execution-orchestrator: 56/56
- execution suite: 304/304
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 92/92 owned, 0 unexplained, 0 violations
- capability audit stale classifications: 0
- JavaScript syntax sweep: passed on 147 files
- `git diff --check`: passed
- `git fsck --full`: passed
- Institutional QA: 159 HTML files passed
- runtime-integration and aggregate execution suite both terminated normally on this host

Host note:
- an installed Linux verification environment was not available in this desktop session, so the reproduced termination evidence above is from the current local host only

## Additional Confirmations
- success and failure transports are both bounded
- the parent rechecks the exact transported representation
- no raw validator `Error` or thrown value crosses the worker boundary
- oversized thrown and rejected messages fail compactly
- no configurable execution function is exported from `kernel/**`
- no alternate validator source can be selected by direct module import
- no production worker accepts caller-supplied closure or contract material
- no production worker accepts caller-supplied limit values as authoritative
- `validatorSetHash` is verified inside the worker before validator execution
- production modules do not import test support
- immutable lookup does not expose inherited properties
- actual closure implementation bytes remain bound into `validatorSetHash`
- capability report contains zero stale classifications
- no broad capability declarations were added
- no `platform/**`, `schemas/platform-*`, or generated `public/data/platform-*` changes remain in the checkpoint

## Patch Delivery Verification
The replacement checkpoint patch must be packaged as raw Git output:
- no UTF-8 BOM
- canonical LF line endings
- `git apply --check` verified from the exact parent commit
- delivered patch bytes verified against a separately regenerated raw `git diff --binary`

## Residual Hold
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, fabricated-descriptor execution, direct-worker source, mutable-limit, UTF-8 result-byte, success-transport, and failure-transport defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
