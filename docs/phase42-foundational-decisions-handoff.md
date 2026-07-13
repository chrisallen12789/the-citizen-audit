# Phase 4.2 foundational decisions handoff

## What this packet creates

This packet supplies a proposed resolution for:

- P42-D001 — authoritative production operating-system baseline;
- P42-D002 — Phase 4.2 threat model and attacker capabilities.

Files:

- `phase42-foundational-decisions-index.md`
- `phase42-d001-production-platform-baseline.md`
- `phase42-d002-threat-model.md`
- `phase42-foundational-decision-mapping.md`
- `phase42-foundational-source-register.md`
- `phase42-foundational-decisions-handoff.md`

## Current decision posture

| Decision | Current status | Recommendation |
| --- | --- | --- |
| P42-D002 | APPROVED | Project owner approved the documented hostile-validator and arbitrary-native-code threat model on 2026-07-12. [Approval record](phase42-d002-owner-approval.md). Immutable identity: source `93263dc3790c93465f13107f86448b77255f45c0`, blob `672e3351b4393f3908908903823c3c3931ed883d`, 17,893 bytes, SHA-256 `41129a387636188c70c9a80c44a95c2090279531dc6336864f24562b313b02f8`. |
| P42-D001 | OPEN | RECOMMENDED: Ubuntu Server 24.04 LTS, amd64, minimal/headless, GA kernel track as the provisional candidate. Final approval requires an Ubuntu 24.04 versus Ubuntu 26.04.1 comparison or a recorded earlier freeze reason. |
| P42-D003 | OPEN | RECOMMENDED: layered, OS-native Linux confinement under a dedicated external supervisor or launcher, with fail-closed capability verification and mandatory assurance evidence. [Package](phase42-d003-confinement-composition.md). |

P42-D002 is APPROVED as an architecture decision. P42-D001 remains OPEN and provisional. Approval does not authorize implementation or prove mitigation.

P42-D003 remains OPEN. D003-GAP-AGG-001 and D003-GAP-DEVICE-001 are resolved only by their approved immutable traceability records. Final project-owner approval must still wait for approved P42-D001, exact-platform reconciliation, independent review of the reconciled package, and explicit P42-D003 owner action. It does not resolve P42-D004 through P42-D022. No automatic merge or implementation is authorized.

## Repository incorporation

Recommended destination paths:

- `docs/phase42-foundational-decisions-index.md`
- `docs/phase42-d001-production-platform-baseline.md`
- `docs/phase42-d002-threat-model.md`
- `docs/phase42-foundational-decision-mapping.md`
- `docs/phase42-foundational-source-register.md`
- `docs/phase42-foundational-decisions-handoff.md`

The decision register links P42-D002 to its approved threat model and owner-approval record. P42-D001 remains OPEN. Do not rewrite other open decisions as if their mechanisms were selected.

## Required reconciliation before independent review

1. Confirm Phase 4.1 status references still state **REPORTED as rejected** and `VAL-RESULT-001` remains **OPEN** unless a later independently accepted checkpoint changes that status.
2. Confirm Phase 4.2 remains **PLANNED** and no implementation claim is introduced.
3. Confirm the accepted Phase 4.2 architecture requirements remain authoritative where this packet is silent.
4. Treat approved P42-D002 as an immutable input, complete P42-D001 first, and do not submit P42-D003 for final owner approval until exact-platform reconciliation, gap resolution, and independent review are complete.
5. Confirm Ubuntu 24.04 LTS is operationally supportable through the intended implementation and review period and complete the Ubuntu 24.04 versus Ubuntu 26.04.1 comparison after 26.04.1 becomes available, unless an earlier freeze reason is recorded.
6. Confirm the team accepts amd64-only initial production scope.
7. Confirm the arbitrary-native-code attacker assumption is intentional.
8. Confirm no statement implies kernel, supervisor, or host-admin compromise is covered.
9. Confirm all source facts remain current at approval time.
10. Do not merge this integration branch automatically.

## Nonclaims

This packet does not establish that:

- Ubuntu 24.04 is already configured securely;
- the future supervisor exists;
- any namespace, cgroup, AppArmor, seccomp, systemd, Landlock, container, or VM policy is approved;
- resource limits are selected;
- Phase 4.2 tests have run;
- Linux CI has certified the design;
- the validator is safe against a kernel or hypervisor exploit;
- Windows, macOS, WSL, or containers are production-supported;
- Phase 4.1 is accepted;
- deployment is approved.

## Review questions

Architecture reviewers should answer explicitly:

1. Is Ubuntu Server 24.04 LTS on the GA kernel track the correct first production baseline?
2. Is the project willing to refuse production execution on every other platform until separate evidence exists?
3. Is arbitrary native-code execution inside the validator process the correct minimum attacker assumption?
4. Should an unprivileged same-host process be treated as hostile even on a dedicated service host?
5. Are kernel/hypervisor/root-admin compromise and microarchitectural covert channels appropriately excluded and disclosed?
6. Does the baseline leave enough implementation options open for later mechanism decisions?
7. Are the update and requalification obligations operationally realistic?

## Decision order before mechanism selection

1. Retain approved P42-D002, subject to its exact approved scope and reopen triggers.
2. Complete and approve P42-D001.
3. Reconfirm the P42-D003 recommendation against the exact P42-D001 platform profile.
4. Independently review the reconciled P42-D003 package.
5. Explicitly approve, revise, or reject P42-D003.
6. Resolve P42-D004 through P42-D022 in dependency order.
7. Keep implementation prohibited until Phase 4.1 is accepted and Phase 4.2 is formally authorized.

The current P42-D003 package is a RECOMMENDED proposal that may be reviewed while P42-D001 remains open. Its two D003 gaps are resolved only by their approved immutable traceability records, but it is not eligible for final owner approval until the remaining sequence above is complete.

Implementation must still wait until Phase 4.1 is independently accepted and Phase 4.2 is formally authorized to begin.
