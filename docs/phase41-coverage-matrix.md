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

## Validator security — PENDING (this session)

missing semantic validator · generic-labeled-semantic · wrong-action binding · implementation replacement · registry drift · timeout · exception · crash · malformed/incomplete result · success-with-invalid-output · validator attempting mutation/subprocess/network — **PENDING** independent execution (structure inspected in prior cycle; the repo `execution:test` suite exercises validator loading/fail-closed = SUITE).

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

## Deployment certification — PENDING (ENV)

`runtime:deployment:certify` harness — **PENDING implementation** this session. Representative-environment certification — **ENV** (this sandbox is not established as representative; certification will not be claimed here).
