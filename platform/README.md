# Public Platform Record Architecture

Status: foundation implementation for P-01 through P-04.

The public website is a projection of canonical, governed records. Canonical records live under `platform/records/`; generated public files belong under `public/` and are never authoritative.

## Record collections

- `audits`
- `findings`
- `claims`
- `sources`
- `source-captures`
- `calculations`
- `unknowns`
- `methodologies`
- `challenges`
- `responses`
- `corrections`
- `releases`
- `artifacts`
- `institutions`

Each file contains exactly one JSON object. Its filename must equal the record's permanent identifier plus `.json`.

## Validation layers

1. JSON Schema validation.
2. Global identifier uniqueness.
3. Cross-record reference integrity.
4. Bidirectional relationship consistency.
5. Publication-policy enforcement.

Run:

```bash
npm run platform:validate
npm run platform:test
```

## Security boundary

Public forms and generated pages must never write directly to `platform/records/`. Challenge intake remains isolated until reviewed and converted into a governed canonical record.

This foundation does not modify or activate Execution Engine v2.
