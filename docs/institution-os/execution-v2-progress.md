# Execution Engine v2 Progress

Status: **ARCHITECTURAL ACTIVATION HOLD — Phase 4.1 is ACCEPTED; runtime activation is not authorized.**

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

### Phase 4.1 — accepted independent-review correction

Historically, Phase 4's existing green suite did not lift the HOLD and independent review reproduced eight blocking failures outside that suite. The project owner has now ACCEPTED Phase 4.1 and authorized `VAL-RESULT-001` as RESOLVED, bound to implementation `ef8d8cef2a82e3a43eee06013500aacae0682d4a`, tree `b945833eb17b9d75111113056ce8cd50b5bf0564`, and the independent clean-room evidence recorded in `docs/phase41-validator-review.md`. This acceptance closes the Phase 4.1 failed-module and failed-cycle cache defects; it does not authorize activation.

The accepted correction includes:

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

### Post-acceptance final-head corrections

The accepted implementation and its acceptance decision remain distinct from the accepted post-acceptance correction chain. `44f166a59735c7c4b6f1237a58951875c42a0ca8` corrected a Windows-specific temporary path in the `rename/unlink/chmod` security regression without changing production files. `e29bd44ce3e83eabc45d3a619dec689d43ccb317` corrected the worker timeout lifecycle so a permanently pending semantic validator remains alive through the parent deadline and deterministically yields `VALIDATOR_TIMEOUT`; genuine premature worker exits remain `WORKER_INTERNAL_FAILURE`.

`e29bd44ce3e83eabc45d3a619dec689d43ccb317` is the final reviewed code head before this documentation addendum, with code tree `f38602d44fbe1f7b4d33d246050f5480165d3dbe`. The accepted implementation remains `ef8d8cef2a82e3a43eee06013500aacae0682d4a`, tree `b945833eb17b9d75111113056ce8cd50b5bf0564`; the acceptance-recording commit remains `d0fb89f1ba1b22199a2fecec060c1ef6f7265ab9`.

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

Remote verification observed on July 7, 2026: correction implementation head `c154712de4190ca785deda18fc48b32bba8318d5` passed Institutional QA, Execution Engine Tests, and Execution Engine Phase 4. The Phase 4 workflow completed every dedicated syntax, compiler, capability-audit, runtime, isolation, event, tamper, fault-injection, QA, and full-suite step successfully. Green local or remote checks do not authorize activation.

Final independent Linux verification at `e29bd44ce3e83eabc45d3a619dec689d43ccb317` recorded pending-validator repetitions 25/25, execution-orchestrator 57/57, validator-security 141/141, and aggregate execution 338/338. Every pending validator was `VALIDATOR_TIMEOUT`; there were zero `WORKER_INTERNAL_FAILURE` results in the repetition, zero execution attempts, zero governed writes, zero surviving Node processes, zero temporary validator artifacts, and a clean worktree.

Exact-head GitHub Actions verification observed on July 13, 2026 completed successfully for `e29bd44ce3e83eabc45d3a619dec689d43ccb317`: Institutional QA run `29289106527`, Execution Engine Tests run `29289106533`, and Execution Engine Phase 4 run `29289106585`. This green evidence does not authorize activation, deployment, merge, or removal of the HOLD.

## Still incomplete for activation

Execution Engine v2 remains inactive. Phase 4.1 acceptance is not runtime
activation. The following are still required before the engine could be
considered for activation:

- deployment-environment certification for the required Linux isolation capabilities,
- explicit migration of active agent entry points to the transactional runtime,
- confirmation that no governed mutation route bypasses the orchestrator,
- satisfaction of issue #9's activation gate,
- explicit governance approval to lift the architecture hold.

Phase 4.2 remains PLANNED. `P42-D001` remains OPEN and provisional, `P42-D002` remains APPROVED, and `P42-D003` remains OPEN and RECOMMENDED. Phase 4.2 implementation remains prohibited pending its own separate governance prerequisites and formal authorization; Phase 4.1 acceptance does not grant that authority.

Runtime mutation in the reviewed routes through the authoritative orchestrator,
and process exit code zero is not interpreted as Institution OS transactional
success. Only the durable execution ledger can establish a committed institutional
transaction after activation is separately authorized.

The controlling architecture and activation gate are documented in:

- `docs/institution-os/execution-engine-v2-architecture.md`
- GitHub issue #9

Execution Engine v2 may be marked complete only after issues #14 and #15 satisfy issue #9's activation gate and the result is independently reviewed.
