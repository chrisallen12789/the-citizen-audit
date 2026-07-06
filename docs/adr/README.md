# Architecture Decision Records

This directory records accepted architectural decisions for Institution OS and The Citizen Audit reference institution.

ADRs exist so future contributors and AI agents do not have to reconstruct major decisions from chat history.

## Accepted decisions

- [ADR-0001: Institution Registry Is Canonical](ADR-0001-institution-registry-is-canonical.md)
- [ADR-0002: Boot Manifest Owns Boot Order](ADR-0002-boot-manifest-owns-boot-order.md)
- [ADR-0003: Dependencies Belong to Registry Objects](ADR-0003-dependencies-belong-to-registry-objects.md)
- [ADR-0004: Transactions Record Before Mutation](ADR-0004-transactions-record-before-mutation.md)
- [ADR-0005: Execution Applies Approved Writes](ADR-0005-execution-applies-approved-writes.md)
- [ADR-0006: Separate Institution OS from The Citizen Audit](ADR-0006-separate-institution-os-from-citizen-audit.md)

## Rule

When a future implementation requires a durable architectural decision, add an ADR before or with the implementation.

If a decision reverses or supersedes an earlier ADR, do not delete the old ADR. Add a new ADR that explicitly supersedes it.
