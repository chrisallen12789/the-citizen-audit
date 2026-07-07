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

### Phase 4 — transactional runtime integration (corrected implementation candidate)

Phase 4 is an **implementation candidate**, not an activation. The corrected
runtime uses prevention-first isolation rather than caller-selected, after-the-
fact sentinel detection.

- production accepts external-process agents only; in-process function adapters
  are rejected before invocation,
- every run receives a disposable writable workspace outside the live repository,
- a capability probe verifies Linux user, mount, PID, network, IPC, and UTS
  namespaces, chroot setup, static sandbox-launcher compilation, and seccomp
  enforcement before the agent starts,
- the live institution root is not mounted or exposed inside the agent sandbox;
  only read-only system directories and a disposable writable workspace are
  present,
- the sandbox launcher locks root privilege semantics, clears capabilities,
  sets no-new-privileges, and blocks mount, namespace-entry, root-escape,
  ptrace, and related syscalls before executing the agent,
- absolute paths, traversal attempts, shell redirection, nested namespace
  attempts, remount attempts, and spawned subprocesses cannot reach or modify
  the live institution,
- unsupported operating systems, architectures, containers, kernels, or hosts
  without a supported static C compiler fail closed before agent execution;
  there is no unrestricted fallback or operator override,
- an always-on governed-tree manifest records bytes, existence, file type, mode,
  directories, and symlink targets for governed and security-critical paths,
- any unauthorized drift is exactly restored and verified as defense in depth;
  restored drift still yields `isolation_violation`, while unprovable restoration
  yields `recovery_required` and persists a hash-bound runtime-isolation barrier
  that blocks both later runtime runs and direct orchestrator execution,
- proposed output is captured from the isolated workspace, converted into an
  immutable transaction, explicitly approved, and applied only through
  `executeApprovedTransaction`,
- the legacy runtime contains no active-agent spawn path and no bypass flag,
- execution events remain deterministic projections of the verified execution
  ledger,
- the repository-wide bypass audit now checks source behavior as well as declared
  classifications and fails on uncontrolled process execution, function-agent
  adapters, sentinel-based protection, isolation-disable surfaces, false
  classifications, missing chroot/seccomp controls, live-root exposure, and
  unsafe fallback behavior,
- Institutional QA still rejects new unmodeled public HTML while explicitly
  classifying the existing legacy static documents.

Phase 4 does not weaken Phases 1–3 or the reviewed Phase 3 hardening. The public
platform work under `platform/**` remains outside this implementation.

## Still incomplete

Execution Engine v2 remains inactive. Phase 4 is an implementation candidate, not
an activation. The following are still required before the engine could be
considered for activation:

- independent architectural review of the Phase 4 candidate,
- application to GitHub and fully green **remote** required CI (not verifiable
  here; only local results are available),
- the Institutional QA baseline tracked by issue #11 confirmed in required CI,
- satisfaction of issue #9's activation gate.

Local runtime mutation now routes through the authoritative orchestrator and exit
code zero is not interpreted as Institution OS transactional success. Remote CI
status is unverified in this candidate.

The controlling architecture and activation gate are documented in:

- `docs/institution-os/execution-engine-v2-architecture.md`
- GitHub issue #9

Execution Engine v2 may be marked complete only after issues #14 and #15 satisfy issue #9's activation gate and the result is independently reviewed.
