# Institution OS Kernel Version

Version: `0.1.0`

Status: Architecture freeze baseline

Date: 2026-07-06

## Scope

This version identifies the first coherent Institution OS kernel baseline.

It does not mean the operating system is complete.

It means the kernel now has enough primitives to stabilize its architecture before broader automation expands on top of it.

## Implemented kernel primitives

- Boot System v2
- Institution Registry
- Registry validation
- Boot manifest reconciliation
- Authority Engine v1
- Canonical Dependency Graph v1
- Transaction Log v1
- Execution Engine v1
- Structured event records
- Institution OS Core Specification v1

## Experimental or partial primitives

- Memory Engine
- Proposal Engine
- Executive Layer
- Agent Workforce
- Publication Platform integration

## Not yet implemented

- Execution Engine v2 post-write validation
- Institution Health
- Institution State
- Scheduler
- Queues
- Department Runtime
- Challenge System
- Public Institution APIs
- Generalized Institution OS installer

## Version rule

Patch versions may document small kernel corrections.

Minor versions should represent new kernel primitives or materially stronger governance enforcement.

Major versions should represent compatibility-breaking changes to Institution OS architecture.

## Current architectural state

The kernel is allowed to coordinate, validate, authorize, transact, execute narrow writes, and record events.

The kernel is not allowed to determine truth.

Truth-bearing audit records remain governed by human institutional process until a future scope explicitly defines safe execution boundaries for them.
