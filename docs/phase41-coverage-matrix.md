# Phase 4.1 - Coverage Matrix for Validator Registry Source-Boundary Checkpoint

Authoritative base: `a47e93a94468c43c59b6c5f39adce732c8722956`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - parent-process registry execution removed; OS confinement still pending by instruction**

Status legend:
- **PASS** - executed in this workspace and passed
- **FIXED** - defect reproduced, corrected, and regression added
- **SUITE** - covered by the repository suite run in this workspace
- **PENDING** - intentionally left for a later checkpoint

## Capability-audit completeness

Probe matrix: 30/30 forms flagged, zero fail-open.

Repository audit result:
- 88/88 capable files owned
- 0 unexplained files
- 0 violations

Relevant audit changes in this checkpoint:
- validator worker execution remains modeled as `processExecution`
- static contract parsing and closure-loading paths remain fully owned
- no broad capability declarations were added

## Mandatory cases covered in this checkpoint

| Case | Status | Evidence |
|---|---|---|
| Registry loading executes top-level validator filesystem side effect | FIXED | `tests/validator-security.test.js` proves no parent-process side effect |
| Registry loading executes rename/unlink/chmod side effect | FIXED | regression added |
| Registry loading executes child-process side effect | FIXED | regression added |
| Registry loading executes worker-thread side effect | FIXED | regression added |
| Registry loading executes network side effect | FIXED | regression added |
| Registry loading executes environment access | FIXED | regression added |
| Registry loading executes approval-store access | FIXED | regression added |
| Registry loading executes ledger access | FIXED | regression added |
| Registry loading executes direct dependency side effect | FIXED | regression added |
| Registry loading executes transitive dependency side effect | FIXED | regression added |
| Static contract parser accepts literal contract without execution | PASS | regression added |
| Static contract parser rejects module export indirection | PASS | regression added |
| Static contract parser rejects dynamic `actions` | PASS | regression added |
| Static contract parser rejects dynamic `supportedPhases` | PASS | regression added |
| Ordinary validator `require` path remains in registry source | FIXED | source regression checks removed patterns |
| Production caller can choose alternate root | FIXED | `execution-orchestrator` regression added |
| Production caller can choose temporary root | FIXED | regression added |
| Production registry loader accepts temporary root | FIXED | regression added |
| Separate test harness can authorize temporary root | PASS | test-only loader regression added |
| Test-only root authorization leaks into production | FIXED | regression added |
| Registry descriptors remain mutable after load | FIXED | deep-freeze assertions added |
| Closure manifests or nested entries remain mutable after load | FIXED | deep-freeze assertions added |
| Validator-set hash omits contract and runtime identities | FIXED | hash-binding assertions added |

## Suites run for this checkpoint

| Suite | Result |
|---|---|
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 74/74 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 47/47 |
| `npm run execution:test` | PASS, 261/261 |
| `npm run runtime:integration:test` | PASS, 28/28 |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 88/88 owned, 0 violations |
| repository JavaScript syntax sweep | PASS |
| `npm run qa` | PASS, 159 HTML files |

## Residual items intentionally not started here
- OS-level validator confinement
- follow-on observed-read coverage work beyond the current registry and worker checks
- later confinement/race hardening checkpoints outside the source-boundary task
