# Institution OS Kernel Version

Version: `0.1.0`

Status: Architecture freeze baseline with Execution Engine v2 Phase 1

Date: 2026-07-06

## Scope

This version identifies the first coherent Institution OS kernel baseline.

It does not mean the operating system or Execution Engine v2 is complete.

The kernel has enough stable primitives to continue phased implementation without widening live authority.

## Implemented kernel primitives

- Boot System v2
- Institution Registry
- Registry validation
- Boot manifest reconciliation
- Authority Engine v1
- Canonical Dependency Graph v1
- Transaction Log v1
- Structured event records
- Institution OS Core Specification v1
- Execution-attempt schema v1
- Execution-attempt state machine v1
- Hash-chained execution-attempt ledger v1

## Experimental or partial primitives

- Execution Engine v2 planning and candidate-state scaffolding
- Execution Engine v2 Phase 1 attempt records and replay
- Memory Engine
- Proposal Engine
- Executive Layer
- Agent Workforce
- Publication Platform integration

## Not yet implemented

- Execution Engine v2 durable recovery store and exclusive execution lock
- Execution Engine v2 write-ahead journal and verified rollback
- Execution Engine v2 deterministic validator planner
- Execution Engine v2 authoritative orchestration and runtime integration
- Execution Engine v2 activation gate
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

The kernel may register objects, validate structure, evaluate authority, record transaction intent, and record/replay governed execution attempts.

No authoritative canonical mutation path is active. The current agent runtime still executes outside Execution Engine v2 and must not be treated as transactional success.

The kernel is not allowed to determine truth.

Truth-bearing audit records remain governed by human institutional process until a future scope explicitly defines and activates safe execution boundaries.
