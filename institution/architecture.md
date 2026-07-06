# Institution Operating System Architecture

Status: foundational architecture

The Citizen Audit is evolving into an Institution Operating System.

The repository is organized around five major systems:

```text
Institution
Kernel
Memory
Workforce
Platform
```

Each system exists to reduce founder dependence and increase institutional reproducibility.

## System 1: Institution

The Institution system contains the doctrine, governance, public standards, and long-term identity of The Citizen Audit.

It defines what the institution is, what it is not, and which rules cannot be bypassed for convenience.

Responsibilities:

- public doctrine;
- governance principles;
- institutional identity;
- constitutional constraints;
- contributor obligations;
- long-term vision;
- bootstrap instructions for future AI systems.

The Institution system is the source of legitimacy.

## System 2: Kernel

The Kernel is the operational runtime.

It loads agents, checks authority, records events, routes work, produces status, and eventually enforces institutional permissions before action execution.

Responsibilities:

- runtime execution;
- permission checks;
- authority resolution;
- event logging;
- executive coordination;
- status reporting;
- safe orchestration of agents.

The Kernel coordinates process.

The Kernel does not determine truth.

## System 3: Memory

The Memory system represents institutional memory as a graph of records and relationships.

Responsibilities:

- node definitions;
- edge definitions;
- graph storage;
- status reporting;
- query support;
- export support;
- relationship mapping.

Memory records relationships.

Memory does not create conclusions.

## System 4: Workforce

The Workforce system contains agents, departments, directors, and future worker-agent structures.

Responsibilities:

- agent declarations;
- capability declarations;
- report paths;
- department organization;
- authority boundaries;
- operational specialization.

Agents may automate process.

Agents may not automate truth.

## System 5: Platform

The Platform system contains the public website, publication outputs, APIs, and user-facing surfaces.

Responsibilities:

- public rendering;
- audit navigation;
- search;
- evidence trace views;
- release artifacts;
- static deployment;
- future public APIs.

The Platform serves the institution.

The Platform is not the institution.

## Architectural dependency order

The dependency order is intentional:

```text
Institution
    ↓
Kernel
    ↓
Memory + Workforce
    ↓
Platform
```

A public interface should not create institutional authority.

A worker agent should not create institutional authority.

A memory relationship should not create institutional authority.

Authority originates from institutional governance and is enforced by the Kernel.

## Design rule

If a feature will matter across multiple audits, it should become infrastructure.

If a rule can affect truth-bearing records, it should become governance.

If a process will repeat, it should become a subsystem.

If a subsystem can act, it should be registered.

If a registered actor can act, it should declare capability and authority.
