# Methodology

## Claim lifecycle

1. A claim is defined as a first-class structured record with an ID, section ownership, source links, confidence label, and revision history.
2. Claims are published only when the supporting public record is explicit enough to preserve basis discipline.
3. Claims retain links to sources, decisions, and open questions so reviewers can follow the same evidence path used during publication generation.

## Evidence standards

- Primary federal records, statutes, and administrative documents outrank corroborating summaries.
- Secondary analyses remain labeled as such and are not substituted for missing primary data.
- Unknown values remain explicit unknowns when the public record stops short of defensible measurement.

## Citation verification workflow

- Each source record tracks publisher, document type, publication date, retrieval date, canonical URL, archive URL or archive status, and verification notes.
- High-priority sources must carry canonical URLs and normalized metadata before QA passes.
- Citation verification is frozen for this release candidate unless QA identifies an objective error.

## Decision logging

- Methodology rules and scoping choices are recorded as public decision-log entries with stable IDs.
- Decision pages link back to related claims, sources, and open questions so reviewers can inspect rule application.

## Publication generation

- Structured audit, section, claim, source, decision, and open-question records are rendered into HTML via the publication build.
- Search index, evidence graph, cross-reference tables, manifest, metrics, and status outputs are generated from the same structured data.
- Release artifacts are assembled from the generated site plus the locked canonical PDF.

## Traceability

- Every published claim links to section ownership and supporting source IDs.
- Source pages expose related claims, decisions, and open questions.
- Platform metrics currently report 100% claim traceability coverage based on source, confidence, and revision-history completeness.

## Reproducibility

- The release package is rebuilt from repository state plus the canonical PDF input.
- Generated artifacts are hashed with SHA-256 and listed in the release manifest.
- QA must pass before release packaging succeeds.
