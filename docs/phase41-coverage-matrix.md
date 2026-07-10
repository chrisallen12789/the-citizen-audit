# Phase 4.1 - Coverage Matrix for Validator Preverified-Closure Checkpoint

Authoritative base: `dc9cb25270b95daa6c2b1c37208496b43fc776cf`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - production validator source selection, fabricated descriptor execution, direct worker source bypass, immutable reviewed limits, UTF-8 transport enforcement, private worker channel ownership, shared-intrinsic mutation, MessagePort prototype dispatch, and dependency-substitution/hash-prototype attacks are locked down; OS confinement still pending by instruction**

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
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 127/127 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 56/56, normal exit on this host |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 92/92 owned, 0 unexplained, 0 violations |
| repository JavaScript syntax sweep | PASS, 147 tracked `.js` files checked |
| `npm run runtime:integration:test` | PASS, 28/28, normal exit on this host |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run execution:test` | PASS, 323/323, normal exit on this host |
| `npm run qa` | PASS, 159 HTML files |
| `git diff --check` | PASS |
| `git fsck --full` | PASS |
| Linux-host normal termination reproduction | NOT LOCAL, WSL has no installed distro and Docker is unavailable in this desktop session |

## Residual Items Intentionally Not Started Here
- OS-level validator confinement
- independent Linux-host termination reproduction, because no Linux runtime is installed locally
- later confinement and runtime hardening outside this intrinsic-hardening checkpoint
