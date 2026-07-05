# Constrained Repair Agent

Status: active scaffold

The repair agent is a local automation tool for a solo maintainer. It is designed to reduce repetitive correction work without allowing uncontrolled edits.

## Commands

```bash
npm run agent:repair:dry
npm run agent:repair
```

## What it does

The agent runs the institutional pipeline in order:

1. ADS export
2. ADS validation
3. publication build
4. institutional QA

If a command fails, it classifies the failure and writes a report to:

```text
docs/repair-agent-report.md
```

## Current safe repairs

The first version only applies deterministic repairs:

- regenerate ADS records when ADS validation or ADS record counts fail;
- rebuild publication assets when generated files, manifests, metrics, or trace records are missing or stale.

## What it does not do

The agent does not invent evidence, alter claims, change source metadata, resolve unknowns, weaken QA gates, delete institutional records, or rewrite conclusions.

Anything requiring judgment remains a blocker for human review.

## Operating principle

The repair agent may fix machinery. It may not fix truth.

## Future repair classes

Safe future additions:

- normalize JSON formatting;
- regenerate public API JSON;
- regenerate sitemap and robots outputs;
- refresh derived manifests;
- sort registry records;
- detect stale generated files;
- open GitHub issues for unresolved failures.

Unsafe without explicit review:

- changing claim language;
- changing source status;
- changing publication readiness;
- removing failed records;
- altering evidence links to make QA pass;
- weakening validation rules.
