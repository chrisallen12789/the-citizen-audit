# Phase 4.2 P42-D003 open questions and handoff

## Package purpose and provenance

This package proposes, without approving, a confinement-mechanism composition class for P42-D003. It was prepared on branch `phase42-d003-confinement-composition` from starting commit `93263dc3790c93465f13107f86448b77255f45c0`.

P42-D003 asks which composition can satisfy the accepted [Phase 4.2 confinement requirements](phase42-confinement-requirements.md) under the [P42-D002 threat model](phase42-d002-threat-model.md). P42-D002 is **APPROVED** by the project owner as an architecture input, subject to its documented assumptions, residual risks, acceptance implications, and reopen triggers. P42-D001 remains **OPEN** and provisional, so the proposal uses distribution-neutral Linux terminology and makes no final Ubuntu release claim.

## Current recommendation posture

**P42-D003: OPEN — recommendation documented; pending independent review and explicit project-owner approval.**

The proposed architecture class is layered, OS-native Linux confinement controlled by a dedicated external supervisor or launcher, with durable process-tree ownership, fail-closed capability verification, immutable verified-byte staging, least privilege and monotonic non-escalation, isolated views or reviewed equivalents, default network and local-IPC denial, syscall and mandatory-access-control policy, bounded resources and transports, cleanup after every terminal outcome, and mandatory host-observed assurance evidence before success acceptance.

The package constrains but does not select exact mechanisms. A service manager, cgroup, job, container runtime, lightweight VM, full VM, hybrid host and guest profile, or reviewed equivalent may participate after its governing decision and evidence program. A container runtime is not automatically required; a container, rootless identity, namespace set, syscall filter, low-privilege account, AppArmor policy, or VM is not by itself proof of the complete security boundary.

## Decision dependencies

| Decision | Status | Handoff dependency |
| --- | --- | --- |
| P42-D002 | APPROVED | The hostile-validator and arbitrary-native-code model is the governing attacker model. Approval does not prove mitigation or implementation. |
| P42-D001 | OPEN | Ubuntu 24.04 remains only a provisional candidate. The required Ubuntu 24.04 versus Ubuntu 26.04.1 comparison and explicit owner decision remain outstanding. |
| P42-D003 | OPEN | The layered composition recommendation requires independent review and explicit project-owner approval; no candidate mechanism or platform profile is approved by this package. |

## Unresolved detailed decisions

Every decision below remains **OPEN**. The P42-D003 package constrains each question but does not resolve it.

| Decision | Constraint established by this package | What remains unresolved |
| --- | --- | --- |
| P42-D004 | Container use is optional and cannot replace the layered boundary or its evidence. | Whether any container runtime is required, and its privilege and lifecycle model. |
| P42-D005 | Validator and descendants must start with minimum authority and remain unable to escalate after launch. | Exact identities, groups, capabilities, mappings, credentials, helpers, and non-escalation mechanisms. |
| P42-D006 | Artifacts must be immutable and read-only; writable temporary storage must be private, bounded, and attempt-owned. | Exact mount, workspace, filesystem, staging, quota, and cleanup mechanisms. |
| P42-D007 | Ordinary IP and packet networking must be denied by default before launch. | Exact network namespace, firewall, service, runtime, VM, or reviewed-equivalent enforcement. |
| P42-D008 | CPU, memory, process, thread, descriptor, filesystem, and temporary-storage budgets require per-attempt enforcement and evidence. | Numeric limits, accounting sources, hard enforcement points, and breach responses. |
| P42-D009 | An external trusted owner must enforce monotonic deadlines, deterministic outcomes, retry policy, and termination escalation. | Exact division among orchestrator, launcher, supervisor, service manager, and durable owner. |
| P42-D010 | Process and process-tree control must use generation-safe authoritative identity; PID logging is only supplemental. | Exact pidfd, service, cgroup, job, VM, or combined identity and control protocol. |
| P42-D011 | Every claimed profile requires a justified syscall policy and negative evidence. | Exact syscall inventory, argument filters, compatibility policy, enforcement mechanism, and residual surface. |
| P42-D012 | Input, output, result, log, and audit transports must be bounded, attempt-bound, schema-safe where applicable, and untrusted at the validator side. | Exact framing, channels, limits, parsers, redaction, backpressure, and terminal behavior. |
| P42-D013 | Launch configuration and environment must be immutable and allowlisted; mandatory assurance evidence must have an approved retention model. | Exact manifest, environment entries, audit sink, event schema, redaction, retention, and availability policy. |
| P42-D014 | Verified bytes must be atomically bound to the exact bytes executed or exposed; a path or earlier hash is insufficient. | Exact content-addressed, descriptor-bound, sealed-store, immutable-image, copy-and-verify, or equivalent design. |
| P42-D015 | Platform support is limited to exact independently reproduced profiles; unsupported environments refuse launch. | Which production, development, and continuous-integration profiles are supported and how each is qualified. |
| P42-D016 | Independent review is mandatory before approval and later acceptance claims. | Reviewer independence, checkpoints, artifacts, criteria, sign-offs, and reopen procedure. |
| P42-D017 | Only explicitly allowlisted descriptors and handles may cross the launch boundary. | Exact launch primitive, close-on-exec policy, census method, transport handles, and platform equivalents. |
| P42-D018 | Input and staging bounds must act before and during receipt, extraction, and copy-in. | Exact enforcement locations, counters, numeric limits, interruption behavior, and coordination. |
| P42-D019 | Durable ownership must survive immediate-supervisor, launcher, session, and connection loss and must reconcile exact stale state after restart. | Exact parent-death, service, cgroup, job, watchdog, runtime, VM, and reconciliation mechanisms. |
| P42-D020 | Staging and extraction must reject hostile structure, ambiguity, traversal, links, special files, recursion, expansion, and partial state. | Supported formats, normalizer, extractor, manifests, limits, immutable promotion, and cleanup procedure. |
| P42-D021 | Attempts must expose only exact supervisor-approved channels and must be isolated from local peers, host processes, sessions, and other attempts. | Exact identities, IPC views, names, ACLs, signal and debugger policy, broker design, and per-family evidence. |
| P42-D022 | Dumps, crash reports, runtime diagnostics, inspector output, and external handlers must be disabled or confined and bounded. | Exact OS and runtime policy, paths, handlers, budgets, redaction, retention, quarantine, and cleanup. |

These decisions may be resolved in dependency-ordered records and review tasks. They are not required to be collapsed into one document or one implementation task.

## Evidence still required

No test was implemented or run in this documentation task. Before an approval or later support claim, reviewers still require the future evidence defined in [the P42-D003 test and evidence gates](phase42-d003-test-and-evidence-gates.md), including:

- clean-room reconstruction bound to exact commit, artifact, host, kernel, runtime, package, configuration, and policy identities;
- complete capability-probe and unsupported-profile refusal evidence;
- negative kernel-enforcement evidence for process ownership, filesystem and mounts, network, local IPC, cross-attempt access, privilege, syscalls, MAC, descriptors, resources, provenance, dumps, and diagnostics;
- deterministic timeout, resource-breach, supervisor-loss, launcher-loss, result-channel-loss, stale-state, PID-reuse, partial-launch, and partial-staging evidence;
- cleanup, residual-process, residual-artifact, mandatory-audit, and repeated restored-clean-state evidence for every terminal path;
- independent reproduction on every exact claimed platform profile.

The [P42-D003 source register](phase42-d003-source-register.md) also identifies primary-source and profile-specific gaps. Source documentation must not be substituted for direct configuration and enforcement evidence.

## Owner action still required

The project owner must explicitly approve, revise, or reject P42-D003 after independent review. Until then:

- P42-D003 remains **OPEN** and only **RECOMMENDED**;
- P42-D001 remains **OPEN** and provisional;
- P42-D002 remains **APPROVED** subject to its reopen triggers;
- Phase 4.1 remains **REPORTED as rejected**;
- VAL-RESULT-001 remains **OPEN**;
- Phase 4.2 remains **PLANNED**;
- no Phase 4.2 implementation, testing, deployment, or production-support claim is authorized;
- this branch must not be merged automatically.

## Required next sequence

1. Independently review the P42-D003 recommendation, its control mapping, lifecycle, traceability, source limitations, and future evidence gates.
2. Approve, revise, or reject P42-D003 through an explicit project-owner record; do not infer approval from this package.
3. Resolve P42-D004, P42-D005, P42-D006, P42-D007, P42-D008, P42-D009, P42-D010, P42-D011, P42-D012, P42-D013, P42-D014, P42-D015, P42-D016, P42-D017, P42-D018, P42-D019, P42-D020, P42-D021, and P42-D022 in dependency order through appropriately scoped decision records and reviews.
4. Keep P42-D001 **OPEN** pending the required Ubuntu 24.04 versus Ubuntu 26.04.1 comparison and explicit project-owner decision.
5. Keep implementation prohibited while Phase 4.1 is **REPORTED as rejected** and VAL-RESULT-001 remains **OPEN**.

## Nonclaims

**OUT OF SCOPE:** implementation, tests, platform qualification, deployment, merge, and resolution of the detailed decisions listed above.

**PROHIBITED CLAIM:** this package shows confinement exists, tests passed, Ubuntu 24.04 or Ubuntu 26.04.1 is approved, a container or VM is sufficient, Phase 4.2 has started, production deployment is approved, or complete isolation or absolute security has been achieved.
