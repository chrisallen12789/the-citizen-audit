# Execution Engine v2 Progress

Status: **HOLD — NOT SAFE TO ACTIVATE**

## Completed foundations

### Phase 1 — execution history

- versioned execution-attempt schema,
- strict state machine,
- hash-chained execution ledger,
- deterministic replay into immutable attempt views,
- terminal-state immutability,
- one committed attempt per transaction,
- focused Execution Engine CI.

### Phase 2 — recoverability layer

- institution-controlled durable recovery store,
- canonical pre-state manifests,
- content-addressed snapshot blobs,
- atomic exclusive execution boundary,
- flushed hash-chained mutation journal,
- same-directory temporary writes and per-file atomic replacement,
- reverse-order rollback,
- restoration verification for bytes, existence, and file mode,
- restart recovery for interrupted execution and interrupted rollback,
- explicit recovery takeover,
- fail-closed `recovery_required` barrier,
- durable artifact preservation outside `os.tmpdir()`,
- fault-injection and tamper tests.

### Phase 3 — orchestrator and live-state validation

- one authoritative execution orchestrator (`executeApprovedTransaction`),
- transaction loaded from authoritative repository state (never caller-supplied),
- schema, approval, content-hash, and write-set-hash revalidation before mutation,
- current-authority and current-policy rebinding at execution time,
- validator-registry loading with a bound canonical hash,
- deterministic execution plan with enforced affected-object coverage,
- candidate-state validation before any mutation,
- exact post-write materialization validation against live state,
- institution-registry, dependency-reference, and dependency-cycle validators,
- fail-closed validator contract (exception, malformed result, timeout,
  unsupported phase, and unavailable validator all normalize to failure),
- durable validation-result artifact bound into the committed ledger record,
- structured immutable result whose disposition matches the durable ledger,
- narrow transaction-id CLI (`kernel/execution/run.js`) that bypasses nothing.

All governed mutation in Phase 3 flows through the Phase 2 exclusive lock,
pre-state snapshots, mutation journal, rollback, and execution ledger. Phase 3
adds no direct governed-path writes.

### Phase 4.1 — independent review correction candidate

Phase 4's existing green suite did not lift the HOLD. Independent review reproduced eight blocking failures outside that suite. Phase 4.1 corrects those findings while preserving all Phase 1–3 invariants and the three reviewed Phase 3 hardening corrections.

The corrected candidate now includes:

- immutable institution-controlled approval decisions bound to exact transaction intent,
- no caller-supplied functions in production runtime, orchestrator, recovery, rollback, or post-commit paths,
- a test-only fault adapter outside production entry points,
- an Acorn-based AST/import/transitive capability inventory that fails on unknown or unowned mutation capability,
- a private digest-verified sandbox-helper cache with race-resistant installation,
- one ledger-derived, schema-validated execution-event projection and no competing event writer,
- authoritative agent-registry resolution with executable and runtime provenance bound into transaction and execution records,
- action-specific semantic validators for every active governed action,
- authorized, manifest-verified, append-only recovery-barrier clearance.

The detailed one-to-one correction map is recorded in `docs/institution-os/execution-v2-phase-4.1-corrections.md`.

## Verification evidence

Local verification observed on July 7, 2026:

- JavaScript syntax validation: passed,
- static sandbox C compilation with warnings treated as errors: passed,
- complete Execution Engine suite: 156/156 passed,
- archive suite: 36/36 passed,
- AST/transitive capability audit: 83/83 capable modules owned, 0 unexplained, 0 violations,
- tamper suite: 5/5 passed,
- fault/recovery suite: 31/31 passed,
- Institutional QA: passed for 159 HTML files.

Remote verification is pending the final pushed correction head. Green local or remote checks do not authorize activation.

## Still incomplete

Execution Engine v2 remains inactive. Phase 4.1 is a correction candidate, not
an activation. The following are still required before the engine could be
considered for activation:

- independent architectural and security review of the corrected Phase 4 candidate,
- deployment-environment certification for the required Linux isolation capabilities,
- explicit migration of active agent entry points to the transactional runtime,
- confirmation that no governed mutation route bypasses the orchestrator,
- satisfaction of issue #9's activation gate,
- explicit governance approval to lift the architecture hold.

Runtime mutation in the candidate routes through the authoritative orchestrator,
and process exit code zero is not interpreted as Institution OS transactional
success. Only the durable execution ledger can establish a committed institutional
transaction after activation is separately authorized.

The controlling architecture and activation gate are documented in:

- `docs/institution-os/execution-engine-v2-architecture.md`
- GitHub issue #9

Execution Engine v2 may be marked complete only after issues #14 and #15 satisfy issue #9's activation gate and the result is independently reviewed.
