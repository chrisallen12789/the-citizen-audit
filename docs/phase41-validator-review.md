# Phase 4.1 - Validator Worker Console/Stdio Channel Review

Base checkpoint: `25f5412e9d664a9258287c30eb2e1d53e846cc88`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection, direct worker source bypass, immutable reviewed limits, UTF-8 transport enforcement, private worker channel ownership, shared-intrinsic mutation, MessagePort prototype dispatch, dependency-substitution/hash-prototype, realpath Buffer facade, and console/stdout MessagePort attacks are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `25f5412e9d664a9258287c30eb2e1d53e846cc88` and closes the remaining default-global worker-channel defect:

1. validator code no longer receives the host Node `console` object or its internal stdout/stderr streams
2. `console._stdout`, `console._stderr`, `console.Console`, symbol enumeration, and constructor-chain recovery cannot expose the worker stdio `MessagePort`
3. the production worker closes the default `parentPort` after handing off the harness-owned private result channel
4. risky default globals such as `performance`, `navigator`, `fetch`, `crypto`, `structuredClone`, web streams, timers, `AbortController`, and messaging constructors are removed from the validator global
5. the fs facade rejects numeric file descriptors so `fs.writeFileSync(1, ...)` and `fs.writeFileSync(2, ...)` cannot bypass stdout/stderr bounds
6. the direct production-worker regression harness now measures stdout/stderr bytes in addition to default-channel messages
7. the previously verified realpath string-only facade, pre-execution closure capture, MessagePort prototype hardening, crypto Hash wrapper, dependency-substitution protection, bounded transport, source-selection lockdown, immutable limits, and validatorSetHash verification remain in force

OS-level validator confinement was not started.

## Architecture Verified

### Pre-Execution Closure Capture
The worker no longer verifies source lazily as each module is required. Before the entry validator module is compiled, `kernel/execution/validator-worker.js` now:
- opens every authoritative closure module with no-follow semantics
- verifies regular-file status, hard-link count, write bits where enforced, size, mode, device, inode, ownership, realpath, and SHA-256 hash against the manifest bound into `validatorSetHash`
- copies each verified byte sequence into a private in-memory source map
- closes source descriptors before validator execution proceeds
- compiles all closure modules only from the captured source map

After the first validator byte executes, the worker does not reopen validator source files, rehash validator modules, consult mutable filesystem source, or resolve dependencies from disk.

### MessagePort Dispatch Hardening
The private-channel correction now avoids prototype dispatch for the harness-owned port:
- `MessagePort.prototype.postMessage` and `MessagePort.prototype.close` are captured before validator code can run
- the harness invokes those captured call-bound functions directly against the private result port
- the default `parentPort` is closed after the private result channel is transferred to the parent
- validator access to global messaging constructors such as `MessagePort`, `MessageChannel`, `BroadcastChannel`, `EventTarget`, `Event`, and `MessageEvent` is removed or hardened
- prototype replacement attempts cannot alter the final harness envelope

### Default Global Authority Lockdown
Validator code no longer receives the worker's host `console` object. The global `console` binding is replaced with `undefined` before any validator byte executes, which removes access to:
- `console._stdout`
- `console._stderr`
- `console.Console`
- symbol-held internal stdio `MessagePort` objects
- host stdout/stderr streams and their native prototypes

Other reviewed-dangerous default globals are also removed from the validator global, including network/fetch surfaces, global web crypto, structured clone, timer callback handles, web streams, abort/event constructors, blob/form/request/response constructors, and messaging constructors. Validators that need reviewed capabilities must use the closure-local builtin facades instead.

### Capability Facade Return Hardening
Allowed builtins remain explicit, but facades no longer return raw host-native authority objects:
- `crypto.createHash()` returns a null-prototype wrapper, not a raw `Hash`
- hash `digest()` without an encoding returns a private safe byte wrapper, not a raw `Buffer`
- `fs.readFileSync()` without an encoding returns a safe byte wrapper
- `fs.realpathSync()` always returns a primitive UTF-8 string; `"buffer"` and `{ encoding: "buffer" }` overload attempts cannot return a raw host `Buffer`
- `fs.writeFileSync()` rejects numeric file descriptors and therefore cannot write directly to worker stdout or stderr
- `fs.statSync()` and `fs.lstatSync()` return null-prototype copied stat records with reviewed predicate wrappers
- raw fs streams, file handles, watchers, descriptors, and stream factories are not exposed
- `buffer.Buffer` returns safe byte wrappers through reviewed constructors
- `JSON.parse()` returns recursively copied frozen data with null-prototype object records and constructor-hidden arrays
- `path` exposes only reviewed string/boolean operations and omits object-returning helpers such as `path.parse()`
- capability wrapper failures expose fixed primitive failures rather than raw host `Error` objects

### Worker Cleanup and Command Termination
The validation-cycle boundary now performs explicit cleanup on every completion path:
- the private harness result port removes listeners and closes before completion
- worker stdout/stderr data listeners are removed and the streams are destroyed
- `worker.terminate()` is awaited unless the worker has already emitted `exit`
- the same cleanup discipline is used by the test-only production-worker launcher

This preserves normal completion for the full execution-orchestrator, runtime-integration, runtime-isolation, fault, and aggregate execution commands on this Windows host. Linux-host termination could not be directly reproduced in this desktop session because WSL has no installed distributions and Docker is unavailable.

### Same-Realm Intrinsic Hardening Retained
The production worker still uses `vm.compileFunction`, but it no longer relies on mutable shared intrinsics after validator bytes begin executing.

Before loading the authoritative closure entry, `kernel/execution/validator-worker.js` now:
- freezes reviewed shared constructors and prototypes including `Object`, `Array`, `String`, `Function`, `Promise`, `Map`, `Set`, `Error`, `RegExp`, `Buffer`, typed arrays, `Symbol`, iterator prototypes, `JSON`, `Math`, and `Reflect`
- disables `globalThis.process`, `global.process`, `console`, `Function`, `eval`, global `require`, global `module`, global `exports`, `process.getBuiltinModule`, `process.binding`, `process._linkedBinding`, and `process.dlopen`
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
- direct `parentPort`, direct `MessagePort`, MessagePort prototype mutation, and forged-envelope attempts cannot preempt verification

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
- `console._stdout` is unavailable
- `console._stderr` is unavailable
- `console.Console` is unavailable
- symbol enumeration cannot recover an internal stdio `MessagePort`
- a validator cannot directly send a `stdioPayload` message
- a 400,000-byte output attempt does not cross the parent boundary
- the parent observes `0` stdout/stderr bytes for the reproduced console/stdout attack
- risky default globals do not expose raw host authority
- the fs facade cannot write directly to stdout/stderr file descriptors

Retained direct production-worker regressions prove:
- `fs.realpathSync(path)` returns a primitive string
- `fs.realpathSync(path, "buffer")` cannot return a raw host `Buffer`
- `fs.realpathSync(path, { encoding: "buffer" })` cannot return a raw host `Buffer`
- realpath return values do not expose `Buffer.prototype`, the host `Buffer` constructor, or `Buffer.allocUnsafe`
- JSON facade parsed objects do not expose host prototypes or constructors
- replacing `MessagePort.prototype.postMessage` cannot forge success
- replacing `MessagePort.prototype.close` cannot suppress harness completion
- a validator whose `validate()` throws remains failed after messaging-prototype attacks
- every closure module is verified and captured before entry top-level code can mutate a later dependency
- entry top-level code cannot modify a later dependency and have those modified bytes execute
- crypto hash prototype mutation cannot falsify dependency hash verification
- `crypto.createHash()`, hash `digest()`, `fs.statSync()`, `fs.readFileSync()`, and `Buffer.from()` expose wrapped/null-prototype values instead of raw host-native objects
- fs stream/file-handle factories, raw Hmac factories, and object-returning `path.parse()` are not exposed through validator facades
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
- forged-envelope-before-contract-verification remains closed
- success and failure transports remain exact and bounded
- `toJSON`, accessor, prototype, structured-clone, multibyte, and emoji result attacks remain closed
- immutable reviewed limits remain immutable
- caller-supplied worker limits remain ignored
- external direct-worker validator-source injection remains closed
- unsafe registry lookup keys remain rejected
- normal authoritative validators still pass

## Test Totals Observed In This Workspace
- validator-security: 131/131
- execution-orchestrator: 56/56
- execution suite: 327/327
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
- WSL has no installed Linux distributions and Docker is not installed in this desktop session, so Linux-host termination could not be directly reproduced here. This is recorded as a host limitation, not as a claimed Linux result.

## Additional Confirmations
- all closure bytes are verified and captured before any validator byte executes
- no validator source verification occurs after validator execution begins
- no raw stdout/stderr `MessagePort` is reachable through the global console object
- no validator-controlled stdio payload crossed the parent boundary in the reproduced direct-worker attack
- maximum observed parent-side stdio bytes for the console/stdout attack: 0
- default globals covered by regression expose no raw host authority
- no capability facade overload returns raw host-native authority in the covered paths
- the `fs.realpathSync()` Buffer-return attack is closed
- MessagePort prototype mutation cannot alter the harness response
- capability facades expose no raw mutable host-native return objects capable of changing trusted behavior
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
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, fabricated-descriptor execution, direct-worker source, mutable-limit, UTF-8 result-byte, success-transport, failure-transport, worker-channel, shared-intrinsic, MessagePort prototype, and dependency-substitution/hash-prototype defects are corrected in this code line, but OS-level validator confinement remains future work and the HOLD stays in place.
