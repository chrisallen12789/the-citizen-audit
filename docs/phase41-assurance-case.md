# Phase 4.1 assurance case

## Objective and boundary

**Objective.** Establish reviewable JavaScript-level assurance that an authoritative validator is selected, loaded from a verified closure into a restricted realm, produces a bounded result through the reviewed worker channel, and causes a failed validation to fail closed. This is not an OS security boundary.

**System boundary.** The boundary begins with `kernel/execution/orchestrator-core.js` loading a validator registry and ends with `kernel/execution/validation-result-store.js` persisting a result for an execution attempt. The worker boundary is `kernel/execution/validation-cycle.js` and `kernel/execution/validator-worker.js`. The loader boundary is `loadClosureEntry()` in the worker.

### Trust model

| Class | Components and authority |
| --- | --- |
| Trusted computing base | Node.js runtime and worker-thread implementation; host OS; reviewed project checkout; `kernel/execution/orchestrator-core.js`; validation cycle; worker harness; registry/closure construction; canonical JSON/hash and durable-I/O helpers. |
| Trusted inputs | The authoritative validator registry and policy read by production code, the expected `validatorSetHash`, governed transaction and plan inputs after their existing validation, and the attempt ledger path. |
| Untrusted or constrained | Validator module bytes after they enter the validator realm; validator return values; validator exceptions/rejections; direct default-channel messages; dependency exports visible to validator code. |
| Protected assets | Validator source identity, validator-set provenance, host authority objects, governed write decision, validation-result integrity, result size limits, worker/channel lifecycle, and execution-attempt outcome. |

The trusted computing base is an assumption, not evidence that its components are defect-free. OS process, filesystem, network, and resource controls are OUT OF SCOPE for Phase 4.1; see [Phase 4.2 planning](phase42-os-confinement-planning.md).

## Lifecycle model

### Validator lifecycle

1. `orchestrator-core.js` loads the registry and records `validatorSetHash` before candidate validation.
2. `validation-cycle.js` re-loads the registry, checks the expected hash, selects required descriptors, and launches one worker per validator.
3. `validator-worker.js` re-loads the authoritative descriptor, verifies the expected hash, verifies and captures closure bytes, then compiles the entry in a `vm` context.
4. The worker normalizes a validator result and sends a serialized envelope only through a private harness channel.
5. `validation-cycle.js` parses and normalizes it; `orchestrator-core.js` rejects a failed phase.

### Module-loader lifecycle

`validator-worker.js` documents and implements cache entries with `loading`, `loaded`, and `invalidated` states. An entry has a path, monotonic module generation, context-native `module` object, and identity-based dependency/dependent sets. A failed or tainted graph is marked invalidated, edges are removed, and the path is removed only when it still maps to that exact entry. A legitimate cycle reads the live `module.exports` slot. See [VAL-CACHE-001](phase41-invariant-catalog.md#val-cache-001-failed-direct-module-is-not-cached) through [VAL-GENERATION-001](phase41-invariant-catalog.md#val-generation-001-obsolete-module-generations-cannot-resurrect).

### Validation-result lifecycle

Candidate validation precedes attempt creation. Post-write validation follows journaled writes and the `validating` attempt transition. On a passed post-write result, `writeValidationResult()` serializes phase results and the orchestrator transitions the attempt to `committed` with a `validationResultHash`. On failure the orchestrator rolls back. This flow is directly visible in `kernel/execution/orchestrator-core.js` and `kernel/execution/validation-result-store.js`.

**Open boundary condition.** The REJECTED ruling and this defect description are imported from an independent checkpoint review performed outside commit `e0e14e1`; its raw review record is not in this branch and must be supplied separately. The review reports that the exact validator-entry generation used by a running `validate()` attempt can become invalid during validation while the worker still accepts and transports that result as success. [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation) requires validity through synchronous `validate()` return, Promise or thenable settlement, result normalization, and final successful transport. A private worker-side reference to the entry generation and a monotonic validity gate are candidate mechanisms. This documentation does not require an envelope token, result-artifact token, ledger binding, or orchestrator/result-store change.

## Claim-argument-evidence

| Claim ID | Claim statement | Rationale | Required evidence | Current evidence | Status | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- |
| CA-01 | Production validation selects an authoritative registry and hash rather than caller-supplied validator material. | Source provenance prevents a caller from selecting unreviewed validator bytes. | Source inspection plus direct-worker negative cases. | `validation-cycle.js`, `validator-worker.js`; tests named `production worker direct attack cannot execute an external validator from a temporary root` and `production worker verifies validatorSetHash before validator execution`; matrix rows 122–127. | **REPORTED** | Independently reproduce the named cases at this commit. |
| CA-02 | Validator code is constrained to a reviewed JavaScript-level realm and facades. | It limits host-authority exposure during validator execution. | Realm construction, facade inspection, and object-graph regressions. | `validator-worker.js`; tests `validator-visible object graph exposes no host-realm authority` and `global process aliases and constructor chains cannot recover the worker channel`; review report sections “Durable Validator-Visible Global Boundary” and “Validator-Visible Object Graph Boundary.” | **REPORTED** | Reproduce against supported runtime versions; this does not show OS confinement. |
| CA-03 | Closure loading is fail-closed and failed loader generations do not expose stale partial exports. | Failed module state must not become a later authority or semantic result. | Loader state-machine inspection and cache/cycle regressions. | `validator-worker.js` cache generation logic; tests `failed local dependency loads are removed from the provisional module cache`, `failed CommonJS cycle peers that captured provisional exports are invalidated`, and `invalidated active module generations cannot resurrect or damage replacements`. | **REPORTED** | Independently reproduce; tie the module-level evidence to the attempt-result lifecycle. |
| CA-04 | A returned validator result is bounded, parsed, normalized, and can enter validation processing only through the harness channel. | Unchecked or oversized data must not drive validation success. | Envelope implementation and transport regressions. | `validation-cycle.js` `parseTransportedValidatorResult()`; tests `production validation cycle parent receives only the exact parsed contents of the bounded serialization` and `validator cannot forge a success envelope before runtime contract verification`; coverage matrix rows 119–127. | **REPORTED** | Reproduce all normal/failure transport paths. |
| CA-05 | Once the exact validator-entry generation used by a validation attempt becomes invalid, that attempt cannot produce accepted success. | A running validation must not outlive the generation it evaluated. | Reproduce the imported defect; add regressions covering synchronous return, Promise/thenable settlement, normalization, and final successful transport; demonstrate a fail-closed validity gate. | The independent review finding is imported and its raw record is absent from this branch. Source inspection identifies worker module generations, but this task did not reproduce behavior. | **OPEN** | Independently reproduce, correct, and review the validate-time validity gate. Envelope/result-artifact/ledger mechanisms remain optional design questions. |

## Assumptions and residual risks

Assumptions include correct Node.js and `vm` behavior, trustworthy repository bytes at checkout, correctness of the registry/hash implementation, correct durable storage, and proper upstream transaction/authority controls. The existing review report states results for a Windows host and notes no local Linux reproduction; that statement is REPORTED, not a portability conclusion.

Residual risks include defects in the trusted harness or Node runtime, a gap between checked tests and untested interleavings, the OPEN attempt-generation/result binding, and the absence of OS-level confinement. JavaScript-level object/realm controls are not equivalent to process isolation, filesystem restrictions, network denial, or resource limits.

## Acceptance argument and block

Phase 4.1 could only be considered for later acceptance after every applicable invariant has reproducible evidence, including [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation), and an independent review records its conclusion. The current checkpoint remains REJECTED under the imported independent review ruling because the validator-session property is OPEN; the raw review record must be supplied separately. Rejected checkpoints can still provide useful evidence for narrower claims; [checkpoint history](phase41-checkpoint-history.md) records those lessons without treating the whole checkpoint as complete.
