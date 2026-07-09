# Phase 4.1 - Validator Worker Channel-Lockdown Review

Base checkpoint: `e73517535bb6fefb98b7b8355d2671a66fab49ec`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection, direct worker source bypass, immutable reviewed limits, UTF-8 result-byte enforcement, success/failure transport binding, and worker channel impersonation are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from `e73517535bb6fefb98b7b8355d2671a66fab49ec` and closes the remaining validator-worker communication bypass:

1. validator code can no longer use `process.getBuiltinModule("worker_threads").parentPort` to post raw messages to the parent
2. validator code can no longer forge a valid-looking success envelope before runtime contract verification
3. the parent no longer accepts the first valid-looking worker message as the harness result
4. the worker transports the harness result on a harness-owned private `MessageChannel`
5. default-channel validator messages fail closed instead of being treated as validator results
6. the prior bounded success/failure envelope, immutable-limit, external-source, and validatorSetHash protections remain in force

OS-level validator confinement was not started.

## Architecture Verified

### Harness-Owned Worker Channel
The production worker creates a private `MessageChannel` before loading any validator bytes. The default `parentPort` is used only to bootstrap the harness-owned result port. The actual validation result is sent as the already bounded serialized JSON envelope over that private port.

Production `kernel/execution/validation-cycle.js` now:
- accepts exactly one bootstrap message containing the harness result port
- reads the bounded serialized envelope only from that harness port
- treats any other default-channel message as unauthorized validator communication
- closes the harness port during completion and terminates the worker after settlement
- continues to remeasure and parse only the exact transported envelope string

This prevents a validator-controlled `parentPort.postMessage()` from preempting runtime contract verification or impersonating success.

### Validator Realm Authority Reduction
Before the authoritative closure entry module is compiled or executed, production `kernel/execution/validator-worker.js` removes validator access to harness communication and host-loading authority:
- `globalThis.process`, `global.process`, `Function`, `eval`, global `require`, global `module`, and global `exports` are hidden behind non-writable, non-configurable properties
- `process.getBuiltinModule`, `process.binding`, `process._linkedBinding`, and `process.dlopen` are disabled before validator bytes execute
- the validator wrapper receives only the reviewed closure `require` function, null-prototype `module` and `exports` objects, and frozen `JSON`/`Buffer` facades
- builtins available to closure code are still limited to the reviewed allowlist and exposed through read-only facades
- envelope construction and module verification use harness-captured primordials rather than validator-mutable globals

The static closure builder still rejects undeclared `require("worker_threads")`, `child_process`, `net`, and other non-allowlisted builtins. The runtime guard closes the separate `process.getBuiltinModule()` and global/constructor-chain acquisition path.

### Complete Worker Transport Contract
The reviewed `REVIEWED_VALIDATOR_LIMITS.maxResultBytes` ceiling applies to the complete serialized worker response envelope.

The production contract remains:
1. construct a plain JSON response envelope
2. for success, include only `{ ok: true, result: <normalized result> }`
3. for failure, include only `{ ok: false, code: <fixed reviewed code>, diagnostic?: <bounded reviewed diagnostic> }`
4. serialize that exact envelope once
5. measure that exact UTF-8 string with captured `Buffer.byteLength`
6. replace any oversized envelope with a compact deterministic failure envelope
7. transport only the checked serialized envelope string over the harness-owned result port
8. remeasure that same string in `validation-cycle.js`
9. parse and structurally validate only that checked envelope
10. use only the parsed bounded value for validation result handling

No unmeasured validator-controlled success data, exception text, rejection reason, diagnostic object, raw `Error`, thrown value, error string, default-channel message, or forged envelope is accepted as a production validator result.

### Source, Registry, and Limit Locks Retained
The previous Phase 4.1 corrections remain in force:
- production registry loading uses the reviewed repository root and validator directory
- production validation accepts only authoritative validator ids plus the expected authoritative `validatorSetHash`
- production worker reconstructs the authoritative descriptor from the reviewed registry
- caller-supplied closure, contract, manifest, module hash, closure hash, and worker limits are ignored
- `validatorSetHash` is verified in the worker before validator execution
- actual closure-building implementation bytes remain bound into `validatorSetHash`
- production modules do not import `tests/**` or `tests/support/**`
- immutable lookup rejects inherited and unsafe keys

## Regressions Added
New direct production-worker regressions prove:
- a validator attempting `process.getBuiltinModule("worker_threads").parentPort.postMessage()` cannot send a direct message
- a 400,000-byte direct message never reaches the parent
- the parent receives exactly one bounded harness-owned envelope
- a forged success envelope cannot preempt runtime contract verification
- a validator with a correct static contract but mismatched runtime contract fails closed
- a validator whose `validate()` throws cannot preemptively report `passed`
- `globalThis.process`, `global.process`, `Function("return process")()`, constructor-chain variants, and aliases cannot recover the channel
- `process.getBuiltinModule()` cannot bypass the runtime builtin allowlist
- attempts to obtain `child_process`, `net`, `worker_threads`, or `module` fail closed
- validator mutation of `JSON.stringify`, `Buffer.byteLength`, `Promise`, `Object`, `Map`, `Set`, and `Array` primordials cannot weaken envelope construction

Retained regressions prove:
- success and failure transports remain exact and bounded
- `toJSON`, accessor, prototype, structured-clone, multibyte, and emoji result attacks remain closed
- immutable reviewed limits remain immutable
- caller-supplied worker limits remain ignored
- external direct-worker validator-source injection remains closed
- unsafe registry lookup keys remain rejected
- normal authoritative validators still pass

## Test Totals Observed In This Workspace
- validator-security: 114/114
- execution-orchestrator: 56/56
- execution suite: 310/310
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
- runtime-integration and aggregate execution suite both terminated normally on this Windows host

Host note:
- WSL has no installed Linux distributions and Docker is not installed in this desktop session, so Linux-host termination could not be directly reproduced here

## Additional Confirmations
- validator code cannot access or impersonate the worker communication channel in the covered attack paths
- no validator-controlled message can preempt harness verification
- the parent accepts only the harness-owned bounded envelope as the validator result
- the runtime builtin allowlist cannot be bypassed through `process` or global access in the covered attack paths
- success and failure transport remain bounded
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
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, fabricated-descriptor execution, direct-worker source, mutable-limit, UTF-8 result-byte, success-transport, failure-transport, and worker-channel defects are corrected, but runtime sandboxing of validator execution remains future work and the HOLD stays in place.
