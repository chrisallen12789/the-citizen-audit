# Execution Engine v2 Phase 4.1 — Independent Review Corrections

Status: **HOLD — NOT SAFE TO ACTIVATE**  
Pull request: **#21 (draft; do not merge)**  
Controlling issues: **#9 and #15 remain open**  
Verified correction base: `abfc0550be9e448dc7973bff286622c58a07fadc`  
Checkpoint: `checkpoint/phase-4.1-pre-corrections-20260707-abfc055`

This document maps the independent architectural/security review findings to the corrective implementation. Passing tests establish a candidate for another independent review; they do not lift the architecture hold or authorize runtime activation.

## 1. In-process callback mutation bypass

Changed files:

- `kernel/runtime/transactional-runtime.js`
- `kernel/runtime/run-transactional.js`
- `kernel/execution/orchestrator.js`
- `kernel/execution/recovery-session.js`
- `kernel/execution/rollback.js`
- `tests/support/orchestrator-fault-adapter.js`
- `tests/runtime-integration.test.js`
- `tests/execution-orchestrator.test.js`

Invariant:

Production entry points reject caller-supplied functions and caller-selected execution internals. No production execution, recovery, rollback, or post-commit API executes an `approvalProvider`, `onStep`, fault injector, or equivalent callback. Fault injection is implemented only by a test-only module-import adapter that is unreachable from production entry points.

Adversarial coverage:

- approval callback attempts to mutate governed state,
- post-commit callback attempts to mutate governed state,
- caller-selected policy, validator, and ledger paths,
- false test-only capability classification,
- production callback and isolation-disable source surfaces.

## 2. Approval bound to exact transaction intent

Changed files:

- `kernel/approvals/decision-store.js`
- `kernel/authority/approval-authorities.json`
- `kernel/runtime/transaction-intent.js`
- `kernel/transactions/validate.js`
- `kernel/execution/orchestrator.js`
- `tests/runtime-integration.test.js`
- `tests/execution-orchestrator.test.js`

Invariant:

Approval is an immutable institution-controlled decision record loaded by decision ID. Its canonical record hash binds decision status, transaction ID, write-set hash, actor type and ID, action, approver identity, approver authority, and decision timestamp. The transaction stores the decision-record hash, and the orchestrator re-verifies the record and current approver authority before mutation. Caller-provided approval JSON is never accepted and approval is never inferred.

Adversarial coverage:

- another transaction ID,
- another write-set hash,
- another actor,
- another action,
- denied decision,
- altered decision bytes or record hash,
- missing decision ID.

## 3. Enforceable capability inventory

Changed files:

- `scripts/bypass-audit.js`
- `scripts/bypass-audit-config.json`
- `tests/bypass-audit.test.js`
- `docs/bypass-audit-report.json`
- `package.json`
- `package-lock.json`

Invariant:

The bypass audit parses JavaScript with pinned Acorn `8.15.0`, resolves CommonJS imports and aliases, builds transitive capability edges, and fails on unknown, unowned, or falsely classified mutation/process capabilities. Text matching is not accepted as proof that no bypass exists.

Adversarial coverage:

- computed-property filesystem calls,
- aliased module imports,
- destructured aliases and renames,
- wrappers and transitive mutation helpers,
- indirect child-process execution,
- dynamic/unknown imports,
- false test-only classification,
- direct governed-path mutation by a generated-output owner,
- invalid JavaScript that cannot be parsed.

Current local inventory: **83 capable modules; 83 owned; 0 unexplained; 0 violations.**

## 4. Sandbox-helper cache poisoning

Changed files:

- `kernel/runtime/isolation-adapter.js`
- `kernel/runtime/runtime-provenance.js`
- `tests/runtime-isolation.test.js`

Invariant:

The reviewed helper is built into an institution-private cache with mode `0700`, installed by exclusive hard link, and accepted only as an owned regular file with mode `0500`. The full binary digest is verified after compilation, before reuse, before copying, after copying, and after sandbox execution. The reviewed source hash and actual binary hash are bound into transaction and execution provenance.

Adversarial coverage:

- pre-positioned unreviewed regular file,
- symlink substitution,
- changed permissions,
- changed bytes,
- installation/replacement race.

## 5. Canonical execution-event mechanism

Changed files:

- removed `kernel/events/write.js`
- `kernel/runtime/run.js`
- `kernel/events/projection.js`
- `kernel/events/validate.js`
- `kernel/events/event.schema.json`
- `kernel/events/event-types.json`
- `tests/event-projection.test.js`

Invariant:

Execution events are schema-validated deterministic projections of verified execution-ledger entries. Event identity is derived from ledger sequence and hash; no event append file, scan-based ID allocator, or competing authoritative writer remains. Event output cannot become a second source of execution truth.

Adversarial coverage:

- ledger tampering,
- event tampering,
- replay determinism,
- duplicate ID and sequence mismatch,
- malformed schema,
- concurrent projection readers.

## 6. Agent identity bound to executable identity

Changed files:

- `agents/registry.json`
- `kernel/runtime/agent-registry.js`
- `kernel/runtime/isolation-adapter.js`
- `kernel/runtime/transactional-runtime.js`
- `kernel/execution/orchestrator.js`
- `tests/runtime-isolation.test.js`
- `tests/runtime-integration.test.js`

Invariant:

The production caller supplies an agent ID, not a command. The runtime resolves the active agent and action capability from the authoritative registry and binds registered agent ID, executable real path, executable content digest, arguments digest, registry-entry hash, runtime version, isolation-adapter version, sandbox-helper source hash, and sandbox-helper binary hash. The orchestrator re-resolves the registry identity and rejects drift before mutation.

Adversarial coverage:

- unknown agent ID,
- caller-supplied command/arguments,
- executable replacement after resolution,
- arguments digest mismatch,
- suspended or changed registry identity.

## 7. Action-specific semantic validators

Changed files:

- `kernel/execution/policy.json`
- `kernel/execution/validators/index.js`
- `kernel/execution/validators/registry.json`
- `kernel/execution/validators/write-report-semantics.js`
- `kernel/execution/validators/derived-files-semantics.js`
- `kernel/execution/validators/ads-records-semantics.js`
- `kernel/execution/validators/sort-registry-semantics.js`
- `tests/execution-orchestrator.test.js`

Invariant:

Every active governed action declares at least one validator explicitly marked semantic and bound to that action. Missing or incorrectly bound semantic validators fail closed. Validator-set hashing continues to bind implementation bytes.

Adversarial coverage:

- missing validator declaration,
- unavailable or wrong action binding,
- changed implementation bytes,
- exception,
- timeout,
- malformed result,
- semantic failure.

## 8. Verified runtime-isolation recovery barrier clearance

Changed files:

- `kernel/execution/runtime-isolation-barrier.js`
- `kernel/execution/runtime-isolation-recovery.js`
- `kernel/approvals/recovery-decision-store.js`
- `tests/runtime-isolation-recovery.test.js`

Invariant:

The barrier API exposes no direct deletion function. Clearance requires an immutable authorized recovery decision bound to the current barrier hash. Both the recovery actor and approver must hold the declared current authority. Governed state must exactly match the barrier's expected restoration manifest. Clearance is serialized by the authoritative execution lock. An append-only clearance record binding the barrier, actor, authority, verification result, timestamp, decision ID, and decision hash is durably written before barrier removal.

Adversarial coverage:

- missing decision,
- unauthorized recovery actor,
- decision bound to another barrier,
- tampered decision,
- unverified restoration,
- concurrent clearance while the execution lock is held,
- barrier unlink failure and idempotent retry.

## Local verification observed on July 7, 2026

- JavaScript syntax validation: **PASS**
- sandbox C compilation with `-Wall -Wextra -Werror`: **PASS**
- complete Execution Engine suite: **156/156 PASS**
- archive suite: **36/36 PASS**
- capability audit: **83/83 owned; 0 unexplained; 0 violations**
- tamper suite: **5/5 PASS**
- fault/recovery suite: **31/31 PASS**
- Institutional QA: **PASS for 159 HTML files**

## Remote verification observed on July 7, 2026

The correction implementation head `c154712de4190ca785deda18fc48b32bba8318d5` completed every required GitHub Actions workflow successfully:

- Institutional QA: **PASS**
- Execution Engine Tests: **PASS**
- Execution Engine Phase 4: **PASS**

The Phase 4 workflow separately completed syntax validation, hardened sandbox-helper compilation, the AST/transitive capability audit and self-tests, runtime integration and isolation suites, event projection, tamper, fault-injection, Institutional QA, and the full Phase 1–4 execution suite. These results establish test evidence only; they do not lift the HOLD or authorize activation.

## Remaining hold

PR #21 must remain draft. Issues #9 and #15 remain open. The runtime remains inactive. Deployment capability certification and another independent architecture/security review remain required before any consideration of activation.
