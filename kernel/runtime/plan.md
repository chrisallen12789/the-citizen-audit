# Kernel Runtime Implementation Plan

Status: implementation plan

The current repository has independent agents. The next architectural step is a shared kernel runtime that loads the agent registry, checks authority, executes agents, collects reports, and produces a single institutional status output.

## Runtime v1 goals

Runtime v1 should support:

- `npm run kernel:status`
- `npm run kernel:agents`
- `npm run kernel:run -- AGENT-ID`
- `npm run kernel:run-all`

## Runtime v1 responsibilities

1. Load `agents/registry.json`.
2. Load `kernel/permissions/authority-levels.json`.
3. Load `kernel/permissions/rules.json`.
4. Verify each agent has a declared authority level.
5. Verify each agent has a report path.
6. Execute active agents in dependency-safe order.
7. Capture exit codes.
8. Write kernel events.
9. Aggregate reports.
10. Produce a kernel status summary.

## Non-goals for Runtime v1

Runtime v1 does not need distributed execution, parallel scheduling, database storage, authentication, queue workers, or remote agent sandboxes.

Local deterministic scripts are sufficient for v1.

## Future runtime features

- event log persistence;
- dependency graph execution;
- agent retries;
- rate limits;
- model-provider abstraction;
- GitHub issue creation for unresolved failures;
- daily scheduled runs;
- agent performance metrics;
- institutional health dashboard;
- immutable event archives.

## Safety requirement

The runtime must refuse to execute any agent whose declared authority exceeds the action it is attempting or whose registry entry lacks required constraints.

The kernel must fail closed.
