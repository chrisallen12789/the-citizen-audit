# Phase 4.1 assurance index

## Current status

Phase 4.1 is **REJECTED** at the reviewed checkpoint `e0e14e199c86a7a1e24ece8edd7d8f1090e735ef` (`Harden validator module cache generations`). The REJECTED status and current blocker were imported from an independent checkpoint review performed outside commit `e0e14e1`. The raw review record is not contained in this documentation branch and must be supplied separately to an external reviewer. This is not an activation or acceptance record.

The governing blocker is **OPEN**: the imported review reports that the exact validator-entry generation used by a running `validate()` attempt may become invalid during validation, while the worker can still accept and transport that already-running result as success. Once that exact generation becomes invalid, the attempt can never produce accepted success. This is [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation). The repository has module-cache generation controls; this documentation task did not independently reproduce the reported validate-time defect.

Phase 4.1 concerns JavaScript-level validator source, realm, loader, result, and transport controls. [Phase 4.2 OS confinement planning](phase42-os-confinement-planning.md) is future work only; OS-level confinement has not started.

## Document map

| Document | Use |
| --- | --- |
| [Assurance case](phase41-assurance-case.md) | Claim-argument-evidence view of the validator boundary. |
| [Invariant catalog](phase41-invariant-catalog.md) | Stable requirements, status, and regression pointers. |
| [Checkpoint history](phase41-checkpoint-history.md) | Chronological corrections and rejected-checkpoint lessons. |
| [External review packet](phase41-external-review-packet.md) | Reproduction-oriented briefing for an independent reviewer. |
| [Phase 4.2 planning](phase42-os-confinement-planning.md) | Non-binding future confinement evaluation areas. |
| [Documentation handoff](phase41-documentation-handoff.md) | Branch scope and later-incorporation conditions. |

Primary repository evidence remains [the validator review report](phase41-validator-review.md), [the coverage matrix](phase41-coverage-matrix.md), `tests/validator-security.test.js`, `tests/execution-orchestrator.test.js`, and the implementation under `kernel/execution/`.

## Evidence-status labels

| Label | Meaning |
| --- | --- |
| **VERIFIED** | Directly supported by repository material inspected for this documentation change, such as a named source path, committed diff, or named regression. It is not a general security proof. |
| **REPORTED** | Stated by a checkpoint report or matrix but not independently reproduced in this documentation task. |
| **REJECTED** | A checkpoint outcome that cannot be treated as complete. Here, the ruling is imported from an independent checkpoint review outside this branch; valid sub-improvements may remain. |
| **OPEN** | Required property whose proof or implementation remains unresolved. |
| **PLANNED** | Future work only. |
| **OUT OF SCOPE** | Deliberately excluded from Phase 4.1. |

Passing tests are evidence about the cases run; they do not by themselves establish an architectural proof. Builder-reported check results remain REPORTED until an independent reviewer reproduces them from the stated commit.

## Explicit nonclaims

This set does not state or imply deployment certification, GitHub CI certification, third-party certification, complete sandbox security, OS-level confinement, or that Phase 4.1 is accepted. PR #21 remains under HOLD according to the task's controlling status. No claim here changes repository governance.

## Reading order

Start with the [assurance case](phase41-assurance-case.md), use the [catalog](phase41-invariant-catalog.md) to trace an assertion, then use the [external packet](phase41-external-review-packet.md) to reproduce or challenge it. Consult [history](phase41-checkpoint-history.md) before re-opening a settled module-loader design choice.
