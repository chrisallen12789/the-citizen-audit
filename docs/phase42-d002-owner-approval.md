# P42-D002 project-owner approval

## Approval record

| Field | Value |
| --- | --- |
| Decision | P42-D002 |
| Status | APPROVED |
| Approval date | 2026-07-12 |
| Approving role | Project owner |
| Approved document | [Phase 4.2 threat model](phase42-d002-threat-model.md) |
| Approved source commit | `93263dc3790c93465f13107f86448b77255f45c0` |
| Approved repository path | `docs/phase42-d002-threat-model.md` |
| Git blob ID | `672e3351b4393f3908908903823c3c3931ed883d` |
| Exact object byte count | 17,893 bytes |
| SHA-256 of exact object bytes | `41129a387636188c70c9a80c44a95c2090279531dc6336864f24562b313b02f8` |

## Exact approval statement

> “Recorded: P42-D002 is approved as documented.
>
> P42-D001 remains OPEN and provisional. Phase 4.2 remains PLANNED; implementation remains prohibited while Phase 4.1 is rejected.”

## Approved scope

The project owner approves P42-D002 as the Phase 4.2 architecture threat model documented in the approved document. The approval accepts:

- the hostile-validator model;
- the assumption that arbitrary native-code execution may occur inside the confined validator process;
- the documented trusted assumptions;
- the documented in-scope attacker capabilities and protected assets;
- the documented out-of-scope conditions;
- the disclosed residual risks;
- the acceptance implications; and
- the documented reopen triggers.

APPROVED means that the project owner accepted this architecture decision. The decision remains subject to its reopen triggers.

## Immutable approval binding

Approval attaches to the exact threat-model substance at the recorded source commit, repository path, Git blob, byte count, and SHA-256 above. The later approval commit may add approval metadata, but it must not silently broaden or alter the approved substance. A repository path or current branch tip alone is not durable proof of the approved content.

Any substantive change to attacker capabilities, protected assets, trusted assumptions, exclusions, residual risks, acceptance implications, or reopen triggers requires P42-D002 to be reopened and explicitly reapproved. Reviewers must retrieve the recorded Git object bytes directly when verifying this approval identity; newline normalization or reserialization would not be an equivalent byte-level check.

## Explicit nonclaims

This approval:

- does not approve or authorize implementation;
- does not prove any listed threat is mitigated;
- does not prove that any control exists, is configured correctly, or has passed testing;
- does not approve P42-D001;
- does not approve P42-D003 or any confinement mechanism;
- does not authorize Phase 4.2 implementation;
- does not change the REPORTED rejection of Phase 4.1;
- does not change the OPEN status of VAL-RESULT-001;
- does not certify, deploy, or establish production security; and
- does not prevent P42-D002 from being reopened under its documented triggers.

Phase 4.2 remains PLANNED. Implementation remains prohibited while Phase 4.1 is rejected.
