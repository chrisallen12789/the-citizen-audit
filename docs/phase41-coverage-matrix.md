# Phase 4.1 - Coverage Matrix for Validator Registry Checkpoint

Authoritative base: `8681daeae981af197f84ed582fe0098893c1740a`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - configurable validator and orchestrator cores are no longer directly importable; OS confinement still pending by instruction**

Status legend:
- **PASS** - executed in this workspace and passed
- **FIXED** - defect reproduced, corrected, and regression added
- **SUITE** - covered by the repository suite run in this workspace

## Capability-audit completeness

Probe matrix: 30/30 forms flagged, zero fail-open.

Repository audit result:
- 90/90 capable files owned
- 0 unexplained files
- 0 violations

New owned files in this checkpoint:
- `tests/support/validator-registry-test-core.js`

No broad capability declarations were added.

## Mandatory cases covered in this checkpoint

| Case | Status | Evidence |
|---|---|---|
| Direct import of `kernel/execution/orchestrator-core.js` exposes configurable execution | FIXED | core export replaced with fixed production executor; regression added |
| Direct import of `kernel/execution/validators/registry-core.js` exposes alternate-directory loading | FIXED | core export replaced with fixed production loader; regression added |
| Production kernel surface still exposes injected execution surfaces or override flags | FIXED | direct-require regression enumerates all production orchestrator/validator modules |
| Production caller can still select another validator directory inside the repository | FIXED | existing rejection regression retained |
| Production caller can still select a temporary validator directory | FIXED | existing rejection regression retained |
| Production caller can still select a copied registry with the same ids | FIXED | existing rejection regression retained |
| Production caller can still select always-pass replacement validators | FIXED | existing rejection regression retained |
| Production code imports `tests/**` or `tests/support/**` | FIXED | import-graph regression scans every `kernel/**/*.js` file |
| Immutable lookup can expose inherited Object prototype values | FIXED | null-prototype lookup backing plus own-property `get`/`has` regression |
| Unsafe validator ids can poison lookup behavior | FIXED | `__proto__`, `prototype`, and `constructor` are rejected with regressions |

## Suites run for this checkpoint

| Suite | Result |
|---|---|
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 79/79 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 55/55 |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 90/90 owned, 0 unexplained, 0 violations |
| repository JavaScript syntax sweep | PASS |
| `npm run runtime:integration:test` | PASS, 28/28 |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run execution:test` | PASS, 274/274 |
| `npm run qa` | PASS, 159 HTML files |

## Residual items intentionally not started here
- OS-level validator confinement
- later confinement/race hardening outside this registry checkpoint
