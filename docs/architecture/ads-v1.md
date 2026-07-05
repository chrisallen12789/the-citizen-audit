# Audit Definition Specification v1

Status: Draft institutional foundation  
Applies to: Platform v2 and all future audits  
Institutional rule: evidence before opinion; transparency before trust.

## Purpose

The Audit Definition Specification (ADS) defines the permanent data contract for The Citizen Audit. The website, public API, search index, evidence pages, source library, claim records, decision logs, unknowns register, and publication packages should be generated from structured audit records wherever practical.

ADS exists so future audits are not handcrafted websites. An audit should be a durable evidence package that the platform can validate, render, search, cite, export, and preserve.

## Architectural rule

The institution, platform, and content are separate layers.

1. Institution: charter, constitution, oath, citizen standard, governance rules, unknowns register, institutional decisions.
2. Platform: Astro application, renderers, validators, search, API, export builders, deployment code.
3. Content: audits, claims, sources, decisions, evidence, revisions, downloads, contributor records.

The software serves the institution. Platform code may change. Institutional records and permanent identifiers must survive framework changes.

## Canonical directory model

```text
/institution/
  charter/
  constitution/
  standards/
  oath/
  decisions/

/registry/
  audits.json
  standards.json
  contributors.json
  publications.json

/audits/
  001/
    audit.json
    claims.json
    sources.json
    decisions.json
    unknowns.json
    revisions.json
    downloads.json
  002/
    audit.json
    claims.json
    sources.json
    decisions.json
    unknowns.json
    revisions.json
    downloads.json

/schemas/
  ads/v1/
    audit.schema.json
    claim.schema.json
    source.schema.json
    decision.schema.json
    unknown.schema.json
```

## Permanent identifiers

Every institutional object receives a stable ID. IDs must not be reused after deletion, renaming, withdrawal, or supersession.

| Object | Format | Example |
|---|---:|---|
| Audit | `AUD-000` | `AUD-001` |
| Claim | `CLM-000000` | `CLM-000104` |
| Source | `SRC-000000` | `SRC-000201` |
| Decision | `DEC-000000` | `DEC-000041` |
| Unknown | `UNK-000000` | `UNK-000007` |
| Standard | `STD-000000` | `STD-000002` |
| Contributor | `CTR-000000` | `CTR-000004` |
| Publication | `PUB-000000` | `PUB-000015` |

Human-friendly file paths may change. Permanent IDs may not.

## Audit status model

Allowed audit lifecycle states:

- `draft`: not ready for public reliance.
- `active`: under development with public visibility permitted.
- `review`: ready for structured challenge or institutional review.
- `published`: released as a public audit package.
- `superseded`: replaced by a later version.
- `withdrawn`: removed from reliance while preserved as an institutional record.

## Claim status model

Allowed claim states:

- `proposed`: claim exists but is not yet supported.
- `supported`: claim is supported by cited evidence under current standards.
- `contested`: unresolved challenge exists.
- `revised`: claim has changed materially.
- `withdrawn`: claim is retained historically but no longer asserted.
- `unknown`: evidence is insufficient for a conclusion.

## Source health model

Allowed source health states:

- `verified`: current URL and archival record are usable.
- `current-only`: current URL works but archival capture is absent or pending.
- `archived-only`: original/current URL is unavailable but archive is usable.
- `degraded`: partial loss, access restriction, format damage, or incomplete capture.
- `missing`: source cannot currently be retrieved.
- `replaced`: source was superseded by a newer official or better-preserved record.

## Evidence rule

A published claim must cite at least one source or decision record unless its status is `unknown`, `withdrawn`, or purely procedural. Unsupported assertion is not an institutional output.

## Unknowns rule

Unknowns are first-class records. A gap, failed capture, inaccessible dataset, unresolved definition, or incomplete official publication must be logged explicitly rather than hidden in prose.

## Decision inheritance

Institutional decisions may apply across audits. Audit-level decisions may apply only to one audit. A decision record must state its scope.

Allowed scopes:

- `institution`
- `audit`
- `claim`
- `source`
- `publication`

## Versioning

ADS versions are immutable after lock. A future ADS v2 may supersede ADS v1, but ADS v1 records must remain readable and reproducible.

Schema versions use semantic form where practical:

```text
adsVersion: "1.0.0"
```

## Platform v2 implementation target

Platform v2 should render audit pages from data records, not hand-authored page code. The long-term target is:

- one reusable audit page renderer;
- one reusable claim page renderer;
- one reusable source page renderer;
- one reusable decision page renderer;
- generated search index;
- generated public API;
- generated publication package;
- validation before publication.

## Non-goals for ADS v1

ADS v1 does not decide visual design, political position, article tone, or public marketing strategy. It defines institutional reproducibility infrastructure.
