# ADR-0002: Boot Manifest Owns Boot Order

Status: accepted

Date: 2026-07-06

## Context

Boot phases must run in a deterministic order. At the same time, boot order must not be confused with institutional dependency order or object identity.

The registry owns identity. Dependencies own architectural relationships. Boot needs an operational plan.

## Decision

The Boot Manifest owns boot order.

The canonical boot manifest path is:

```text
kernel/boot/manifest.json
```

The manifest defines phase order, required or optional status, phase entrypoints, and phase descriptions.

The manifest does not create institutional identity. Boot phases must reconcile with registered objects.

## Consequences

Adding or reordering boot phases should not require changing the boot runner.

Boot order remains operational configuration, not institutional architecture.

Manifest and registry reconciliation is required so a phase cannot exist only as an anonymous file.
