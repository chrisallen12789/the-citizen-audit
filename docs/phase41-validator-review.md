# Phase 4.1 - Validator Worker Cross-Realm Boundary Review

Base checkpoint: `d4a6e88039eb0c620cb43c7e87e5c1bab29ed0f6`
Review commit: `(this checkpoint)`
Ruling: **HOLD - production validator source selection, direct worker source bypass, immutable reviewed limits, UTF-8 transport enforcement, private worker channel ownership, shared-intrinsic mutation, MessagePort prototype dispatch, dependency-substitution/hash-prototype, realpath Buffer facade, console/stdout MessagePort, own/inherited/post-lock global authority, symbol-keyed dispatcher, cross-realm host-authority, local-require host-exception, failed-module cache-poisoning, and failed CommonJS cycle peer poisoning attacks are locked down; OS confinement still pending by instruction**

## Scope
This checkpoint continues from rejected checkpoint `d4a6e88039eb0c620cb43c7e87e5c1bab29ed0f6` and closes the remaining failed CommonJS cycle peer poisoning defect:

1. validator modules still compile and execute inside a separate `vm` context with a frozen null-prototype validator global
2. validator top-level code and `validate()` now receive only validator-realm `module`, `exports`, `require`, builtin facades, validation context objects, arrays, byte wrappers, stat wrappers, hash wrappers, JSON parse results, and dependency return values
3. the worker no longer passes host-created validation context objects, host CommonJS functions, host capability wrapper functions, or host JSON result objects into validator-visible code
4. context-native capability facades call a hidden host bridge that accepts serialized primitive/byte-marker arguments and returns only primitives or validator-realm wrappers
5. capability bridge return values are materialized inside the validator realm, with host Buffers encoded through a captured `Buffer.isBuffer` and copied into safe byte wrappers
6. the CommonJS shim is created inside the validator context, so `require.prototype`, callable `.prototype` objects, and constructor-chain probes do not climb back into the harness realm
7. the validation context is serialized in the harness and parsed inside the validator realm, preventing `Object.getPrototypeOf(context).constructor.constructor(...)` host-global recovery
8. local dependency load failures are converted at the host/validator boundary into primitive response records; catchable require failures are created inside the validator realm as frozen null-prototype records
9. failed dependency modules no longer remain in the provisional CommonJS cache after compilation or top-level execution failure
10. completed cycle peers that successfully received a failed module's provisional exports are recursively invalidated before they can return stale partial exports
11. catching a reviewed dependency failure without receiving exports does not taint the catching module
12. the previously verified console/stdout lockdown, durable global freeze, realpath string-only facade, pre-execution closure capture, MessagePort prototype hardening, crypto Hash wrapper, dependency-substitution protection, bounded transport, source-selection lockdown, immutable limits, require-failure membrane, and validatorSetHash verification remain in force

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

### Symbol-Keyed Global Authority Lockdown
The worker still audits symbol-keyed host globals as a fail-closed preflight class:
- `Object.getOwnPropertySymbols(globalThis)` is captured and used by trusted code before validator execution
- symbol-keyed primitive values, such as harmless string tags, may remain
- symbol-keyed objects, functions, accessors, Undici Agent-like dispatchers, raw pools/clients, internal factories, maps, callbacks, and options objects are neutralized before validator code runs
- writable non-configurable symbol globals are overwritten with `undefined`
- non-writable/non-configurable symbol globals fail worker startup closed before validator module loading

This is intentionally not tied to a single display string such as `Symbol(undici.globalDispatcher.1)`. The lockdown is value-oriented: any symbol-keyed nonprimitive global authority is removed or causes fail-closed startup.

### Durable Validator-Visible Global Boundary
The symbol preflight is now backed by a durable validator-visible boundary rather than a one-time host-global snapshot:
- validator code executes in a separate `vm` parsing context
- `Object.setPrototypeOf(globalThis, null)` removes inherited string-keyed and symbol-keyed authority from the validator global
- `Object.freeze(globalThis)` makes the validator global non-extensible and prevents post-lock additions or rewrites
- context self-audit verifies the global prototype is null, the global is frozen/non-extensible, and no symbol-keyed nonprimitive value remains before validator module compilation
- preloaded `process.nextTick`, `queueMicrotask`, resolved Promise, and `setImmediate` callbacks that add host globals cannot affect the already-detached validator global
- validator-visible `require`, `module`, and `exports` do not expose host constructors or the harness global through prototype or constructor chains

### Validator-Visible Object Graph Boundary
The durable global boundary is now paired with a host-free validator-visible object graph:
- `module`, `exports`, and `require` are constructed inside the validator context rather than in the host harness
- facade functions are context-native frozen callables with null prototypes and hidden constructors
- host capability execution is reached only through a hidden bridge closure that is not exposed in any enumerable, prototype, descriptor, or return-value graph visible to validator code
- bridge arguments are serialized in the validator realm and decoded by trusted host code; bridge responses are serialized by trusted host code and materialized back into validator-realm values
- `Buffer.from()`, `Buffer.concat()`, `fs.readFileSync()`, and hash `digest()` return safe byte wrappers created in the validator realm, not host Buffers or host JSON marker objects
- `fs.statSync()` and `fs.lstatSync()` return validator-realm stat wrappers with copied primitive metadata and reviewed predicate callables
- `JSON.parse()` and validation context parsing produce frozen data whose objects are null-prototype records and whose arrays hide constructor recovery
- dependency modules execute from the preverified in-memory source map and return validator-realm objects/functions, so dependent-module arrays, objects, and factory results cannot recover host prototypes
- validator code cannot use `.constructor`, `.prototype`, `Object.getPrototypeOf(...)`, property descriptors, function own keys, arrays, iterators, symbol keys, accessors, or nested return values to recover the host global or a host Agent-like sentinel

### Local Require Failure Membrane
The closure-local CommonJS loader is now total at the validator realm boundary:
- the hidden host callback used by context-native `require()` catches every host exception before returning control to validator code
- successful local dependency loads return only the already context-native dependency export value
- failed local dependency loads return a null-prototype primitive response record to the validator context rather than throwing a host `WorkerFailure`, host `Error`, or arbitrary thrown value
- the validator-realm require wrapper creates and throws a frozen null-prototype `ValidatorRequireFailure` record whose `name`, `message`, and `code` fields are primitive strings
- uncaught dependency failures still fail the worker closed through the reviewed bounded failure envelope

This covers direct dependencies, transitive dependencies, dependency failures during entry-module top-level execution, dependency failures during `validate()`, ordinary `Error` subclasses, `AggregateError`, strings, symbols, `null`, arrays, proxies, accessor-bearing objects, `Error.cause`, and hostile `toString`/`message`/`name`/`stack` accessors. No original host-created thrown value crosses into validator code.

### Failed-Module Cache State
The CommonJS loader now treats the module cache as a three-state machine:
- **absent** before a module begins loading
- **loading/provisional** while a module is actively executing, so legitimate CommonJS cycles can observe provisional exports
- **loaded** only after the wrapper completes normally

Each cache entry records forward dependency edges and reverse-dependent edges when a `require()` call successfully returns exports to its caller. This includes the reviewed cycle case where a loading module returns provisional exports. If module compilation fails, top-level execution throws, or a transitive dependency failure makes an ancestor module fail, the worker removes the failed module and recursively removes every cached module that successfully received exports from the failed graph. A later `require()` retries initialization and fails again instead of returning partially initialized exports. Successful direct modules, successful transitive modules, unrelated modules, parents that caught a reviewed failure without receiving exports, and successful cycles remain cached.

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
- a two-module failed cycle `A -> B -> A` invalidates completed peer `B` after `B` captured `A`'s provisional exports and `A` later throws
- repeated requires of both participants in the failed two-module cycle retry initialization and never return cached partial exports
- a three-module failed cycle `A -> B -> C -> A` invalidates all completed peers that captured failed provisional exports
- failed cycles containing primitive fields, functions, nested objects, arrays, cyclic object graphs, and reassigned `module.exports` do not leave recoverable partial exports
- failed-cycle retries cover `Error`, custom `Error`, `AggregateError`, string, symbol, `null`, plain object, array, proxy, revoked proxy, accessor-bearing object, and `Error.cause`
- unrelated modules loaded before and during the failed cycle remain cached with stable identity, proving the cache is not cleared indiscriminately
- successful two-module and three-module CommonJS cycles remain supported and cached
- cache-state marker counts prove failed entries, failed acyclic ancestors, completed cycle peers that captured failed provisional exports, and transitive dependents of those peers are absent after failure
- a direct dependency that assigns primitive, callable, and nested partial exports before throwing fails on every retry and never returns partial exports
- a dependency required and caught at entry-module top level fails again when required during `validate()`
- a transitive parent module that assigns a partial callable export and then observes a leaf failure is removed from cache along with the failed leaf
- direct leaf retries after a transitive failure re-execute and fail again rather than returning a provisional object
- repeated retries of failed direct, transitive, function-export, object-graph-export, and arbitrary-thrown modules all expose only reviewed validator-realm failure records
- arbitrary thrown values in failed modules include `Error`, custom `Error`, `AggregateError`, string, symbol, `null`, plain object, array, proxy, revoked proxy, proxy prototype trap, accessor-bearing object, and `Error.cause`
- failed modules that partially export functions, nested arrays, nested objects, functions, and cyclic object graphs cannot be recovered or invoked through later `require()` calls
- successful direct and transitive modules execute once and remain cached
- successful CommonJS cycles retain reviewed provisional behavior and remain available after completion
- cache-state marker counts prove loading entries exist only during active execution, failed entries return to absent, failed transitive ancestors are absent, and successful entries remain cached
- every repeated failure is recursively audited for prototype, constructor, host-global, Agent, Pool, Client, Dispatcher, raw `Map`, factory, callback, stdio, and direct-message regressions
- a declared direct dependency that throws at module top level can be caught by the entry validator without exposing host `WorkerFailure`, host `Error`, host prototypes, host constructors, host globals, inherited Agent-like sentinels, dispatcher functions, factories, callbacks, raw `Map`s, or manufactured pools
- the same direct dependency failure path remains host-free when caught inside `validate()`
- transitive dependency failures are membrane-protected both at entry-module top level and during `validate()`
- dependency thrown values including `Error`, custom `Error` subclasses, `AggregateError`, strings, symbols, `null`, plain objects, arrays, proxies, accessor objects, `Error` with `cause`, and hostile accessor-bearing objects cannot escape as host-visible authority
- every catchable require-failure representation is recursively audited across own keys, symbol keys, descriptors, getters, setters, prototype chains, constructor chains, `.stack`, `.cause`, nested objects, functions, arrays, and iterator-like surfaces
- inherited host sentinels and late-installed host sentinels scheduled by `process.nextTick`, `queueMicrotask`, a resolved Promise, and `setImmediate` remain unreachable through caught require failures
- bridge failure paths for builtin facades still expose only reviewed validator-realm failures
- normal direct dependencies, transitive dependencies, cycles, builtin facades, and dependency export graphs continue to function with context-native values
- uncaught local dependency failure fails closed without exposing host messages or default-channel messages
- `Object.getPrototypeOf(context).constructor.constructor("return globalThis")()` cannot recover the host global from the validation context
- `Object.getPrototypeOf(require.prototype).constructor.constructor("return globalThis")()` is absent or fails closed at module top level and during `validate()`
- every exposed callable, including `fs`, `crypto`, hash, `Buffer`, `path`, `util`, and `assert` facade functions, lacks a host-realm prototype/constructor recovery path
- nonprimitive capability returns, including JSON arrays/objects, byte wrappers, stat wrappers, hash wrappers, dependency exports, dependency arrays/objects, and dependency factory results, expose no host prototypes, constructors, sentinels, maps, factories, callbacks, or dispatcher-like objects
- the host realm cannot be recovered during validator module top-level execution before `module.exports` is assigned
- the host realm cannot be recovered during `validate()` through arguments, globals, CommonJS objects, builtin facades, return values, descriptors, or nested prototypes
- Agent-like sentinels installed on the host global, the host global prototype, `Object.prototype`, `Function.prototype`, `Array.prototype`, and `Map.prototype` remain unreachable through the complete validator-visible graph
- post-lock Agent-like sentinels scheduled through `process.nextTick`, `queueMicrotask`, a resolved Promise, and `setImmediate` remain unreachable through context, loader, capability, or return-value paths
- recursive object-graph inspection with cycle detection covers `globalThis`, validation arguments, `require`, `module`, `exports`, all builtin facades, callable own keys, callable `.prototype` values, prototype chains, descriptors, capability return values, dependency return values, and nested dispatcher-like state
- normal authoritative validators still pass with context-native Buffer/JSON/facade values
- `Object.getOwnPropertySymbols(globalThis)` exposes no raw host object or function after a preloaded Agent-like symbol global is scrubbed
- `Reflect.ownKeys(globalThis)` cannot locate an Undici-like Agent, Pool, Client, Dispatcher, dispatch method, internal factory, clients `Map`, options object, callback function, or manufactured Pool
- `Symbol.for("undici.globalDispatcher.1")` cannot recover a host Agent-like dispatcher
- an Agent-like object inherited from the direct host global prototype is invisible to validator code
- an Agent-like object inherited farther up the host global prototype chain, including `Object.prototype`, is invisible to validator code
- an inherited accessor returning Agent-like authority is invisible to validator code
- a non-configurable inherited symbol descriptor is invisible to validator code
- `process.nextTick`, `queueMicrotask`, Promise, and `setImmediate` late-installed symbol and string global authority is invisible to validator code
- an existing primitive-valued symbol cannot be rewritten into validator-visible nonprimitive authority after lockdown
- validator-side recursive inspection confirms the visible global prototype is null and the visible global is frozen/non-extensible
- `require`, `module`, and `exports` constructor chains cannot recover host authority
- writable non-configurable symbol-keyed dispatcher globals are neutralized
- non-writable/non-configurable symbol-keyed dispatcher globals fail closed before validator execution
- no Agent, Pool, Client, Dispatcher constructor or raw internal factory can be recovered from retained global state

Retained direct production-worker regressions prove:
- `console._stdout` is unavailable
- `console._stderr` is unavailable
- `console.Console` is unavailable
- symbol enumeration cannot recover an internal stdio `MessagePort`
- a validator cannot directly send a `stdioPayload` message
- a 400,000-byte output attempt does not cross the parent boundary
- the parent observes `0` stdout/stderr bytes for the reproduced console/stdout attack
- risky default globals do not expose raw host authority
- the fs facade cannot write directly to stdout/stderr file descriptors
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
- validator-security: 139/139
- focused failed-cache and failed-cycle regressions: 5/5
- execution-orchestrator: 56/56
- execution suite: 335/335
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
- execution-orchestrator, runtime-integration, runtime-isolation, fault, and aggregate execution suite all terminated normally on this Windows host
- Linux three-run termination reproduction was not local in this desktop session because WSL has no installed distribution and Docker is unavailable

Host note:
- WSL has no installed Linux distributions and Docker is not installed in this desktop session, so Linux-host termination could not be directly reproduced here. This is recorded as a host limitation, not as a claimed Linux result.

## Additional Confirmations
- all closure bytes are verified and captured before any validator byte executes
- no validator source verification occurs after validator execution begins
- no string-keyed or symbol-keyed default global exposes raw host authority in the covered own, inherited, and post-lock regression paths
- no validator-visible context, CommonJS shim, facade callable, facade return value, dependency return value, descriptor, prototype, or constructor path exposes host-realm authority in the covered object-graph regression paths
- no Undici-like Agent, Pool, Client, Dispatcher, internal factory, clients Map, options object, or callback function is reachable through symbol-keyed global state
- late host-global additions scheduled before worker startup cannot become validator-visible after the durable global is frozen
- validator-visible `globalThis` is null-prototype, frozen, and non-extensible before validator module compilation
- non-neutralizable symbol-keyed authority fails closed before validator execution
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
This checkpoint intentionally stops before OS-level validator confinement. The source-boundary, production-root, direct-import, fabricated-descriptor execution, direct-worker source, mutable-limit, UTF-8 result-byte, success-transport, failure-transport, worker-channel, shared-intrinsic, MessagePort prototype, dependency-substitution/hash-prototype, durable-global, cross-realm host-authority, local-require host-exception, failed-module cache-poisoning, and failed CommonJS cycle peer poisoning defects are corrected in this code line, but OS-level validator confinement remains future work and the HOLD stays in place.
