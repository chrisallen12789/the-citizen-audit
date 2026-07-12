# Phase 4.2 foundational decision mapping

## Purpose

This document shows how the **APPROVED** P42-D002 threat model and **RECOMMENDED** but **OPEN** P42-D001 platform proposal constrain later Phase 4.2 decisions without selecting implementation mechanisms.

P42-D002 was approved by the project owner on 2026-07-12 and is now an architecture input, subject to its reopen triggers. P42-D001 remains OPEN. P42-D003 remains the later confinement-composition decision depending on both.

## Decision effects

| Area | Effect of P42-D001 | Effect of P42-D002 |
| --- | --- | --- |
| Platform claims | Ubuntu Server 24.04 LTS amd64 GA-kernel is the provisional candidate; final approval requires an Ubuntu 24.04 versus Ubuntu 26.04.1 comparison or a recorded earlier freeze reason. | The threat model drives platform selection and does not change merely because a different Linux distribution is selected. |
| JavaScript controls | No platform effect. | Phase 4.2 cannot depend on Phase 4.1 remaining intact. |
| Resource control | Linux cgroup v2 becomes the primary capability to evaluate, not an approved final mechanism. | Limits must withstand malicious code and noncooperation. |
| Process identity | Linux generation-safe process handles and service/cgroup ownership become primary candidates. | PID-only supervision is rejected because attacker-controlled timing can exploit reuse and races. |
| Filesystem/MAC | AppArmor, mount namespaces, Landlock, read-only staging, and service controls become candidates. | Controls must resist native syscalls and path-manipulation attacks, not just Node APIs. |
| Network/IPC | Linux namespaces, firewall policy, per-attempt runtime directories, and exact transport allowlists become candidates. | Local IPC, debugger, signal, and cross-attempt channels are in scope even when IP networking is denied. |
| Privilege | Linux identities, capabilities, `no_new_privs`, supplementary-group policy, and service ownership become candidates. | Privilege must remain monotonic after arbitrary native-code compromise. |
| Syscalls | Linux seccomp can be evaluated. | Filter scope must be derived from native attacker capability and residual kernel surface. |
| Diagnostics | Linux core limits, Node diagnostic settings, service policy, and workspace confinement become candidates. | Attacker-triggered crashes and diagnostics are expected behavior, not exceptional cases. |
| Portability | Windows/macOS/WSL remain development-only until separately modeled and reproduced. | No cross-platform claim by analogy is allowed. |

## Impact on existing open decisions

| Decision | Updated constraint | Status after this packet |
| --- | --- | --- |
| P42-D002 | Fully hostile/native-code attacker model accepted by the project owner; approval does not prove mitigation or implementation. | APPROVED |
| P42-D001 | RECOMMENDED provisional Ubuntu Server 24.04 LTS amd64 GA-kernel candidate; compare Ubuntu 24.04 and Ubuntu 26.04.1 before final approval unless an earlier freeze reason is recorded. | OPEN |
| P42-D003 | RECOMMENDED layered, OS-native Linux confinement under a dedicated external supervisor or launcher, with fail-closed capability verification and mandatory evidence. Exact mechanisms under P42-D004 through P42-D022 remain unresolved. | OPEN |
| P42-D004 | Container use remains optional; container-only reasoning is insufficient. | OPEN |
| P42-D005 | Must establish monotonic non-escalation against native code. | OPEN |
| P42-D006 | Must expose only immutable, bounded, exact-byte-bound files/workspace. | OPEN |
| P42-D007 | Must deny both IP networking and unapproved local IPC. | OPEN |
| P42-D008 | Must provide hard kernel enforcement, not cooperative observation. | OPEN |
| P42-D009 | Supervisor must own deadlines and failure taxonomy independently of validator cooperation. | OPEN |
| P42-D010 | Must use generation-safe Linux process/tree identity. | OPEN |
| P42-D011 | Syscall scope must be justified against arbitrary native code and compatibility evidence. | OPEN |
| P42-D012 | Every transport is attacker-controlled except the supervisor-owned framing and parser. | OPEN |
| P42-D013 | Minimal immutable environment and audit policy required. | OPEN |
| P42-D014 | Verified bytes must be the exact bytes executed. | OPEN |
| P42-D015 | Only the Ubuntu baseline may qualify initially; other platforms require separate programs. | OPEN |
| P42-D016 | Independent review must include both platform and native-compromise assumptions. | OPEN |
| P42-D017 | Exact descriptor/handle inheritance is mandatory. | OPEN |
| P42-D018 | Bounds must apply before and during staging/transport. | OPEN |
| P42-D019 | Validator ownership must survive immediate-supervisor failure. | OPEN |
| P42-D020 | Extraction must resist hostile archive structure and expansion. | OPEN |
| P42-D021 | Concurrent attempts and unprivileged local peers are in-scope adversaries. | OPEN |
| P42-D022 | Attacker-triggered dumps/diagnostics must be disabled or confined. | OPEN |

## Requirement interpretation changes

Because P42-D002 is approved, it changes the interpretation of every Phase 4.2 requirement:

- “validator” means a potentially fully compromised native process, not only JavaScript source;
- “deny” means kernel/service enforcement against direct syscalls and descendant activity;
- “evidence” means host-observed evidence not supplied solely by the validator;
- “identity” means exact process/attempt generation, not a PID string;
- “cleanup” includes attacker-created processes, files, IPC objects, dumps, diagnostics, and policy state;
- “success” is impossible after any mandatory control or assurance gap;
- “supported platform” means the exact reproduced image and capability profile, not a distribution family name.

## Initial design direction permitted by these decisions

The following may be researched and prototyped after Phase 4.1 is accepted and governance authorizes Phase 4.2 implementation:

1. Ubuntu 24.04 LTS GA-kernel host capability probe.
2. Dedicated supervisor/launcher process with exact immutable configuration.
3. Per-attempt cgroup v2 ownership and resource accounting.
4. Generation-safe process control using pidfd or an equivalent reviewed launch primitive.
5. Per-attempt mount/PID/network/IPC namespaces where justified.
6. AppArmor and/or stackable filesystem restrictions.
7. `no_new_privs`, capability removal, and supplementary-group minimization.
8. Seccomp profile design after syscall measurement and threat review.
9. Exact descriptor allowlisting and bounded framed transport.
10. Parent-death/service ownership and restart reconciliation.

This list is not a mechanism decision and must not be treated as approved implementation architecture.

## Review checklist

Before any owner decision, reviewers should confirm the threat model first and the platform decision second:

- [ ] The Ubuntu 24.04 LTS GA-kernel recommendation is operationally supportable.
- [ ] Ubuntu 24.04 and Ubuntu 26.04.1 have been compared for support window, candidate control behavior, runtime support, operational familiarity, full evidence reproducibility, and migration/requalification cost, unless an earlier freeze reason is recorded.
- [ ] amd64-only production scope is acceptable.
- [ ] The project accepts that Windows/macOS/WSL are not production-supported initially.
- [ ] Security updates and platform changes will trigger controlled requalification.
- [ ] The OS boundary is required to withstand arbitrary native code inside the validator process.
- [ ] Unprivileged same-host peers and concurrent attempts are in scope.
- [ ] Host root, kernel, hypervisor, firmware, and physical compromise remain out of scope and are disclosed residual risks.
- [ ] The threat model’s availability, side-channel, and supply-chain exclusions are acceptable.
- [ ] No implementation, deployment, or certification claim is inferred from approval.

## Next decision sequence before later mechanism selection

Recommended order:

1. P42-D002 — APPROVED; retain its reopen triggers.
2. P42-D001 — select the production platform against that threat model.
3. P42-D003 — select the confinement mechanism composition.
4. P42-D009, P42-D010, and P42-D019 — supervisor, process identity, ownership, and restart model.
5. P42-D005, P42-D017, and P42-D021 — identity, inherited handles, and local IPC isolation.
6. P42-D006, P42-D014, P42-D018, and P42-D020 — immutable staging, provenance, and input bounds.
7. P42-D007, P42-D008, P42-D011, and P42-D022 — network, resources, syscall surface, and diagnostics.
8. P42-D012 and P42-D013 — transports, environment, logging, and retention.
9. P42-D015 and P42-D016 — CI/development profiles and external review.

No implementation should begin merely because this ordering exists.

## P42-D003 recommendation package

The [P42-D003 confinement-composition package](phase42-d003-confinement-composition.md) maps the approved P42-D002 threat model to the accepted confinement requirements while P42-D001 remains provisional. The recommendation is OPEN, does not mark controls implemented, and requires independent review and explicit project-owner approval.
