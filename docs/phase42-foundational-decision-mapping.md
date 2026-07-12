# Phase 4.2 foundational decision mapping

## Purpose

This document shows how the **RECOMMENDED** but **OPEN** proposals for P42-D001 and P42-D002 would constrain the accepted Phase 4.2 architecture if later approved, without selecting implementation mechanisms.

## Decision effects

| Area | Effect of P42-D001 | Effect of P42-D002 |
| --- | --- | --- |
| Platform claims | If approved, only the exact Ubuntu Server 24.04 LTS amd64 GA-kernel profile may become the first production-supported profile. | A platform may support a future claim only if it can contain arbitrary native code under the validator identity. |
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
| P42-D001 | RECOMMENDED Ubuntu Server 24.04 LTS amd64 GA-kernel profile; independent review and explicit owner approval remain required. | OPEN |
| P42-D002 | RECOMMENDED fully hostile/native-code attacker model; independent review and explicit owner approval remain required. | OPEN |
| P42-D003 | Must select a composition capable of enforcing the full threat model on a later-approved Ubuntu profile. | OPEN |
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

If P42-D002 is later approved, it changes the interpretation of every Phase 4.2 requirement:

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

## Approval checklist

Before recording P42-D001/P42-D002 as closed, reviewers should confirm:

- [ ] The Ubuntu 24.04 LTS GA-kernel recommendation is operationally supportable.
- [ ] amd64-only production scope is acceptable.
- [ ] The project accepts that Windows/macOS/WSL are not production-supported initially.
- [ ] Security updates and platform changes will trigger controlled requalification.
- [ ] The OS boundary is required to withstand arbitrary native code inside the validator process.
- [ ] Unprivileged same-host peers and concurrent attempts are in scope.
- [ ] Host root, kernel, hypervisor, firmware, and physical compromise remain out of scope and are disclosed residual risks.
- [ ] The threat model’s availability, side-channel, and supply-chain exclusions are acceptable.
- [ ] No implementation, deployment, or certification claim is inferred from approval.

## Next decision sequence after approval

Recommended order:

1. P42-D003 — confinement mechanism composition.
2. P42-D009/P42-D010/P42-D019 — supervisor, process identity, ownership, and restart model.
3. P42-D005/P42-D017/P42-D021 — identity, inherited handles, and local IPC isolation.
4. P42-D006/P42-D014/P42-D018/P42-D020 — immutable staging, provenance, and input bounds.
5. P42-D007/P42-D008/P42-D011/P42-D022 — network, resources, syscall surface, and diagnostics.
6. P42-D012/P42-D013 — transports, environment, logging, and retention.
7. P42-D015/P42-D016 — CI/development profiles and external review.

No implementation should begin merely because this ordering exists.
