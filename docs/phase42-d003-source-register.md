# Phase 4.2 P42-D003 source register

## Status and method

This register records sources used to form the **RECOMMENDED** but **OPEN** P42-D003 architecture class. The task used repository records only and did not access or independently recheck any external source. External facts below are therefore **REPORTED** from the existing [foundational source register](phase42-foundational-source-register.md), whose stated review date is 2026-07-12. The repository documents were directly inspected on 2026-07-12.

A source describing an available mechanism does not establish that the project selected, configured, attached, exercised, or reproduced it correctly. Candidate-specific behavior remains **OPEN** until the exact production profile and mechanism are tested with the evidence in [the P42-D003 test and evidence gates](phase42-d003-test-and-evidence-gates.md).

## Project records inspected

| Stable source ID | Title | Publisher | Source type | Claim supported | Limitation | Date checked | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-D003-PRJ-001 | [P42-D002 threat model](phase42-d002-threat-model.md) | The Citizen Audit project | APPROVED architecture decision | The validator, its native code, inputs, outputs, timing, descendants, and hostile peers must be treated as attacker-controlled within the documented trust boundary. | Approval accepts the threat model; it does not prove mitigation or implementation. | Repository record inspected 2026-07-12. | Project governance fact, not a platform primary-source fact. |
| SRC-D003-PRJ-002 | [Phase 4.2 confinement requirements](phase42-confinement-requirements.md) | The Citizen Audit project | Accepted requirements record | Defines the exact future properties and failure behavior that a P42-D003 composition must satisfy. | Requirements are PLANNED and contain unresolved dependencies and values. | Repository record inspected 2026-07-12. | Project requirements fact, not a platform primary-source fact. |
| SRC-D003-PRJ-003 | [Phase 4.2 resource-budget framework](phase42-resource-budget.md) | The Citizen Audit project | Accepted budget framework | Defines resource categories, candidate measurement and enforcement points, and required fail-closed behavior. | Every numeric value and final enforcement mechanism remains OPEN. | Repository record inspected 2026-07-12. | Project requirements fact, not a platform primary-source fact. |
| SRC-D003-PRJ-004 | [Phase 4.2 test and evidence plan](phase42-test-and-evidence-plan.md) | The Citizen Audit project | Accepted evidence plan | Defines future evidence classes, negative-test posture, clean-room reconstruction, and independent reproduction obligations. | It neither implements nor runs a test. | Repository record inspected 2026-07-12. | Project evidence-policy fact, not a platform primary-source fact. |
| SRC-D003-PRJ-005 | [Phase 4.2 decision register](phase42-open-decisions-and-handoff.md) | The Citizen Audit project | Governance register | P42-D002 is APPROVED; P42-D001 and P42-D003 remain OPEN; detailed mechanisms remain governed by exact later decisions. | Open entries are questions and candidate options, not selected mechanisms. | Repository record inspected 2026-07-12. | Project governance fact, not a platform primary-source fact. |
| SRC-D003-PRJ-006 | [Foundational source register](phase42-foundational-source-register.md) | The Citizen Audit project | Reported source compilation | Records primary-source links and limitations for Ubuntu, Linux kernel, Linux man-pages, systemd, AppArmor, Landlock, and alternative platforms. | This task did not independently revisit the external pages or establish current behavior. | Repository record inspected 2026-07-12; external sources not checked in this task. | REPORTED source metadata. |
| SRC-D003-PRJ-007 | [P42-D001 production platform baseline](phase42-d001-production-platform-baseline.md) | The Citizen Audit project | RECOMMENDED architecture proposal | Ubuntu 24.04 is only a provisional candidate and an Ubuntu 24.04 versus Ubuntu 26.04.1 comparison remains required. | P42-D001 is OPEN; no release or profile is approved. | Repository record inspected 2026-07-12. | Project recommendation, not a platform primary-source fact. |
| SRC-D003-PRJ-008 | [P42-D002 owner approval](phase42-d002-owner-approval.md) | The Citizen Audit project | Owner-approval record | The project owner approved P42-D002 as documented on 2026-07-12, subject to its exact scope and reopen triggers. | The approval does not authorize implementation or approve P42-D001 or P42-D003. | Repository record inspected 2026-07-12. | Project governance fact. |

## Reused primary-source records

The stable identifiers and claims in this section are reused from the foundational source register. The linked external documentation was not opened during this task.

| Stable source ID | Title | Publisher | Source type | Claim supported | Limitation | Date checked | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-LNX-001 | Linux cgroup v2 | Linux kernel documentation | Official kernel documentation | cgroup v2 documents hierarchical process organization and controlled resource distribution, supporting its evaluation as a candidate ownership and resource-control layer. | Does not prove complete-tree ownership, selected limits, correct delegation, or project configuration. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-002 | Seccomp BPF | Linux kernel documentation | Official kernel documentation | Seccomp BPF documents syscall filtering and supports evaluation as a candidate syscall-restriction layer. | Does not define the project's syscall policy or prove that filtering alone is sufficient. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-003 | No New Privileges | Linux kernel documentation | Official kernel documentation | `no_new_privs` is documented as preventing privilege gain through setuid, setgid, and file capabilities, supporting its evaluation within a broader non-escalation policy. | Does not by itself remove existing authority, isolate IPC, or establish the complete privilege boundary. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-004 | PID file descriptors | Linux man-pages | Manual page | pidfds are documented as file descriptors referring to exact tasks and supporting signaling, polling, and waiting without relying only on numeric PID identity. | Does not by itself own descendants, survive every supervisor failure, or prove project lifecycle correctness. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-005 | Landlock | Linux kernel documentation | Official kernel documentation | Landlock is documented as a stackable unprivileged access-control mechanism for restricting ambient rights and may be evaluated as a filesystem-control candidate. | Availability and rule coverage vary; no project use or sufficiency claim is established. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-006 | systemd execution controls | systemd project | Official project manual | systemd documents execution controls including privilege, namespace, filesystem, address-family, syscall, runtime-directory, and environment settings. | A documented setting does not prove effective attachment, kernel support, exact semantics on a candidate release, or composition completeness. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-007 | systemd resource control | systemd project | Official project manual | systemd documents cgroup-backed service and scope resource controls, supporting evaluation as an ownership and budget-enforcement layer. | Does not select the service topology, limits, delegation model, restart policy, or acceptance evidence. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-LNX-008 | Linux namespaces | Linux man-pages | Manual page | Linux namespaces are documented as isolating specified global system resources and support evaluation of distinct mount, PID, IPC, and network views. | Namespace availability or creation does not establish local-IPC completeness, privilege safety, resource bounds, MAC enforcement, or full confinement. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-UBU-004 | Ubuntu privilege restriction | Canonical | Official Ubuntu security documentation | Ubuntu documents AppArmor as its supported mandatory-access-control mechanism and lists cgroups and filesystem capabilities among privilege-restriction features. | This does not establish the exact policy, mode, attachment, release behavior, or correctness of a project profile. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |
| SRC-UBU-005 | Ubuntu security-feature overview | Canonical | Official Ubuntu security documentation | Ubuntu records security-feature availability across releases, supporting later profile comparison and capability probing. | Feature tables do not establish enabled state, operational suitability, policy correctness, or support for a project claim. | Not checked externally in this task; REPORTED source-register date 2026-07-12. | REPORTED primary-source fact. |

## Project inferences

| Stable source ID | Title | Publisher | Source type | Claim supported | Limitation | Date checked | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-D003-INF-001 | Layered-composition inference | The Citizen Audit project | Architecture inference from SRC-D003-PRJ-001, SRC-D003-PRJ-002, and SRC-D003-PRJ-003 | A dedicated external supervisor plus multiple kernel or service enforcement layers is the recommended architecture class because no single cited layer maps every accepted property and failure path. | This is a recommendation awaiting review, not a documented platform guarantee or approved mechanism. | Derived from repository records inspected 2026-07-12. | Project inference. |
| SRC-D003-INF-002 | Single-mechanism insufficiency inference | The Citizen Audit project | Threat-to-control mapping inference | A container, rootless identity, namespace set, syscall filter, low-privilege account, MAC policy, or VM label alone cannot be treated as proof of the complete boundary. | This does not assert that any candidate is unusable; composition and evidence remain OPEN. | Derived from repository records inspected 2026-07-12. | Project inference. |
| SRC-D003-INF-003 | External ownership inference | The Citizen Audit project | Lifecycle inference from accepted requirements | Ownership, deadlines, cleanup, evidence, and result acceptance must remain outside the hostile validator trust boundary. | Exact service manager, cgroup, launcher, job, container, VM, or equivalent mechanism is unresolved. | Derived from repository records inspected 2026-07-12. | Project inference. |
| SRC-D003-INF-004 | Fail-closed evidence inference | The Citizen Audit project | Acceptance inference from accepted requirements and evidence plan | Missing capability, enforcement, mandatory evidence, or cleanup proof must prevent launch or success acceptance. | This defines a future acceptance posture and is not evidence that a fail-closed implementation exists. | Derived from repository records inspected 2026-07-12. | Project inference. |

## Unresolved source and mechanism gaps

The repository source register inspected for this task does not contain sufficient primary-source support to select or claim exact behavior for:

- a rootless or rootful container runtime;
- a lightweight VM, microVM, full VM, or hybrid host and guest profile;
- a complete local-IPC policy for an exact production image;
- the exact AppArmor or reviewed-equivalent policy and attachment model;
- namespace, cgroup, systemd, pidfd, seccomp, dump, diagnostic, filesystem, and descriptor interactions on both Ubuntu candidate releases;
- exact service-manager survival, restart, and reconciliation behavior for the proposed lifecycle;
- exact kernel, runtime, package, cloud, hypervisor, or deployment capability exposure.

Those facts remain **OPEN** and require later primary-source review plus direct platform evidence. An optional container runtime may be a packaging or operational mechanism without becoming security evidence. A VM may remain a higher-isolation or fallback profile, but neither a VM nor a container is automatically required or sufficient.

## Source-use rules for later work

1. Prefer official kernel, Linux man-pages, Canonical, systemd, AppArmor, Node.js, runtime, and VM documentation for mechanism claims.
2. Record the exact document version or retrieval date actually checked; do not inherit the reported date above as a new verification.
3. Bind every behavioral claim to the exact candidate image, kernel, runtime, package, configuration, and policy profile reproduced.
4. Treat documented availability as a capability candidate, not evidence of enabled state or correct configuration.
5. Preserve project inferences as inferences until negative enforcement and independent reproduction evidence support an approval decision.
6. Do not infer Ubuntu 26.04.1 behavior from Ubuntu 24.04, or the reverse.

## Nonclaims

**PROHIBITED CLAIM:** these citations prove that the project configured, tested, or correctly composed any mechanism. They do not approve P42-D001 or P42-D003, establish production support, certify confinement, or show that Phase 4.2 implementation exists.
