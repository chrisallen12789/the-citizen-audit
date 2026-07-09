# Phase 4.1 - Validator Worker Intrinsic-Hardening Review

Base checkpoint: `5f2eac728dd7b465f6f65136471617bce38cc59b`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection, direct worker source bypass, immutable reviewed limits, UTF-8 transport enforcement, private worker channel ownership, and shared-intrinsic mutation are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `5f2eac728dd7b465f6f65136471617bce38cc59b` and closes the remaining same-realm validator-worker trust-boundary defect:

1. validator top-level code can no longer replace `Promise.prototype.then` to fabricate approval without `validate()` running
2. validator top-level code can no longer replace `Array.prototype.push` to suppress normalization problems
3. validator code can no longer mutate shared constructors, prototypes, iterator prototypes, or host capability facades in a way that changes trusted harness behavior
4. trusted post-validator-load code now uses captured call-bound primordials for promise chaining, string checks, buffer slicing/string conversion, map/set lookup, and result normalization
5. private harness `MessageChannel`, bounded success/failure envelopes, immutable limits, authoritative source selection, and worker-side `validatorSetHash` verification remain in force

OS-level validator confinement was not started.

## Architecture Verified

### Same-Realm Intrinsic Hardening
The production worker still uses `vm.compileFunction`, but it no longer relies on mutable shared intrinsics after validator bytes begin executing.

Before loading the authoritative closure entry, `kernel/execution/validator-worker.js` now:
- freezes reviewed shared constructors and prototypes including `Object`, `Array`, `String`, `Function`, `Promise`, `Map`, `Set`, `Error`, `RegExp`, `Buffer`, typed arrays, `Symbol`, iterator prototypes, `JSON`, `Math`, and `Reflect`
- disables `globalThis.process`, `global.process`, `Function`, `eval`, global `require`, global `module`, global `exports`, `process.getBuiltinModule`, `process.binding`, `process._linkedBinding`, and `process.dlopen`
- preserves trusted harness primordials in lexical scope before validator code can run
- removes host constructor chains from reviewed builtin facades and `Buffer`/`JSON` facade callables
- exposes only reviewed builtin facades through the closure-local `require`

This is not claimed as OS-level sandboxing. It is a source/realm hardening step that prevents validator code in the current worker process from mutating the trusted harness behavior covered by the regressions.

### Trusted Post-Load Operations
After validator bytes may have executed, the harness avoids mutable receiver syntax for enforcement-critical behavior:
- promise control flow uses captured `Promise.prototype.then`/`catch` call-bound references
- string checks use captured `String.prototype.startsWith`, `slice`, and `split`
- buffer operations use captured `Buffer.prototype.subarray` and `toString`
- map/set operations use captured `Map`/`Set` prototype functions
- result normalization appends by indexed assignment instead of `Array.prototype.push`
- normalized problem merging avoids spread/iterator semantics
- closure dependency resolution avoids post-load iterator dependence where enforcement matters

The harness therefore does not trust validator-mutated `Promise`, `Array`, `String`, `Object`, `Map`, `Set`, `JSON`, `Buffer`, `Error`, iterator, thenable, or constructor behavior.

### Private Worker Channel Retained
The previous private-channel correction remains in force:
- the worker sends exactly one bounded serialized envelope through a harness-owned `MessageChannel`
- the parent accepts only the harness-owned result-port message as the validator result
- default-channel validator messages fail closed
- direct `parentPort`, direct `MessagePort`, and forged-envelope attempts cannot preempt verification

### Complete Worker Transport Contract Retained
The reviewed `REVIEWED_VALIDATOR_LIMITS.maxResultBytes` ceiling continues to apply to the complete serialized worker response envelope for both success and failure.

No unmeasured validator-controlled success data, exception text, rejection reason, diagnostic object, raw `Error`, thrown value, default-channel message, forged envelope, thenable behavior, or mutated intrinsic behavior is accepted as a production validator result.

### Source, Registry, and Limit Locks Retained
The previous Phase 4.1 corrections remain in force:
- production registry loading uses the reviewed repository root and validator directory
- production validation accepts only authoritative validator ids plus the expected authoritative `validatorSetHash`
- production worker reconstructs the authoritative descriptor from the reviewed registry
- caller-supplied closure, contract, manifest, module hash, closure hash, and worker limits are ignored
- actual closure-building implementation bytes remain bound into `validatorSetHash`
- production modules do not import `tests/**` or `tests/support/**`
- immutable lookup rejects inherited and unsafe keys

## Regressions Added
New direct production-worker regressions prove:
- replacing `Promise.prototype.then` cannot bypass `validate()`
- replacing `Promise.prototype.catch` cannot change rejection handling
- `validate()` is invoked exactly once before success is possible
- a throwing `validate()` cannot be reported as passed
- replacing `Array.prototype.push` cannot suppress normalization problems
- invalid statuses normalize to failed and never passed
- replacing `Array.prototype.slice`, `includes`, `sort`, iterator methods, or `Symbol.iterator` cannot alter enforcement
- replacing `String.prototype.slice`, `startsWith`, or `split` cannot alter closure or transport enforcement
- replacing `Object`, `Map`, `Set`, `JSON`, `Buffer`, `Error`, `RegExp`, `Promise`, `String`, `Function`, or their prototypes cannot affect the harness
- thenables and custom `Promise` subclasses cannot bypass rejection or normalization
- constructor chains and host capability facades cannot recover process authority or harness lexical state
- direct `parentPort` and direct `MessagePort` attacks remain closed

Retained regressions prove:
- forged-envelope-before-contract-verification remains closed
- success and failure transports remain exact and bounded
- `toJSON`, accessor, prototype, structured-clone, multibyte, and emoji result attacks remain closed
- immutable reviewed limits remain immutable
- caller-supplied worker limits remain ignored
- external direct-worker validator-source injection remains closed
- unsafe registry lookup keys remain rejected
- normal authoritative validators still pass

## Test Totals Observed In This Workspace
- validator-security: 123/123
- execution-orchestrator: 56/56
- execution suite: 319/319
- runtime-integration: 28/28
- runtime-isolation: 48/48
- fault and recovery: 31/31
- events: 7/7
- archive: 36/36
- bypass-audit self-test: 29/29
- capability audit: 92/92 owned, 0 unexplained, 0 violations
- capability audit stale classifications: 0
- JavaScript syntax sweep: passed on 147 tracked `.js` files
- `git diff --check`: passed
- `git fsck --full`: passed
- Institutional QA: 159 HTML files passed
- execution-orchestrator, runtime-integration, and aggregate execution suite all terminated normally on this Windows host

Host note:
- WSL has no installed Linux distributions and Docker is not installed in this desktop session, so Linux-host termination could not be directly reproduced here

## Additional Confirmations
- validator code cannot mutate trusted harness intrinsics in the covered attack paths
- `validate()` must actually execute before approval
- invalid statuses fail closed
- the private result channel remains inaccessible
- no validator-controlled message can preempt verification
- success and failure transport remain exact and bounded
- no configurable execution function is exported from `kernel/**`
- no alternate validator source can be selected by direct module import
- no production worker accepts caller-supplied closure or contract material
- no production worker accepts caller-supplied limit values as authoritative
- no broad capability declarations were added
- no `platform/**`, `schemas/platform-*`, or generated `public/data/platform-*` changes remain in the checkpoint

## Patch Delivery Verification
The replacement checkpoint patch must be packaged as raw Git output:
- no UTF-8 BOM
- canonical LF line endings
- `git apply --check` verified from the exact parent commit
- delivered patch bytes verified against a separately regenerated raw `git diff --binary`

## Residual Hold
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, fabricated-descriptor execution, direct-worker source, mutable-limit, UTF-8 result-byte, success-transport, failure-transport, worker-channel, and shared-intrinsic defects are corrected in this code line, but OS-level validator confinement remains future work and the HOLD stays in place.
