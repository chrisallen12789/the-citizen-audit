# Platform v2 Institutional Roadmap

Status: active roadmap

## Current finding

The current repository is already a data-driven evidence platform. It has a modular `data-model`, generated pages, detail renderers, search output, trace records, evidence graph, cross-reference tables, publication metadata, platform status, and QA.

Platform v2 should not replace this system. It should harden it into a repeatable institutional platform capable of supporting hundreds of audits.

## Phase 1: Formalize the data contract

Completed baseline:

- ADS v1 specification
- ADS JSON schemas
- ADS audit registry
- ADS export bridge
- ADS validation command
- ADS QA gate
- GitHub Actions institutional QA workflow
- legacy compatibility map

Remaining:

- full schema validation using a JSON Schema validator dependency
- ADS public API builder
- ADS manifest outputs
- ADS record checksum generation

## Phase 2: Make every audit pluggable

Target state:

```text
/audits/001/
/audits/002/
/audits/003/
```

Each audit directory contains ADS records. The platform discovers audits from `registry/audits.json` and renders pages automatically.

Required work:

- audit registry renderer
- reusable audit landing renderer
- reusable ADS claim renderer
- reusable ADS source renderer
- reusable ADS decision renderer
- reusable ADS unknown renderer
- generated audit navigation

## Phase 3: Public machine-readable access

Target endpoints:

```text
/api/audits.json
/api/audits/001.json
/api/audits/001/claims.json
/api/audits/001/sources.json
/api/audits/001/decisions.json
/api/audits/001/unknowns.json
```

Required work:

- static API builder
- API manifest entries
- API QA checks
- API documentation page

## Phase 4: Institutional review workflow

Required work:

- challenge record schema
- correction record schema
- reviewer record schema
- contributor oath linkage
- public review queue
- challenge disposition log

## Phase 5: Preservation and reproducibility

Required work:

- source archive completeness gates
- source health aging checks
- publication package checksums
- ADS bundle checksums
- release immutability rules
- archived-publication manifest

## Phase 6: Multi-audit operating model

Required work:

- audit topic registry
- audit status dashboard
- cross-audit source reuse
- cross-audit decision inheritance
- institutional standards inheritance
- multi-audit search
- multi-audit evidence graph

## Architectural doctrine

The Citizen Audit should not become a pile of pages. It should become an institution that publishes verifiable audit records through stable software.

The site is the view. The records are the institution.
