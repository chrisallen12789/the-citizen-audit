# The Citizen Audit Public Platform

Status: foundation scaffold.

This directory contains the canonical public-platform record model for The Citizen Audit. It is intentionally separate from `public/`, which is deployment output, and from `kernel/execution/**`, which is the Institution OS execution engine.

## Architecture decision

The public platform is static-data-first:

```text
canonical records -> schema validation -> cross-record validation -> deterministic build -> public static output
```

Canonical records live under `platform/records/**` and must be treated as governed institutional data. Generated pages and public JSON live under `public/**` and may be rebuilt from canonical records.

## Non-negotiable boundaries

- `public/` is not the source of truth.
- Public forms must not directly modify canonical records.
- Published releases must not be silently overwritten.
- Prior releases must remain addressable.
- AI agents may propose changes, but they must not publish canonical records directly.
- Public-platform work must not weaken or bypass Execution Engine v2.

## Record families

The MVP platform is built around these records:

- audits
- findings
- claims
- sources
- source captures
- calculations
- unknowns and limitations
- methodologies
- challenges
- responses
- corrections
- releases
- artifacts
- institutions

## Initial build target

The first complete public-platform implementation should render one real audit, beginning with:

`TCA-VA-2026-001`

That audit should be rendered from structured records, not hard-coded page prose.

## Required validation layers

1. JSON Schema validation.
2. Identifier uniqueness.
3. Cross-record reference integrity.
4. Bidirectional consistency where stored.
5. Publication-policy validation.
6. Release and artifact hash validation.
7. Deterministic public-output verification.

## Directory map

```text
platform/
  records/        canonical institutional records
  indexes/        controlled indexes and current-record pointers
  policies/       controlled vocabularies and publication rules
  fixtures/       valid and invalid test records
```

Schemas live in `schemas/platform-*.schema.json`.

Validation and build scripts should live in `scripts/` and must not mutate canonical records during validation.
