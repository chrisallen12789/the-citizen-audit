# Phase 4.1 - Coverage Matrix for Validator Registry Checkpoint

Authoritative base: `21de95cc49556756e9e8e5429ecea394de3cc386`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - parent-process registry execution removed; production override surfaces removed; OS confinement still pending by instruction**

Status legend:
- **PASS** - executed in this workspace and passed
- **FIXED** - defect reproduced, corrected, and regression added
- **SUITE** - covered by the repository suite run in this workspace

## Capability-audit completeness

Probe matrix: 30/30 forms flagged, zero fail-open.

Repository audit result:
- 92/92 capable files owned
- 0 unexplained files
- 0 violations

New owned files in this checkpoint:
- `kernel/execution/orchestrator-core.js`
- `kernel/execution/validators/registry-core.js`
- `tests/support/orchestrator-test-harness.js`
- `tests/support/validator-test-harness.js`

No broad capability declarations were added.

## Mandatory cases covered in this checkpoint

| Case | Status | Evidence |
|---|---|---|
| Mode-change regression uses a genuinely different mode | FIXED | `tests/validator-security.test.js` now derives a different expected mode and asserts it differs |
| Production caller can select another validator directory inside the repository | FIXED | `tests/execution-orchestrator.test.js` regression added |
| Production caller can select a temporary validator directory | FIXED | regression added |
| Production caller can select a copied registry with the same ids | FIXED | regression added |
| Production caller can select always-pass replacement validators | FIXED | regression added |
| Production registry loader accepts caller-selected `validatorsDir` | FIXED | production loader now rejects override directly |
| Production orchestrator exports a test-only execution function | FIXED | export removed; regression added |
| Production validator registry exports a test-only loader | FIXED | export removed; regression added |
| Descriptor collection can be extended or replaced through public API | FIXED | immutable lookup surface replaces exposed `Map` |
| Descriptor collection can be deleted or cleared through public API | FIXED | no mutator methods exist; regression added |
| Contract collection remains mutable | FIXED | immutable lookup surface; regression added |
| Production exports can still reach a test-only root override | FIXED | regression added |

## Suites run for this checkpoint

| Suite | Result |
|---|---|
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 76/76 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 52/52 |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 92/92 owned, 0 unexplained, 0 violations |
| repository JavaScript syntax sweep | PASS |
| `npm run runtime:integration:test` | PASS, 28/28 |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run execution:test` | PASS, 268/268 |
| `npm run qa` | PASS, 159 HTML files |

## Residual items intentionally not started here
- OS-level validator confinement
- later confinement/race hardening outside this registry checkpoint
