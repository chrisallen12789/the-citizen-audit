# Phase 4.2 P42-D003 device and kernel-interface boundary

## Record definition and status

This document canonically defines **D003-TRACE-DEVICE-001**, an approved P42-D003 architecture-level traceability record for device and kernel-interface boundary governance.

**APPROVED — project-owner approval is bound only to the immutable complete file from commit `d7e6c286cbfc36ecf2c4b6abd1030f285052aee0`: blob `2a807e88df1b2cdf8305efdf1810153385b58f3e`; UTF-8, no-BOM, LF-only bytes `[0, 25588)`; 25,588 bytes; SHA-256 `2a19f430a1bce0cdb17fc00773fea1651c803fb0558ed0c690b499875fd53d53`.**

D003-TRACE-DEVICE-001 is not a `CONF` requirement, a `BUD` resource-budget identifier, a `P42-D` governance decision, or an implemented control. It is approved only as the architecture-level traceability record bound above. D003-GAP-DEVICE-001 is **RESOLVED** only by that exact immutable approved record. This approval does not approve P42-D003.

Phase 4.1 remains **REPORTED** as rejected, VAL-RESULT-001 remains **OPEN**, Phase 4.2 remains **PLANNED**, P42-D001 remains **OPEN** and provisional, P42-D002 remains **APPROVED** and bound to its immutable approved content, and P42-D003 remains **OPEN** and **RECOMMENDED**. No Phase 4.2 implementation exists, no Phase 4.2 tests have been implemented or run, and implementation remains prohibited while Phase 4.1 is rejected.

## Decision question

What deny-by-default, exact-platform-bound device and kernel-interface policy must the P42-D003 composition establish so hostile validator native code and its descendants receive only the minimum per-attempt authority, cannot recover equivalent authority through another path, and are refused launch when the boundary cannot be established or evidenced?

## Proposed resolution

**RECOMMENDED:** expose no device object, pseudo-filesystem, kernel-control surface, host process-state surface, tracing or performance surface, security-policy surface, runtime-control surface, or service-control surface by default. Before untrusted launch, an external trusted owner must construct and verify an explicit minimal per-attempt allowlist. Each exception must identify the exact object or view, purpose, access mode, mount and descriptor provenance, immutable platform-profile identity, enforcement mechanism, observation method, cleanup owner, and required evidence.

Approved views must be read-only and immutable where feasible. Host-global mutation and access to unrelated process, kernel, device, tracing, performance, security, and policy state must be denied. The same authority must remain denied through pathname access, alternate mounts, remounts, namespace operations, device-node creation, inherited descriptors, open directory handles, syscalls, capabilities, helper programs, local IPC, or any reviewed platform-equivalent route. If any mandatory denial, complete inventory, evidence hook, or cleanup guarantee cannot be established, the attempt must not start.

This posture is proposed architecture traceability. It does not select a mount mechanism, namespace layout, syscall filter, mandatory-access-control policy, device controller, service manager, container runtime, VM, launcher primitive, or exact Linux release.

## Governed interface inventory

The exact platform profile must enumerate every validator-visible object and every alternate route to equivalent authority before launch. Absence from the allowlist means denial.

| Interface class | Required policy | Required inventory and verification |
| --- | --- | --- |
| Character devices | Deny by default. Allow an exact character-device object only when a documented validator function requires it and its authority is bounded for the attempt. | Record device identity, major and minor numbers or platform equivalent, backing driver, access mode, path aliases, mount origin, ownership, policy rule, and negative access results for every non-allowlisted character device. |
| Block devices | Expose none by default. A future exception requires separate explicit review because raw block access can bypass filesystem policy and reveal or alter host data. | Record the complete absence or exact exception, backing storage identity, path aliases, read and write denial, device-mapper or loop exposure, and direct-I/O and ioctl reachability. |
| Device-node creation | Deny creation of character and block nodes and deny equivalent helper-mediated creation. | Record syscall, capability, filesystem, mandatory-access-control, and helper restrictions; test creation in every writable or mountable view. |
| Inherited device descriptors | Permit no inherited device descriptor unless it is explicitly listed as a required attempt transport or interface exception. | Record parent-side inheritance configuration, child-side descriptor census where supported, descriptor target and flags, duplicate and reopen paths, and sentinel negative evidence. |
| `/dev` | Provide a private minimal view rather than a host-wide device directory. Deny unexpected nodes, links, control sockets, shared-memory paths, pseudo-terminals, and runtime-created additions. | Inventory every visible entry, symlink target, mount, device identity, permission, ownership, and change after launch; compare it with the immutable allowlist. |
| `/proc` and procfs | Provide no host-wide process view. If a minimal procfs view is required, limit it to the attempt and remove or mask host process, credential, mount, kernel, sysctl-style, tracing, debugging, and descriptor information not explicitly needed. | Inventory mount options and visible paths; prove denial of unrelated process discovery, process control, kernel settings, host mount information, sensitive descriptors, and writable procfs controls. |
| `/sys` and sysfs | Deny by default. If a narrow read-only view is indispensable, expose only enumerated immutable paths and deny device, driver, firmware, power, module, security, and kernel mutation. | Inventory every visible path, attribute, device link, mount option, write result, alternate alias, and hotplug behavior. |
| cgroupfs | Expose no host or peer cgroup administration. Any attempt-visible view must not permit movement, delegation, controller mutation, release-agent-style authority, or observation outside the exact attempt. | Record hierarchy identity, delegated subtree if any, controller files, namespace relation, mount options, readable state, writable state, ownership, and negative cross-attempt and host tests. |
| debugfs | Do not mount or expose it to the validator. | Record mount-namespace inventory, path and descriptor checks, alternate-mount denial, and negative reads and writes. |
| tracefs | Do not mount or expose it to the validator. | Record mount-namespace inventory, trace control and data denial, performance-event interaction, alternate-mount denial, and descriptor checks. |
| securityfs | Do not mount or expose it to the validator. | Record mount-namespace inventory, security-policy control denial, alternate-mount denial, and descriptor checks. |
| Sysctl-style controls | Deny writes and deny reads not explicitly required, whether reached through procfs, a syscall, a library, a helper, or another filesystem view. | Inventory applicable controls and aliases; record negative mutation evidence and post-attempt state comparison. |
| Runtime and service-control filesystems | Deny ambient runtime directories, service-manager control points, automount controls, binfmt controls, firmware variables, configuration filesystems, and platform-equivalent service or runtime authority. | Inventory every mounted pseudo-filesystem and control socket or file, record ownership and access mode, and prove unrelated service discovery and control are denied. |
| Tracing and performance interfaces | Deny debug, trace, profiling, performance-counter, kernel-log, probe, eBPF-loading, and equivalent observation or mutation authority except a future exact, reviewed exception. | Inventory syscalls, devices, pseudo-filesystems, capabilities, descriptors, helper paths, and policy rules; prove denial for host, peer, supervisor, and kernel targets. |
| Host process-state interfaces | Deny discovery, signaling, debugging, inspection, descriptor access, memory access, namespace entry, credential inspection, and control of unrelated processes. | Record process-namespace and procfs views, IPC and identity policy, syscall and capability denial, and concurrent hostile-peer evidence. |
| Kernel-state interfaces | Deny kernel memory, logs, modules, firmware, keyrings, boot configuration, drivers, devices, namespaces, and global tunables unless an exact read-only item is independently justified. | Inventory path, syscall, descriptor, device, helper, and capability routes; record state-before and state-after evidence for mutable surfaces. |
| Policy-control interfaces | Deny mutation or discovery of host-global mandatory-access-control, firewall, audit, cgroup, namespace, service, key-management, and security-module policy. | Inventory policy paths and control APIs, then record negative access and unchanged host-policy evidence. |

## Bypass closure

The allowlist governs authority, not merely preferred paths. The future design and evidence program must close these routes:

- **Mount and remount behavior:** deny validator-created mounts, bind mounts, remounts, propagation changes, pivot or root replacement, and mutation of approved mount flags. Approved views must be fixed before launch and protected against later widening.
- **Alternate mounts:** prevent the validator from mounting or locating a second instance of `/dev`, procfs, sysfs, cgroupfs, debugfs, tracefs, securityfs, or any equivalent kernel or service-control filesystem.
- **Namespace-based re-exposure:** prevent creation, joining, reassociation, or manipulation of namespaces from revealing host or peer devices, processes, mounts, IPC objects, cgroups, or control surfaces.
- **Descriptor-based bypass:** close or reject every unapproved inherited file descriptor, handle, device descriptor, mount reference, namespace descriptor, process descriptor, control socket, and privileged transport before execution.
- **Directory-handle bypass:** prevent open directory descriptors, working directories, root directories, path-resolution handles, or equivalent capabilities from reaching objects masked from the validator-visible pathname view.
- **Syscall and capability equivalence:** deny syscalls, ioctl operations, capability-mediated operations, keyrings, performance APIs, debugging APIs, eBPF or module operations, helper execution, and platform equivalents that confer the same authority as a denied filesystem object.
- **Cross-layer bypass:** identity, local IPC, process control, mandatory access control, syscall filtering, filesystem policy, descriptor policy, and namespace policy must compose. Passing one layer does not excuse an alternate route left open by another.

## Ownership and lifecycle

| Responsibility | Owner | Required behavior |
| --- | --- | --- |
| Policy definition | Platform security owner with runtime design owner | Produce the immutable exact-platform allowlist, justify every exception, map alternate authority paths, and obtain independent review and explicit owner approval. |
| Preflight enforcement | External trusted supervisor or launcher | Identify the exact platform, verify required capabilities, establish the private views and denial policies, inspect the complete mount, device, pseudo-filesystem, descriptor, syscall, capability, identity, and policy inventory, and refuse launch on any mismatch. |
| Kernel enforcement | Approved host kernel and selected security modules | Enforce mount, device, namespace, identity, capability, syscall, process, filesystem, IPC, and mandatory-access-control decisions outside validator authority. |
| Runtime observation | External supervisor, durable ownership layer, and mandatory audit sink | Observe effective policy, capability state, mount and descriptor changes, prohibited access events where the platform provides them, terminal outcome, and cleanup without trusting validator self-report. |
| Terminal cleanup | Supervisor or reviewed replacement owner | Terminate the complete owned tree, remove attempt mounts and policy objects, close descriptors and transports, scan for residual interfaces, and reconcile generation-safely after owner restart or loss. |
| Acceptance review | Independent reviewer and project owner | Compare the exact inventory and negative evidence with the immutable profile; approve, revise, or reject the proposed record without inferring P42-D003 approval. |

Enforcement and observation owners must remain outside the hostile validator boundary. Validator-provided logs, inventories, exit codes, or claims may supplement but cannot replace host-observed evidence.

## Mandatory future evidence

No evidence listed here presently exists as acceptance evidence, and no test is implemented or run by this package. A future approval review requires, at minimum:

- immutable exact-platform identity covering distribution, release, architecture, kernel, runtime, packages, service manager, security modules, configuration, policy compiler and outputs, and deployment profile;
- a complete validator-visible inventory of device objects, device aliases, pseudo-filesystems, ordinary filesystems, mount options and propagation, descriptors, directory handles, namespaces, identities, groups, capabilities, syscalls, ioctl classes, IPC paths, control sockets, helpers, and policy rules;
- proof that the inventory exactly matches the minimal allowlist and that no unreviewed interface appears before, during, or after the attempt;
- negative evidence for unauthorized character and block devices, device-node creation, inherited descriptors, host process discovery, kernel-state discovery, sysctl-style mutation, cgroup state outside the attempt, debugfs, tracefs, securityfs, tracing, performance, policy control, remount, alternate mount, namespace re-exposure, descriptor bypass, directory-handle bypass, syscall bypass, and capability bypass;
- continuity evidence that every explicitly approved minimal interface remains usable only for its documented purpose and does not widen other authority;
- deterministic launch-refusal evidence for missing enforcement, missing observation, inventory mismatch, unsupported profile, unsafe exception, or unavailable cleanup ownership;
- event-correlated host-observed policy, denial, terminal-outcome, and cleanup records with approved redaction and retention;
- complete-tree termination and residual mount, device, descriptor, namespace, policy-object, and control-interface cleanup proof for every terminal outcome and supervisor-restart reconciliation; and
- independent reproduction on every exact platform profile for which support is later claimed.

## Cleanup and failure behavior

Every terminal outcome, including success, rejection after partial setup, policy breach, timeout, cancellation, validator crash, forced termination, launcher loss, supervisor loss, audit failure, and restart reconciliation, requires generation-safe cleanup. Cleanup must close attempt-owned and inherited descriptors, dismantle private mounts and namespaces, remove policy objects and temporary aliases, terminate the exact process tree, verify no residual directory handle or control socket remains, scan for exposed device and kernel interfaces, and record the final state.

Cleanup is complete only when host-observed evidence proves the exact attempt generation owns no residual interface or authority. An inability to verify cleanup is a deterministic cleanup or reconciliation failure, invalidates success, and requires quarantine or reviewed remediation without adopting or deleting unrelated replacement state.

Launch must fail closed before untrusted code runs when any required denial cannot be established, the exact inventory is incomplete or mismatched, an allowlisted exception cannot be made sufficiently narrow, mandatory evidence is unavailable, or the platform profile is unsupported. A detected boundary breach after launch requires complete-tree termination, invalid result acceptance, bounded redacted assurance evidence, cleanup, and deterministic classification. No fallback to a broader host view is permitted.

## Trusted assumptions and residual risks

### Trusted assumptions

- The exact approved host kernel, boot chain, security modules, service manager, external supervisor or launcher, policy inputs and compiler, immutable artifact source, audit sink, and deployment administration remain trustworthy under approved P42-D002.
- The platform reports mount, descriptor, process, namespace, capability, policy, and device state accurately enough for the approved evidence program.
- Administrators do not deliberately weaken the immutable profile during an attempt, and profile changes are detected and governed.
- The supervisor and durable owner possess only the authority needed to construct, observe, terminate, clean, and reconcile the boundary and protect their own control paths from the validator.

### Residual risks

- A trusted-kernel, driver, security-module, firmware, hypervisor, or hardware flaw can defeat enforcement; resistance to a malicious administrator or compromised kernel remains **OUT OF SCOPE** under P42-D002.
- Read-only device or pseudo-filesystem views can still disclose sensitive state or enable side channels; read-only is not equivalent to harmless.
- Kernel interfaces can change across releases, configurations, drivers, packages, and hardware. An inventory proved for one exact profile does not transfer by analogy.
- Denial-event telemetry may be incomplete or lossy. Prevention, preflight verification, continuity checks, and residual scans remain necessary.
- A necessary device or runtime exception may create authority not fully reducible by one control layer; that exception remains an approval blocker until its cross-layer effects are independently reviewed.
- Resource timing, device behavior, performance counters, and other permitted observations may retain side channels even after direct host-global control is denied.

## Approval record and later platform dependencies

The project owner approved the immutable record identified above after independent review. The following remain mandatory limitations for final platform and P42-D003 consideration:

1. P42-D001 must approve the authoritative production baseline and the approved invariant must be reconciled to that exact platform.
2. P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, and P42-D021 must select the detailed policy and every exception must have an immutable exact-profile inventory and disposition.
3. Required negative, continuity, failure, cleanup, and independent-reproduction evidence must pass before final P42-D003 consideration.

P42-D001 remained **OPEN** for the architecture-record action. The approval establishes only the mandatory architecture invariant and resolves D003-GAP-DEVICE-001 by the immutable approved record; it does not approve exact exceptions, mechanisms, a supported platform, implementation, or test results.

Final P42-D003 and exact-platform acceptance have additional later blockers. P42-D001 must approve the authoritative production baseline; this invariant must be reconciled against that exact distribution, release, architecture, kernel, hardware and device inventory, runtime, service manager, security modules, filesystem set, namespace features, syscall semantics, packages, configuration, and policy manifest; P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, and P42-D021 must select the detailed policy; every exposed interface and exception must have an immutable exact-profile inventory and disposition; required negative, continuity, failure, cleanup, and independent-reproduction evidence must pass; and the reconciled P42-D003 package must receive independent review and explicit P42-D003 owner action. Evidence from a development container, desktop VM, WSL environment, CI label, another Linux release, or another hardware profile cannot be transferred to production by analogy. P42-D003 must remain **OPEN**, and implementation remains prohibited until Phase 4.1 is accepted and Phase 4.2 is formally authorized.

## Exact existing-identifier mapping

This record supplies proposed architecture-level traceability only. It does not amend the accepted [confinement requirements](phase42-confinement-requirements.md), the accepted [resource-budget document](phase42-resource-budget.md), or the [open-decision register](phase42-open-decisions-and-handoff.md). Detailed contribution, ambiguity, evidence, dependency, and status fields appear in the [gap-resolution traceability](phase42-d003-gap-resolution-traceability.md).

| Existing identifier | Contribution to the proposed device and kernel-interface boundary |
| --- | --- |
| CONF-FS-001 | Limits reads to explicit approved artifacts and paths, supporting the minimal allowlisted view and denial of host and kernel state. |
| CONF-FS-002 | Limits writes to the approved workspace and result transport, supporting denial of device, kernel, sysctl-style, and policy mutation. |
| CONF-HANDLE-001 | Requires an exact inherited-object allowlist and fail-closed verification, closing inherited device, directory, namespace, process, and control descriptors. |
| CONF-IDENTITY-001 | Requires minimum launch authority and monotonic non-escalation, constraining identities, capabilities, helpers, and privilege paths to denied interfaces. |
| CONF-SYSCALL-001 | Requires an exact-platform syscall-exposure policy and refusal when required filtering is unavailable. |
| CONF-IPC-001 | Denies unapproved local IPC, host-process inspection and control, and cross-attempt authority that can expose equivalent kernel or service-control surfaces. |
| CONF-PORTABILITY-001 | Requires exact platform identity, support claims limited to proven profiles, and refusal of unsupported profiles. |
| CONF-FAILCLOSED-001 | Prevents launch until every required boundary and evidence hook is active. |
| P42-D005 | Must select the exact identity, capability, group, credential, helper, and monotonic non-escalation policy. |
| P42-D006 | Must select exact mounts, device views, pseudo-filesystem views, writable workspace, immutability, and cleanup mechanisms. |
| P42-D010 | Must select generation-safe process-tree control that cannot become an alternate host-process authority path. |
| P42-D011 | Must select and justify syscall restrictions for device creation, mounting, namespace operations, kernel controls, tracing, performance, and equivalent paths. |
| P42-D015 | Must define exact supported platform profiles, their complete exposed-interface inventories, and unsupported-profile refusal. |
| P42-D017 | Must select the process-launch primitive and exact inherited-descriptor allowlist and census method. |
| P42-D021 | Must select identity, namespace, transport, local-IPC, host-process, pseudo-filesystem, and cross-attempt isolation policy. |

No existing `BUD` identifier expressly governs the complete device and kernel-interface boundary. That absence does not create a new budget identifier and does not weaken applicable resource limits for attempts, mounts, descriptors, diagnostics, or cleanup.

## Reopen triggers

This approved record must be reopened when any of the following occurs:

- a change to P42-D001, P42-D002, P42-D003, an identifier mapped above, or the accepted requirement or resource-budget baseline that changes the boundary;
- any distribution, kernel, hardware, driver, device inventory, runtime, service manager, security-module, namespace, filesystem, mount, syscall, capability, helper, package, configuration, or policy change that affects exposure or evidence;
- discovery of an uninventoryable interface, unapproved device, new pseudo-filesystem, alternate mount, inherited descriptor, open directory handle, namespace route, syscall route, capability route, helper route, or cross-attempt route;
- evidence that a read-only or minimal exception exposes unexpected information, mutation, control, side effects, or host-global authority;
- missing, ambiguous, contradictory, non-reproducible, or stale mandatory evidence;
- a boundary, cleanup, attribution, generation-identity, or unsupported-profile refusal failure;
- a new attacker capability or changed trusted assumption under P42-D002; or
- inability to reproduce the approved posture on the exact claimed platform profile.

## Nonclaims

**OUT OF SCOPE:** selecting or implementing exact mechanisms, changing accepted requirements or budgets, approving P42-D001, approving P42-D003, qualifying a platform, running tests, deployment, production support, resistance to a malicious administrator or compromised trusted kernel, and automatic merge.

**PROHIBITED CLAIM:** this approval approves P42-D003; a mount namespace, container, VM, syscall filter, device allowlist, mandatory-access-control policy, low-privilege identity, or read-only view alone is sufficient; denial has been implemented or tested; a platform is supported; no device or kernel interface exists; no side channel remains; Phase 4.2 implementation has begun; or complete isolation or absolute security has been achieved.
