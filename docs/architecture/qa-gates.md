# Institutional QA Gates

Status: active

The Citizen Audit treats QA as an institutional control, not a software nicety.

## Current enforced gates

The repository now supports these gates:

1. ADS export
   - Command: `npm run ads:export`
   - Purpose: export ADS records from the existing publication data model.

2. ADS validation
   - Command: `npm run ads:validate`
   - Purpose: confirm ADS schemas exist, the audit registry is valid, audit records are present, record-set files exist, record sets are JSON arrays, ADS IDs are unique, and audit metrics match record-set counts.

3. Publication build
   - Command: `npm run build:publication`
   - Purpose: generate the public evidence platform from the existing data model.

4. Institutional QA
   - Command: `npm run qa`
   - Purpose: verify generated public artifacts, metadata, links, trace records, evidence graph, cross-references, revision history, source metadata, page-model output, renderer usage, and publication readiness state.

5. CI enforcement
   - Workflow: `.github/workflows/institutional-qa.yml`
   - Purpose: run ADS export, ADS validation, publication build, and QA on pushes and pull requests targeting `main`.

## Principle

A public audit should not depend on trust in the founder, author, reviewer, or developer. It should depend on visible records and repeatable validation.

## Current design decision

ADS validation is intentionally layered on top of the existing platform instead of replacing it. The existing platform already contains mature data-driven components. ADS formalizes the institutional contract that future audits must satisfy.

## Future gates

The next gates should be:

- schema-level validation with a JSON Schema validator dependency;
- ADS public API output validation;
- stale-source age checks;
- archive-completeness checks by source class;
- contributor-oath validation for external submissions;
- challenge-response workflow validation;
- reproducible publication package checksums.
