# Institution Operating System Roadmap

Status: strategic roadmap

The Citizen Audit is moving from publication platform to Institution Operating System.

This roadmap defines the architectural sequence. It is not a marketing roadmap.

## Phase 1: Institutional doctrine stabilization

Goal: make the institution loadable without founder memory.

Core work:

- maintain `institution/ai-bootstrap.md`;
- keep runtime state separate from stable doctrine;
- document architectural invariants;
- ensure future AI systems can join the project without relying on prior chat history.

Exit condition:

A future operator can read the repository and understand the institution's operating doctrine.

## Phase 2: Executable governance

Goal: move from governance-as-documentation to governance-as-runtime.

Core work:

- formalize the Authority Engine;
- require agents to declare canonical capabilities;
- resolve capabilities against permission rules;
- fail unsafe operations before execution;
- log authority decisions.

Exit condition:

The Kernel can deny an action before an agent runs.

## Phase 3: Institution registry

Goal: make major institutional objects discoverable and auditable.

Core work:

- register systems;
- register agents;
- register audits;
- register schemas;
- register doctrine files;
- register generated reports;
- validate object references.

Exit condition:

Nothing important exists only because a folder exists.

## Phase 4: Dependency graph

Goal: make institutional dependencies explicit.

Core work:

- map audits to source libraries;
- map claims to evidence;
- map releases to gates;
- map agents to permissions;
- map generated files to canonical records;
- detect required revalidation when dependencies change.

Exit condition:

The Kernel can identify what must be revalidated after a change.

## Phase 5: Department model

Goal: organize the workforce for scale.

Core work:

- define departments;
- define director agents;
- define worker agents;
- define escalation paths;
- define interdepartmental handoffs;
- separate coordination from truth-bearing authority.

Exit condition:

The institution can add specialized agents without expanding implicit authority.

## Phase 6: Public reproducibility APIs

Goal: expose institutional records for independent verification.

Core work:

- public audit registry API;
- claim API;
- source API;
- decision API;
- unknowns API;
- challenge API;
- release manifest API.

Exit condition:

A third party can reproduce public audit conclusions from records rather than trust the public website.

## Phase 7: Multi-institution portability

Goal: make the system useful beyond The Citizen Audit.

Core work:

- generalize institutional schemas;
- isolate Citizen Audit-specific doctrine;
- document deployment patterns;
- define governance adapters;
- support independent institutional forks.

Exit condition:

A separate public institution can run the operating system without inheriting The Citizen Audit's founder-specific assumptions.
