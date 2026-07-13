# P42-D003 — confinement-mechanism composition

## Decision status

**OPEN — RECOMMENDED layered OS-native Linux confinement composition documented; pending P42-D001 approval, exact-platform reconciliation, resolution of the two OPEN review gaps, independent review, and explicit project-owner approval.**

This document proposes an architecture class. It does not approve P42-D003, select the exact mechanisms governed by P42-D004, P42-D005, P42-D006, P42-D007, P42-D008, P42-D009, P42-D010, P42-D011, P42-D012, P42-D013, P42-D014, P42-D015, P42-D016, P42-D017, P42-D018, P42-D019, P42-D020, P42-D021, or P42-D022, authorize implementation, or establish that confinement exists.

The status terms used here are:

- **APPROVED:** explicitly accepted as an architecture or governance decision by the project owner.
- **RECOMMENDED:** a proposed decision awaiting independent review and owner approval.
- **REQUIRED:** a mandatory future Phase 4.2 property.
- **CANDIDATE:** a possible mechanism, not an approved mechanism.
- **OPEN:** unresolved or not approved.
- **PLANNED:** future work only.
- **OUT OF SCOPE:** explicitly excluded from the decision.
- **PROHIBITED CLAIM:** a statement the project must not make.

Phase 4.2 remains **PLANNED**. Phase 4.1 remains **REPORTED** as rejected, VAL-RESULT-001 remains **OPEN**, and implementation remains prohibited while Phase 4.1 is rejected.

## Decision question

Which confinement-mechanism combination satisfies the [approved P42-D002 hostile-validator threat model](phase42-d002-threat-model.md) and the accepted [Phase 4.2 confinement requirements](phase42-confinement-requirements.md)?

## Decision inputs

### P42-D002 — approved threat model

P42-D002 is **APPROVED** as an architecture decision, with the approval and its limits recorded in the [project-owner approval record](phase42-d002-owner-approval.md). The composition must assume that the validator is hostile, can achieve arbitrary native-code execution under its launch identity, controls its inputs and observable behavior, and can try to create descendants, exhaust resources, forge results, communicate with peers, inherit ambient authority, or persist after a terminal outcome.

The composition continues to trust the approved kernel, host image, external supervisor and launcher, immutable artifact source, policy inputs and compiler, result parser, and audit sink within the assumptions and residual risks of P42-D002. Approval of that threat model does not prove any mitigation is implemented or effective.

### P42-D001 — provisional platform dependency

P42-D001 remains **OPEN** and provisional. Ubuntu Server 24.04 LTS remains a candidate, and the required Ubuntu 24.04 versus Ubuntu 26.04.1 comparison remains outstanding. Therefore this recommendation uses distribution-neutral Linux control terminology and requires independent reproduction on every exact platform profile before support can be claimed. It does not approve either Ubuntu release or depend on behavior established only for one unapproved release.

P42-D003 continues to depend on P42-D001 and P42-D002. The package may be independently reviewed while P42-D001 is open, but P42-D003 must not receive final project-owner approval under the current dependency model until P42-D001 is approved and this recommendation is reconfirmed against the exact selected platform profile. Conditional approval before P42-D001 would require a separate explicit governance decision and is not authorized here. Approval of P42-D002, and any later approval of P42-D001, does not by itself approve P42-D003.

## Assets protected

The future composition is intended to protect:

- host filesystem confidentiality and integrity;
- executable, runtime, dependency, configuration, input, and staged-artifact identity;
- host, peer-attempt, and supervisor process authority;
- host and external network authority;
- local IPC, session, debugging, signaling, and cross-attempt boundaries;
- credentials, identities, groups, capabilities, tokens, and inherited handles;
- CPU, memory, process, descriptor, storage, input, output, result, audit, and diagnostic capacity;
- result provenance and terminal-decision integrity;
- audit evidence needed to determine whether mandatory controls were active; and
- absence or accountable reconciliation of residual processes, workspaces, IPC objects, policy objects, dumps, and diagnostics.

## Attacker capabilities assumed

The validator and its descendants are untrusted. They may execute arbitrary native instructions available to their launch identity; invoke system calls; race filesystem and launch operations; inspect inherited state; create or abuse files, links, archives, IPC objects, sockets, signals, debugging facilities, runtime diagnostics, and child processes; consume bounded resources; crash deliberately; emit malformed or excessive output; forge or replay result data; and attempt to survive timeout, cancellation, launcher loss, or supervisor loss.

Unprivileged same-host processes and concurrent validator attempts are hostile peers. JavaScript-level restrictions may reduce accidental exposure but are assumed bypassable and are not the Phase 4.2 security boundary.

## Recommended composition class

**RECOMMENDED:** a layered, OS-native Linux confinement profile controlled by a dedicated external supervisor or launcher, with fail-closed capability verification and mandatory assurance evidence.

The baseline architecture class is direct kernel and OS-native confinement under a supervisor that remains outside the validator trust boundary. A service manager or reviewed equivalent should provide durable ownership of the complete validator process tree. Resource accounting and enforcement should be bound both to each exact attempt and to the admitted concurrent-attempt population. Separate mount, PID, IPC, network, device, and kernel-interface views should be used where the approved platform profile proves that they contribute the required properties. Least-privilege launch identity, monotonic post-launch non-escalation, inherited-descriptor allowlisting, syscall restriction, and mandatory-access-control policy must compose rather than substitute for one another.

Verified artifacts should be staged immutably and exposed read-only; the launch must bind verified bytes to executed bytes rather than trust a mutable path. Each attempt should receive private bounded scratch space and only bounded supervisor-owned input, output, result, log, and audit transports. Ordinary network access and unapproved local IPC should be denied by default. Every terminal outcome should trigger complete process-tree termination, cleanup, residual-state scans, and audit finalization. Crash dumps and diagnostic artifacts should be disabled by default or explicitly confined and bounded. Missing capabilities or mandatory evidence should refuse launch or prevent success acceptance.

This composition is an architecture class, not an exact implementation. A service manager, cgroup v2 controls, Linux namespaces, AppArmor, seccomp, `no_new_privs`, pidfds, immutable staging techniques, a container runtime, or a VM are **CANDIDATE** mechanisms until the responsible later decision is approved and independently reproduced.

## Trust boundary

The boundary is drawn at kernel-enforced and externally owned controls, not inside the validator runtime.

| Component | Boundary role | Trust posture | Required constraint |
| --- | --- | --- | --- |
| Orchestrator | Requests an attempt and consumes the terminal decision. | Trusted only for authorized request construction; not the sole confinement owner. | Cannot bypass preflight, mandatory evidence, or terminal acceptance gates. |
| External supervisor or launcher | Builds the profile, owns attempt identity and transports, launches the validator, observes enforcement, and coordinates termination and cleanup. | Trusted computing base. | Runs outside validator authority; loses no validator tree on crash or restart. |
| Service manager, cgroup, job, VM, or reviewed equivalent owner | Retains generation-safe ownership of the complete process tree and resource domain. | Trusted computing base when selected. | Ownership must outlive or safely reconcile immediate-supervisor loss. |
| Host kernel and approved security modules | Enforce process, resource, namespace, privilege, filesystem, network, IPC, syscall, and access-control decisions. | Trusted assumption inherited from P42-D002. | Exact platform identity and required capabilities must be captured and reproduced. |
| Validator and descendants | Execute untrusted validation behavior. | Untrusted. | Receive only the attempt-bound authority explicitly granted by the profile. |
| Artifact store and staging controller | Supply verified immutable inputs and bind identity to launch. | Trusted for integrity within its approved scope. | Mutable paths or tags alone cannot establish executed-byte identity. |
| Result transport and audit sink | Carry bounded attempt-bound results and mandatory assurance evidence. | Trusted components outside validator control. | Validator diagnostics cannot be interpreted as trusted success or substitute for evidence. |
| Host administrator and deployment environment | Establish the trusted host, kernel, boot, policy, patch, and operational context. | Trusted assumptions; malicious administration is OUT OF SCOPE. | Drift, unsupported capabilities, or unverifiable identity must invalidate the profile claim. |

## Trusted computing base

The proposed trusted computing base includes only the components needed to construct, enforce, observe, and reconcile the boundary: the approved host and kernel, selected kernel security modules, the dedicated supervisor or launcher, the durable process-tree ownership layer, policy material and policy compiler, immutable artifact source and staging controller, result parser, and external audit sink. If a container runtime, VM monitor, guest kernel, service manager, broker, or helper is selected later, it joins the trusted computing base and adds patching, configuration, and evidence obligations.

Minimizing the trusted computing base is a design objective, not proof that any remaining component is defect-free.

## Untrusted components

The validator executable, runtime behavior reachable by validator input, validator source and dependencies unless separately verified, validator input, staged untrusted artifacts, stdout, stderr, structured result payload before supervisor validation, runtime diagnostics, validator descendants, unapproved helpers, concurrent attempts, and unprivileged same-host peer processes are untrusted.

Packaging metadata, image labels, a filesystem path, a numeric PID, or validator-reported policy state is also untrusted as security evidence unless bound to an authoritative external identity and independently observed.

## Mandatory control layers

Exact mechanisms remain **OPEN** under the listed decisions. Each layer is **REQUIRED** as a property of a future approved composition; the examples are **CANDIDATE** mechanisms only.

Two review gaps remain **OPEN** and block approval. D003-GAP-AGG-001 records that the accepted requirement and budget records provide per-attempt resource categories but no explicit stable aggregate-admission or concurrent-host-budget identifier even though approved P42-D002 makes aggregate containment mandatory. D003-GAP-DEVICE-001 records that the final exact-platform profile still needs an approved, traceable device and kernel-interface boundary. These are review-gap identifiers, not accepted CONF or BUD identifiers; this package does not alter the accepted requirement or budget documents. Each gap must be resolved through an approved traceability decision before P42-D003 can be approved.

The proposed resolution path is documented by [D003-TRACE-AGG-001](phase42-d003-gap-aggregate-governance.md), [D003-TRACE-DEVICE-001](phase42-d003-gap-device-kernel-boundary.md), the [gap-resolution traceability](phase42-d003-gap-resolution-traceability.md), [future evidence plan](phase42-d003-gap-resolution-evidence-plan.md), [conditional decision records](phase42-d003-gap-resolution-decision-records.md), and [handoff](phase42-d003-gap-resolution-handoff.md). Both traceability records and both gaps remain OPEN; none of these documents approves P42-D003.

| Control layer | Required property | Candidate mechanism examples | Primary requirements | Open decisions |
| --- | --- | --- | --- | --- |
| Profile identity and capability gate | Identify the exact OS, kernel, runtime, policy profile, and enforcement capabilities before launch; refuse unsupported profiles. | Signed profile manifest, kernel capability probes, service-manager property inspection, policy-load verification. | CONF-PORTABILITY-001, CONF-FAILCLOSED-001 | P42-D001, P42-D003, P42-D015, P42-D016 |
| Attempt and process-generation identity | Bind request, process tree, transports, workspace, result, and evidence to one non-reusable identity. | pidfd, cgroup or service identity, VM instance identity, reviewed generation-safe equivalent. | CONF-PROC-001, CONF-OUTPUT-002, CONF-OBS-001 | P42-D009, P42-D010, P42-D012 |
| External supervision and durable tree ownership | Keep the complete process tree owned, bounded, terminable, and reconcilable after parent, launcher, or connection loss. | Dedicated launcher plus service manager, cgroup owner, watchdog, VM owner. | CONF-CHILD-001, CONF-SUPERVISOR-001, CONF-CLEANUP-001, CONF-CLEANUP-002 | P42-D009, P42-D010, P42-D019 |
| Resource enforcement | Apply per-attempt and aggregate CPU, memory, process, descriptor, storage, timing, input, output, result, IPC, retry, and diagnostic limits outside validator control. | cgroup v2 controllers, rlimits, service limits, filesystem quotas, framed transport counters, VM allocation. | CONF-CPU-001, CONF-TIME-001, CONF-MEM-001, CONF-OUTPUT-001, CONF-OUTPUT-002, CONF-TEMP-001, CONF-INPUT-001, CONF-DUMP-001 | P42-D006, P42-D008, P42-D009, P42-D012, P42-D018, P42-D020, P42-D022 |
| Aggregate admission and concurrent-resource governance | Admit no more than the configured concurrent maximum; reserve before launch and govern aggregate CPU, memory, processes and threads, descriptors and handles, filesystem and temporary storage, input and extraction work, stdout, stderr, result, IPC, dump and diagnostic volume, supervisor queues, pending results, audit buffers, retry amplification, cleanup backlog, and host reserve for supervision, ownership, audit, and recovery. Release only after terminal cleanup or generation-safe reconciliation, reconstruct reservations after restart, prevent overcommit from individually valid attempts, and deterministically refuse work outside the aggregate profile. | External admission ledger, atomic reservations, host-level resource domains and quotas, bounded queues and audit buffers, restart-reconciled ownership records. | CONF-CPU-001, CONF-MEM-001, CONF-CHILD-001, CONF-HANDLE-001, CONF-TEMP-001, CONF-INPUT-001, CONF-OUTPUT-001, CONF-OUTPUT-002, CONF-IPC-001, CONF-DUMP-001, CONF-SUPERVISOR-001, CONF-CLEANUP-001, CONF-CLEANUP-002, CONF-FAILCLOSED-001, CONF-OBS-001 | P42-D008, P42-D009, P42-D010, P42-D012, P42-D016, P42-D018, P42-D019, P42-D020, P42-D022 |
| Filesystem and mount boundary | Expose only approved read-only artifacts and private bounded writable storage. | Private mount view, read-only bind or immutable object exposure, private workspace quota. | CONF-FS-001, CONF-FS-002, CONF-TEMP-001 | P42-D006, P42-D014, P42-D020 |
| Device and kernel-interface boundary | Expose no device or kernel-control interface by default. Define a minimal reviewed per-attempt view of character and block devices, inherited device descriptors, `/dev`, `/proc`, `/sys`, cgroupfs, debugfs, tracefs, securityfs, applicable runtime or service control filesystems, and every applicable kernel-control interface reachable through syscalls, capabilities, descriptors, or mounts. Deny device-node creation (`mknod` or equivalent). Make approved read-only views immutable where possible; deny mutation and host-global process, kernel, device, tracing, performance, and policy authority; prevent remount, alternate-mount, inherited-descriptor, path, namespace, and syscall bypass; refuse a profile whose denial cannot be established or observed. | Minimal private mount and device view, device policy, descriptor allowlist, syscall and capability policy, mandatory access control, immutable read-only pseudo-filesystem views. | CONF-FS-001, CONF-FS-002, CONF-HANDLE-001, CONF-IDENTITY-001, CONF-SYSCALL-001, CONF-IPC-001, CONF-PORTABILITY-001, CONF-FAILCLOSED-001 | P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, P42-D021 |
| Artifact provenance and immutable staging | Ensure the exact verified bytes are later executed or exposed, with safe bounded staging. | Content-addressed staging, sealed artifact store, atomic copy-and-verify, descriptor-based execution, immutable image digest. | CONF-INPUT-001, CONF-PROVENANCE-001 | P42-D006, P42-D014, P42-D018, P42-D020 |
| Launch identity and post-launch non-escalation | Start with minimum authority and prevent the validator and descendants from acquiring more. | Dedicated identity, cleared supplementary groups and capabilities, `no_new_privs`, restricted user mapping. | CONF-IDENTITY-001 | P42-D005, P42-D010, P42-D021 |
| Explicit environment construction | Supply only approved immutable environment variables and deny ambient host or supervisor state. | Supervisor-built allowlist with redacted launch diff. | CONF-ENV-001 | P42-D013 |
| Inherited-handle boundary | Permit only exact supervisor-owned attempt transports and required read handles. | Close-on-exec defaults, explicit descriptor allowlist, launch broker, child-side census. | CONF-HANDLE-001 | P42-D017, P42-D012 |
| Process, mount, PID, IPC, and network views | Reduce visibility and authority across host and attempts using separately verified boundaries. | Linux namespaces or reviewed equivalents combined with host policy. | CONF-PROC-001, CONF-FS-001, CONF-FS-002, CONF-NET-001, CONF-IPC-001 | P42-D006, P42-D007, P42-D010, P42-D021 |
| Ordinary network denial | Deny IP and packet-network access before launch. | Private network view with no interface, host firewall or policy, VM network denial. | CONF-NET-001 | P42-D007 |
| Local IPC and cross-attempt isolation | Expose only exact attempt-bound transports and deny ambient IPC, signaling, debugging, and peer-process interaction. | IPC namespace, private runtime directories, identity separation, MAC rules, transport broker. | CONF-IPC-001 | P42-D005, P42-D010, P42-D012, P42-D017, P42-D021 |
| Syscall restriction | Reduce reachable kernel operations according to an approved platform policy. | seccomp filter or reviewed equivalent. | CONF-SYSCALL-001 | P42-D011 |
| Mandatory access control | Enforce object and operation policy independently of validator cooperation and discretionary permissions. | AppArmor or reviewed equivalent. | CONF-FS-001, CONF-FS-002, CONF-IPC-001, CONF-IDENTITY-001 | P42-D003, P42-D005, P42-D006, P42-D021 |
| Bounded transports and result acceptance | Separate diagnostics from one bounded, schema-validated, attempt-bound result; keep assurance evidence external. | Supervisor-owned pipes, framed result channel, structured audit sink. | CONF-OUTPUT-001, CONF-OUTPUT-002, CONF-OBS-001 | P42-D012, P42-D013 |
| Dump and diagnostic policy | Disable unauthorized diagnostics or confine approved artifacts and handlers inside the bounded attempt. | Zero dump limit, runtime-report disabling, private bounded dump path, service policy. | CONF-DUMP-001 | P42-D012, P42-D019, P42-D022 |
| Termination, cleanup, and reconciliation | Terminate the complete owned tree and verify removal or safe reconciliation of all attempt state after every terminal outcome. | Service or cgroup tree kill, idempotent workspace cleanup, residual scans, restart reconciliation. | CONF-CLEANUP-001, CONF-CLEANUP-002, CONF-SUPERVISOR-001 | P42-D006, P42-D010, P42-D019, P42-D021, P42-D022 |
| Mandatory assurance and success gate | Prevent success unless required control state, policy outcomes, provenance, result identity, termination, cleanup, and evidence are complete. | External evidence ledger and deterministic acceptance state machine. | CONF-OBS-001, CONF-FAILCLOSED-001, CONF-OUTPUT-002 | P42-D009, P42-D012, P42-D013, P42-D016 |

## Control-layer interactions

The controls must compose in this order of authority:

1. The orchestrator supplies a bounded request to the external supervisor; it does not launch the validator directly.
2. The supervisor selects an exact platform profile, discovers capabilities, inventories every exposed device and mounted pseudo-filesystem, and refuses the attempt if any mandatory control or evidence hook is unavailable.
3. The supervisor atomically reserves capacity under the aggregate admission profile before assigning an exact attempt identity, validating and immutably staging exact artifacts, constructing bounded transports and storage, and creating the durable process and resource ownership domain. A request that would exceed the concurrent-attempt maximum or any host reserve is deterministically refused before untrusted launch.
4. The ownership layer and kernel establish filesystem, device, kernel-interface, process, IPC, network, identity, handle, syscall, access-control, diagnostic, and per-attempt and aggregate resource policies before untrusted instructions execute.
5. The supervisor launches the validator into that prepared domain and records authoritative externally observed identities. A numeric PID is diagnostic data, not authoritative identity.
6. The kernel enforces policy. The supervisor observes counters, policy state, lifecycle events, transport bounds, and violations. Observation does not substitute for enforcement.
7. The supervisor accepts at most one bounded structured result only if it matches the exact attempt and process generation and no mandatory breach or evidence gap exists.
8. Every outcome triggers complete tree termination, cleanup, residual scans, and audit finalization. Aggregate reservations are released only after verified terminal cleanup or generation-safe reconciliation; failed cleanup retains or quarantines reservation state, and supervisor restart reconstructs it before further admission. Cleanup detection does not excuse a prevention failure; it determines whether success must remain blocked and remediation is required.

The composition distinguishes ordinary IP-network denial from local IPC isolation. It also distinguishes least-privilege launch identity from monotonic post-launch non-escalation, PID logging from authoritative process identity, and verified paths from exact executed-byte identity.

## Fail-closed profile negotiation

Before launch, the supervisor must identify the requested profile and verify all required platform facts, ownership primitives, per-attempt and aggregate resource controllers and available host reserve, namespace or equivalent boundaries, identity reduction, non-escalation, descriptor policy, artifact immutability, the complete approved device and pseudo-filesystem inventory, network denial, local IPC isolation, syscall policy, mandatory-access-control policy, dump policy, transport bounds, audit availability, cleanup authority, and evidence hooks.

The supervisor must refuse launch when any mandatory property is absent, unknown, degraded, misconfigured, unverifiable, or unsupported. There is no best-effort fallback from a stronger profile to a weaker profile. An optional mechanism may be omitted only when the approved profile documents how the remaining composition still meets the requirement and the required evidence independently confirms that conclusion.

Profile negotiation must record exact host, kernel, runtime, policy, artifact, and capability identity. A profile proven on one distribution or kernel cannot be claimed for another by analogy.

## Success-acceptance conditions

A future attempt may be considered successful only when all of the following are satisfied:

1. The exact approved platform and confinement profile was identified and all mandatory capabilities were verified before launch, including the approved minimal device and kernel-interface inventory.
2. The exact verified executable, runtime, dependencies, configuration, and staged artifacts were immutably bound to the bytes executed or exposed.
3. Exact attempt, process-generation, ownership-domain, workspace, transport, result, and audit identities were recorded and remained consistent.
4. Mandatory filesystem, device and kernel-interface, process-tree, per-attempt resource, aggregate admission and host-reserve, identity, non-escalation, environment, inherited-handle, network, local IPC, syscall, mandatory-access-control, dump, and transport controls were active before untrusted execution and remained active through termination.
5. No timeout, resource breach, policy breach, diagnostic-policy breach, supervision loss, provenance ambiguity, malformed or cross-attempt result, or mandatory evidence gap occurred.
6. The bounded structured result passed schema and provenance validation and matched the exact attempt and authoritative process generation; stdout and stderr were treated only as diagnostics.
7. The complete process tree was terminated and all required workspaces, transports, IPC names, policy objects, mounts, device descriptors, dumps, diagnostics, and other attempt state were removed or generation-safely reconciled; only then was the aggregate reservation released.
8. Mandatory redacted assurance evidence and cleanup proof were finalized in the trusted audit sink.

Missing evidence is not neutral: it prevents success acceptance.

## Non-goals and excluded choices

- **OUT OF SCOPE:** implementation of a launcher, protocol, policy, service unit, container definition, VM image, or test suite in this decision package.
- **OUT OF SCOPE:** final values for resource budgets, timeouts, transport bounds, retry limits, diagnostic retention, or concurrency.
- **OUT OF SCOPE:** protection from malicious administrators, compromised kernels or hypervisors, firmware compromise, physical access, and complete microarchitectural or timing-channel prevention, as inherited from P42-D002.
- A container runtime is not automatically required. A container may be a packaging or operational mechanism without becoming proof of confinement.
- A VM is not automatically required. A lightweight VM, full VM, or hybrid host-and-guest composition may remain a higher-isolation or fallback profile subject to separate evidence.
- The package does not choose exact namespace, cgroup, service-manager, syscall, mandatory-access-control, identity, transport, staging, dump, cleanup, or deployment policy.

## Residual risks

Even a future approved and reproduced composition would retain kernel or hypervisor vulnerabilities, defects in trusted supervisors and launchers, policy-compiler and result-parser errors, policy-composition mistakes, incomplete syscall or mandatory-access-control coverage, covert timing and shared-resource channels, operational drift, patch and requalification gaps, and false confidence from nonrepresentative tests.

Adding a container runtime or VM can reduce some direct host exposure while increasing the trusted computing base, patching surface, configuration state, and evidence burden. Direct OS-native controls can minimize layers while making correct composition and host-profile discipline critical. No candidate eliminates the need for negative enforcement evidence and restored-clean-state reproduction.

## Prohibited claims

The following are **PROHIBITED CLAIMS** for this package:

- P42-D003 is approved, implemented, tested, certified, deployed, production-ready, or production-secure.
- Phase 4.2 has started or Phase 4.1 rejection no longer blocks implementation.
- Ubuntu 24.04, Ubuntu 26.04.1, or any other platform is finally approved by this recommendation.
- A container, VM, namespace set, seccomp profile, AppArmor policy, rootless runtime, or low-privilege account is sufficient by itself.
- JavaScript isolation is the Phase 4.2 OS security boundary.
- A numeric PID proves process identity, a verified path proves executed-byte identity, or observation proves enforcement.
- CI, external certification, or independent reproduction has already validated the design.
- Complete isolation or absolute security has been achieved.

## Proposed future approval wording

The authoritative governance sequence is: retain approved P42-D002; complete and approve P42-D001; reconfirm this recommendation against the exact selected P42-D001 platform; independently review the reconciled package; explicitly approve, revise, or reject P42-D003; resolve P42-D004 through P42-D022 in dependency order; and keep implementation prohibited until Phase 4.1 is accepted and Phase 4.2 is formally authorized.

P42-D003 cannot be owner-approved until P42-D001 is approved, the recommendation is reconciled against the exact selected platform profile, D003-GAP-AGG-001 and D003-GAP-DEVICE-001 are resolved through approved traceability decisions, the corrected package receives independent review, and the project owner explicitly approves P42-D003. If and only if those prerequisites and required evidence support the recommendation, a future approval record could state:

> With P42-D001 approved, this recommendation reconciled against its exact selected platform profile, the reconciled package independently reviewed, D003-GAP-AGG-001 and D003-GAP-DEVICE-001 resolved through approved traceability decisions, and explicit project-owner approval recorded, P42-D003 is resolved at the architecture-class level by requiring a layered, OS-native Linux confinement profile under a dedicated external supervisor or launcher, with durable generation-safe process-tree ownership, per-attempt resource enforcement, aggregate admission and concurrent-host-resource governance, a minimal explicit device and kernel-interface boundary, isolated filesystem, process, IPC, and network authority, least-privilege launch with monotonic non-escalation, explicit inherited-handle allowlisting, immutable exact-byte staging, syscall and mandatory-access-control policy, bounded supervisor-owned transports, fail-closed cleanup, and mandatory assurance evidence before success acceptance. Exact mechanisms and platform profiles remain governed by their separately approved decisions and independently reproduced evidence.

That wording is a proposal only. It does not state that P42-D003 is currently approved and cannot be used until the project owner explicitly approves it.

## Reopen triggers

If P42-D003 is approved later, reopen it when:

- P42-D002 is reopened or its assets, attacker capabilities, trusted assumptions, out-of-scope conditions, or residual-risk posture changes;
- P42-D001 selects a platform that cannot reproduce a mandatory property or selects a materially different kernel, service, identity, or policy model;
- the validator receives network authority, secrets, privileged helpers, approved peer communication, new native runtimes, alternate artifact formats, or new result transports;
- the process-tree owner, supervisor, launcher, container runtime, VM boundary, mandatory-access-control system, or deployment topology changes materially;
- a confinement bypass, cross-attempt channel, privilege escalation, provenance substitution, orphan process, cleanup defect, dump leakage, or evidence-forgery path is found;
- an approved mechanism becomes unavailable, unsupported, materially changed, or cannot be reproduced after an OS, kernel, runtime, package, policy, or configuration update;
- production support expands to another distribution, architecture, kernel track, hypervisor, Windows, or macOS; or
- independent review shows that the composition does not satisfy an accepted requirement or that the trusted computing base and residual risks are unacceptable.

Until explicit approval is recorded, P42-D003 remains **OPEN** and the composition remains **RECOMMENDED** only.
