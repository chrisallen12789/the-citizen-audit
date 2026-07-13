# Phase 4.1 - Coverage Matrix for Validator Cross-Realm Boundary Checkpoint

Authoritative base: `3ecddc1359fc1285e65ff6b635868b57cdecdd6d`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - production validator source selection, fabricated descriptor execution, direct worker source bypass, immutable reviewed limits, UTF-8 transport enforcement, private worker channel ownership, shared-intrinsic mutation, MessagePort prototype dispatch, dependency-substitution/hash-prototype, realpath Buffer facade, console/stdout MessagePort, own/inherited/post-lock global authority, symbol-keyed dispatcher, cross-realm host-authority, local-require host-exception, and failed-module cache-poisoning attacks are locked down; OS confinement still pending by instruction**

Status legend:
- **PASS** - executed in this workspace and passed
- **FIXED** - defect reproduced, corrected, and regression added
- **SUITE** - covered by the repository suite run in this workspace
- **NOT LOCAL** - not directly reproducible on this host

## Capability-Audit Completeness

Probe matrix: 30/30 forms flagged, zero fail-open.

Repository audit result:
- 92/92 capable files owned
- 0 unexplained files
- 0 violations
- 0 stale classifications

No broad capability declarations were added.

## Mandatory Cases Covered In This Checkpoint

| Case | Status | Evidence |
|---|---|---|
| Validator replaces `MessagePort.prototype.postMessage` to forge success | FIXED | direct worker regression proves thrown validation still returns bounded `VALIDATOR_THROW`, with no forged pass |
| Validator replaces `MessagePort.prototype.close` to suppress or alter completion | FIXED | direct worker regression proves harness completion and success envelope still arrive through the private port |
| Symbol-keyed `globalThis` property exposes Undici-like Agent | FIXED | direct worker preloads `Symbol.for("undici.globalDispatcher.1")` with an Agent-like object and proves validator enumeration cannot recover it |
| `Object.getOwnPropertySymbols(globalThis)` exposes raw host object/function | FIXED | symbol-keyed nonprimitive values are neutralized before validator bytes execute |
| `Reflect.ownKeys(globalThis)` locates Agent/Pool/Client/Dispatcher authority | FIXED | regression scans reflected symbol keys and finds no dispatcher constructors, dispatch methods, factories, maps, callbacks, or manufactured pools |
| `Symbol.for("undici.globalDispatcher.1")` recovers Agent | FIXED | regression proves the symbol lookup returns no raw dispatcher authority |
| Inherited symbol authority on the direct host global prototype is reachable | FIXED | validator executes in a null-prototype frozen context and regression proves `Symbol.for("audit.inherited.dispatcher")` exposes no Agent-like object |
| Inherited symbol authority farther up the host global prototype chain is reachable | FIXED | regression installs Agent-like authority on `Object.prototype` and proves validator global prototype traversal ends at `null` |
| Inherited accessor lazily returns Agent-like authority | FIXED | regression installs an inherited accessor and proves validator recursive descriptor inspection cannot recover it |
| Non-configurable inherited symbol descriptor remains reachable | FIXED | regression installs a non-configurable inherited symbol descriptor and proves the detached validator global hides it |
| Post-lock symbol authority installed by `process.nextTick` is reachable | FIXED | regression schedules a preloaded nextTick addition and proves the frozen validator global cannot see it |
| Post-lock symbol authority installed by microtask, Promise, or immediate callback is reachable | FIXED | regression schedules `queueMicrotask`, resolved Promise, and `setImmediate` additions and proves none are validator-visible |
| Primitive-valued symbol can be rewritten to nonprimitive authority after lockdown | FIXED | validator attempts the rewrite and recursive inspection confirms no dispatcher-like value is visible |
| String-keyed inherited or post-lock authority remains reachable | FIXED | regression installs string-keyed Agent-like globals on the host global/prototype chain and through late callbacks; validator sees none |
| CommonJS shim exposes host constructors through `require`, `module`, or `exports` | FIXED | worker passes null-prototype `module`/`exports` and a constructor-hidden frozen require function into the validator context |
| Validator-visible global can accept new properties after lockdown | FIXED | validator asserts `Object.isExtensible(globalThis) === false`, `Object.isFrozen(globalThis) === true`, and `Object.getPrototypeOf(globalThis) === null` |
| Non-writable/non-configurable symbol-keyed authority cannot be neutralized | FIXED | worker fails closed before validator execution and marker creation |
| Host-created validation context recovers host global through constructor chain | FIXED | direct worker regression serializes context in the harness, parses it inside the validator realm, and proves `Object.getPrototypeOf(context).constructor.constructor(...)` cannot reach host sentinels |
| Host-created `require` function exposes a `.prototype` route to host `Function` | FIXED | CommonJS `require` is created as a context-native frozen callable; top-level and validate-time probes find no host constructor path |
| Host-created capability functions expose `.prototype` routes to host `Function` | FIXED | every reviewed facade callable is context-native, null-prototype, constructor-hidden, and recursively audited |
| Host-realm capability return values expose host prototypes | FIXED | byte, stat, hash, JSON, validation-context, and dependency return values are materialized inside the validator realm and recursively audited |
| Dependency module arrays, objects, functions, and factory results recover host authority | FIXED | dependency modules execute from the verified source map inside the validator context, and recursive audit proves dependency return graphs contain no host sentinels |
| Host Agent-like sentinels installed on Object/Function/Array/Map prototypes are reachable through validator-visible values | FIXED | preload installs prototype sentinels and dispatcher-like objects; recursive validator audit finds none through globals, context, facades, module objects, dependencies, descriptors, or prototypes |
| Post-lock host authority installed after scrub is reachable through validator-visible host objects | FIXED | preload schedules nextTick, microtask, Promise, and immediate installations; context-native values provide no path back to the late host globals |
| Complete validator-visible object graph contains host `Function`, host constructors, raw maps, factories, callbacks, or dispatchers | FIXED | new direct worker regression recursively inspects `globalThis`, validation arguments, CommonJS objects, builtin facades, callable own keys/prototypes, descriptors, capability returns, dependency returns, and nested dispatcher-like state with cycle detection |
| Local `require()` host callback throws raw host `WorkerFailure` into validator code | FIXED | host callback catches dependency-load failures and returns primitive status records; validator realm creates the catchable failure record |
| Direct dependency failure at entry-module top level exposes host realm | FIXED | regression catches the failure at top level and recursively audits the caught value, constructor chains, descriptors, `.stack`, `.cause`, and nested values |
| Direct dependency failure inside `validate()` exposes host realm | FIXED | same attack is repeated inside `validate()` and no host global, Agent-like sentinel, dispatcher, factory, callback, raw `Map`, or Pool is recovered |
| Transitive dependency failure exposes host realm | FIXED | entry requires dependency A, A requires dependency B that throws, and both top-level and validate-time catch paths remain membrane-protected |
| Arbitrary thrown values cross the host boundary through dependency loading | FIXED | regressions cover `Error`, custom `Error`, `AggregateError`, string, symbol, `null`, object, array, proxy, accessors, `Error.cause`, and hostile `toString`/`message`/`name`/`stack` accessors |
| Caught require-failure representation contains host identity | FIXED | recursive caught-error audit checks own keys, symbol keys, descriptors, getters/setters, prototypes, constructors, `.stack`, `.cause`, nested objects/functions/arrays, and iterator-like surfaces |
| Inherited or post-lock host sentinels are reachable through caught require failures | FIXED | preload installs Agent-like authority on host prototypes and through nextTick, microtask, Promise, and immediate callbacks; caught failures expose none of it |
| Uncaught local dependency failure leaks host message data | FIXED | direct worker regression proves uncaught dependency failure fails closed with bounded `VALIDATOR_THROW` and no default-channel messages |
| Local require failure membrane breaks ordinary dependencies | FIXED | regression verifies normal direct dependencies, transitive dependencies, cycles, builtin facades, and dependency export graphs still load as context-native values |
| Failed direct module remains cached after top-level execution throws | FIXED | repeated top-level and validate-time requires must throw again; a returned provisional export fails the focused lifecycle regression |
| Failed transitive leaf or incomplete ancestor remains reusable | FIXED | regression retries the failed parent, directly retries the leaf, and repeats both paths; every attempt fails through the reviewed membrane rather than returning partial exports |
| Failed module exports a reusable primitive, function, object, nested object, array, or cyclic graph | FIXED | every partial-export shape is exercised across multiple retries and remains absent after failure |
| Cache rollback clears successful unrelated modules or breaks CommonJS cycles | FIXED | successful direct/transitive modules and both cycle participants retain identity; cache deletion uses a captured trusted `Map.prototype.delete` operation |
| `console._stdout` exposes worker stdio `MessagePort` | FIXED | direct production-worker regression proves global `console` is unavailable and parent-side stdio bytes remain 0 |
| `console._stderr` exposes worker stdio `MessagePort` | FIXED | same regression proves `_stderr` is unavailable |
| `console.Console` exposes host constructor or streams | FIXED | same regression proves `Console` is unavailable |
| Symbol enumeration recovers internal stdio `MessagePort` | FIXED | same regression attempts symbol traversal and observes no raw port or direct payload |
| Direct `stdioPayload` message crosses before byte enforcement | FIXED | 400,000-byte direct stdio attempt produces 0 observed stdout/stderr bytes and exactly one private harness envelope |
| Default worker globals expose raw host authority | FIXED | direct worker regression proves reviewed-dangerous globals such as console, performance, fetch, crypto, structuredClone, timers, streams, and messaging constructors are unavailable |
| fs facade writes directly to stdout/stderr file descriptors | FIXED | `fs.writeFileSync(1, ...)` and `fs.writeFileSync(2, ...)` are rejected and produce 0 observed stdio bytes |
| `fs.realpathSync(__filename, "buffer")` returns raw host `Buffer` | FIXED | direct production-worker regression proves all realpath overloads return primitive strings |
| `fs.realpathSync(__filename, { encoding: "buffer" })` recovers host `Buffer.allocUnsafe` | FIXED | realpath facade ignores caller-selected encodings and never returns a Buffer object |
| JSON facade parsing returns host-prototype objects | FIXED | capability regression proves parsed objects are null-prototype and parsed arrays hide constructor recovery |
| Worker/result-port cleanup leaks handles across full commands | FIXED | validation-cycle and test launchers close ports, destroy stdout/stderr streams, and await worker termination where needed |
| Validator modifies a later dependency after registry hashing and before `require()` | FIXED | dependency-substitution regression proves the worker executes the pre-captured original dependency bytes |
| Validator mutates crypto Hash prototype to falsify dependency hashing | FIXED | same regression proves raw `Hash` prototypes are not exposed and modified dependency bytes do not execute |
| Closure verification happens lazily after validator top-level code starts | FIXED | worker verifies and captures every closure module before compiling the entry module; dependency replacement marker stays absent |
| Capability facades return raw `crypto.Hash`, `Buffer`, fs `Stats`, stream, file-handle, or path parse objects | FIXED | facade return-object regression proves null-prototype wrappers and absence of raw factories/object-returning path helpers |
| Raw host capability errors cross into validator code | FIXED | capability wrappers convert facade failures to fixed primitive failures rather than raw host `Error` instances |
| Validator replaces `Promise.prototype.then` to fabricate approval | FIXED | direct worker regression proves `validate()` runs and throwing validation fails with `VALIDATOR_THROW` |
| Validator replaces `Promise.prototype.catch` to change rejection handling | FIXED | direct worker regression proves rejected validation fails with `VALIDATOR_REJECTION` |
| Validator can pass without `validate()` executing | FIXED | marker regression proves success is possible only after exactly one validate invocation |
| Throwing `validate()` can be reported as passed | FIXED | Promise-prototype forged-approval regression fails closed |
| Validator replaces `Array.prototype.push` to suppress normalization problems | FIXED | invalid-status regression still records `status is invalid` and returns failed |
| Invalid status normalizes to passed | FIXED | invalid status remains failed after Array prototype replacement |
| Validator replaces `Array.prototype.slice`, `includes`, `sort`, iterator methods, or `Symbol.iterator` | FIXED | array/string prototype regression still enforces array bounds |
| Validator replaces `String.prototype.slice`, `startsWith`, or `split` | FIXED | closure-local `require("node:fs")` and transport enforcement still behave correctly after attempted mutation |
| Validator replaces `Object`, `Map`, `Set`, `JSON`, `Buffer`, `Error`, `RegExp`, `Promise`, `String`, `Function`, or prototypes | FIXED | broad intrinsic mutation regression still fails invalid status closed and cannot forge envelope sizing |
| Thenables bypass rejection or normalization | FIXED | thenable resolve/reject regressions fail closed or normalize invalid status to failed |
| Custom `Promise` subclasses bypass normalization | FIXED | subclass regression resolves invalid status and remains failed |
| Constructor chains recover trusted harness functions or lexical state | FIXED | host facade regression cannot recover process authority or `HARNESS_RESULT_PORT` lexical state |
| Host capability facades expose host constructors | FIXED | explicit builtin facades and safe byte/stat/hash/path wrappers have null-prototype/constructor-hidden surfaces |
| Direct `parentPort` message reaches parent | FIXED | direct parentPort regression observes no direct messages |
| Direct `MessagePort` or `MessageChannel` reaches parent | FIXED | MessagePort/MessageChannel regression observes no direct messages |
| MessagePort prototype replacement alters private channel result | FIXED | captured call-bound `postMessage`/`close` operations are used against the harness-owned port |
| Forged success envelope can preempt runtime contract verification | FIXED | regression proves mismatched runtime contract fails with `VALIDATOR_RESULT_INVALID` |
| Validator can obtain `parentPort` with `process.getBuiltinModule("worker_threads")` | FIXED | runtime guard disables process builtin acquisition before validator bytes execute |
| `process.getBuiltinModule()` bypasses the recorded builtin allowlist | FIXED | regression proves `child_process`, `net`, `worker_threads`, and `module` are not reachable |
| Failure worker message can transport arbitrary validator exception text | FIXED | worker sends only bounded serialized failure envelopes with fixed reviewed codes |
| Parent accepts unchecked worker messages | FIXED | production validation cycle rechecks complete serialized envelopes and ignores default-channel validator messages |
| Complete transport limit definition is ambiguous | FIXED | review report and tests define `maxResultBytes` as the complete serialized worker response envelope |
| Direct import of production validator-closure or validation-cycle exposes configurable source selection | FIXED | production modules expose no alternate root, directory, entry source, descriptor, or execution-surface override |
| Direct launch of `kernel/execution/validator-worker.js` accepts caller-supplied closure or contract material | FIXED | production worker reconstructs the authoritative descriptor from the reviewed registry and ignores caller-supplied source material |
| Fabricated workerData can execute validator bytes from an external temporary root | FIXED | direct worker regression proves the production worker fails closed and creates no marker files |
| Production worker can skip authoritative `validatorSetHash` binding | FIXED | direct worker mismatch regression proves the worker rejects mismatched hashes before execution |
| Direct import or workerData can mutate reviewed result and array limits | FIXED | `validation-cycle.js` exports no mutable `LIMITS`; worker ignores caller `limits` |
| Measured success representation differs from transported object | FIXED | worker transports only the exact checked serialized envelope string |
| `toJSON`, accessor, prototype getter, structured clone, multibyte, emoji, circular result attacks | FIXED | retained direct worker regressions remain green |
| Production code imports `tests/**` or `tests/support/**` | FIXED | import-graph regression scans every `kernel/**/*.js` file |
| Immutable lookup can expose inherited Object prototype values or unsafe ids | FIXED | own-property/null-prototype lookup and unsafe-id regressions remain green |
| Closure implementation identity is bound to metadata-only bytes | FIXED | regression proves the recorded loader hash equals `registry-core.js` and mutating that identity changes `validatorSetHash` |
| Replacement checkpoint patch can be rejected because of BOM or CRLF conversion | FIXED | packaging uses raw Git diff bytes and verifies no BOM, LF-only newlines, and `git apply --check` from the exact parent |

## Suites Run For This Checkpoint

| Suite | Result |
|---|---|
| focused failed-module cache lifecycle (`--test-name-pattern="cache lifecycle"`) | PASS, 1/1, normal exit on this host |
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 137/137 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 56/56, normal exit on this host |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 92/92 owned, 0 unexplained, 0 violations |
| repository JavaScript syntax sweep | PASS, 147 tracked `.js` files checked |
| `npm run runtime:integration:test` | PASS, 28/28, normal exit on this host |
| three consecutive clean-checkpoint runs of the exact required five-command set | PASS on Windows: 56/56 orchestrator, 28/28 integration, 48/48 isolation, 31/31 fault, and 333/333 aggregate in every run; all commands exited zero with zero tracked residue and zero new Node processes |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run execution:test` | PASS, 333/333, normal exit on this host |
| `npm run qa` | PASS, 159 HTML files |
| `git diff --check` | PASS |
| `git fsck --full` | PASS |
| Linux-host normal termination reproduction | NOT LOCAL, WSL has no installed distro and Docker is unavailable in this desktop session |

## Residual Items Intentionally Not Started Here
- OS-level validator confinement
- independent Linux-host termination reproduction, because no Linux runtime is installed locally
- later confinement and runtime hardening outside this intrinsic-hardening checkpoint
