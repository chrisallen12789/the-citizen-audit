# Execution Engine v2 Phase 4.1 — Independent Review Corrections

Status: **PHASE 4.1 CORRECTION MAP — Phase 4.1 is ACCEPTED; runtime activation remains prohibited.**
Pull request: **#21 (draft; do not merge)**  
Controlling issues: **#9 and #15 remain open**  
Verified correction base: `abfc0550be9e448dc7973bff286622c58a07fadc`  
Checkpoint: `checkpoint/phase-4.1-pre-corrections-20260707-abfc055`

This document maps the historical independent architectural/security review findings to the corrective implementation. Current governance accepts Phase 4.1 and resolves `VAL-RESULT-001`, bound to implementation `ef8d8cef2a82e3a43eee06013500aacae0682d4a`, tree `b945833eb17b9d75111113056ce8cd50b5bf0564`, and the independent clean-room evidence recorded in `docs/phase41-validator-review.md`. That acceptance does not lift the architecture activation hold or authorize runtime activation.

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

The Phase 4 workflow separately completed syntax validation, hardened sandbox-helper compilation, the AST/transitive capability audit and self-tests, runtime integration and isolation suites, event projection, tamper, fault-injection, Institutional QA, and the full Phase 1–4 execution suite. These historical results are test evidence only; they did not independently authorize activation.

## Activation constraints retained

PR #21 remains open, draft, inactive, and unmerged. Issues #9 and #15 remain open. The runtime remains inactive. Deployment capability certification and separate activation authorization remain required before any consideration of activation. Phase 4.1 acceptance does not authorize Phase 4.2 implementation.

## Post-Acceptance CI Corrections

This final section supplements the historical correction map. Its verified correction base remains `abfc0550be9e448dc7973bff286622c58a07fadc`; the original map and its acceptance basis are not rewritten.

1. **Portable temporary-path correction.** `44f166a59735c7c4b6f1237a58951875c42a0ca8`, directly parented by `d0fb89f1ba1b22199a2fecec060c1ef6f7265ab9`, corrected a Windows-specific temporary path in `tests/validator-security.test.js`. It changed no production file. Independent non-root Linux review reproduced the parent `EACCES` failure and passed the replacement focused `rename/unlink/chmod` regression.
2. **Timeout-lifecycle correction.** `e29bd44ce3e83eabc45d3a619dec689d43ccb317`, directly parented by `44f166a59735c7c4b6f1237a58951875c42a0ca8`, prevents a permanently pending semantic validator Promise from allowing its worker to exit before the parent deadline. Trusted private-port ref/close operations are captured and the port remains referenced through reviewed completion or parent timeout. Pending validation deterministically yields `VALIDATOR_TIMEOUT`; genuine premature exit remains `WORKER_INTERNAL_FAILURE`; no trusted harness object is exposed to validator code.
3. **Adversarial coverage.** The correction coverage includes portable OS temporary-path construction; the rename/unlink/chmod payload; 25/25 repeated short-timeout pending validations; trusted worker/MessagePort cleanup; Promise resolution and rejection before deadline; synchronous throw; genuine worker exit; and validator-realm prototype replacement that cannot suppress timeout or cleanup. The final independent Linux results at `e29bd44ce3e83eabc45d3a619dec689d43ccb317` were execution-orchestrator 57/57, validator-security 141/141, and aggregate execution 338/338, with zero pending-run `WORKER_INTERNAL_FAILURE`, execution attempts, governed writes, surviving Node processes, and temporary validator artifacts.
4. **Independent clean-room acceptance.** The portability correction is bound to `phase41-ci-path-portability-review.zip` (4,401,359 bytes; SHA-256 `2a7446304d62b51c10415ce59e24b686f3793c366bf2797647bf8e4b32302bf2`), `phase41-ci-path-portability.bundle` (4,424,638 bytes; SHA-256 `3261aa66fedbb2dcf1b312df0d4fa87d36e437463ea03996c70ca667795d356f`), `phase41-ci-path-portability.patch` (1,108 bytes; SHA-256 `fe3a1f775ef4d73f4e6caac054314e788f1b583aa3a45ae1ea29463ab9a24ad9`), and `phase41-ci-path-portability-final-independent-review.txt` (3,895 bytes; SHA-256 `1731aa09aea97499d8e3f4992f3691abc19cf8a7e23e8e09f17261ded55160d5`). The timeout-lifecycle correction is bound to `phase41-validator-timeout-lifecycle-review.zip` (4,440,130 bytes; SHA-256 `eb012936e5984ae99b4c0b21d55ec6d67e68490f8fc26648fea34d7f26de481a), `phase41-validator-timeout-lifecycle.bundle` (4,428,740 bytes; SHA-256 `5da3ed8e586082e2f61774ad9e20a0839b0a591ca8c4025dd580fb304d9e6cb7), `phase41-validator-timeout-lifecycle.patch` (16,276 bytes; SHA-256 `666ea304242d8534fa2dfb73f44b8ae88e0f94ee772c2970db60104514af2c44), and `phase41-validator-timeout-lifecycle-final-independent-review.txt` (8,262 bytes; SHA-256 `5d587722acdfcffdb6b1f9ce78367a9fba4ab829bba8263aab4317c990e4877b`).
5. **Exact-head GitHub Actions.** The final reviewed code head before this documentation addendum is `e29bd44ce3e83eabc45d3a619dec689d43ccb317`, with code tree `f38602d44fbe1f7b4d33d246050f5480165d3dbe`. On July 13, 2026, all exact-head workflows concluded success: Institutional QA run `29289106527`, Execution Engine Tests run `29289106533`, and Execution Engine Phase 4 run `29289106585`.

Phase 4.1 remains ACCEPTED and `VAL-RESULT-001` remains RESOLVED. PR #21 remains open, draft, inactive, unmerged, and under HOLD; Issues #9 and #15 remain open; runtime activation and deployment remain prohibited. No production-security or absolute-isolation claim is authorized. Phase 4.2 remains PLANNED: `P42-D001` is OPEN and provisional, `P42-D002` is APPROVED, and `P42-D003` is OPEN and RECOMMENDED. Phase 4.2 implementation remains prohibited. This addendum does not authorize merge or activation.
