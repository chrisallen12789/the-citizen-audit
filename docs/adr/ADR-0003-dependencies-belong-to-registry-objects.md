# ADR-0003: Dependencies Belong to Registry Objects

Status: accepted

Date: 2026-07-06

## Context

Institution OS needs deterministic impact analysis and dependency validation. A legacy dependency source existed separately from the canonical institution registry.

Separate dependency sources create ambiguity.

## Decision

Institutional dependencies belong to canonical registry objects through `dependsOn`.

The dependency graph is over institutional systems and objects, not boot phases.

Boot phase order remains owned by the Boot Manifest.

## Consequences

The canonical dependency source is:

```text
kernel/registry/institution.json
```

The dependency graph validates registered object relationships, dangling references, required-system connectivity, and prohibited cycles.

Impact analysis should be based on registry object ids and declared dependencies.

Legacy dependency files may remain temporarily for compatibility but must be marked deprecated and should emit structured warnings if used.
