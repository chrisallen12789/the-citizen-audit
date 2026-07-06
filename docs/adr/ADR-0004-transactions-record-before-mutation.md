# ADR-0004: Transactions Record Before Mutation

Status: accepted

Date: 2026-07-06

## Context

Institution OS needs a governed paper trail for institutional operations before any execution system mutates canonical state.

Direct mutation creates weak accountability and makes it hard to answer who requested an operation, what authority was evaluated, what objects were affected, and what final disposition occurred.

## Decision

Transactions are governed institutional operation records.

Transactions v1 record intent, authority evaluation, affected objects, proposed writes, emitted events, and final status.

Transactions v1 do not directly mutate canonical state.

Transactions are the execution unit for the Execution Engine.

## Consequences

Every important mutation should eventually begin as a transaction.

A transaction may be approved, denied, require human review, closed, or abandoned.

Proposed writes remain descriptive until the Execution Engine applies them.

This creates the institutional paper trail before execution exists or expands.
