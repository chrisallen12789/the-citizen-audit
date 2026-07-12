# P42-D001 — authoritative production platform baseline

## Decision status

**OPEN — Ubuntu Server 24.04 LTS remains the provisional recommended baseline candidate.** Final approval requires an explicit Ubuntu 24.04 versus Ubuntu 26.04.1 comparison after 26.04.1 becomes available, unless the project owner records a concrete operational reason to freeze 24.04 earlier. Independent review and explicit project-owner approval remain required.

> **Ubuntu Server 24.04 LTS (Noble Numbat), amd64, minimal/headless installation, and the Ubuntu GA kernel track.**

The exact image, kernel, runtime, package, configuration, and policy-manifest identities must be captured for every independently reproduced platform claim. A generic statement such as “Ubuntu 24.04” is not sufficient provenance. This recommendation does not approve a container runtime, namespace design, cgroup policy, seccomp policy, service manager, VM, deployment platform, or any confinement mechanism; it does not prove present deployment or confinement.

## Why this baseline

**REPORTED:** the supplied source register records that Canonical documents Ubuntu LTS maintenance, Ubuntu 24.04 release components, and supported security-feature families. Those primary-source facts were not independently re-verified during this integration. They support evaluation of the recommendation; they do not approve a particular control composition. [SRC-UBU-001](phase42-foundational-source-register.md#src-ubu-001), [SRC-UBU-002](phase42-foundational-source-register.md#src-ubu-002), [SRC-UBU-004](phase42-foundational-source-register.md#src-ubu-004), [SRC-UBU-005](phase42-foundational-source-register.md#src-ubu-005)

The platform exposes the kernel primitives required to evaluate the accepted Phase 4.2 requirements, including cgroup v2 resource control, seccomp filtering, `no_new_privs`, PID file descriptors, namespaces, and stackable access-control mechanisms. The existence of those primitives does not prove the future design, but it makes the profile technically capable of supporting a reviewed implementation. [SRC-LNX-001](phase42-foundational-source-register.md#src-lnx-001), [SRC-LNX-002](phase42-foundational-source-register.md#src-lnx-002), [SRC-LNX-003](phase42-foundational-source-register.md#src-lnx-003), [SRC-LNX-004](phase42-foundational-source-register.md#src-lnx-004), [SRC-LNX-005](phase42-foundational-source-register.md#src-lnx-005), [SRC-LNX-008](phase42-foundational-source-register.md#src-lnx-008)

**REPORTED:** the supplied source register records that Ubuntu Server 24.04 defaults to the GA kernel while HWE is optional and that their support windows differ. The **RECOMMENDED** first baseline should therefore remain on the GA kernel track unless a later decision deliberately requalifies an HWE kernel. [SRC-UBU-003](phase42-foundational-source-register.md#src-ubu-003)

## Exact recommended-profile definition

| Profile field | Recommended value | Rule |
| --- | --- | --- |
| Distribution | Ubuntu Server 24.04 LTS | Exact `VERSION_ID`, image identity, and update state recorded. |
| Installation | Minimal/headless server | No desktop environment, interactive user session, or unnecessary service set. |
| CPU architecture | amd64 | arm64 and other architectures require separate evidence and approval. |
| Kernel track | Ubuntu 24.04 GA kernel track, beginning from Linux 6.8 | Do not silently move to HWE, OEM, custom, or provider kernels. Exact package and ABI recorded. |
| Init/service manager | Later decision | Presence of a service manager is a platform characteristic, not approval of any service-manager-based confinement design. |
| Mandatory access control | Later decision | AppArmor or another access-control mechanism remains P42-D003, P42-D011; no policy is selected here. |
| Control groups | Later decision | cgroup mode, placement, controller availability, and policy remain P42-D003, P42-D008. |
| Network posture | Later decision | Network enforcement remains P42-D007, P42-D003; host firewall defaults are not enough by themselves. |
| Package sources | Prefer Ubuntu `Main` and `Restricted` for TCB packages | Packages outside those components require explicit support and patching review because Canonical documents different support treatment. [SRC-UBU-006](phase42-foundational-source-register.md#src-ubu-006) |
| Runtime | Exact approved Node.js/runtime artifact, digest, and dependency closure | Version selection remains a separate decision; no ambient “latest” runtime. |
| Image update policy | Security updates required; every material platform change triggers recorded requalification | Fixed-release backports support stability, but updated bytes must still be captured and retested. [SRC-UBU-006](phase42-foundational-source-register.md#src-ubu-006) |
| Deployment form | OPEN | Bare metal, VM, and deployment-platform choices remain separate decisions; host assumptions must be stated separately. |

## Ubuntu 26.04.1 comparison gate

Ubuntu 26.04 LTS was released on April 23, 2026. It is a valid future candidate, but at the time of this packet it has substantially less field and project-specific test history than 24.04. Canonical’s own LTS-to-LTS upgrade guidance places the supported 24.04-to-26.04 upgrade window after the initial release cycle. The project should evaluate 26.04 only after its first point release and after reproducing the complete Phase 4.2 evidence suite on the exact candidate profile. [SRC-UBU-007](phase42-foundational-source-register.md#src-ubu-007), [SRC-UBU-008](phase42-foundational-source-register.md#src-ubu-008)

This is a maturity and evidence decision, not a claim that 26.04 is less secure.

**REPORTED:** Ubuntu 26.04 LTS was released on 2026-04-23; Ubuntu 26.04.1 is scheduled for 2026-08-27; Ubuntu 26.04 LTS standard support extends through April 2031; and Ubuntu 24.04 LTS standard support extends through 2029. The release schedule is the primary source for the final-release and scheduled point-release dates; community upgrade guidance is not the sole source for the point-release date. [SRC-UBU-001](phase42-foundational-source-register.md#src-ubu-001), [SRC-UBU-007](phase42-foundational-source-register.md#src-ubu-007), [SRC-UBU-009](phase42-foundational-source-register.md#src-ubu-009)

Before any final P42-D001 approval, compare Ubuntu 24.04 and Ubuntu 26.04.1 for:

- remaining standard-support window;
- GA-kernel capabilities;
- AppArmor behavior and policy compatibility;
- cgroup v2 behavior;
- namespace availability and restrictions;
- seccomp behavior;
- pidfd and process-supervision support;
- systemd behavior;
- Node.js/runtime support;
- project operational familiarity;
- complete Phase 4.2 evidence reproducibility; and
- migration and requalification cost.

This comparison gate does not automatically recommend or approve Ubuntu 26.04 and does not remove Ubuntu 24.04 as the provisional candidate.

## Alternatives considered

The dispositions below are project recommendations, not approvals. Platform facts cited from the supplied source register remain REPORTED unless independently re-verified.

| Candidate | Disposition | Reason |
| --- | --- | --- |
| Ubuntu Server 24.04 LTS, GA kernel, amd64 | **RECOMMENDED baseline** | Mature LTS point-release history, long support window, project-aligned Linux operations, and documented availability of the required control families. |
| Ubuntu Server 26.04 LTS | **DEFERRED candidate** | Newly released in April 2026; evaluate after first point release and full evidence parity. |
| Debian 13 stable | **VALID alternative, not selected** | Stable, five-year lifecycle, and current point releases. Selecting it would split platform evidence without a demonstrated project benefit. [SRC-DEB-001](phase42-foundational-source-register.md#src-deb-001) |
| RHEL 10 | **VALID enterprise alternative, not selected** | Strong SELinux and cgroup capabilities, but adds subscription, packaging, and operational differences not currently justified. [SRC-RHL-001](phase42-foundational-source-register.md#src-rhl-001), [SRC-RHL-002](phase42-foundational-source-register.md#src-rhl-002) |
| Windows Server/native Windows | **UNAPPROVED production profile** | Requires an independent design based on Job Objects, restricted tokens/AppContainer, ACLs, named-object isolation, and Windows crash/reporting behavior. Linux evidence cannot be transferred. |
| macOS | **UNAPPROVED production profile** | Requires an independent process, sandbox, resource, IPC, and cleanup design. Linux evidence cannot be transferred. |
| WSL, Docker Desktop, local desktop containers | **DEVELOPMENT ONLY** | Useful for developer workflows but not equivalent to the authoritative production kernel and service profile. |

## Required platform acceptance evidence

P42-D001 should be recorded as approved only after the project can produce all of the following from a clean system:

1. Immutable base-image digest and installation manifest.
2. OS release, architecture, kernel package/ABI, runtime package, configuration, and policy-manifest evidence.
3. Proof that the GA kernel track is selected and HWE/OEM/custom tracks are absent.
4. Package-source and installed-package inventory, including support classification for every later-approved TCB package.
5. Boot-time verification of the capabilities required by later-approved confinement decisions.
6. Refusal behavior when the OS, architecture, kernel track, or a later-approved exact platform identity differs from the approved profile.
7. Reproduction of the complete Phase 4.2 test-and-evidence plan on the exact image.
8. Requalification after kernel, runtime, package, configuration, or policy-manifest changes.
9. Independent reproduction before any support claim.

## Development and CI posture

Windows and macOS may remain development hosts. Their local test results are informative only for code that is platform-neutral. Any future host-level confinement acceptance claim must be independently reproduced on the later-approved authoritative Ubuntu profile.

CI may assist with repeatability, but CI results are not accepted merely because a job reports success. The runner kernel, image digest, privileges, and all later-selected control states must be observable and reproducible. P42-D015 remains OPEN until that environment exists.

## Consequences for later decisions

Approval of P42-D001 narrows, but does not close:

- P42-D003 confinement mechanism;
- P42-D004 container dependency;
- P42-D005 identity and privilege policy;
- P42-D007 network enforcement;
- P42-D008 resource enforcement;
- P42-D010 process identity and tree control;
- P42-D011 syscall-filter scope;
- P42-D017 inherited-handle policy;
- P42-D019 parent-death and restart ownership;
- P42-D021 local IPC and cross-attempt isolation;
- P42-D022 dump and diagnostic policy.

Those mechanisms must be selected against the threat model, not because Ubuntu happens to provide them.

## Reopen triggers

Reopen P42-D001 if any of the following occurs:

- the production architecture moves to another CPU architecture;
- the GA kernel lacks a mandatory Phase 4.2 control;
- a provider requires a custom kernel or immutable appliance;
- Ubuntu 24.04 approaches end of standard support;
- the project needs Windows or macOS production support;
- a verified security or operational constraint materially favors another distribution;
- Ubuntu 26.04 or a later LTS completes the full evidence suite and governance approves migration.

## Decision record wording

If approved, record:

> P42-D001 is resolved for the first production profile as Ubuntu Server 24.04 LTS, amd64, minimal/headless, on the Ubuntu GA kernel track. Every supported deployment and acceptance run must bind claims to an exact immutable image, kernel, package, runtime, and policy manifest. Other platforms remain unsupported until separately approved and reproduced.
