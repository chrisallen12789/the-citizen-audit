# Phase 4.2 foundational decisions index

## Status

**OPEN — recommendation documented; pending independent review and explicit project-owner approval.** This packet records **RECOMMENDED** proposals for the two foundational Phase 4.2 decisions:

- **P42-D001:** authoritative production operating-system baseline;
- **P42-D002:** threat model and attacker capabilities.

It does not start Phase 4.2 implementation, approve a confinement mechanism, close any Phase 4.1 blocker, or certify a production deployment.

Phase 4.1 remains **REPORTED as rejected** and `VAL-RESULT-001` remains **OPEN**. Phase 4.2 remains **PLANNED**.

## Recommended decisions

| Decision | Recommendation | Effect if approved |
| --- | --- | --- |
| P42-D001 | Recommend **Ubuntu Server 24.04 LTS, amd64, minimal/headless, GA kernel track** as the first authoritative production profile if approved. Pin and record the exact image, kernel, runtime, package, configuration, and policy-manifest identities for every independently reproduced platform claim. | If approved, Linux becomes the only production profile eligible for Phase 4.2 claims until another platform completes a separate approval and evidence program. Ubuntu 26.04 LTS, Debian, RHEL, Windows, macOS, WSL, and developer container environments remain unapproved profiles. |
| P42-D002 | Model the attacker as having **arbitrary native-code execution inside the confined validator process**, control of validator source, dependencies, input, staged artifacts, timing, errors, outputs, and repeated/concurrent attempts. Include unprivileged same-host processes and other validator attempts as hostile peers. Treat the kernel, approved host image, supervisor, launcher, immutable artifact store, and audit sink as trusted assumptions. | Phase 4.2 controls cannot depend on Phase 4.1 JavaScript restrictions continuing to hold after process launch. Every accepted production mechanism must contain a fully compromised validator process within the approved OS boundary. |

## Document map

- [P42-D001 production platform baseline](phase42-d001-production-platform-baseline.md)
- [P42-D002 threat model](phase42-d002-threat-model.md)
- [Decision-to-requirement mapping](phase42-foundational-decision-mapping.md)
- [Source register](phase42-foundational-source-register.md)
- [Documentation handoff](phase42-foundational-decisions-handoff.md)

## Decision posture

These are **RECOMMENDED** governance decisions, not repository-native approvals. They require independent review against the accepted Phase 4.2 architecture package and explicit project-owner approval.

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

The platform decision narrows what may be claimed. The threat model defines what the future boundary must withstand. Neither decision is evidence that the required controls have been implemented correctly.
