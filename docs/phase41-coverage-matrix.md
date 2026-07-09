# Phase 4.1 - Coverage Matrix for Validator Execution-Surface Checkpoint

Authoritative base: `eef24a40c27daeeee7bc04813751d50238cec411`
Review commit: `(this checkpoint)`
Governing ruling: **HOLD - production validator source selection and fabricated descriptor execution are locked down; OS confinement still pending by instruction**

Status legend:
- **PASS** - executed in this workspace and passed
- **FIXED** - defect reproduced, corrected, and regression added
- **SUITE** - covered by the repository suite run in this workspace

## Capability-audit completeness

Probe matrix: 30/30 forms flagged, zero fail-open.

Repository audit result:
- 91/91 capable files owned
- 0 unexplained files
- 0 violations
- 0 stale classifications

New owned files in this checkpoint:
- `tests/support/validation-cycle-test-core.js`
- `tests/support/validator-closure-test-core.js`
- `tests/support/validator-registry-test-core.js`

No broad capability declarations were added.

## Mandatory cases covered in this checkpoint

| Case | Status | Evidence |
|---|---|---|
| Direct import of `kernel/execution/validator-closure.js` exposes configurable closure construction | FIXED | production module now exports only fixed policy metadata; regression directly probes missing builder/root-selector exports |
| Direct import of `kernel/execution/validation-cycle.js` accepts caller-supplied descriptors or closure material | FIXED | production cycle now accepts only validator ids plus expected authoritative `validatorSetHash`; fabricated descriptor regression fails closed |
| Direct import of `kernel/execution/orchestrator-core.js` exposes configurable execution | FIXED | core export remains fixed to production executor; regression added |
| Direct import of `kernel/execution/validators/registry-core.js` exposes alternate-directory loading | FIXED | core export remains fixed to production loader; regression added |
| Production kernel surface still exposes injected execution surfaces or override flags | FIXED | direct-require regression enumerates all production orchestrator/validator modules |
| Production imports can still select an alternate validator entry source | FIXED | `validator-closure.js` direct-import probe shows no callable closure builder or inspector remains |
| Fabricated descriptor can execute validator bytes from an external temporary root | FIXED | behavioral regression builds an external validator, probes production imports, proves no marker file is created |
| Production caller can still select another validator directory inside the repository | FIXED | existing rejection regression retained |
| Production caller can still select a temporary validator directory | FIXED | existing rejection regression retained |
| Production caller can still select a copied registry with the same ids | FIXED | existing rejection regression retained |
| Production caller can still select always-pass replacement validators | FIXED | existing rejection regression retained |
| Production code imports `tests/**` or `tests/support/**` | FIXED | import-graph regression scans every `kernel/**/*.js` file |
| Immutable lookup can expose inherited Object prototype values | FIXED | null-prototype lookup backing plus own-property `get`/`has` regression |
| Unsafe validator ids can poison lookup behavior | FIXED | `__proto__`, `prototype`, and `constructor` are rejected with regressions |
| Closure implementation identity is bound to metadata-only bytes instead of the real implementation | FIXED | regression proves the recorded loader hash equals `registry-core.js` and mutating that identity changes `validatorSetHash` |

## Suites run for this checkpoint

| Suite | Result |
|---|---|
| `node --test --test-concurrency=1 tests/validator-security.test.js` | PASS, 80/80 |
| `node --test --test-concurrency=1 tests/execution-orchestrator.test.js` | PASS, 56/56 |
| `npm run bypass:audit:test` | PASS, 29/29 |
| `npm run bypass:audit` | PASS, 91/91 owned, 0 unexplained, 0 violations |
| repository JavaScript syntax sweep | PASS, 145 files checked |
| `npm run runtime:integration:test` | PASS, 28/28 |
| `npm run runtime:isolation:test` | PASS, 48/48 |
| `npm run fault:test` | PASS, 31/31 |
| `npm run events:test` | PASS, 7/7 |
| `npm run archive:manifest:test` | PASS, 36/36 |
| `npm run execution:test` | PASS, 276/276 |
| `npm run qa` | PASS, 159 HTML files |
| `git diff --check` | PASS |
| `git fsck --full` | PASS |

Termination note:
- `npm run runtime:integration:test` terminated normally after 28/28 on this host
- `npm run execution:test` terminated normally after 276/276 on this host
- no installed Linux verification host was available inside this desktop session, so host-specific Linux-only reproduction could not be rerun locally

## Residual items intentionally not started here
- OS-level validator confinement
- later confinement/race hardening outside this registry checkpoint
