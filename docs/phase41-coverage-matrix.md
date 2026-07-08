# Phase 4.1 Independent Review — Mandatory-Case Coverage Matrix

Authoritative base: `4907d6e990b48df719fd6473ee79d90bebc3b7ef`
Review commit: `94ef63bd09908b4d86fa1d21dcfb24ca8db5c144` (parent = base)
Governing ruling: **HOLD — CODE CORRECTIONS VERIFIED; DEPLOYMENT CERTIFICATION REQUIRED**

Status legend:
- **PASS** — independently executed by this reviewer and passed
- **FIXED** — independently executed, defect reproduced, corrected, regression added
- **PRIOR** — verified in an earlier authorized review cycle (approval/provenance/option attacks); carried forward, not re-executed this session
- **SUITE** — covered by the repository's own passing adversarial suite; not independently re-attacked this session
- **PENDING** — not yet independently executed in this workspace this session
- **ENV** — blocked by non-representative environment

No case is silently dropped. Items marked PENDING/SUITE/ENV are explicitly unfinished and keep the HOLD.

## Capability-audit completeness (this session — COMPLETE)

| Form | Status | Evidence |
|---|---|---|
| inline `require().member` alias | PRIOR/FIXED | fixed earlier; regression present |
| optional chaining call | PASS | probe flagged (fs mutation) |
| computed static property | PASS | flagged (dynamic computed) |
| template-literal property | PASS | flagged |
| reassigned alias | FIXED | `AssignmentExpression` tracking; regression |
| `.call` invoke | FIXED | indirect-invoke rule; regression |
| `.apply` invoke | FIXED | indirect-invoke rule; regression |
| `Reflect.apply` | FIXED | Reflect.apply rule; regression |
| object-property storage | FIXED | value-reference rule; regression |
| array storage | FIXED | value-reference rule; regression |
| parameter passthrough | FIXED | value-reference rule; regression |
| factory return | FIXED | value-reference rule; regression |
| nested member chain | FIXED | dotted-key namespace tracking; regression |
| `module.createRequire` | FIXED | flagged unknown → fail closed; regression |
| `Function` constructor | FIXED | flagged unknown → fail closed; regression |
| dynamic `import()` | FIXED | flagged unknown → fail closed; regression |
| `eval` | FIXED | flagged unknown → fail closed |
| conditional/lazy require | PASS | flagged |
| `node:` prefix, `fs/promises` | PASS | flagged |
| indirect child_process, spawn/exec variants | PASS | flagged (process execution) |
| stream write, fd write (openSync) | PASS | flagged |
| chmod / **chown** / link / symlink / truncate | FIXED | chown family added to mutators; regression |

Probe matrix: 30/30 forms flagged (zero fail-open). Real repo audit: 83/83 owned, 0 false positives. Self-test: 29/29.

Residual: fully general interprocedural taint (arbitrarily deep indirection) remains outside a static inventory by construction; the audit's assurance statement scopes this, and runtime defense-in-depth (registered-agent identity, OS read-only live root, governed-tree guard) does not depend on the audit.

## Validator security — INDEPENDENTLY EXECUTED (this session)

Attacks driven via `runValidationPhase` (result handling) and `loadValidatorRegistry` (integrity); regressions in `tests/validator-security.test.js` (19/19). Legend as above.

| # | Case | Status | Evidence |
|---|---|---|---|
| 1 | missing semantic validator | PASS | orchestrator throws `no action-specific semantic validator` unless governed `nonSemantic`+justification |
| 2 | registry entry missing | PASS | `selectRequiredValidators` fails closed on unavailable id |
| 3 | registry malformed | FIXED-TEST | malformed JSON rejected (regression added) |
| 4 | wrong-action binding | PASS | `action binding mismatch` (regression) |
| 5 | generic labeled semantic | PARTIAL | loader enforces semantic-flag+action binding; "real semantic logic" is a governance/review property, not mechanically detectable — documented |
| 6-9 | impl/registry replaced/changed after load/hash | PASS | fresh re-read + re-hash each execution; moduleHash folded into `validatorSetHash` (regression: tamper changes hash) |
| 10 | symlink substitution | **CORRECTED** | loader now `lstat`-rejects symlinked/non-regular modules (regression added) |
| 11-13 | malformed/incomplete/non-object result | PASS | `normalizeValidationResult` fails closed (regressions) |
| 14 | success while output invalid | PASS(model) | final status derived from `problems`; validator is integrity-bound trusted code |
| 15 | failure after writes | PASS | post-write failure → `ExecutionRejected` → Phase-2 rollback |
| 16 | throws exception | PASS | caught → failed (regression) |
| 17 | process crash | PASS(model) | in-process throw → failed; true OS-process crash n/a (in-process trusted code) |
| 18 | timing out (async) | PASS | `Promise.race` timeout → failed (regression) |
| 19 | hanging indefinitely (sync) | **PARTIAL / RESIDUAL** | a synchronous busy/infinite loop is NOT preempted by the in-process timeout (reproduced: 1500ms work under 300ms timeout returned `passed`). Mitigation: validators are integrity-bound, hash-verified, governed, symlink-rejected code — a hanging validator cannot be introduced without defeating verified controls. Recommended hardening: run validators in a worker thread/child process with a hard `terminate()`, reconstructing context inside the worker (candidate-state carries closures, so it cannot be structure-cloned directly). **Not claimed fixed; HOLD retained.** |
| 20 | exits without result | PASS | undefined/void → malformed → failed |
| 21 | oversized output | SUITE/PENDING | not independently sized-tested this session |
| 22-30 | validator mutates/spawns/network/reads approval or ledgers | PASS(model) | in-process trusted integrity-bound code; cannot be introduced without defeating registry hash/symlink/governance; not runtime-sandboxed by design |
| 31-34 | result replay across tx/action/write-set/identity | PASS(by-construction) | results are computed by the orchestrator itself, never caller-supplied; bound into `validationResultHash` in the ledger |
| 35 | one of several validators fails | PASS | phase status = every result passed |
| 36 | concurrent executions | SUITE | serialized through the execution lock; concurrency covered by recovery/fault suites |
| 37-38 | race with governed-file replacement / rollback | SUITE/PENDING | governed-tree guard + Phase-2 barriers; not independently raced this session |
| 39 | claims all affected objects checked while omitting one | PARTIAL | plan build enforces write-set coverage of affected objects (`plan.js`), exact-materialization verifies live state; validator-result `checkedObjects` is recorded but not separately enforced ⊇ affectedObjects — documented |
| 40 | validates stale pre-write instead of live post-write | PASS | post-write phase runs against live post-write state + manifest |

## Sandbox-helper security — PENDING / ENV

pre-positioned cache file · symlink/hard-link substitution · wrong owner/mode (file+dir) · replacement at each stage (post-verify, during-compile, between compile/install, install/verify, verify/copy, copy/exec) · concurrent compile/install · truncated binary · compiler failure/identity · static-link failure · unsupported arch · noexec · cache-vs-exec fs — **PENDING**; several are **ENV** (require representative host). Helper compiles `-Wall -Wextra -Werror -static` = PASS.

## Recovery & barrier security — PARTIAL

direct-delete barrier · same-hash clear/re-raise — **PRIOR/FIXED** (base already contains fixes; regressions present, suite green). concurrent authorized clear · unauthorized recovery actor/approver · revoked authority · decision bound to another barrier · altered decision bytes · restoration-manifest mismatch/incomplete · extra/missing/altered governed file · altered mode · symlink substitution during recovery · unlink failure · ledger append failure · crash after clearance/before unlink · crash after unlink · retry after partial · multiple open barriers · ledger corruption/truncation/deletion — **SUITE** (recovery suite 31/31 green) / **PENDING** independent attack.

## Transaction crash-consistency & rollback — SUITE / PENDING

crash before/between/after writes, during/after validation, before terminal append · rollback failure (single/multi) · byte+mode restoration · created-file removal · deleted-file recreation · rename/symlink rollback · fsync/dir-fsync/atomic-rename failure · disk-full · ro-fs transition · stale/malformed/dead-owner lock · concurrent/duplicate/replayed requests — **SUITE** (fault/recovery 31/31) / **PENDING** independent attack.

## Agent identity & provenance — PRIOR / PENDING

executable replacement after resolution · registry drift after prep — **PRIOR** (orchestrator re-resolves + compares; verified last cycle). symlink substitution · registry symlink · authority drift · args/env/cwd substitution · runtime/adapter/helper-hash mismatch · suspension after prep · duplicate IDs · nonregular executable · ownership/mode change — **PENDING** independent execution.

## Approval security — PRIOR

forged JSON · altered bytes · altered record hash · reuse (tx/write-set) · actor/action/approver/authority substitution · revoked authority · symlinked/replaced decision file · duplicate ID (O_EXCL) — **PRIOR/PASS** (11 attacks executed last cycle, all fail closed). decision-store dir replacement · pre-mutation validation race — **PENDING**.

## Event & ledger security — SUITE / PENDING

ledger tamper/truncation · projection tamper · stale output · duplicate identity · conflicting sequence · concurrent readers/materialization · malformed entry · unsupported type · schema mismatch · materialization-as-authoritative — **SUITE** (events 7/7, tamper 5/5) / **PENDING** independent attack.

## Repository-wide capability ownership — PASS (audit) / PENDING (manual)

Capability audit owns 83/83 capable files with 0 violations = PASS. Independent manual sweep beyond the (now-stronger) audit = PENDING.

## Deployment certification — HARNESS IMPLEMENTED; REPRESENTATIVE HOST REQUIRED

`runtime:deployment:certify` implemented (`scripts/deployment-certify.js`, tests `tests/deployment-certify.test.js` 9/9). It fingerprints the host; probes user/mount/pid/net/ipc/uts namespaces, chroot/mount-in-userns, and seccomp availability; compiles the exact `sandbox-exec.c` with `-O2 -static -Wall -Wextra -Werror -s` and records compiler/linker identity, source+binary hashes; verifies helper regular-file/0500/cache-0700, rejects symlinks, and detects truncation/replacement/wrong-mode/hostile pre-positioned files via the real adapter `verifyHelperFile`; demonstrates network-block, PID isolation, governed-root read-only, atomic rename, fsync, noexec support. Emits machine-readable JSON + human-readable Markdown under `docs/certification/`.

Observed on THIS sandbox: **26 mandatory verified, 0 failed, 4 representative-required** → ruling `REPRESENTATIVE_ENVIRONMENT_REQUIRED`, exit 1 (fail-closed). Representative-required: seccomp filter enforcement (kill/EPERM), inherited-fd closing, env sanitization (all need the full helper chain on a representative host), and `protected_hardlinks` (0 here). **This sandbox is NOT asserted representative; no certification is claimed.** Fail-closed proven: unavailable/representative-required never becomes a pass, and even with `DEPLOYMENT_CERT_REPRESENTATIVE=1` the harness stays nonzero while any mandatory check is not `verified`.

Operator procedure on a representative host: run `npm run runtime:deployment:certify`; confirm every mandatory check is `verified`; only then set `DEPLOYMENT_CERT_REPRESENTATIVE=1` to obtain `CERTIFIED` (exit 0). Certification remains an operator action on qualified infrastructure — not claimable here.
