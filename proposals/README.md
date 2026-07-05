# Proposal Engine

Status: v1 foundation

The Proposal Engine is the institutional self-improvement layer for The Citizen Audit.

Agents, directors, and humans may recommend changes, but significant changes should move through proposals instead of silent edits.

## Purpose

The Proposal Engine lets the institution improve without giving agents unrestricted authority.

A proposal may recommend:

- a new agent;
- a new QA gate;
- a new schema;
- a governance change;
- a release process change;
- a memory graph expansion;
- a public API improvement;
- a founder-dependence reduction.

## Doctrine

Proposals are not approvals.

A proposal records a recommendation, rationale, risk, expected benefit, affected records, required authority, and review status.

Truth-bearing or governance-changing proposals require human approval before implementation.

## Status values

- draft
- pending-review
- approved
- rejected
- implemented
- withdrawn

## Authority model

A proposal must declare the authority level required to implement it.

If the required authority is Level 4, the proposal cannot be implemented by an agent alone.

## v1 target

Proposal Engine v1 supports:

- proposal schema;
- proposal registry;
- proposal status report;
- public doctrine for agent-generated improvement recommendations.
