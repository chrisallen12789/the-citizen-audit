# Phase 4.1 documentation handoff

## What this branch created

This documentation-only branch created a formal Phase 4.1 assurance set:

- [Assurance index](phase41-assurance-index.md)
- [Assurance case](phase41-assurance-case.md)
- [Invariant catalog](phase41-invariant-catalog.md)
- [Checkpoint history](phase41-checkpoint-history.md)
- [External review packet](phase41-external-review-packet.md)
- [Phase 4.2 OS confinement planning](phase42-os-confinement-planning.md)
- This handoff

The authoritative starting commit was `e0e14e199c86a7a1e24ece8edd7d8f1090e735ef`. This revision corrects the checkpoint-ancestry table structure, narrows VAL-CACHE-002, separates the imported validator-session defect from speculative durable-token designs, documents external provenance for the rejection ruling, and removes any suggestion that behavioral test success was independently reproduced during documentation work. No production code, tests, existing checkpoint reports, coverage matrices, or external systems were changed by this branch.

## Current Phase 4.1 status

Phase 4.1 remains **REJECTED**. The ruling and current blocker were imported from an independent checkpoint review performed outside commit `e0e14e1`; its raw record is not in this documentation branch and must be supplied separately to an external reviewer. [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation) is OPEN: a running `validate()` attempt can be invalidated yet still accept and transport its result as success, according to that imported review. Once the exact entry generation becomes invalid, the attempt can never produce accepted success. OS-level confinement has not started and is only PLANNED in [Phase 4.2 planning](phase42-os-confinement-planning.md).

## Later incorporation

Do not merge this branch blindly. First review the documents against the then-current implementation, repository status, and checkpoint ruling. If a later Phase 4.1 checkpoint resolves the blocker, update every status reference, the assurance-case claim table, catalog evidence, history, external packet baseline, and this handoff. If another checkpoint is rejected, add it to [checkpoint history](phase41-checkpoint-history.md) and revise the index/current blocker before using the packet for review.

The documents are a traceability aid, not a governance decision. They must continue to distinguish VERIFIED source facts from REPORTED checkpoint results and OPEN conditions. They must not be used to assert deployment approval, certification, OS-level confinement, complete sandbox security, or Phase 4.1 acceptance.
