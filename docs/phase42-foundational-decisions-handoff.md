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
| P42-D001 | OPEN | RECOMMENDED: Ubuntu Server 24.04 LTS, amd64, minimal/headless, GA kernel track, with exact platform and artifact identities pinned. |
| P42-D002 | OPEN | RECOMMENDED: fully hostile validator process with possible arbitrary native-code execution; malicious artifacts/input and hostile concurrent/local unprivileged peers in scope. |

Both decisions remain OPEN. No status should change merely because this packet exists; independent review and explicit project-owner approval remain required.

## Repository incorporation

Recommended destination paths:

- `docs/phase42-foundational-decisions-index.md`
- `docs/phase42-d001-production-platform-baseline.md`
- `docs/phase42-d002-threat-model.md`
- `docs/phase42-foundational-decision-mapping.md`
- `docs/phase42-foundational-source-register.md`
- `docs/phase42-foundational-decisions-handoff.md`

This integration updates the P42-D001 and P42-D002 rows in the open-decisions register with repository-relative links while retaining OPEN status. Do not rewrite the other open decisions as if their mechanisms were selected.

## Required reconciliation before independent review

1. Confirm Phase 4.1 status references still state **REPORTED as rejected** and `VAL-RESULT-001` remains **OPEN** unless a later independently accepted checkpoint changes that status.
2. Confirm Phase 4.2 remains **PLANNED** and no implementation claim is introduced.
3. Confirm the accepted Phase 4.2 architecture requirements remain authoritative where this packet is silent.
4. Confirm Ubuntu 24.04 LTS is operationally supportable through the intended implementation and review period.
5. Confirm the team accepts amd64-only initial production scope.
6. Confirm the arbitrary-native-code attacker assumption is intentional.
7. Confirm no statement implies kernel, supervisor, or host-admin compromise is covered.
8. Confirm all source facts remain current at approval time.
9. Do not merge this integration branch automatically.

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

## Next step after approval

The next paper decision should be P42-D003: select a confinement-mechanism composition that maps every accepted requirement to an enforcement point on the Ubuntu baseline and remains valid under the approved native-code attacker model.

Implementation must still wait until Phase 4.1 is independently accepted and Phase 4.2 is formally authorized to begin.
