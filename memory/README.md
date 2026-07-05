# Memory Engine

Status: v1.1 foundation

The Memory Engine is the institutional memory layer for The Citizen Audit.

It exists so the institution can remember why decisions were made, which records are connected, what remains unresolved, what agents did, and how the institution changed over time.

## Purpose

The Memory Engine is not chat memory and not model memory. It is version-controlled institutional memory.

It must allow a future maintainer, reviewer, contributor, or citizen to ask:

- Why does this rule exist?
- Which decision affected this audit?
- Which sources support this claim?
- Which unknowns block publication?
- Which agent created this report?
- Which release included this record?
- Which events explain this state?

## Core model

Memory is built from nodes and edges.

A node is an institutional object:

- audit;
- claim;
- source;
- decision;
- unknown;
- challenge;
- release;
- agent;
- event;
- rule;
- report;
- document.

An edge is a relationship:

- supports;
- cites;
- affects;
- blocks;
- supersedes;
- generated;
- reviewed;
- challenged;
- governed-by;
- produced-by;
- included-in.

## Commands

```bash
npm run memory:status
npm run memory:query -- NODE-ID
npm run memory:export
```

Examples:

```bash
npm run memory:query -- KERNEL-001
npm run memory:query -- AGENT-ADS-STEWARD
```

## Outputs

```text
memory/reports/status.md
public/data/memory-graph.json
```

## Doctrine

The Memory Engine records relationships. It does not invent conclusions.

Memory may help retrieve institutional context. It may not silently change evidence, claims, decisions, or publication readiness.

## Directory structure

```text
memory/
  graph/
  schemas/
  timeline/
  reports/
```

## v1 target

Memory Engine v1 should:

- define node schema;
- define edge schema;
- create a graph registry;
- produce a memory status report;
- validate basic graph integrity;
- prepare for future query commands.
