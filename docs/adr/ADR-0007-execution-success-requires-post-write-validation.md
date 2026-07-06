# ADR-0007: Execution Success Requires Post-Write Validation

Status: accepted

Date: 2026-07-06

## Context

The Execution Engine is the first Institution OS subsystem allowed to mutate canonical institutional state.

Execution v1 establishes the mutation boundary: it consumes approved transactions, re-checks authority, applies only declared writes, rejects prohibited paths, records events, and restores snapshots when execution fails.

That boundary is incomplete if execution can report success after filesystem writes but before the resulting institutional state has been validated.

A write may be mechanically successful while leaving the registry invalid, dependencies unresolved, boot configuration inconsistent, schemas violated, or another governed invariant broken.

Rollback after an implementation exception is not enough. Invalid institutional state is itself an execution failure.

## Decision

Execution success requires successful validation of the resulting institutional state inside the governed execution block.

Execution Engine v2 must use this sequence:

1. Load one approved transaction.
2. Re-check authority and execution policy immediately before mutation.
3. Acquire exclusive mutation control for the institution root.
4. Resolve the complete declared write set and affected registry objects.
5. Snapshot the canonical preimage of every touched path.
6. Build a staged candidate state containing only the transaction's declared writes.
7. Run the required deterministic validators against the staged candidate state.
8. Refuse promotion if candidate validation fails.
9. Promote only the validated candidate writes to canonical state.
10. Validate canonical state again before recording success or releasing mutation control.
11. If promotion or canonical validation fails, restore the complete preimage and verify restoration.
12. Emit structured execution, validation, commit, and rollback events.
13. Append the final execution disposition only after the canonical state is proven valid or proven restored.

Execution must never mark a transaction successful merely because file writes returned without error.

Validators are read-only. They may inspect and report. They may not repair state, invent writes, broaden transaction scope, or alter the transaction under validation.

Validator selection must be explicit and deterministic. Required validators may be selected from registered object types, affected objects, declared dependencies, and policy. Runtime discovery or hidden validator execution is prohibited.

Institution OS validators must remain institution-agnostic. The Citizen Audit may register additional institution-layer validators through explicit configuration, but Citizen Audit-specific validation logic must not be embedded in the kernel.

All validation results must be structured records suitable for events, execution history, debugging, and independent review.

Exclusive mutation control is an execution safety mechanism, not a Scheduler. It exists only to prevent concurrent canonical mutation while an execution is being staged, promoted, validated, or rolled back.

If rollback cannot be completed and verified, execution must fail closed, emit a critical recovery-required event, preserve recovery artifacts, and refuse to report institutional validity.

## Consequences

Execution becomes slower and performs more filesystem work.

Validators must support validation against an explicit institution root or candidate workspace rather than assuming the process working directory is canonical.

Existing command-line validators should preserve their CLI behavior while exposing reusable programmatic interfaces.

Execution history becomes capable of proving not only that declared writes were attempted, but that the resulting state passed the validators required by policy.

Post-write validation does not expand execution authority. Doctrine and truth-bearing audit records remain outside automated mutation scope unless separately authorized through future governance.

Health, State, Scheduler, Queues, Department Runtime, and broader automation remain downstream work. They must not be used to bypass this milestone.

## Supersession

This ADR extends ADR-0005. It does not supersede ADR-0005's narrow mutation boundary.