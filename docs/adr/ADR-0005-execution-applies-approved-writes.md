# ADR-0005: Execution Applies Approved Writes

Status: accepted

Date: 2026-07-06

## Context

The Execution Engine is the first Institution OS subsystem allowed to mutate canonical institutional state.

That makes it a critical governance boundary.

Without a narrow rule, execution could become a general-purpose file writer and bypass the transaction and authority models.

## Decision

Execution consumes approved transactions and applies only their declared proposed writes.

Execution must not invent writes.

Execution must not broaden transaction scope.

Execution must re-check authority at execution time.

Execution must reject prohibited paths.

Execution must be rollback-safe within its declared scope.

## Consequences

Transactions are the execution unit.

Authority decisions are not trusted permanently; they are re-evaluated before mutation.

Execution v1 remains intentionally narrow.

Future broader write scope requires explicit governance and should not be added silently.
