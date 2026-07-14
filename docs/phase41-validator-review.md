# Phase 4.1 - Validator Worker Cross-Realm Boundary Review

Historical rejected checkpoint: `75c5a9fbdd9c7979bcfa59985b0b55f996cc21c5`
Accepted implementation: `ef8d8cef2a82e3a43eee06013500aacae0682d4a` (`fix: rollback failed validator load transactions`)
Accepted implementation tree: `b945833eb17b9d75111113056ce8cd50b5bf0564`
Ruling: **ACCEPTED - the project owner accepted Phase 4.1 and authorized `VAL-RESULT-001` as RESOLVED, bound to the exact implementation and independent clean-room evidence below.**

Immutable evidence binding:
- `phase41-validator-failed-cycle-cache-checkpoint-ef8d8ce.zip` — 4,364,398 bytes; SHA-256 `46f1ea090306816380d282fb73d60e3407a983bcff2d634fb7671ec7acc098ac`
- `phase41-validator-failed-cycle-cache-ef8d8ce.bundle` — 4,375,400 bytes; SHA-256 `ffb41c0f43f243ad4dbf00a2a598e2484536fd18bc8df8a71370cd076152e54a`
- `phase41-validator-failed-cycle-cache-75c5a9f-to-ef8d8ce.patch` — 53,903 bytes; SHA-256 `64cd8d7c039f7f871ea40f1b6dc6fbbff4b31065a39aa5862a7a38a10477264a`
- `phase41-failed-cycle-cache-final-independent-review.txt` — 8,049 bytes; SHA-256 `5b0153e58ad5173f4e1ad6b19036a877235b0e58b7b28ae5b32948c4af691aac`

Governance state: Phase 4.1 is ACCEPTED and `VAL-RESULT-001` is RESOLVED. PR #21 remains open, draft, inactive, unmerged, and under HOLD; Issues #9 and #15 remain open; runtime activation remains prohibited. This acceptance does not authorize merge, push, deployment, a production-security claim, or an absolute-isolation claim.

Phase 4.2 remains PLANNED: `P42-D001` remains OPEN and provisional; `P42-D002` remains APPROVED and bound to its existing immutable content; `P42-D003` remains OPEN and RECOMMENDED. Phase 4.2 implementation remains prohibited pending its separate governance prerequisites and formal authorization. Phase 4.1 acceptance removes the Phase 4.1 rejection as a blocker; it does not authorize Phase 4.2 implementation.

## Scope
The accepted implementation replaces the historically rejected checkpoint `75c5a9fbdd9c7979bcfa59985b0b55f996cc21c5`. That historical checkpoint correctly removed a directly failed module and unwound ordinary failed ancestors, but a completed CommonJS cycle peer could remain cached while retaining a failed participant's provisional exports. The accepted correction closes that failed-module and failed-cycle cache condition without weakening the reviewed require-failure membrane:

1. validator modules still compile and execute inside a separate `vm` context with a frozen null-prototype validator global
2. validator top-level code and `validate()` now receive only validator-realm `module`, `exports`, `require`, builtin facades, validation context objects, arrays, byte wrappers, stat wrappers, hash wrappers, JSON parse results, and dependency return values
3. the worker no longer passes host-created validation context objects, host CommonJS functions, host capability wrapper functions, or host JSON result objects into validator-visible code
4. context-native capability facades call a hidden host bridge that accepts serialized primitive/byte-marker arguments and returns only primitives or validator-realm wrappers
5. capability bridge return values are materialized inside the validator realm, with host Buffers encoded through a captured `Buffer.isBuffer` and copied into safe byte wrappers
6. the CommonJS shim is created inside the validator context, so `require.prototype`, callable `.prototype` objects, and constructor-chain probes do not climb back into the harness realm
7. the validation context is serialized in the harness and parsed inside the validator realm, preventing `Object.getPrototypeOf(context).constructor.constructor(...)` host-global recovery
8. local dependency load failures are converted at the host/validator boundary into primitive response records; catchable require failures are created inside the validator realm as frozen null-prototype records
9. closure-local loads now use a bounded outer-load transaction journal, an active execution stack, per-load savepoints, cycle floors, and explicit absent, loading, initialized, loaded, and invalid states; only successful outer-transaction commit promotes valid initialized records to loaded, while failure removes the relevant failed descendants and initialization group
10. the previously verified console/stdout lockdown, durable global freeze, realpath string-only facade, pre-execution closure capture, MessagePort prototype hardening, crypto Hash wrapper, dependency-substitution protection, bounded transport, source-selection lockdown, immutable limits, and validatorSetHash verification remain in force

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

### Failed Module Cache Lifecycle
The closure-local CommonJS cache now has an explicit reviewed lifecycle:
- an absent module has no cache entry
- each outermost absent-module load creates one synchronous transaction with an append-only journal and active execution stack; every new identity-stable record is journaled before validator code can observe it
- a wrapper executing in the validator realm is `loading` and exposes its live validator-realm `module.exports` only to a CommonJS back-edge, preserving reassignment and ordinary cycle semantics
- a wrapper that returns successfully becomes transaction-local `initialized`, not independently committed; only a successful outer transaction first validates every live journal record and then promotes all valid initialized records to `loaded`
- each nested load records the current journal length as its rollback savepoint; ordinary nested failure invalidates and removes only records created from that savepoint onward, so an uninvolved caller may catch the reviewed failure and complete
- a back-edge to a loading ancestor records the earliest cycle journal floor across the active group; participant failure rolls back from that floor even if another peer's wrapper already returned or a cycle ancestor catches the reviewed failure
- invalid completed records are removed immediately; invalid executing records remain non-exporting tombstones only until their wrappers unwind, cannot issue later dependency loads, cannot be reseeded recursively, and cannot commit
- records that were loaded before the transaction are never journaled and remain cached with stable identity; no failure clears the complete cache
- cache lookup and deletion use captured call-bound `Map` operations; journal and stack mutation use captured call-bound `Array.prototype.push` and `Array.prototype.pop`, with indexed traversal rather than validator-controlled iterators

For `A -> B -> A`, where B completes after observing A's provisional exports and A then fails, the transaction removes both A and B. A later direct `require()` of either participant retries initialization. The same behavior is covered for three-node cycles, failure at every participant, repeated alternating retries, `module.exports` reassignment, and primitive, function, object, nested-object, array, and self-referential provisional export shapes. Successful direct and transitive loads and successful two- and three-node CommonJS cycles still commit and retain cross-reference identity.

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

The independent clean-room review reproduced the required Linux sequence three consecutive times on the accepted implementation: execution-orchestrator 56/56, runtime-integration 28/28, runtime-isolation 48/48, fault 31/31, and aggregate execution 334/334 in each run. All 15 commands terminated normally with exit status zero, zero tracked residue, and zero surviving Node processes. The earlier desktop-host limitation is historical context only and is not an outstanding Linux-evidence condition.

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
- transaction journals and active stacks use captured `Array.prototype.push`/`pop` operations plus indexed traversal; cache transaction operations use captured `Map.prototype.get`/`has`/`set`/`delete`
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
- the exact focused failed-cycle regression fails on historical rejected parent `75c5a9f` and passes on the accepted implementation
- a two-node `A -> B -> A` cycle cannot retain B after A fails following B's completion; alternating direct A/B retries re-execute both participants every time
- the two-node failure is repeated across primitive, function, object, nested-object, array, and self-referential partial exports, including explicit `module.exports` reassignment before the back-edge
- three-node `A -> B -> C -> A` cycles roll back when A, B, or C fails, and repeated direct retries of every participant reinitialize all three
- an ordinary nested child and descendant failure may be caught while its uninvolved parent completes and remains cached; the failed child and descendant retry, and a dependency loaded before a later failed retry remains identity-stable
- a cycle ancestor that catches another participant's failure is invalidated and cannot commit apparent success, while a caller outside the failed cycle may catch the reviewed failure, complete, and remain cached
- a module loaded before failed transactions and modules loaded by a successful transaction remain cached; successful two- and three-node cycles commit with stable participant and cross-reference identity
- validator-realm replacement attempts against `Map.prototype.get`/`has`/`set`/`delete`, `Array.prototype.push`/`pop`, array iterators, and `Symbol.iterator` do not participate in transaction bookkeeping
- worker failures are classified through a private host WeakMap rather than trapful prototype traversal; a Proxy whose `getPrototypeOf` trap rethrows itself cannot bypass invalidation and is retried in both direct and cyclic failure paths
- the focused worker produces no direct worker messages and zero stdout/stderr bytes, and every caught dependency failure remains the exact frozen null-prototype `name`/`message`/`code` record
- a declared direct dependency that throws at module top level can be caught by the entry validator without exposing host `WorkerFailure`, host `Error`, host prototypes, host constructors, host globals, inherited Agent-like sentinels, dispatcher functions, factories, callbacks, raw `Map`s, or manufactured pools
- the same direct dependency failure path remains host-free when caught inside `validate()`
- transitive dependency failures are membrane-protected both at entry-module top level and during `validate()`
- failed direct modules throw again on repeated require attempts rather than returning provisional exports; the same top-level failure is retried during `validate()`
- compilation failures delete the provisional entry and compile again on each later require attempt
- a failed transitive leaf and every incomplete ancestor are absent on subsequent direct and parent retries, while already completed dependencies retain identity
- failures after primitive, function, object, nested-object, array, and cyclic-object exports never make those partial values reusable
- successful direct and transitive dependencies and both participants in a successful CommonJS cycle remain loaded and identity-stable
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

## Accepted and Independently Reproduced Evidence
- focused failed-cycle regression: 1/1 on the accepted implementation; the exact test exits nonzero on historical rejected parent `75c5a9f`
- validator-security: 138/138
- execution-orchestrator: 56/56
- execution suite: 334/334
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
- independent Linux reproduction: three consecutive runs of execution-orchestrator 56/56, runtime-integration 28/28, runtime-isolation 48/48, fault 31/31, and aggregate execution 334/334; all 15 commands exited zero, terminated normally, and left zero tracked residue and zero surviving Node processes
- historical local-host note: this desktop session lacked a Linux runtime. That limitation did not produce Linux evidence and is superseded as a current evidence condition by the accepted independent Linux reproduction above.

## Additional Confirmations
- no failed initialization participant remains reachable directly or through a cached cycle peer in the focused two- and three-node cases
- every invalidated participant is absent after unwind and executes again on direct retry
- rollback is bounded by the nested savepoint or implicated cycle floor and never clears the complete cache
- modules loaded before a failed transaction and uninvolved callers that catch a nested failure retain identity
- successful ordinary transactions and successful two- and three-node cycles remain cached and identity-stable
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

## Residual Constraints and Nonclaims
The accepted implementation closes the failed-module and failed-cycle cache defects, and the owner decision resolves `VAL-RESULT-001`. This acceptance intentionally does not claim OS-level validator confinement, production security, or absolute isolation. Runtime activation, deployment, merge, and PR or issue state changes remain separately prohibited or unapproved. Phase 4.2 remains PLANNED and its unresolved `P42-D001` and `P42-D003` sequence still requires separate formal authorization.

## Post-Acceptance CI Corrections and Final-Head Evidence

This addendum supplements the original Phase 4.1 acceptance decision; it does not erase, replace, or rewrite that decision. The accepted implementation remains `ef8d8cef2a82e3a43eee06013500aacae0682d4a`, with accepted implementation tree `b945833eb17b9d75111113056ce8cd50b5bf0564`, and the acceptance-recording commit remains `d0fb89f1ba1b22199a2fecec060c1ef6f7265ab9`.

The accepted post-acceptance correction chain is:

- `44f166a59735c7c4b6f1237a58951875c42a0ca8` (`test: use portable validator temp path`), whose direct parent is `d0fb89f1ba1b22199a2fecec060c1ef6f7265ab9`. It corrected a Windows-specific temporary-path construction in `tests/validator-security.test.js`, changed no production file, independently reproduced the parent failure as `EACCES` under non-root Linux, and passed the replacement focused test.
- `e29bd44ce3e83eabc45d3a619dec689d43ccb317` (`fix: keep validator worker alive through timeout`), whose direct parent is `44f166a59735c7c4b6f1237a58951875c42a0ca8`. A permanently pending validator Promise could previously permit worker exit before the parent deadline, nondeterministically producing `WORKER_INTERNAL_FAILURE` rather than `VALIDATOR_TIMEOUT`. The correction captures trusted `MessagePort` ref/close operations and keeps the private result port referenced through reviewed completion or parent timeout. Genuine premature worker exits remain `WORKER_INTERNAL_FAILURE`, and no trusted harness object is exposed to validator code.

Independent-review evidence packages:

- `phase41-ci-path-portability-review.zip` — 4,401,359 bytes; SHA-256 `2a7446304d62b51c10415ce59e24b686f3793c366bf2797647bf8e4b32302bf2`
- `phase41-ci-path-portability.bundle` — 4,424,638 bytes; SHA-256 `3261aa66fedbb2dcf1b312df0d4fa87d36e437463ea03996c70ca667795d356f`
- `phase41-ci-path-portability.patch` — 1,108 bytes; SHA-256 `fe3a1f775ef4d73f4e6caac054314e788f1b583aa3a45ae1ea29463ab9a24ad9`
- `phase41-ci-path-portability-final-independent-review.txt` — 3,895 bytes; SHA-256 `1731aa09aea97499d8e3f4992f3691abc19cf8a7e23e8e09f17261ded55160d5`
- `phase41-validator-timeout-lifecycle-review.zip` — 4,440,130 bytes; SHA-256 `eb012936e5984ae99b4c0b21d55ec6d67e68490f8fc26648fea34d7f26de481a`
- `phase41-validator-timeout-lifecycle.bundle` — 4,428,740 bytes; SHA-256 `5da3ed8e586082e2f61774ad9e20a0839b0a591ca8c4025dd580fb304d9e6cb7`
- `phase41-validator-timeout-lifecycle.patch` — 16,276 bytes; SHA-256 `666ea304242d8534fa2dfb73f44b8ae88e0f94ee772c2970db60104514af2c44`
- `phase41-validator-timeout-lifecycle-final-independent-review.txt` — 8,262 bytes; SHA-256 `5d587722acdfcffdb6b1f9ce78367a9fba4ab829bba8263aab4317c990e4877b`

Independent Linux evidence at `e29bd44ce3e83eabc45d3a619dec689d43ccb317` recorded pending-validator repetitions 25/25, execution-orchestrator 57/57, validator-security 141/141, and aggregate execution 338/338. Every pending validator was classified `VALIDATOR_TIMEOUT`; the repetition produced zero `WORKER_INTERNAL_FAILURE` results, zero execution attempts, zero governed writes, zero surviving Node processes, zero temporary validator artifacts, and a clean worktree.

`e29bd44ce3e83eabc45d3a619dec689d43ccb317` is the final reviewed PR/code head before this documentation addendum, with final reviewed code tree `f38602d44fbe1f7b4d33d246050f5480165d3dbe`. All three GitHub Actions workflows completed successfully on that exact head: Institutional QA run `29289106527`, Execution Engine Tests run `29289106533`, and Execution Engine Phase 4 run `29289106585`.

Phase 4.1 remains ACCEPTED and `VAL-RESULT-001` remains RESOLVED. PR #21 remains open, draft, inactive, unmerged, and under HOLD; Issues #9 and #15 remain open; runtime activation and deployment remain prohibited. No production-security or absolute-isolation claim is authorized. Phase 4.2 remains PLANNED: `P42-D001` is OPEN and provisional, `P42-D002` is APPROVED, and `P42-D003` is OPEN and RECOMMENDED. Phase 4.2 implementation remains prohibited, and this addendum authorizes neither merge nor activation.
