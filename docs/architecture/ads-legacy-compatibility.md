# ADS v1 Legacy Compatibility Bridge

Status: active compatibility layer  
Applies to: Platform v1 publication model and Platform v2 ADS records

## Finding

The repository already contains a substantial structured publication platform. It includes:

- `data-model/index.js` relationship enrichment;
- audit, section, claim, source, decision, and open-question datasets;
- detail renderers for claims, sources, decisions, and open questions;
- generated search index;
- generated claim database;
- generated cross-reference tables;
- generated evidence graph;
- generated trace records;
- generated publication manifest and metadata.

ADS v1 must therefore extend the existing architecture instead of replacing it.

## Compatibility rule

Existing publication IDs remain valid operational IDs. ADS IDs become permanent institutional IDs.

| Existing model | ADS v1 | Example |
|---|---|---|
| `AUDIT-001` | `AUD-001` | Audit 001 |
| `C-001` | `CLM-000001` | Claim 1 |
| `S-001` | `SRC-000001` | Source 1 |
| `D-001` | `DEC-000001` | Decision 1 |
| `A-001` | `UNK-000001` | Unknown/Open question 1 |

The bridge must preserve the legacy ID on every exported ADS record as `legacyId` wherever schema support permits.

## Migration strategy

1. Keep the current publication build intact.
2. Export ADS records from the existing `data-model`.
3. Validate ADS records independently.
4. Introduce registry-driven pages only after the ADS export is stable.
5. Do not delete or rename legacy records until all public URLs, search outputs, and evidence links are proven compatible.

## Architectural implication

The current platform is not merely static HTML. It already behaves like a data-driven evidence platform. Platform v2 should therefore become a formalization and institutional hardening of the current model, not a rewrite.

## Next integration target

The next highest-value target is a repeatable ADS exporter:

```text
npm run ads:export
npm run ads:validate
```

That exporter should transform current publication records into ADS-compatible records under `/audits/{id}/` and update `/registry/audits.json`.
