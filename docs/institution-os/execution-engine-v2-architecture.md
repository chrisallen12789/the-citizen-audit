# Execution Engine v2 Architecture

Status: **Architectural hold — implementation incomplete**  
Authority: Institution OS architecture  
Tracking: GitHub issue #9

## 1. Purpose

Execution Engine v2 is the sole governed mutation boundary for Institution OS.

Its purpose is not merely to write files. Its purpose is to make every institutional mutation:

- authorized,
- declared,
- reproducible,
- attributable,
- validated,
- recoverable,
- and independently verifiable.

An agent process exiting successfully does not prove that institutional state is valid. A write call completing does not prove that a transaction committed. Execution succeeds only when the declared resulting state has been materialized, validated, and durably recorded.

## 2. Governing invariant

A transaction may reach `committed` only when all of the following are true:

1. The exact approved transaction was loaded from the transaction log.
2. Its schema, approval metadata, and write-set hash were revalidated.
3. Current authority rules still permit the exact action by the exact actor.
4. The current execution policy permits every declared write.
5. Durable recovery information was persisted before the first governed mutation.
6. Every declared write was materialized exactly.
7. Every mandatory post-write validator passed against live state.
8. A terminal execution-ledger record was durably appended.

If any condition fails after mutation begins, the engine must restore the pre-execution state and prove restoration. If restoration cannot be proven, the engine must enter `recovery_required` and reject further governed execution.

## 3. Architectural boundaries

### 3.1 Transaction record

The transaction record is immutable intent. It contains the requested action, actor, approval, affected objects, and proposed write set.

Approval does not mutate the institution. Approval authorizes a later execution attempt against an exact write-set hash.

### 3.2 Execution attempt

An execution attempt is a separate immutable history stream. Multiple attempts may refer to one transaction, but at most one attempt may commit it.

Each attempt must bind:

- attempt id,
- transaction id,
- transaction write-set hash,
- actor identity,
- authority decision and authority-state hash,
- execution-policy hash,
- validator-registry hash,
- execution-plan hash,
- pre-state manifest hash,
- state transitions,
- validation results,
- rollback results,
- terminal disposition,
- previous execution-ledger hash.

### 3.3 Event record

Execution events are projections of authoritative execution-ledger entries. They are not a competing source of truth.

There is no separate authoritative execution-event writer. Event identity, schema validation, and ordering are derived deterministically from the verified execution ledger. A projected event stream may be materialized for consumers, but it must remain reproducible from the ledger and must never allocate independent IDs or become a second execution truth source.

### 3.4 Runtime

The runtime may coordinate agents, but it may not grant agents unrestricted governed repository writes.

The preferred flow is:

1. Run the agent in an isolated workspace or capture its output without applying governed mutations.
2. Convert intended repository changes into declared proposed writes.
3. Record and approve a transaction.
4. Execute through the sole execution orchestrator.

Any direct-writing legacy agent path must be labeled uncontrolled and must not be described as transactional Institution OS execution.

## 4. State machine

An execution attempt uses the following states:

- `prepared` — transaction, authority, policy, validators, and plan verified.
- `recovery_persisted` — pre-state manifest and required snapshot blobs durably stored.
- `applying` — governed writes are being materialized.
- `validating` — exact materialization and institutional validators are running against live state.
- `committed` — all validation passed and terminal record was durably appended.
- `rolling_back` — restoration is in progress after a failure.
- `rolled_back` — restoration was verified and durably recorded.
- `recovery_required` — restoration could not be proven; execution is fail-closed.

Allowed transitions:

```text
prepared -> recovery_persisted
recovery_persisted -> applying
applying -> validating
validating -> committed
applying -> rolling_back
validating -> rolling_back
rolling_back -> rolled_back
rolling_back -> recovery_required
```

No transition may skip `recovery_persisted` before mutation. No state may transition away from a terminal disposition.

## 5. Storage model

Recovery state must live under an institution-controlled durable directory, conceptually:

```text
kernel/execution/state/
  ledger.jsonl
  lock/
  attempts/
    ATTEMPT-.../
      manifest.json
      journal.jsonl
      validation.json
      blobs/
        <sha256>
```

The exact path may change, but the following requirements do not:

- Never use `os.tmpdir()` as the authoritative recovery store.
- Snapshot blobs must be content-addressed.
- Manifests must use canonical serialization.
- Ledger and journal entries must be hash chained.
- Required files must be flushed before the engine advances state.
- Recovery metadata must survive process and host restart.
- Successful cleanup may remove redundant blobs only after the terminal ledger entry is durable.

## 6. Exclusive execution

The engine must permit one governed mutation attempt at a time unless a later design proves safe object-level concurrency.

The lock must include:

- attempt id,
- process id,
- host identity,
- acquisition timestamp,
- lock-format version.

Lock acquisition must use an operating-system primitive that cannot be won simultaneously by two processes, such as exclusive file creation. An append-only journal is not itself a lock.

At startup:

1. Inspect the lock.
2. Inspect the corresponding attempt journal.
3. Refuse normal execution if an attempt is incomplete.
4. Run deterministic recovery or require explicit operator intervention.
5. Never silently delete a stale lock without reconciling institutional state.

## 7. Execution phases

### 7.1 Load and revalidate intent

The orchestrator must load the transaction from the authoritative transaction log. Caller-supplied transaction objects are not authoritative.

It must verify:

- transaction schema,
- approved status,
- approval metadata,
- transaction id uniqueness,
- proposed-write content hashes,
- computed write-set hash,
- absence of a prior committed attempt.

### 7.2 Re-evaluate authority

Authority must be re-evaluated immediately before execution.

The decision must bind the actor, action, transaction id, and write-set hash. A generic permission such as `write_report` is insufficient evidence that a particular write set was authorized.

If rules, agent status, capability, or required approval changed after approval, execution must stop before mutation.

### 7.3 Build deterministic plan

The execution plan must include:

- ordered writes,
- affected objects,
- downstream impacted objects,
- required validators,
- write-set hash,
- policy hash,
- validator-set hash,
- plan hash.

Plan generation must reject:

- prohibited paths,
- paths outside action policy,
- undeclared affected-object coverage,
- duplicate paths,
- unauthorized deletion,
- paths not represented by the institutional registry when coverage is required.

`requireAffectedObjectCoverage` must be enabled before activation.

### 7.4 Persist recovery material

Before mutation, the engine must create a canonical pre-state manifest for every touched path containing:

- relative path,
- whether the path existed,
- file type,
- byte hash,
- mode,
- snapshot blob hash when applicable.

For existing files, the exact original bytes must be stored in the durable blob store. For absent paths, the manifest must explicitly record absence.

The engine must then append the `recovery_persisted` transition and flush required state.

### 7.5 Candidate validation

Candidate-state validation is a preflight defense, not a substitute for post-write validation.

Candidate state must expose a controlled read interface over:

- existing repository state,
- proposed writes,
- proposed deletions.

Validators must not bypass this interface when running in candidate mode.

### 7.6 Apply writes

For each write operation:

1. Create parent directories as needed.
2. Write bytes to a same-directory temporary file.
3. Flush the temporary file when supported.
4. Apply the intended mode.
5. Atomically replace the destination by rename on the same filesystem.
6. Append a journal record identifying the completed path operation.

For deletion:

1. Confirm the path state matches the pre-state manifest.
2. Remove the path.
3. Append a completed deletion record.

A multi-file transaction is not made globally atomic by per-file rename. The journal and recovery protocol provide transaction-level recoverability.

### 7.7 Verify exact materialization

Before semantic validators run, the engine must verify every declared write against live state:

- `write`: path exists as a regular file and content hash matches.
- `delete`: path does not exist.

Any undeclared mutation detected inside the governed execution boundary is a failure.

### 7.8 Run post-write validators

Every required validator must declare supported phases:

- `candidate`,
- `post_write`,
- or both.

A normalized validator result includes:

- validator id and version,
- phase,
- status,
- problems,
- warnings,
- checked objects,
- checked paths,
- deterministic result hash.

Validator exceptions, malformed results, timeouts, and unavailable modules are failures.

Mandatory validators before activation:

1. Execution-plan consistency.
2. Exact write-set materialization.
3. Institution registry validity.
4. Dependency reference validity.
5. Dependency-cycle detection.
6. Action-specific semantic validation.

Warnings may be nonfatal only when policy explicitly identifies the warning class as nonfatal. A global `warningPolicy` string is too coarse for mature governance.

### 7.9 Commit

The attempt reaches `committed` only after:

- exact materialization passed,
- every mandatory post-write validator passed,
- the validation result artifact was durably written,
- the terminal ledger entry was durably appended.

Only then may the lock be released and success returned.

## 8. Rollback

Rollback must process touched paths in reverse application order.

For a path that existed before execution:

- restore the exact snapshot bytes,
- restore the original mode,
- verify hash and mode.

For a path absent before execution:

- remove the newly created path,
- remove newly created empty parent directories only when the engine can prove it created them and they remain empty.

After restoration, every pre-state manifest entry must be verified.

If all entries match, append `rolled_back` and release the lock.

If any entry cannot be restored or verified:

- append `recovery_required`,
- retain the lock or replace it with an explicit recovery barrier,
- reject all further governed execution,
- preserve all recovery artifacts,
- emit a critical institutional event.

Rollback failure must never be collapsed into an ordinary transaction failure.

## 9. Recovery after interruption

Startup recovery must inspect every nonterminal attempt.

| Last durable state | Required recovery action |
| --- | --- |
| `prepared` | No governed writes should exist; verify and abandon safely. |
| `recovery_persisted` | Verify live state still equals pre-state; then abandon or retry under policy. |
| `applying` | Restore from manifest and journal, then verify. |
| `validating` | Treat as uncommitted; restore and verify unless a future protocol can prove terminal commit. |
| `rolling_back` | Resume idempotent rollback. |
| terminal | No recovery mutation. |

The absence of a durable `committed` ledger entry means the transaction is not committed, even if all target files appear to contain proposed bytes.

## 10. Idempotency and replay

- A committed transaction must never be committed again.
- A rolled-back transaction may be retried only as a new execution attempt under current authority and policy.
- Recovery operations must be idempotent.
- Duplicate API or CLI requests must resolve to the existing attempt or fail deterministically.
- Attempt identifiers must not depend on scanning an unlocked append file.

## 11. Validator registry contract

Each validator registration must include:

- stable id,
- semantic version,
- module path,
- supported phases,
- declared scope,
- deterministic/non-deterministic classification,
- timeout policy where applicable.

The loader must reject duplicate ids, path escape, contract mismatch, unsupported phase declarations, and version omission.

Registry loading must be deterministic and its canonical hash must be bound into the execution attempt.

## 12. Public orchestrator contract

The engine should expose one high-level operation conceptually equivalent to:

```js
executeApprovedTransaction(transactionId, options)
```

The caller supplies an identifier, not mutable transaction contents.

The result must be structured and terminal:

```js
{
  attemptId,
  transactionId,
  disposition: "committed" | "rolled_back" | "recovery_required",
  executionLedgerHash,
  validationResultHash,
  problems,
  warnings
}
```

Thrown exceptions are implementation transport. The durable attempt record remains the authoritative institutional outcome.

## 13. Required test strategy

The implementation must provide:

### Unit tests

- canonical hashing,
- state transitions,
- path safety,
- snapshot creation and restoration,
- lock ownership,
- validator normalization,
- exact materialization checks.

### Integration tests

- successful single-file and multi-file execution,
- writes and deletes,
- registry and dependency validation,
- runtime-to-transaction integration,
- duplicate execution prevention.

### Fault-injection tests

Inject failure or process termination:

- before snapshot persistence,
- after snapshot persistence,
- before first write,
- between each write,
- after all writes,
- during each validator,
- after validation,
- before terminal ledger append,
- during rollback,
- after partial rollback.

Every injected failure must end in a verifiable `rolled_back` or `recovery_required` state after restart.

### Tamper tests

- transaction-log modification,
- execution-ledger modification,
- snapshot-blob modification,
- manifest modification,
- validator-registry modification,
- write-set modification,
- policy modification.

## 14. Activation gate

Execution Engine v2 remains inactive until all of the following are true:

- one orchestrator controls every governed mutation path,
- active runtime no longer directly writes governed repository state,
- durable recovery and startup reconciliation are implemented,
- required validators inspect live post-write state,
- affected-object coverage is enforced,
- the execution ledger is hash chained and execution events are deterministic schema-validated projections of that ledger,
- the adversarial suite passes in CI,
- injected crash recovery is demonstrated,
- issue #9 is closed by architectural review.

## 15. Non-goals

Execution Engine v2 does not:

- decide whether an institutional claim is true,
- replace human approval where governance requires it,
- allow AI to confer authority on itself,
- make cross-file filesystem writes magically atomic,
- treat logs as proof without verification,
- equate agent completion with institutional success.

The engine exists to make institutional change auditable and recoverable. It does not automate truth.
## 16. Phase 4 runtime isolation contract

Active agents must execute as external processes inside an operating-system-enforced sandbox. The implementation candidate requires Linux user, mount, PID, network, IPC, and UTS namespaces; a chroot-capable mount environment; seccomp filter support; and a supported static C compiler for the reviewed sandbox launcher.

Before any agent starts, the runtime must prove that it can:

- build and execute the sandbox launcher from the governed source,
- create the required namespaces,
- construct a disposable chroot filesystem outside the institution root,
- expose only read-only system runtime directories plus a writable disposable workspace and temporary directory,
- keep the live institution root entirely absent from the sandbox,
- block mount, remount, namespace-entry, root-escape, ptrace, and related syscalls after sandbox setup,
- preserve a writable workspace for proposed output without any writable link back to the institution.

The trusted namespace setup process may access host paths only before chroot and before the untrusted agent starts. Agent command and arguments are passed as positional arguments and executed only after chroot, capability removal, privilege locking, and seccomp installation. The environment uses a fixed system `PATH` and does not expose a live-root variable.

If the capability probe fails, the runtime must reject the run before the agent process starts. There is no unrestricted fallback, operator bypass flag, caller-supplied sentinel list, or caller option that may mark isolation as available.

The agent workspace must live outside the institution root. Only declared regular-file inputs are copied into it. Workspace symlinks and special files are prohibited. Production runtime accepts only external command adapters; in-process function agents are rejected before invocation.

The runtime also records a complete manifest of governed and security-critical paths before agent execution. The manifest binds file bytes, existence, type, mode, directory structure, and symlink targets. After the agent exits, the runtime compares live state to the manifest before trusting output or process status.

Preventive chroot, namespace, and seccomp isolation is the primary control. Governed-tree restoration is defense in depth, not an equivalent substitute. If drift is detected and exactly restored, the run still terminates as an isolation violation. If exact restoration cannot be proven, the runtime durably records a hash-bound isolation recovery barrier, returns `recovery_required`, and both later runtime runs and direct orchestrator execution fail closed until explicit recovery clears that barrier.

Supported deployment environments must provide Linux namespace and seccomp facilities, permit the required `unshare`, bind-mount, and chroot setup, and provide a supported static compiler (`gcc` or `cc`) for x86_64 or aarch64. Containers or hosts that disable these capabilities are unsupported for active agents and must receive a fail-closed isolation-unavailable result. Remote CI and production deployment must independently demonstrate the complete capability probe; local success does not activate the engine.


## 17. Phase 4.1 review-correction contracts

### 17.1 Approval decisions

Production runtime accepts only an institution-controlled approval decision ID. The loaded immutable record must bind the exact transaction ID, write-set hash, actor, action, approver, approver authority, decision timestamp, and canonical record hash. Approval callbacks and caller-provided approval JSON are prohibited. The orchestrator must re-verify the decision record and current authority before mutation.

### 17.2 Production callback prohibition

No production runtime, orchestrator, recovery, rollback, or post-commit API may execute a caller-supplied function. Fault injection belongs exclusively in test-only adapters that production entry points cannot import or invoke.

### 17.3 Agent executable provenance

The caller selects a registered agent ID, not an executable. The authoritative registry resolves the executable and arguments. Transaction and durable execution provenance bind the registered agent ID, executable real path and content digest, arguments digest, registry-entry hash, runtime version, isolation-adapter version, sandbox-helper source hash, and sandbox-helper binary hash. Registry or executable drift fails closed.

### 17.4 Sandbox-helper trust

The sandbox helper cache must be institution-private, owned by the runtime user, and non-writable by group or others. Helper installation must be exclusive and race resistant. Symlinks, non-regular files, changed ownership, changed mode, and changed bytes are rejected. Full source and binary digests are verified and bound into provenance.

### 17.5 Recovery-barrier clearance

Runtime-isolation barrier clearance is a governed recovery operation, not a file deletion. It requires an immutable authorized decision bound to the original barrier hash, exact restoration-manifest verification, and a durable append-only clearance record before the barrier is removed or superseded. Failure to prove restoration leaves the barrier in force.
