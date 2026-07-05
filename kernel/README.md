# Citizen Audit Kernel

Status: executable foundation

The Citizen Audit Kernel is the institutional runtime for agents, events, permissions, reports, and future automation.

The kernel exists so The Citizen Audit can grow from a small set of scripts into a constrained, auditable, AI-assisted public auditing institution.

## Kernel responsibilities

The kernel is responsible for:

- loading registered agents;
- checking agent authority;
- enforcing permission boundaries;
- recording events;
- writing logs;
- aggregating reports;
- publishing institutional health data;
- routing work to specialized agents;
- stopping unsafe actions before execution.

## Kernel non-responsibilities

The kernel does not decide what is true.

The kernel does not rewrite claims.

The kernel does not change source verification status without evidence.

The kernel does not erase unknowns, weaken standards, or override the public constitution.

## Current runtime commands

Direct script usage:

```bash
node kernel/runtime/status.js
node kernel/runtime/run.js AGENT-REPAIR
node kernel/runtime/run.js --all
node kernel/runtime/run.js --all --dry-run
```

When wired through `package.json`, these map to:

```bash
npm run kernel:status
npm run kernel:run -- AGENT-REPAIR
npm run kernel:run-all
npm run kernel:run-all:dry
```

## Runtime outputs

The kernel writes:

```text
kernel/events/log.jsonl
docs/agent-reports/kernel-dashboard.md
```

## Target structure

```text
kernel/
  events/
  permissions/
  runtime/
  logging/
  metrics/
  services/
  registry/
```

## Architectural model

```text
Institutional Records
        │
        ▼
Citizen Audit Kernel
        │
        ├── Permission Bus
        ├── Event Bus
        ├── Memory Bus
        ├── Agent Runtime
        ├── Report Aggregator
        └── Metrics Service
        │
        ▼
Agents and Applications
```

## Scaling model

The kernel must eventually support many thousands of specialized agents. This does not mean each agent has broad authority. It means each agent performs narrow work under explicit permission boundaries.

The safest scalable agent is small, inspectable, constrained, logged, and replaceable.

## Core doctrine

The kernel enforces the institution's rules before it executes the institution's tools.
