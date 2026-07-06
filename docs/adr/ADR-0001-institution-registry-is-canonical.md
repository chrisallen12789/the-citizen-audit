# ADR-0001: Institution Registry Is Canonical

Status: accepted

Date: 2026-07-06

## Context

Institution OS requires a single source of truth for institutional object identity. Earlier repository structure allowed folders and files to imply the existence of systems, agents, phases, and records.

That does not scale. It also creates founder-only knowledge and makes automation brittle.

## Decision

The Institution Registry is canonical for institutional object identity.

The canonical registry path is:

```text
kernel/registry/institution.json
```

Institutional objects must be explicitly registered.

Folders, scripts, manifests, and generated files may support objects, but they do not create institutional identity by themselves.

## Consequences

Every significant institutional object should eventually be registered.

Validation can confirm whether registered objects have real paths, valid types, and declared relationships.

Future subsystems should reference registry object ids rather than infer identity from paths.

This makes the institution more inspectable and less dependent on founder memory.
