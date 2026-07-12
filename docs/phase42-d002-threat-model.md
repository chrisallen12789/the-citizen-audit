# P42-D002 — Phase 4.2 threat model

## Decision status

**OPEN — recommendation documented; pending independent review and explicit project-owner approval.** The **RECOMMENDED** Phase 4.2 threat model is compromise-oriented:

> The attacker is assumed to control validator code, dependencies, inputs, staged artifacts, outputs, timing, failure behavior, concurrency, and retries, and may obtain arbitrary native-code execution inside the confined validator process. The OS boundary must still protect the host, supervisor, other attempts, and accepted result path.

This assumption deliberately prevents Phase 4.2 from depending on Phase 4.1 JavaScript-level containment remaining intact. Phase 4.1 remains valuable defense in depth, but the OS boundary must withstand a fully compromised validator process.

**REPORTED:** the supplied source register cites general threat-modeling guidance about defining the system, identifying what can go wrong, selecting responses, and establishing validation evidence. That methodology supports this recommendation; it is not proof that the listed threats are currently mitigated. [SRC-TM-001](phase42-foundational-source-register.md#src-tm-001), [SRC-TM-002](phase42-foundational-source-register.md#src-tm-002)

## Subject of evaluation

The subject begins when the trusted orchestrator submits a bounded validation request to the future supervisor. It includes:

- artifact verification and staging;
- process launch and exact process-generation ownership;
- validator execution and descendants;
- all approved and attempted input/output, IPC, filesystem, network, process, diagnostic, and resource activity;
- result parsing and success acceptance;
- termination, cleanup, restart reconciliation, and audit evidence.

It ends only after the supervisor has either accepted a bounded valid result or recorded a deterministic failure, accounted for the exact process tree, and completed or explicitly quarantined cleanup.

## Security objectives

| ID | Objective | Protected property |
| --- | --- | --- |
| TM-G01 | Confine a fully compromised validator process to its approved attempt boundary. | Host and cross-attempt integrity/confidentiality. |
| TM-G02 | Prevent unapproved filesystem, network, local IPC, process, credential, handle, and device authority. | Authority containment. |
| TM-G03 | Bound CPU, memory, process count, descriptors, storage, input, output, diagnostics, and wall-clock use. | Host availability. |
| TM-G04 | Bind execution, control, result, and cleanup to exact attempt and process generations. | Provenance and lifecycle integrity. |
| TM-G05 | Accept success only when every mandatory control and assurance record remained valid. | Fail-closed result integrity. |
| TM-G06 | Isolate concurrent attempts and unrelated host processes from one another. | Multi-attempt integrity/confidentiality. |
| TM-G07 | Prevent persistent state, orphan processes, stale IPC, dumps, or workspaces after termination or supervisor loss. | Cleanup and persistence resistance. |
| TM-G08 | Produce bounded, redacted, reproducible evidence without trusting validator output. | Auditability. |

## Threat agents

| Agent | In scope | Assumed capability |
| --- | --- | --- |
| Malicious validator author | Yes | Crafts validator source and behavior to escape, persist, forge success, or exhaust resources. |
| Compromised or malicious validator dependency | Yes | Equivalent to validator author; may execute at load time or later. |
| Malicious validation-input originator | Yes | Controls structured input, filenames, metadata, archive structure, object graphs, sizes, timing, and repeated submissions. |
| Native-code attacker inside validator process | Yes | Executes arbitrary machine code under the validator process identity, uses any reachable syscall or inherited authority, and exploits runtime/user-space defects. |
| Concurrent validator attempt | Yes | Attempts local IPC, workspace, process, result-channel, identifier, and resource interference. |
| Unprivileged same-host process | Yes | Attempts to inspect, signal, debug, communicate with, or influence the validator and supervisor through ambient local interfaces. |
| Remote network attacker | Indirectly | May supply malicious validator/input through governed upstream channels, but is not assumed to have direct host access. |
| Host administrator/root | No | Trusted operational authority; compromise defeats the boundary. Misconfiguration remains a governance risk. |
| Compromised kernel, hypervisor, firmware, or physical host | No | Residual platform risk outside Phase 4.2 control. |
| Compromised trusted supervisor/launcher or approved artifact signer | No | Those components are in the TCB; their compromise requires a different boundary and incident model. |

## Attacker capabilities

The in-scope attacker may:

- know the complete architecture and policy;
- run repeated and concurrent attempts;
- race launch, validation, result, timeout, and cleanup paths;
- exploit Node.js, native add-ons, libraries, or other user-space components reachable in the validator process;
- attempt every syscall available to the process;
- create threads and descendants when not blocked;
- manipulate exit codes, signals, stdout, stderr, result frames, timing, and crashes;
- attempt to exhaust all measurable resources;
- use symlinks, hardlinks, sparse files, archive recursion, duplicate paths, special files, and mutable staging objects;
- attempt local IPC, debugger, process-inspection, signal, shared-memory, named-object, and stale-identifier interactions;
- attempt to acquire privileges, capabilities, supplementary groups, tokens, credentials, or privileged helpers;
- trigger core dumps, runtime diagnostics, external crash handlers, and persistent artifacts;
- attempt to survive supervisor termination or exploit restart reconciliation;
- attempt to substitute bytes between provenance verification and execution;
- return results containing malformed, oversized, ambiguous, delayed, accessor-driven, or intentionally misleading data.

The attacker is not assumed to respect Phase 4.1 APIs or JavaScript semantics after process compromise.

## Trusted assumptions

The following are trusted for Phase 4.2 and must be explicit in any claim:

1. The explicitly approved host image, kernel, firmware/hypervisor layer, and hardware enforce their documented semantics.
2. The supervisor, launcher, orchestrator, result parser, policy compiler, artifact verifier, immutable artifact store, audit sink, and governance process are trusted assumptions for any later approved design.
3. Exact approved bytes are available from an immutable or otherwise generation-safe source.
4. Platform security updates are applied under a controlled requalification process.
5. Host administrators do not intentionally bypass policy.
6. The underlying kernel does not contain an exploitable vulnerability that defeats the selected controls.
7. Mandatory evidence cannot be forged by validator-owned channels.

These assumptions define residual risk. They do not turn the TCB into a verified component.

## Assets and authorities to protect

- repository and governed project state;
- host filesystem and package state;
- supervisor/orchestrator memory and process authority;
- credentials, tokens, environment secrets, sockets, handles, descriptors, and service identities;
- local and external network connectivity;
- other validator attempts and their workspaces, transports, results, and resource allocations;
- result integrity, attempt identity, and acceptance decision;
- audit evidence and provenance records;
- host CPU, memory, storage, process, thread, descriptor, and IPC capacity;
- crash dumps, diagnostics, temporary files, and cleanup state;
- artifact-store and runtime provenance.

## Trust boundaries

| Boundary | Untrusted side | Trusted side | Required treatment |
| --- | --- | --- | --- |
| Artifact intake | Validator package, dependencies, archives, metadata | Staging/provenance verifier | Bound, normalize, reject ambiguity, and bind verified identity to exact executed bytes. |
| Launch | Validator executable and configuration | Supervisor/launcher/kernel policy | Establish every control before execution; no ambient inheritance. |
| Process identity | Validator PID/tree | Generation-safe process owner | Numeric PID is supplemental only; prevent reuse and replacement confusion. |
| Input transport | Validator-controlled reads | Supervisor-owned bounded channel | Exact attempt binding, size limits, deterministic closure. |
| Result transport | Validator-controlled output | Host parser and acceptance gate | Untrusted, bounded, schema-checked, exact-attempt bound, and never authoritative by itself. |
| Filesystem | Validator process | Host and attempt workspace | Exact allowlist, read/write separation, immutable executable bytes, safe cleanup. |
| Network and local IPC | Validator process | Host network, service buses, peers, other attempts | Default denial except exact approved attempt channels. |
| Identity/privilege | Validator and descendants | Host credentials and privileged helpers | Monotonic non-escalation. |
| Resource control | Validator activity | Shared host capacity | Kernel-enforced hard ceilings and deterministic termination. |
| Supervisor lifecycle | Owned validator tree | Service manager/watchdog/reconciler | No unowned continuation; exact restart reconciliation. |
| Diagnostics | Crashing validator | Host crash/reporting facilities | Disabled or bounded inside owned workspace and process tree. |
| Concurrent attempts | Attempt A | Attempt B | Separate identities, workspaces, transports, resource groups, and results. |

## Threat catalog

| ID | Threat | Impact | Required response | Primary Phase 4.2 mappings |
| --- | --- | --- | --- | --- |
| TM-T01 | Escape through filesystem access or staged-artifact path confusion. | Host read/write compromise or persistence. | Immutable bounded staging, path/link/special-file rejection, read-only executable view, exact cleanup. | CONF-FS-001/002, CONF-INPUT-001, CONF-TEMP-001, P42-D006, P42-D020 |
| TM-T02 | Network or local-IPC communication outside approved channels. | Exfiltration, command/control, cross-attempt corruption. | Default deny IP networking and ambient local IPC; exact attempt-bound transport allowlist. | CONF-NET-001, CONF-IPC-001, P42-D007, P42-D021 |
| TM-T03 | Inherited handle, socket, descriptor, token, or transport authority. | Bypass of later policy. | Exact inherited-handle allowlist and launch refusal on ambiguity. | CONF-HANDLE-001, P42-D017 |
| TM-T04 | Identity or privilege escalation after launch. | Host or peer compromise. | Least privilege plus monotonic non-escalation for validator and descendants. | CONF-IDENTITY-001, P42-D005 |
| TM-T05 | Descendant or orphan process survives timeout, crash, or supervisor loss. | Persistence and resource abuse. | Exact tree ownership, parent-death policy, restart reconciliation, force termination, orphan scan. | CONF-CHILD-001, CONF-SUPERVISOR-001, CONF-CLEANUP-001/002, P42-D010, P42-D019 |
| TM-T06 | CPU, memory, process, descriptor, storage, input, output, or diagnostic exhaustion. | Host denial of service. | Kernel-enforced budgets, preflight bounds, streaming limits, deterministic failure. | CONF-CPU/TIME/MEM/OUTPUT/INPUT/DUMP, P42-D008, P42-D018, P42-D022 |
| TM-T07 | Result forgery, ambiguity, replay, cross-attempt confusion, or acceptance after policy breach. | False institutional decision. | Exact attempt identity, bounded schema, mandatory evidence, fail-closed acceptance gate. | CONF-PROC-001, CONF-OUTPUT-002, CONF-OBS-001, CONF-FAILCLOSED-001 |
| TM-T08 | Time-of-check/time-of-use substitution of executable, dependency, configuration, or staged bytes. | Execution of unverified code. | Bind recorded provenance to exact immutable executed objects. | CONF-PROVENANCE-001, P42-D014 |
| TM-T09 | Cross-attempt inspection, signaling, debugging, shared-memory, or workspace interference. | Confidentiality/integrity loss. | Per-attempt process, identity, IPC, workspace, and resource separation. | CONF-IPC-001, CONF-FS-001, CONF-PROC-001, P42-D021 |
| TM-T10 | Crash dump, heap snapshot, diagnostic report, or crash-handler escape. | Memory disclosure, storage exhaustion, persistence. | Disable or confine diagnostics, budget bytes/files, contain handlers, clean/quarantine artifacts. | CONF-DUMP-001, BUD-DUMP, P42-D022 |
| TM-T11 | Supervisor/launcher failure leaves an active but unowned validator. | Unobserved execution or forged late success. | External ownership, invalidation on supervision loss, generation-safe reconciliation. | CONF-SUPERVISOR-001, P42-D019 |
| TM-T12 | Misconfigured or unsupported host silently degrades controls. | False assurance. | Capability preflight and launch refusal; no best-effort fallback for mandatory controls. | CONF-PORTABILITY-001, CONF-FAILCLOSED-001, P42-D001, P42-D015 |
| TM-T13 | Kernel/runtime/user-space vulnerability exploited from validator. | Boundary bypass or host compromise. | Defense in depth, narrow TCB, patching, syscall/MAC review, and residual-risk disclosure. | P42-D003, P42-D011, P42-D016 |
| TM-T14 | Covert timing/resource channels between attempts. | Limited information leakage. | Reduce direct channels and resource coupling; document residual covert-channel risk. | CONF-IPC-001, CONF-CPU/MEM/OBS; residual risk |

## Availability scope

Phase 4.2 must contain denial of service caused by a single attempt and by the configured number of concurrent attempts. It must bound per-attempt and aggregate resources governed by the supervisor.

Out of scope for Phase 4.2:

- unbounded distributed request floods against upstream services;
- capacity planning for arbitrary institutional scale;
- denial of service by a root administrator, compromised kernel, provider, or hypervisor;
- business-continuity and regional-disaster recovery.

Those require later service-level architecture.

## Explicitly out of scope

The following are not security guarantees of Phase 4.2:

- protection from malicious root/administrator action;
- protection from compromised kernel, hypervisor, firmware, CPU microcode, or physical access;
- complete prevention of microarchitectural, timing, cache, power, or electromagnetic side channels;
- proof that the trusted supervisor, launcher, parser, or policy compiler is defect-free;
- proof that an approved signed artifact is semantically benign if the trusted signing/build process itself is compromised;
- global DDoS protection;
- endpoint/user-device security;
- social engineering and credential theft outside the validator host;
- legal, privacy, or records-retention classification of validator content.

## Residual risks that must remain visible

Even after Phase 4.2 acceptance, residual risks include:

- kernel or hypervisor vulnerabilities;
- errors in the supervisor, launcher, policy compiler, or result parser;
- policy composition mistakes;
- incomplete syscall/MAC coverage;
- covert timing and resource channels;
- operational drift after an approved baseline;
- insufficient patch/requalification cadence;
- false confidence from tests that do not reproduce production privileges and topology.

No document should describe Phase 4.2 as “secure against arbitrary code” without stating these assumptions and residual risks.

## Acceptance implications

Under this threat model, a future production acceptance run would need to demonstrate that the selected controls prevent arbitrary validator-process behavior from:

1. read or modify unapproved host or peer state;
2. communicate through unapproved network or local IPC;
3. acquire additional identity or privilege;
4. retain inherited ambient authority;
5. escape exact process-tree ownership;
6. exceed hard resource and input/output bounds without deterministic termination;
7. substitute unverified executable or staged bytes;
8. forge, replay, or cross-bind an accepted result;
9. persist through processes, files, IPC, dumps, diagnostics, or stale policy state;
10. produce accepted success after any mandatory control or evidence failure.

Tests must be reproduced on every claimed supported platform profile. Positive “works normally” tests are insufficient without negative enforcement evidence.

## Review and change triggers

Reopen P42-D002 if the system adds:

- network-enabled validators;
- approved helper processes;
- multi-host execution;
- secrets intentionally exposed to validators;
- new artifact or archive formats;
- new result transports;
- native add-ons or alternate runtimes;
- Windows/macOS production support;
- stronger tenant-isolation claims;
- an untrusted supervisor or broker tier;
- requirements to resist malicious host administrators or kernel compromise.

The threat model must also be reviewed after a confinement bypass, major runtime/kernel change, or new cross-attempt data path.

## Decision record wording

If approved, record:

> P42-D002 is resolved by assuming the validator process is fully hostile and may obtain arbitrary native-code execution under its launch identity. Validator source, dependencies, input, staged artifacts, output, timing, errors, retries, and concurrent attempts are attacker-controlled. Unprivileged same-host processes and other attempts are hostile peers. The approved kernel, host image, supervisor, launcher, immutable artifact source, and audit sink remain trusted assumptions. Phase 4.2 must fail closed and protect the host even if Phase 4.1 JavaScript containment is completely bypassed.
