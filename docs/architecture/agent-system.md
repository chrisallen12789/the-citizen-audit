# Institutional Agent System

Status: active architecture

The Citizen Audit should use multiple constrained agents, not one unrestricted agent.

## Core principle

Agents may automate process. Agents may not automate truth.

An agent can run checks, regenerate derived files, classify failures, create reports, open issues, sort records, format JSON, and rebuild public artifacts.

An agent must not invent evidence, weaken standards, change claim meaning, erase unknowns, alter source status, or mark publication readiness without an auditable record.

## Agent classes

### 1. Repair Agent

Purpose: work through mechanical build and QA failures.

Allowed actions:

- run ADS export;
- run ADS validation;
- run publication build;
- run QA;
- regenerate ADS records;
- rebuild publication assets;
- write repair reports.

Forbidden actions:

- changing claims;
- changing sources;
- changing decisions;
- changing readiness language;
- deleting failing records.

Current command:

```bash
npm run agent:repair
```

### 2. Source Steward Agent

Purpose: inspect source records and surface preservation problems.

Allowed actions:

- detect missing archive URLs;
- detect stale retrieval dates;
- detect inconsistent archive status;
- detect high-priority sources without canonical URLs;
- write source-health reports;
- open issue drafts or local issue reports.

Forbidden actions:

- claiming a source is verified without evidence;
- replacing a source without review;
- changing source health to pass QA.

### 3. ADS Steward Agent

Purpose: keep ADS records synchronized with the platform data model.

Allowed actions:

- export ADS records;
- validate ADS structure;
- check record counts;
- sort registry records;
- report missing ADS fields;
- detect legacy-ID mapping conflicts.

Forbidden actions:

- changing permanent IDs once assigned;
- deleting ADS records;
- silently rewriting audit history.

### 4. Publication Builder Agent

Purpose: maintain generated public outputs.

Allowed actions:

- rebuild publication assets;
- regenerate search data;
- regenerate trace records;
- regenerate evidence graphs;
- regenerate manifests;
- compare generated outputs to modeled records.

Forbidden actions:

- editing source data to satisfy generated outputs;
- weakening generated page checks.

### 5. Challenge Intake Agent

Purpose: process public challenges and corrections into structured records.

Allowed actions:

- classify challenge type;
- detect affected claim/source/decision IDs;
- create draft challenge records;
- route challenge to human review.

Forbidden actions:

- deciding the challenge outcome;
- editing the challenged claim directly;
- hiding or discarding serious challenges.

### 6. Release Steward Agent

Purpose: prepare releases without changing conclusions.

Allowed actions:

- run full QA;
- verify release artifacts exist;
- generate release checklist;
- calculate checksums;
- produce publication package inventory.

Forbidden actions:

- publishing over failed gates;
- changing readiness gates;
- modifying evidence to satisfy release.

### 7. Content Hygiene Agent

Purpose: improve consistency without changing meaning.

Allowed actions:

- normalize whitespace;
- sort JSON keys where configured;
- detect duplicate page titles;
- flag inconsistent capitalization;
- flag broken internal links.

Forbidden actions:

- rewriting institutional language;
- simplifying legal or audit language without review;
- changing claims or evidence descriptions.

## Agent authority levels

### Level 0: Report only

The agent only reads files and writes a report.

### Level 1: Derived-file repair

The agent may regenerate files that are derived from canonical records.

### Level 2: Mechanical canonical edits

The agent may make deterministic edits to canonical files, such as sorting registry entries or formatting JSON.

### Level 3: Draft institutional changes

The agent may create draft records for human review but may not activate them.

### Level 4: Human-only

Truth-bearing changes require direct human approval.

## Required logs

Every agent must write a report under:

```text
docs/agent-reports/
```

Reports must include:

- timestamp;
- command run;
- files inspected;
- files changed;
- failures found;
- repairs attempted;
- unresolved blockers.

## Design target

The institution should eventually have an agent runner that can execute:

```bash
npm run agents:all
```

But each agent must remain independently callable, independently auditable, and independently limited.
