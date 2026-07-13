# Phase 4.2 P42-D003 gap-resolution decision records

## Status and purpose

**APPROVED RECORDINGS — the project owner approved D003-TRACE-AGG-001 and D003-TRACE-DEVICE-001 only against their exact immutable source content; their corresponding gaps are RESOLVED by those records.**

This document records the current approvals for the architecture-level traceability records referenced below and retains clearly marked superseded preapproval draft text for provenance. Their canonical definitions are in [aggregate admission and concurrent-resource governance](phase42-d003-gap-aggregate-governance.md) and [device and kernel-interface boundary governance](phase42-d003-gap-device-kernel-boundary.md#record-definition-and-status). This document references those identifiers; it does not redefine them.

The traceability identifiers are not `CONF` requirements, `BUD` budgets, or `P42-D` governance decisions. They do not alter the accepted [Phase 4.2 confinement requirements](phase42-confinement-requirements.md) or [resource-budget framework](phase42-resource-budget.md). Both traceability records are **APPROVED** and both corresponding D003 gaps are **RESOLVED** only by their exact immutable approved records. P42-D003 remains **OPEN** and **RECOMMENDED**.

The quoted approval language below is retained as historical proposed wording. The current approvals are recorded by the following immutable bindings; neither approval authorizes mechanisms, numeric limits, an exact platform, implementation, tests, merge, deployment, P42-D001, or P42-D003.

| Record | Approved immutable source | Resulting status |
| --- | --- | --- |
| D003-TRACE-AGG-001 | Commit `d7e6c286cbfc36ecf2c4b6abd1030f285052aee0`; blob `60866c028c06f1b260aa7c6010b5f38851d876af`; UTF-8 no-BOM LF bytes `[720, 31684)`; 30,964 bytes; SHA-256 `c5eeb152a94a8f056506800939b613b52ec58df27687ef2846e3ae2c6ab2ce31`. | **APPROVED**; D003-GAP-AGG-001 **RESOLVED** only by this binding. |
| D003-TRACE-DEVICE-001 | Commit `d7e6c286cbfc36ecf2c4b6abd1030f285052aee0`; blob `2a807e88df1b2cdf8305efdf1810153385b58f3e`; UTF-8 no-BOM LF bytes `[0, 25588)`; 25,588 bytes; SHA-256 `2a19f430a1bce0cdb17fc00773fea1651c803fb0558ed0c690b499875fd53d53`. | **APPROVED**; D003-GAP-DEVICE-001 **RESOLVED** only by this binding. |

## Shared governance constraints

- Each recorded approval accepts only an architecture-level mapping and its governance invariants. It does not approve numeric limits, mechanisms, configurations, platform support, implementation, test results, deployment, or P42-D003.
- Each approval is bound to the exact immutable reviewed record and retains its independent-review disposition, approving project-owner action, assumptions, residual risks, conditions, and exceptions.
- P42-D001 remains **OPEN** and provisional. Its later approval and exact-platform reconciliation remain mandatory before final P42-D003 approval.
- P42-D002 remains **APPROVED** and bound to its immutable approved content. The hostile-validator and arbitrary-native-code model, trusted assumptions, out-of-scope conditions, residual risks, acceptance implications, and reopen triggers remain controlling inputs.
- P42-D003 remains **OPEN** after both traceability-record approvals. Final P42-D003 approval still requires P42-D001 approval, reconciliation against the exact selected platform, independent review of the reconciled package, and explicit P42-D003 project-owner approval.
- Phase 4.1 remains **REPORTED as rejected**, VAL-RESULT-001 remains **OPEN**, and Phase 4.2 remains **PLANNED**. Implementation remains prohibited while Phase 4.1 is rejected.

## D003-TRACE-AGG-001 approval record and superseded preapproval draft

### Approval status

**APPROVED — only against the immutable binding recorded above. D003-GAP-AGG-001 is RESOLVED only by that approved record.**

All remaining subsections in this section are **SUPERSEDED HISTORICAL PREAPPROVAL DRAFT TEXT** retained for provenance. They do not describe current record or gap status and do not extend the approval.

### Exact decision question

Should the project adopt the proposed host-level aggregate admission, reservation, enforcement, accounting, cleanup, restart-reconstruction, and protected-capacity contract as the architecture-level traceability response to D003-GAP-AGG-001?

### Proposed resolution

Adopt the governance invariants in the referenced aggregate record: one trusted host-level admission controller; a configured maximum concurrent-attempt count; atomic reservation before untrusted launch; simultaneous per-attempt and aggregate controls for all mapped resource categories; generation-safe descendant and state ownership; protected supervisor, service-manager or durable-owner, audit-sink, and recovery reserves; deterministic refusal of zero-capacity, `N+1`, unsupported, or overcommitted admission; reservation retention through verified terminal cleanup; quarantine after incomplete cleanup; and fail-closed ledger reconstruction after restart.

This proposed action accepts an architecture contract and mapping. Exact numeric profiles, mechanisms, enforcement points, transport encodings, and platform-specific configuration remain subject to P42-D001, P42-D008, P42-D009, P42-D010, P42-D012, P42-D013, P42-D018, P42-D019, P42-D021, and P42-D022.

### Scope

- Aggregate governance for configured concurrency; CPU; memory; processes; threads; descriptors and handles; input; staging; extraction; filesystem and temporary storage; stdout; stderr; structured results; IPC; dumps; diagnostics; audit buffers; supervisor queues; pending results; retries; cancellation; cleanup; quarantine; and protected control-plane capacity.
- Ownership split among trusted admission, enforcement, external observation, durable recovery, cleanup, audit, and profile-approval roles.
- Deterministic fail-closed admission, lifecycle charging, release, quarantine, restart reconstruction, mandatory evidence, trusted assumptions, residual risks, and reopen triggers.
- Proposed mapping to the exact existing `CONF`, `BUD`, and `P42-D` identifiers listed in the referenced aggregate record and [gap-resolution traceability](phase42-d003-gap-resolution-traceability.md).

### Superseded historical nonclaims

**OUT OF SCOPE:** choosing or configuring cgroups, service managers, job objects, quotas, containers, VMs, supervisors, ledgers, audit sinks, numeric limits, or any other mechanism; qualifying an exact platform; implementing or testing controls.

**HISTORICAL DRAFT NONCLAIM:** approval does not prove aggregate exhaustion is prevented by an implementation, any numeric profile is safe, or any test has passed; it does not approve P42-D003 or authorize Phase 4.2 implementation.

### Dependencies

| Dependency | Required disposition for future owner action |
| --- | --- |
| P42-D002 | Remains APPROVED and supplies the controlling hostile-validator and arbitrary-native-code model. Any relevant reopen trigger requires reassessment. |
| Accepted `CONF` requirements | The future action must preserve their exact text and status and approve only the proposed architecture-level mapping. |
| Accepted `BUD` framework | The future action must preserve every numeric value as OPEN unless separately approved and bind later values to an exact platform profile. |
| P42-D008, P42-D009, P42-D010, P42-D012, P42-D013, P42-D018, P42-D019, P42-D021, and P42-D022 | Remain OPEN; future detailed decisions must implement the approved architecture invariant without weakening it. |
| P42-D016 | Independent-review scope, artifacts, conclusions, and sign-off must be recorded. |
| P42-D001 | May remain OPEN for this proposed architecture-record action, but must be approved and followed by exact-platform reconciliation before final P42-D003 approval. |
| Device-boundary traceability record | Independently reviewed and explicitly acted on before its separate gap status can change; aggregate action cannot substitute for it. |
| P42-D003 | Must remain OPEN until every separate final approval dependency is satisfied. |

### Evidence prerequisites

Before any owner approval, an independent reviewer must verify that the immutable aggregate record and [traceability tables](phase42-d003-gap-resolution-traceability.md) cover every applicable existing requirement, budget, decision, lifecycle path, ownership role, failure category, cleanup rule, trust assumption, residual risk, open numeric question, blocker, and reopen trigger. The reviewer must also confirm that the [future evidence plan](phase42-d003-gap-resolution-evidence-plan.md) contains the required zero-capacity, through-`N`, `N+1`, simultaneous-pressure, attribution, descendant, retry, cancellation, cleanup, quarantine, restart-reconstruction, and protected-reserve families.

These prerequisites are documentation-review evidence, not implementation or completed-test evidence. Future platform acceptance would additionally require the tests and host-observed artifacts in the evidence plan; none may be claimed by this owner action.

### Independent-review requirement

The reviewer must be independent of the record authoring and future implementation work, identify omissions or disagreements explicitly, verify that no accepted requirement or budget was silently changed, and record an accept, revise, or reject recommendation against the exact immutable bytes presented for owner action. Unresolved material review findings block approval.

### Owner-approval requirement

Only an explicit project-owner action against the exact independently reviewed immutable record can approve it. Silence, merge, commit existence, ZIP distribution, reviewer recommendation, approval of P42-D002, or approval of another traceability record is not owner approval. Any revision after review requires a new immutable identity and review disposition before action.

### Superseded historical draft approval wording

> If an independent reviewer has accepted the exact immutable aggregate-governance record, all material review findings are closed or explicitly retained by the project owner, and the project owner expressly elects to approve it, the owner may record: “D003-TRACE-AGG-001 is **APPROVED** as the architecture-level aggregate-admission and concurrent-resource-governance traceability record, subject to its trusted assumptions, residual risks, unresolved numeric and platform-specific work, evidence prerequisites, and reopen triggers. D003-GAP-AGG-001 is **RESOLVED** by reference to this exact immutable approved record. This action does not approve numeric limits, a mechanism, an exact platform, implementation, test results, P42-D001, or P42-D003.”

> If that conditional owner action occurs, P42-D003 must still remain **OPEN** until P42-D001 is approved, P42-D003 is reconciled against the exact selected platform, both gap records have received their required independent review and explicit owner action, the reconciled P42-D003 package is independently reviewed, and the project owner explicitly approves, revises, or rejects P42-D003.

### Reopen triggers

Any later approval must be reopened if the P42-D002 threat or trust model changes; the OS, kernel, runtime, service manager, ownership layer, deployment topology, host-sharing model, accounting or enforcement primitive, audit sink, ledger, or recovery design changes; a new resource or backlog class appears; numeric budgets or concurrency change; descendant or state attribution fails; an overcommit, ledger race, protected-reserve breach, cleanup leak, stale release, quarantine error, restart-reconstruction ambiguity, or nondeterministic refusal is observed; mandatory evidence becomes incomplete or validator-controlled; or an exact platform requires weakening a governing invariant.

## D003-TRACE-DEVICE-001 approval record and superseded preapproval draft

### Approval status

**APPROVED — only against the immutable binding recorded above. D003-GAP-DEVICE-001 is RESOLVED only by that approved record.**

All remaining subsections in this section are **SUPERSEDED HISTORICAL PREAPPROVAL DRAFT TEXT** retained for provenance. They do not describe current record or gap status and do not extend the approval.

### Exact decision question

Should the project adopt the proposed default-deny, minimal per-attempt allowlist and exact-platform evidence contract for devices, pseudo-filesystems, process-state surfaces, kernel-state surfaces, tracing and performance interfaces, policy-control interfaces, inherited descriptors, mounts, namespaces, syscalls, and capabilities as the architecture-level traceability response to D003-GAP-DEVICE-001?

### Proposed resolution

Adopt the governance invariants in the referenced device and kernel-interface record: expose no device or kernel-control interface by default; allow only a minimal inventoried per-attempt set required by the exact approved profile; make permitted views read-only and immutable where feasible; deny host-global mutation and access to unrelated process, kernel, device, tracing, performance, security, service-control, and policy state; deny device-node creation and inherited-device authority except for an explicit reviewed exception; prevent remount, alternate-mount, namespace, descriptor, directory-handle, syscall, capability, and equivalent-authority bypass; bind every exception to the exact platform capability manifest; and refuse launch when the required boundary or evidence cannot be established.

This proposed action accepts an architecture contract and mapping. Exact devices, pseudo-filesystems, mount options, namespaces, identities, capabilities, syscall rules, descriptor policy, mandatory-access-control policy, broker design, and platform configuration remain subject to P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, and P42-D021.

### Scope

- Character devices, block devices, device-node creation, inherited device descriptors, and descriptor- or directory-handle-based authority.
- `/dev`, `/proc`, `/sys`, cgroupfs, debugfs, tracefs, securityfs, sysctl-style controls, runtime and service-control filesystems, and any alternate or namespace-based exposure of equivalent authority.
- Host process state, kernel state, device state, tracing, performance, security, and policy-control interfaces reachable through paths, mounts, descriptors, syscalls, capabilities, brokers, or helpers.
- Inventory, minimum allowlisting, read-only and immutable posture where feasible, host-global mutation denial, fail-closed capability validation, cleanup, residual scans, evidence, assumptions, risks, platform dependencies, blockers, and reopen triggers.
- Proposed mapping to CONF-FS-001, CONF-FS-002, CONF-HANDLE-001, CONF-IDENTITY-001, CONF-SYSCALL-001, CONF-IPC-001, CONF-PORTABILITY-001, CONF-FAILCLOSED-001, P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, and P42-D021.

### Superseded historical nonclaims

**OUT OF SCOPE:** selecting or configuring exact mounts, devices, namespaces, identities, syscall filters, capability sets, descriptor-closing primitives, mandatory-access-control rules, containers, VMs, brokers, or host policy; qualifying an exact platform; implementing or testing controls.

**HISTORICAL DRAFT NONCLAIM:** approval does not prove a path allowlist or read-only mount alone establishes the boundary, every kernel interface is inventoried in an implementation, any platform is supported, or any test has passed; it does not approve P42-D003 or authorize Phase 4.2 implementation.

### Dependencies

| Dependency | Required disposition for future owner action |
| --- | --- |
| P42-D002 | Remains APPROVED and supplies the controlling hostile-validator and arbitrary-native-code model. Any relevant reopen trigger requires reassessment. |
| CONF-FS-001, CONF-FS-002, CONF-HANDLE-001, CONF-IDENTITY-001, CONF-SYSCALL-001, CONF-IPC-001, CONF-PORTABILITY-001, and CONF-FAILCLOSED-001 | The future action must preserve their exact text and status and approve only the proposed architecture-level mapping. |
| P42-D005, P42-D006, P42-D010, P42-D011, P42-D015, P42-D017, and P42-D021 | Remain OPEN; future detailed decisions must select exact-platform mechanisms without weakening the approved architecture invariant. |
| P42-D016 | Independent-review scope, artifacts, conclusions, and sign-off must be recorded. |
| P42-D001 | May remain OPEN for this proposed architecture-record action, but exact exceptions cannot become a support claim; P42-D001 approval and exact-platform reconciliation remain mandatory before final P42-D003 approval. |
| Aggregate-governance traceability record | Independently reviewed and explicitly acted on before its separate gap status can change; device action cannot substitute for it. |
| P42-D003 | Must remain OPEN until every separate final approval dependency is satisfied. |

### Evidence prerequisites

Before any owner approval, an independent reviewer must verify that the immutable device record and [traceability tables](phase42-d003-gap-resolution-traceability.md) cover every applicable existing requirement and decision, every interface and bypass family in scope, enforcement and observation ownership, cleanup, failure behavior, trusted assumptions, residual risks, platform dependencies, blockers, and reopen triggers. The reviewer must also confirm that the [future evidence plan](phase42-d003-gap-resolution-evidence-plan.md) contains unauthorized character- and block-device access, device-node creation, inherited-descriptor, process- and kernel-state discovery, sysctl and kernel mutation, cgroup, debug, trace, security and performance surface, remount, alternate-mount, namespace re-exposure, open-descriptor, directory-handle, syscall, capability, approved-continuity, complete-inventory, and residual-cleanup families.

These prerequisites are documentation-review evidence, not implementation or completed-test evidence. Future platform acceptance would additionally require exact-profile host-observed negative, continuity, inventory, cleanup, and independent-reproduction evidence; none may be claimed by this owner action.

### Independent-review requirement

The reviewer must be independent of the record authoring and future implementation work, challenge the completeness of the interface inventory and equivalent-authority analysis, verify that the default-deny and fail-closed posture has no undocumented fallback, verify that no accepted requirement was silently changed, and record an accept, revise, or reject recommendation against the exact immutable bytes presented for owner action. Unresolved material review findings block approval.

### Owner-approval requirement

Only an explicit project-owner action against the exact independently reviewed immutable record can approve it. Silence, merge, commit existence, ZIP distribution, reviewer recommendation, approval of P42-D002, or approval of the aggregate traceability record is not owner approval. Any revision after review requires a new immutable identity and review disposition before action.

### Superseded historical draft approval wording

> If an independent reviewer has accepted the exact immutable device and kernel-interface governance record, all material review findings are closed or explicitly retained by the project owner, and the project owner expressly elects to approve it, the owner may record: “D003-TRACE-DEVICE-001 is **APPROVED** as the architecture-level device and kernel-interface boundary traceability record, subject to its trusted assumptions, residual risks, platform dependencies, exact-profile inventory and exception work, evidence prerequisites, and reopen triggers. D003-GAP-DEVICE-001 is **RESOLVED** by reference to this exact immutable approved record. This action does not approve an exact device or interface allowlist, a mechanism, an exact platform, implementation, test results, P42-D001, or P42-D003.”

> If that conditional owner action occurs, P42-D003 must still remain **OPEN** until P42-D001 is approved, P42-D003 is reconciled against the exact selected platform, both gap records have received their required independent review and explicit owner action, the reconciled P42-D003 package is independently reviewed, and the project owner explicitly approves, revises, or rejects P42-D003.

### Reopen triggers

Any later approval must be reopened if the P42-D002 threat or trust model changes; the OS, kernel, runtime, service manager, mount, namespace, cgroup, device, descriptor, identity, capability, syscall, mandatory-access-control, container, VM, broker, or deployment profile changes; a new pseudo-filesystem, device class, tracing, performance, security, service-control, policy, helper, or descriptor path appears; an allowlisted interface gains broader authority; read-only or immutability guarantees weaken; inventory, denial, observation, cleanup, or evidence is incomplete; a remount, alternate-mount, namespace, descriptor, directory-handle, syscall, capability, or equivalent-authority bypass succeeds; host-global or unrelated process, kernel, device, tracing, performance, security, or policy state becomes reachable; or an exact platform requires best-effort fallback.

## Package-wide nonclaims and present status

**OUT OF SCOPE:** approving P42-D001 or P42-D003; approving mechanisms, numeric limits, or an exact platform; implementation; completed tests; platform qualification; deployment; merge; or modification of accepted requirements and budgets.

**PROHIBITED CLAIM:** either approval makes P42-D003 approvable without its remaining dependencies, or this package shows confinement, production security, complete isolation, or absolute security. The two approvals and their corresponding gap resolutions are current only as stated in the immutable bindings above.

D003-GAP-AGG-001 and D003-GAP-DEVICE-001 are **RESOLVED** only by their corresponding immutable approved records. P42-D001 remains **OPEN** and provisional. P42-D002 remains **APPROVED** and bound to its immutable approved content. P42-D003 remains **OPEN** and **RECOMMENDED**. P42-D004 through P42-D022 remain **OPEN**. Phase 4.2 remains **PLANNED**. No Phase 4.2 implementation exists, no Phase 4.2 tests have been implemented or run, and this branch must not be merged automatically.
