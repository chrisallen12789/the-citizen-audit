# Public Platform Engineering Backlog

This backlog builds the public audit reader without touching `kernel/execution/**`.

## P-01 — Establish platform record architecture

Status: started on `platform-mvp-foundation`.

Acceptance criteria:

- `platform/README.md` defines canonical records versus generated output.
- `platform/policies/**` defines controlled vocabularies.
- `schemas/platform-*.schema.json` begins strict record validation.
- Valid and invalid fixtures exist.
- No execution-engine files change.

## P-02 — Complete platform JSON Schemas

Add schemas for:

- claim
- source capture
- unknown
- methodology
- challenge
- response
- correction

Acceptance criteria:

- required fields are enforced,
- identifier formats are enforced,
- status enums are enforced,
- hashes use SHA-256 format,
- published records require publication gate fields where applicable.

## P-03 — Build platform record validator

Add `scripts/validate-platform-records.js`.

Required checks:

- schema validation,
- unique identifiers,
- reference integrity,
- publication policy,
- release artifact presence,
- deterministic error output.

## P-04 — Add platform test suite

Add `tests/platform-schema-validation.test.js` and related tests.

Required coverage:

- valid audit fixture accepted,
- invalid audit fixture rejected,
- malformed identifier rejected,
- dangling reference rejected,
- published-with-limitations without limitation summary rejected.

## P-05 — Convert first VA audit into structured records

Use real records only. Do not fabricate missing evidence.

Required record groups:

- audit,
- findings,
- claims,
- sources,
- captures,
- calculations,
- unknowns,
- methodology,
- release,
- artifacts.

## P-06 — Deterministic public data generator

Add `scripts/build-public-platform.js`.

Output to `public/data/**` only after validation succeeds.

## P-07 — Public audit reader

Build `/audits/` and `/audits/{slug}/` from generated JSON.

## Current non-goals

- no database,
- no public write path,
- no AI publishing authority,
- no Phase 4 runtime integration,
- no edits to Execution Engine v2.
