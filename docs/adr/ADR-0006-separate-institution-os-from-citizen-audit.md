# ADR-0006: Separate Institution OS from The Citizen Audit

Status: accepted

Date: 2026-07-06

## Context

The project began as The Citizen Audit publication platform. The architecture has since grown into reusable governance infrastructure: boot, registry, authority, dependencies, transactions, execution, events, and institutional specifications.

Those primitives are broader than one audit or one public website.

## Decision

Institution OS and The Citizen Audit are separate architectural concepts.

Institution OS is the reusable operating system.

The Citizen Audit is the reference institution running on it.

## Consequences

Citizen Audit-specific doctrine, branding, audits, claims, source libraries, and publication views should not be treated as Institution OS primitives unless generalized.

Future institutions should be able to use Institution OS without inheriting Citizen Audit-specific assumptions.

Internal architecture should use this distinction consistently:

```text
Institution OS
    ↓
Reference Institution
    ↓
The Citizen Audit
```

This separation improves portability, maintainability, and long-term institutional durability.
