# Phase 4.1 - Coverage Matrix for Validator Channel-Lockdown Checkpoint

Authoritative base: `e73517535bb6fefb98b7b8355d2671a66fab49ec`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - production validator source selection, fabricated descriptor execution, direct worker source bypass, immutable reviewed limits, UTF-8 result-byte enforcement, success/failure transport binding, and worker channel impersonation are locked down; OS confinement still pending by instruction**

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
| Validator can obtain `parentPort` with `process.getBuiltinModule("worker_threads")` | FIXED | worker disables host process builtin acquisition before validator bytes execute and direct worker regression observes no direct messages |
| Validator can send a 400,000-byte default-channel message | FIXED | direct worker regression proves no oversized raw message reaches the parent |
| Parent accepts the first valid-looking worker message as success | FIXED | parent now accepts only the harness-owned result port envelope |
| Forged success envelope can preempt runtime contract verification | FIXED | regression proves mismatched runtime contract fails with `VALIDATOR_RESULT_INVALID` and cannot report `passed` |
| Throwing validator can preemptively report `passed` | FIXED | forged-envelope regression verifies `validate()` throw cannot be hidden by an early message |
| `globalThis.process` or `global.process` can recover the channel | FIXED | regression proves global process aliases are unavailable |
| `Function("return process")()` or constructor-chain variants can recover the channel | FIXED | regression covers direct `Function`, object-constructor, `require.constructor`, and `module.constructor` paths |
| `process.getBuiltinModule()` bypasses the recorded builtin allowlist | FIXED | regression proves `child_process`, `net`, `worker_threads`, and `module` are not reachable |
| Validator mutation of host primordials weakens envelope construction | FIXED | regression mutates `JSON`, `Buffer`, `Promise`, `Object`, `Map`, `Set`, and `Array` methods and still fails closed on oversized output |
| Failure worker message can transport an arbitrary validator exception string | FIXED | worker sends only a bounded serialized failure envelope with fixed reviewed codes |
| Validator throwing a 400,000-character ASCII `Error` can exceed `maxResultBytes` | FIXED | direct worker regression proves the complete envelope stays within the reviewed byte bound |
| Validator throwing a large emoji or multibyte `Error` can exceed `maxResultBytes` | FIXED | direct worker regression proves emoji failure messages remain compact and bounded |
| Rejected `Promise` containing a large `Error` can exceed `maxResultBytes` | FIXED | direct worker regression proves rejection reasons use `VALIDATOR_REJECTION` without raw message transport |
| Parent accepts unchecked failure messages | FIXED | production validation cycle rechecks the complete serialized envelope before parsing success or failure |
| Complete transport limit definition is ambiguous | FIXED | review report and tests define `maxResultBytes` as the complete serialized worker response envelope |
| Direct import of `kernel/execution/validator-closure.js` exposes configurable closure construction | FIXED | production module exports only fixed policy metadata; regression directly probes missing builder/root-selector exports |
| Direct import of `kernel/execution/validation-cycle.js` accepts caller-supplied descriptors or closure material | FIXED | production cycle accepts only validator ids plus expected authoritative `validatorSetHash`; fabricated descriptor regression fails closed |
| Direct launch of `kernel/execution/validator-worker.js` accepts caller-supplied closure or contract material | FIXED | production worker reconstructs the authoritative descriptor from the reviewed registry and ignores caller-supplied source material |
| Production kernel surface still exposes injected execution surfaces or override flags | FIXED | direct-require regression enumerates production orchestrator and validator modules |
| Fabricated workerData can execute validator bytes from an external temporary root | FIXED | direct worker regression proves the production worker fails closed and creates no marker files |
| Production worker can skip authoritative `validatorSetHash` binding | FIXED | direct worker mismatch regression proves the worker rejects mismatched hashes before execution |
| Direct import can mutate production validator result and array limits | FIXED | `validation-cycle.js` exports no `LIMITS`; immutable reviewed limits remain in `validator-limits.js` |
| Direct worker launch can weaken reviewed result-byte bounds with `Infinity` | FIXED | worker ignores caller `limits`; regression proves oversized authoritative results still fail |
| Direct worker launch can tighten reviewed result-byte bounds with `maxResultBytes = 1` | FIXED | regression proves authoritative validator still passes under reviewed internal bounds |
| Measured success representation differs from transported object | FIXED | worker transports only the exact checked serialized envelope string and never posts a raw normalized object |
| Non-enumerable `toJSON()` can shrink checked success representation | FIXED | direct worker regression proves `toJSON()` is not invoked and no oversized payload reaches the parent |
| Accessor getters can produce a smaller checked value than transported success value | FIXED | direct worker regression proves accessor properties are rejected without invoking the getter |
| Prototype getters or custom class instances can bypass the result ceiling | FIXED | direct worker regression proves prototype-backed and non-plain values fail closed |
| Multibyte BMP Unicode payload can exceed reviewed byte ceiling | FIXED | regression proves BMP Unicode result fails closed by UTF-8 byte count |
| Astral-character or emoji payload can exceed reviewed byte ceiling | FIXED | regression proves emoji result fails closed by UTF-8 byte count |
| Multibyte payload immediately below the reviewed envelope ceiling can still pass | FIXED | regression proves a below-limit multibyte result passes unchanged |
| Circular or unserializable validator result can cross the worker boundary | FIXED | regression proves non-transport-safe result surfaces fail closed before acceptance |
| Production code imports `tests/**` or `tests/support/**` | FIXED | import-graph regression scans every `kernel/**/*.js` file |
| Immutable lookup can expose inherited Object prototype values | FIXED | null-prototype lookup backing plus own-property `get` and `has` regression |
| Unsafe validator ids can poison lookup behavior | FIXED | `__proto__`, `prototype`, and `constructor` are rejected with regressions |
| Closure implementation identity is bound to metadata-only bytes | FIXED | regression proves the recorded loader hash equals `registry-core.js` and mutating that identity changes `validatorSetHash` |
| Replacement checkpoint patch can be rejected because of BOM or CRLF conversion | FIXED | packaging uses raw Git diff bytes and verifies no BOM, LF-only newlines, and `git apply --check` from the exact parent |

## Suites Run For This Checkpoint

| Suite | Result |
|---|---|
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 114/114 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 56/56 |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 92/92 owned, 0 unexplained, 0 violations |
| repository JavaScript syntax sweep | PASS, 147 tracked `.js` files checked |
| `npm run runtime:integration:test` | PASS, 28/28, normal exit on this host |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run execution:test` | PASS, 310/310, normal exit on this host |
| `npm run qa` | PASS, 159 HTML files |
| `git diff --check` | PASS |
| `git fsck --full` | PASS |
| Linux-host normal termination reproduction | NOT LOCAL, WSL has no installed distro and Docker is unavailable in this desktop session |

## Residual Items Intentionally Not Started Here
- OS-level validator confinement
- independent Linux-host termination reproduction, because no Linux runtime is installed locally
- later confinement and runtime hardening outside this channel-lockdown checkpoint
