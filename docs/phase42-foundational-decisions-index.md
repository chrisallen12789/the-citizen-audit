# Phase 4.2 foundational decisions index

## Status

P42-D002 is **APPROVED** by the project owner as of 2026-07-12. P42-D001 remains **OPEN** and provisionally **RECOMMENDED** pending its required platform comparison and explicit owner approval.

- **P42-D002:** APPROVED threat model and attacker capabilities;
- **P42-D001:** authoritative production operating-system baseline.

It does not start Phase 4.2 implementation, approve a confinement mechanism, close any Phase 4.1 blocker, or certify a production deployment.

Phase 4.1 remains **REPORTED as rejected** and `VAL-RESULT-001` remains **OPEN**. Phase 4.2 remains **PLANNED**.

## Recommended decisions

| Decision | Recommendation | Effect if approved |
| --- | --- | --- |
| P42-D002 | **APPROVED:** model the attacker as having **arbitrary native-code execution inside the confined validator process**, control of validator source, dependencies, input, staged artifacts, timing, errors, outputs, and repeated/concurrent attempts. Include unprivileged same-host processes and other validator attempts as hostile peers. Treat the kernel, approved host image, supervisor, launcher, immutable artifact store, and audit sink as trusted assumptions. | This threat model is an approved architecture input for platform and confinement decisions. Approval does not prove mitigation or implementation. |
| P42-D001 | Keep **Ubuntu Server 24.04 LTS, amd64, minimal/headless, GA kernel track** as the provisional recommended baseline candidate. Final approval requires an explicit Ubuntu 24.04 versus Ubuntu 26.04.1 comparison after 26.04.1 becomes available, unless the project owner records a concrete operational reason to freeze 24.04 earlier. Pin and record the exact image, kernel, runtime, package, configuration, and policy-manifest identities for every independently reproduced platform claim. | If approved after that comparison, Linux becomes the only production profile eligible for Phase 4.2 claims until another platform completes a separate approval and evidence program. Ubuntu 26.04 LTS, Debian, RHEL, Windows, macOS, WSL, and developer container environments remain unapproved profiles. |

## Decision order

1. Use approved P42-D002 as the threat-model input, subject to its reopen triggers.
2. Select the production platform under P42-D001 against that threat model and production deployment and operational constraints.
3. Independently review the OPEN P42-D003 layered OS-native Linux composition recommendation against both decisions.

## Document map

- [P42-D001 production platform baseline](phase42-d001-production-platform-baseline.md)
- [P42-D002 threat model](phase42-d002-threat-model.md)
- [P42-D002 owner-approval record](phase42-d002-owner-approval.md)
- [Decision-to-requirement mapping](phase42-foundational-decision-mapping.md)
- [Source register](phase42-foundational-source-register.md)
- [Documentation handoff](phase42-foundational-decisions-handoff.md)
- [P42-D003 confinement composition](phase42-d003-confinement-composition.md)
- [P42-D003 candidate analysis](phase42-d003-candidate-analysis.md)
- [P42-D003 control boundary map](phase42-d003-control-boundary-map.md)
- [P42-D003 lifecycle and supervision](phase42-d003-lifecycle-and-supervision.md)
- [P42-D003 requirement traceability](phase42-d003-requirement-traceability.md)
- [P42-D003 test and evidence gates](phase42-d003-test-and-evidence-gates.md)
- [P42-D003 source register](phase42-d003-source-register.md)
- [P42-D003 open questions and handoff](phase42-d003-open-questions-and-handoff.md)

P42-D003 remains **OPEN — recommendation documented; pending independent review and explicit project-owner approval.** Its package recommends an architecture class and does not resolve P42-D004 through P42-D022 or authorize implementation.

## Decision posture

P42-D002 is **APPROVED** as an architecture decision. P42-D001 remains **RECOMMENDED** and **OPEN**. Approval of P42-D002 does not establish implementation or mitigation.

**REPORTED:** the supplied source register records primary-source references for platform facts and methodology. This integration did not independently re-verify those external sources; the recommendations and project inferences are distinct from those reported facts.

Approval of P42-D001 and P42-D002 does **not** approve:

- a container runtime;
- namespaces, cgroups, seccomp, AppArmor, Landlock, systemd sandboxing, or a VM as the final mechanism;
- numeric resource limits;
- a Node.js version;
- a deployment provider;
- production activation;
- GitHub CI as acceptance evidence;
- Windows or macOS production support;
- a claim of complete isolation or absolute security.

## Governing principle

The threat model defines what the future boundary must withstand. The platform decision then narrows what may be claimed. Neither decision is evidence that the required controls have been implemented correctly.
