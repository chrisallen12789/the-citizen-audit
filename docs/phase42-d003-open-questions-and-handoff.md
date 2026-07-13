# Phase 4.2 P42-D003 open questions and handoff

## Package purpose and provenance

This package proposes, without approving, a confinement-mechanism composition class for P42-D003. It was prepared on branch `phase42-d003-confinement-composition` from starting commit `93263dc3790c93465f13107f86448b77255f45c0`.

P42-D003 asks which composition can satisfy the accepted [Phase 4.2 confinement requirements](phase42-confinement-requirements.md) under the [P42-D002 threat model](phase42-d002-threat-model.md). P42-D002 is **APPROVED** by the project owner as an architecture input, subject to its documented assumptions, residual risks, acceptance implications, and reopen triggers. P42-D001 remains **OPEN** and provisional, so the proposal uses distribution-neutral Linux terminology and makes no final Ubuntu release claim.

## Current recommendation posture

**P42-D003: OPEN — recommendation documented; pending independent review and explicit project-owner approval.**

The proposed architecture class is layered, OS-native Linux confinement controlled by a dedicated external supervisor or launcher, with durable process-tree ownership, fail-closed capability verification, immutable verified-byte staging, least privilege and monotonic non-escalation, isolated views or reviewed equivalents, default network and local-IPC denial, syscall and mandatory-access-control policy, bounded per-attempt resources, aggregate admission and concurrent-resource governance, an explicit device and kernel-interface boundary, cleanup after every terminal outcome, and mandatory host-observed assurance evidence before success acceptance.

The package constrains but does not select exact mechanisms. A service manager, cgroup, job, container runtime, lightweight VM, full VM, hybrid host and guest profile, or reviewed equivalent may participate after its governing decision and evidence program. A container runtime is not automatically required; a container, rootless identity, namespace set, syscall filter, low-privilege account, AppArmor policy, or VM is not by itself proof of the complete security boundary.

## Decision dependencies

| Decision | Status | Handoff dependency |
| --- | --- | --- |
| P42-D002 | APPROVED | The hostile-validator and arbitrary-native-code model is the governing attacker model. Approval does not prove mitigation or implementation. |
| P42-D001 | OPEN | Ubuntu 24.04 remains only a provisional candidate. The required Ubuntu 24.04 versus Ubuntu 26.04.1 comparison and explicit owner decision remain outstanding. |
| P42-D003 | OPEN | P42-D003 depends on P42-D001 and P42-D002. The package may be independently reviewed while P42-D001 remains OPEN, but final owner approval is blocked until P42-D001 is approved and the recommendation is reconfirmed against that exact platform profile. No candidate mechanism or platform profile is approved by this package. |

## Approval blockers and review gaps

The canonical gap definitions are in [Approved-threat-model coverage gaps](phase42-d003-requirement-traceability.md#approved-threat-model-coverage-gaps). This handoff references those definitions rather than creating competing definitions.

| Gap | Status | Handoff consequence |
| --- | --- | --- |
| [D003-GAP-AGG-001](phase42-d003-requirement-traceability.md#d003-gap-agg-001) | OPEN | The accepted requirement and budget records contain per-attempt resource categories but no explicit stable aggregate-admission or concurrent-host-budget identifier, while approved P42-D002 requires aggregate containment. An approved traceability decision must reconcile aggregate admission, reservation, enforcement, observation, restart reconstruction, terminal cleanup, and protected supervisor and recovery reserve before P42-D003 approval. |
| [D003-GAP-DEVICE-001](phase42-d003-requirement-traceability.md#d003-gap-device-001) | OPEN | The exact platform profile needs an approved traceability decision for device objects, inherited device descriptors, pseudo-filesystems, kernel-control surfaces, and their negative and continuity evidence before P42-D003 approval. |

Neither gap is a new accepted `CONF` or `BUD` identifier, and neither authorizes this task to edit the accepted requirement or resource-budget documents. Reconciliation may extend that accepted framework later or explicitly demonstrate an approved mapping to existing identifiers.

The aggregate control must govern the maximum admitted concurrent attempts; reserve aggregate CPU, memory, processes, threads, descriptors, handles, filesystem and temporary storage, input and extraction work, outputs, results, IPC, dumps, diagnostics, supervisor queues, pending results, audit buffers, retries, and cleanup backlog before launch; retain host reserve for supervision, ownership, audit, and recovery; refuse overcommit deterministically; reconstruct reservations after restart; and release reservations only after verified cleanup or generation-safe reconciliation.

The device and kernel-interface policy must expose nothing by default and then provide only a minimal reviewed per-attempt view of required character or block devices, `/dev`, `/proc`, `/sys`, cgroupfs, debugfs, tracefs, securityfs, service-control filesystems, and other kernel controls reachable by syscalls, capabilities, descriptors, or mounted objects. Approved read-only views should be immutable where possible. Mutation and host-global control must be denied, with evidence against remount, alternate-mount, descriptor, path, namespace, syscall, and capability bypass. Any exception must bind to the exact platform profile; a profile must refuse launch when required denial or observation cannot be established. The applicable existing requirements include CONF-FS-001, CONF-FS-002, CONF-HANDLE-001, CONF-IDENTITY-001, CONF-SYSCALL-001, CONF-IPC-001, CONF-PORTABILITY-001, and CONF-FAILCLOSED-001; the applicable open mechanism decisions include P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, and P42-D021. [SRC-D003-LNX-009](phase42-d003-source-register.md#independent-review-supplied-source) supports the need for this policy, not a claim that a mechanism is configured correctly.

## Unresolved detailed decisions

Every decision below remains **OPEN**. The P42-D003 package constrains each question but does not resolve it.

| Decision | Constraint established by this package | What remains unresolved |
| --- | --- | --- |
| P42-D004 | Container use is optional and cannot replace the layered boundary or its evidence. | Whether any container runtime is required, and its privilege and lifecycle model. |
| P42-D005 | Validator and descendants must start with minimum authority and remain unable to escalate after launch, including through device or kernel-control capabilities. | Exact identities, groups, capabilities, mappings, credentials, helpers, and non-escalation mechanisms. |
| P42-D006 | Artifacts must be immutable and read-only; writable temporary storage must be private, bounded, and attempt-owned; device objects and pseudo-filesystems require explicit minimal views. | Exact mount, device, pseudo-filesystem, workspace, filesystem, staging, quota, and cleanup mechanisms. |
| P42-D007 | Ordinary IP and packet networking must be denied by default before launch. | Exact network namespace, firewall, service, runtime, VM, or reviewed-equivalent enforcement. |
| P42-D008 | CPU, memory, process, thread, descriptor, filesystem, and temporary-storage budgets require per-attempt enforcement plus aggregate admission, host-reserve protection, and evidence. | Numeric limits, aggregate profile, reservation and release rules, accounting sources, hard enforcement points, and breach responses. |
| P42-D009 | An external trusted owner must enforce monotonic deadlines, deterministic outcomes, retry policy, termination escalation, and aggregate reservations. | Exact division among orchestrator, launcher, supervisor, service manager, and durable owner. |
| P42-D010 | Process and process-tree control must use generation-safe authoritative identity; PID logging is only supplemental, and host process or kernel state cannot become an alternate control path. | Exact pidfd, service, cgroup, job, VM, or combined identity and control protocol. |
| P42-D011 | Every claimed profile requires a justified syscall policy and negative evidence, including device creation, mount, namespace, and kernel-control paths. | Exact syscall inventory, argument filters, compatibility policy, enforcement mechanism, and residual surface. |
| P42-D012 | Input, output, result, log, and audit transports must be bounded, attempt-bound, schema-safe where applicable, and untrusted at the validator side. | Exact framing, channels, limits, parsers, redaction, backpressure, and terminal behavior. |
| P42-D013 | Launch configuration and environment must be immutable and allowlisted; mandatory assurance evidence must have an approved retention model. | Exact manifest, environment entries, audit sink, event schema, redaction, retention, and availability policy. |
| P42-D014 | Verified bytes must be atomically bound to the exact bytes executed or exposed; a path or earlier hash is insufficient. | Exact content-addressed, descriptor-bound, sealed-store, immutable-image, copy-and-verify, or equivalent design. |
| P42-D015 | Platform support is limited to exact independently reproduced profiles with complete device, mount, pseudo-filesystem, and exposed-interface inventories; unsupported environments refuse launch. | Which production, development, and continuous-integration profiles are supported and how each is qualified. |
| P42-D016 | Independent review is mandatory before approval and later acceptance claims. | Reviewer independence, checkpoints, artifacts, criteria, sign-offs, and reopen procedure. |
| P42-D017 | Only explicitly allowlisted descriptors and handles may cross the launch boundary; inherited device and kernel-interface descriptors are denied unless reviewed. | Exact launch primitive, close-on-exec policy, census method, transport handles, device-handle treatment, and platform equivalents. |
| P42-D018 | Input and staging bounds must act before and during receipt, extraction, and copy-in. | Exact enforcement locations, counters, numeric limits, interruption behavior, and coordination. |
| P42-D019 | Durable ownership must survive immediate-supervisor, launcher, session, and connection loss and must reconcile exact stale state and aggregate reservations after restart. | Exact parent-death, service, cgroup, job, watchdog, runtime, VM, reservation, and reconciliation mechanisms. |
| P42-D020 | Staging and extraction must reject hostile structure, ambiguity, traversal, links, special files, recursion, expansion, and partial state. | Supported formats, normalizer, extractor, manifests, limits, immutable promotion, and cleanup procedure. |
| P42-D021 | Attempts must expose only exact supervisor-approved channels and must be isolated from local peers, host processes, sessions, other attempts, host devices, and host process, kernel, tracing, performance, security, or policy state. | Exact identities, IPC and pseudo-filesystem views, names, ACLs, signal and debugger policy, broker design, and per-family evidence. |
| P42-D022 | Dumps, crash reports, runtime diagnostics, inspector output, and external handlers must be disabled or confined and bounded. | Exact OS and runtime policy, paths, handlers, budgets, redaction, retention, quarantine, and cleanup. |

These decisions may be resolved in dependency-ordered records and review tasks. They are not required to be collapsed into one document or one implementation task.

## Evidence still required

No test was implemented or run in this documentation task. Before an approval or later support claim, reviewers still require the future evidence defined in [the P42-D003 test and evidence gates](phase42-d003-test-and-evidence-gates.md), including:

- clean-room reconstruction bound to exact commit, artifact, host, kernel, runtime, package, configuration, and policy identities;
- complete capability-probe and unsupported-profile refusal evidence;
- negative kernel-enforcement evidence for process ownership, filesystem and mounts, network, local IPC, cross-attempt access, privilege, syscalls, MAC, descriptors, resources, provenance, dumps, and diagnostics;
- aggregate-admission evidence for zero-capacity refusal, admission through maximum `N`, deterministic refusal of `N+1`, simultaneous resource pressure, supervisor restart with live reservations, reservation retention after failed cleanup, descendant accounting, attribution isolation, and preserved supervisor and recovery reserves;
- device and kernel-interface evidence for unauthorized character and block devices, device creation, inherited descriptors, pseudo-filesystem discovery and mutation, cgroup, debug, tracing, performance and security surfaces, remount and namespace re-exposure, open-descriptor bypass, approved minimal-interface continuity, and residual mount and descriptor cleanup, backed by a complete exact-profile inventory;
- deterministic timeout, resource-breach, supervisor-loss, launcher-loss, result-channel-loss, stale-state, PID-reuse, partial-launch, and partial-staging evidence;
- cleanup, residual-process, residual-artifact, mandatory-audit, and repeated restored-clean-state evidence for every terminal path;
- independent reproduction on every exact claimed platform profile.

The [P42-D003 source register](phase42-d003-source-register.md) also identifies primary-source and profile-specific gaps. Source documentation must not be substituted for direct configuration and enforcement evidence.

## Owner action still required

P42-D003 cannot receive final project-owner approval until P42-D001 is approved, this recommendation is reconciled against the exact selected platform profile, D003-GAP-AGG-001 and D003-GAP-DEVICE-001 are each resolved through an approved traceability decision, and the corrected package receives independent review. The project owner must then explicitly approve, revise, or reject P42-D003. A conditional approval before P42-D001 would require a separate explicit governance decision and is not authorized by this task.

A future P42-D003 approval record must identify the approved P42-D001 profile, record reconciliation against that exact profile, identify the independent review, record resolution of both review gaps, and contain explicit owner approval. Approval of P42-D002, and any later approval of P42-D001, does not by itself approve P42-D003.

Until all blockers are resolved and that action occurs:

- P42-D003 remains **OPEN** and only **RECOMMENDED**;
- P42-D001 remains **OPEN** and provisional;
- P42-D002 remains **APPROVED** subject to its reopen triggers;
- Phase 4.1 remains **REPORTED as rejected**;
- VAL-RESULT-001 remains **OPEN**;
- Phase 4.2 remains **PLANNED**;
- no Phase 4.2 implementation, testing, deployment, or production-support claim is authorized;
- this branch must not be merged automatically.

## Required next sequence

This is the authoritative governance sequence for the package:

1. Retain approved P42-D002.
2. Complete and approve P42-D001.
3. Reconfirm the P42-D003 recommendation against the exact P42-D001 platform.
4. Independently review the reconciled package.
5. Explicitly approve, revise, or reject P42-D003.
6. Resolve P42-D004 through P42-D022 in dependency order.
7. Keep implementation prohibited until Phase 4.1 is accepted and Phase 4.2 is formally authorized.

## Nonclaims

**OUT OF SCOPE:** implementation, tests, platform qualification, deployment, merge, and resolution of the detailed decisions listed above.

**PROHIBITED CLAIM:** this package shows confinement exists, tests passed, Ubuntu 24.04 or Ubuntu 26.04.1 is approved, a container or VM is sufficient, Phase 4.2 has started, production deployment is approved, or complete isolation or absolute security has been achieved.
