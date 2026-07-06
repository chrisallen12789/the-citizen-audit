# Institution OS Core Specification v1

Status: architectural baseline

This document freezes the core architecture of Institution OS as it exists after the first kernel primitives have been implemented.

The purpose of this specification is to prevent the project from continuing as an unbounded sequence of features. Institution OS is defined here as a layered operating model with stable primitives, explicit subsystem boundaries, and clear separation between the reusable operating system and The Citizen Audit as the reference institution.

## 1. Identity

Institution OS is a governance-oriented software runtime for transparent, evidence-based public institutions.

Its purpose is to make institutional operations reproducible, inspectable, governable, and independently verifiable.

Institution OS is not the public website.

Institution OS is not The Citizen Audit.

The Citizen Audit is the reference institution running on Institution OS.

The internal distinction is:

```text
Institution OS
    ↓
Reference Institution
    ↓
The Citizen Audit
```

This distinction matters because future institutions should be able to adopt the operating system without inheriting Citizen Audit-specific doctrine, branding, audits, or publication choices.

## 2. Architectural Law

Every major subsystem must answer one question before it is added:

Is this a primitive every transparent public institution will need?

If yes, it belongs in Institution OS.

If no, it belongs in The Citizen Audit reference institution or in a platform-specific application layer.

Institution OS primitives should be durable across decades, not optimized around the current website, current audit, current founder, or current AI tools.

## 3. Core Layers

Institution OS is organized into five layers.

```text
Layer 0: Doctrine
Layer 1: Kernel
Layer 2: Runtime
Layer 3: Institution
Layer 4: Platform
```

Each layer may depend downward. Lower layers must not depend upward.

Platform may depend on Institution.

Institution may depend on Runtime.

Runtime may depend on Kernel.

Kernel may depend on Doctrine.

Doctrine must not depend on any implementation layer.

## 4. Layer 0: Doctrine

Layer 0 contains the institutional rules that give the system legitimacy.

Examples:

- Constitution
- Charter
- Operating Principles
- AI Bootstrap
- Policy documents
- Amendment rules
- Contributor obligations
- Citizen standards

Doctrine defines what the institution is allowed to become.

Doctrine must be readable by humans.

Doctrine may be interpreted by software, but software must not silently rewrite doctrine.

Doctrine changes require explicit governance.

## 5. Layer 1: Kernel

Layer 1 is the institutional kernel.

The Kernel validates, governs, records, and executes institutional operations.

Current and planned kernel primitives include:

- Boot
- Registry
- Authority
- Policies
- Dependencies
- Transactions
- Execution
- Events
- Health
- Scheduler
- State

The Kernel coordinates process.

The Kernel does not determine truth.

The Kernel must refuse unsafe operations before they mutate canonical state.

## 6. Layer 2: Runtime

Layer 2 contains long-running operational services.

Examples:

- Memory
- Departments
- Agents
- Executive coordination
- Queues
- Scheduled jobs
- Metrics
- Workload routing

The Runtime executes institutional work under Kernel governance.

Runtime services may recommend, inspect, report, route, or prepare work.

Runtime services must not bypass Authority, Transactions, or Execution.

## 7. Layer 3: Institution

Layer 3 contains institution-specific public records and workflows.

Examples:

- Audits
- Claims
- Sources
- Evidence
- Unknowns
- Decisions
- Challenges
- Proposals
- Corrections
- Releases

For The Citizen Audit, this is where public audit records live.

For another institution, this layer may contain different domain records while still using the same Kernel and Runtime primitives.

Institution records are truth-bearing when they describe findings, sources, evidence, claims, corrections, or publication status.

Truth-bearing records require heightened governance.

## 8. Layer 4: Platform

Layer 4 contains public-facing and deployment-specific surfaces.

Examples:

- Website
- Public API
- Search
- Dashboards
- Static assets
- Publication views
- Challenge intake interface
- Release pages

The Platform serves the institution.

The Platform is not the institution.

A platform failure must not corrupt institutional records.

A platform convenience must not create institutional authority.

## 9. Core Primitives

Institution OS currently recognizes these primitives:

```text
Object
Actor
Authority
Policy
Registry
Dependency
Boot
Event
Transaction
Execution
Memory
Department
Agent
Decision
Release
Health
State
Scheduler
Queue
```

Every subsystem should be expressible in terms of these primitives.

If a new concept cannot be mapped onto these primitives, the architecture should pause before implementation.

## 10. Object

Nothing important exists only because a folder exists.

Institutional objects must be registered.

An object should eventually share a common metadata model:

```yaml
id:
type:
status:
version:
createdAt:
updatedAt:
owner:
authority:
dependsOn:
relationships:
history:
metadata:
```

Object types include, but are not limited to:

- system
- doctrine
- policy
- registry
- authority_rule
- dependency_graph
- boot_phase
- transaction
- execution
- memory_node
- department
- agent
- audit
- claim
- source
- evidence
- decision
- challenge
- proposal
- release
- report

Objects are the addressable units of the institution.

## 11. Actor

An actor is anything that can request or perform institutional work.

Actors may include:

- citizen
- contributor
- reviewer
- director
- board
- founder
- agent
- executive
- system

The Authority Engine should evaluate actors, not merely agents.

Agents are one actor class, not the whole model.

## 12. Authority

Authority answers:

Can this actor perform or request this action on this object under current policy?

Authority must be explicit.

Authority must be re-checked at execution time.

Past approval is evidence of a prior decision, not permanent authorization.

Actions requiring human approval must never be executed automatically.

## 13. Policy

Policy is executable governance.

Policy defines operational rules such as:

- halt on registry failure
- require post-write validation
- allow or block double execution
- require human review for specific actions
- allow safe-mode boot
- mark subsystems required or optional

Policy should reduce hard-coded governance.

Policy changes are institutional changes and should be governed accordingly.

## 14. Registry

The Institution Registry is the canonical list of institutional objects.

The registry is not merely documentation.

It is a kernel input.

The registry records objects, types, paths, descriptions, statuses, required flags, and dependencies.

The registry does not own boot order.

The registry owns institutional object identity.

## 15. Dependency

Dependencies describe institutional architecture, not startup order.

Dependencies are object-to-object relationships declared on canonical registry objects through `dependsOn`.

The canonical dependency source is:

```text
kernel/registry/institution.json
```

The dependency graph must validate:

- all referenced objects exist
- required systems are connected
- prohibited cycles do not exist
- impact analysis is deterministic

Dependency graph output is used to determine affected objects, blast radius, and revalidation requirements.

## 16. Boot

Boot is the institutional initialization protocol.

Boot validates whether the institution can enter an operational state.

Boot order is owned by:

```text
kernel/boot/manifest.json
```

Boot must not use dependency order as boot order.

Boot should produce:

- boot id
- boot events
- boot report
- phase results
- institution fingerprint
- warnings
- failures

Boot must halt before runtime if required governance gates fail.

## 17. Event

Events are structured institutional records.

Console output is not the primary record.

Events should be JSON records with stable event types.

Events must support replay, audit, debugging, and institutional history.

Important event families include:

- boot events
- transaction events
- execution events
- authority events
- validation events
- release events
- challenge events

## 18. Transaction

A transaction is a governed institutional operation record.

Transactions v1 record intent, authority evaluation, affected objects, proposed writes, events, and final status.

Transactions are the execution unit.

Transactions do not automatically mutate canonical state.

Only the Execution Engine may apply approved transaction writes.

Transactions create the paper trail before mutation.

## 19. Execution

Execution applies approved transactions.

Execution is the first subsystem allowed to mutate canonical institutional state.

Execution must be narrow, logged, authority-checked, and rollback-safe.

Execution must:

- consume approved transactions
- re-check authority at execution time
- apply only declared proposed writes
- reject prohibited paths
- snapshot touched files
- restore on failure
- emit execution events
- record append-only execution history

Execution must not invent writes.

Execution must not broaden transaction scope.

Execution must not mutate doctrine or audit truth records unless future governance explicitly authorizes that scope.

## 20. Memory

Memory records institutional history and relationships.

Memory must not create conclusions.

Memory should eventually become graph-native.

Memory should answer:

- what happened
- when it happened
- what objects were affected
- what decision caused it
- what evidence supported it
- what downstream records depend on it

Memory should preserve why the institution changed, not merely that files changed.

## 21. Department

Departments organize institutional labor.

A department may contain:

- director
- worker agents
- queues
- authority boundaries
- escalation paths
- metrics
- reports

Departments are the scalable unit of workforce organization.

The Executive Layer should coordinate departments, not micromanage individual scripts.

## 22. Agent

Agents are constrained workers.

Agents may automate process.

Agents may not automate truth.

Each agent should declare:

- identity
- capabilities
- authority level
- inputs
- outputs
- report path
- forbidden actions
- metrics

Agents should be replaceable, narrow, logged, and inspectable.

## 23. Decision

A decision is an institutional judgment record.

A proposal asks for change.

A transaction records an operation envelope.

An execution applies approved writes.

A decision records approval, rejection, interpretation, correction, or disposition.

Decision records should be durable and reviewable.

## 24. Release

A release is an immutable public publication event.

A release should include:

- release id
- manifest
- artifacts
- hashes
- validation report
- source archive status
- publication readiness decision
- supersession relationship if applicable

A release must not be silently edited.

A release may only be superseded or corrected through governed process.

## 25. Health

Institutional health is the measurable operational state of the institution.

A future command should exist:

```text
npm run institution:health
```

Health should report, at minimum:

- registry status
- authority status
- dependency status
- boot status
- transaction status
- execution status
- memory status
- workforce status
- platform status
- publication status

Health should distinguish:

- pass
- warning
- degraded
- failed
- unknown

Health reporting must not repair the institution by itself.

## 26. State

The institution should eventually expose a single operational state.

Possible states:

```text
healthy
degraded
maintenance
recovery
read_only
offline
```

Boot determines initial state.

Health updates state.

Scheduler reacts to state.

Execution obeys state.

Platform displays state.

State must be explicit, not inferred from scattered logs.

## 27. Scheduler

The Scheduler is the future subsystem that decides when approved institutional work runs.

Execution should eventually be invoked by Scheduler, not directly by ad hoc commands.

Scheduler responsibilities:

- select eligible transactions
- respect authority and policy
- respect institution state
- prioritize queues
- prevent unsafe concurrent mutation
- emit scheduling events

The Scheduler does not determine truth.

The Scheduler does not approve work.

## 28. Queue

Queues organize pending institutional work.

Queue classes may include:

- high
- normal
- background
- maintenance
- recovery

Examples:

- challenge review
- archive verification
- source health check
- release validation
- broken link scan
- evidence integrity check

Queues should feed Scheduler and Departments.

## 29. Mutation Boundary

Canonical mutation must pass through the governed chain:

```text
Request
    ↓
Transaction
    ↓
Authority Evaluation
    ↓
Approval or Human Review
    ↓
Execution
    ↓
Post-Write Validation
    ↓
Events
    ↓
Memory
```

Direct mutation of canonical records is a legacy escape hatch and should be reduced over time.

The founder is not exempt from institutional process.

## 30. Public Truth Boundary

No automated subsystem may determine truth by authority alone.

AI may:

- inspect
- classify
- summarize
- recommend
- report
- draft
- route
- validate structure

AI may not:

- fabricate evidence
- mark unverified sources verified
- finalize truth-bearing conclusions
- silently alter published claims
- bypass correction process
- weaken governance rules

## 31. Reference Institution Boundary

The Citizen Audit may contain:

- specific audits
- specific claims
- specific source libraries
- specific public pages
- specific publication rules
- specific civic standards

Institution OS should contain:

- boot
- registry
- authority
- dependency graph
- transactions
- execution
- memory
- scheduler
- health
- state
- workforce primitives

Citizen Audit-specific logic must not leak into Institution OS unless it is generalized into an institutional primitive.

## 32. Compatibility and Deprecation

Legacy subsystems may remain during migration.

Legacy paths must be clearly marked deprecated.

If a deprecated source is used, the system should emit a structured warning event.

Compatibility must not be confused with authority.

The canonical source must always be named.

## 33. Architectural Freeze

As of this specification, the core primitive set is frozen for v1.

New primitives require architectural review.

New subsystems should be implemented as compositions of existing primitives whenever possible.

The purpose of this freeze is not to stop development.

The purpose is to prevent accidental architecture.

## 34. Next Kernel Milestones

The highest-value next milestones are:

1. Execution Engine v2: post-write institutional validation.
2. Institution Health v1.
3. Institution State v1.
4. Scheduler v1.
5. Queue v1.
6. Memory Engine v2.
7. Challenge System v1.
8. Department Runtime v1.
9. Public Institution APIs.

Execution Engine v2 should come before broader write scope.

Health and State should come before Scheduler.

Scheduler should come before autonomous recurring work.

Memory Engine v2 should come before large-scale challenge processing.

## 35. Governing Principle

The operating system exists to make institutional trust unnecessary where verification is possible.

Every subsystem should reduce reliance on personality, memory, discretion, or private judgment.

Every important conclusion must remain independently verifiable.

Every important operation must leave a record.

Every important mutation must be governed.
