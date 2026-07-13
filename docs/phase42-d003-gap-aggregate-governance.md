# Phase 4.2 P42-D003 aggregate admission and concurrent-resource governance

## Status and authority

**APPROVED — project-owner approval is bound only to the immutable D003-TRACE-AGG-001 extraction from commit `d7e6c286cbfc36ecf2c4b6abd1030f285052aee0`: blob `60866c028c06f1b260aa7c6010b5f38851d876af`; UTF-8, no-BOM, LF-only bytes `[720, 31684)`; 30,964 bytes; SHA-256 `c5eeb152a94a8f056506800939b613b52ec58df27687ef2846e3ae2c6ab2ce31`.**

This document supplies the approved architecture-level traceability record for the aggregate-governance coverage gap defined as [D003-GAP-AGG-001](phase42-d003-requirement-traceability.md#d003-gap-agg-001). It does not alter the accepted [confinement requirements](phase42-confinement-requirements.md) or [resource-budget framework](phase42-resource-budget.md), and it does not create a `CONF`, `BUD`, or `P42-D` identifier. D003-GAP-AGG-001 is **RESOLVED** only by the exact immutable approved extraction above. P42-D003 remains **OPEN** and **RECOMMENDED**.

## D003-TRACE-AGG-001 — aggregate admission and concurrent-resource governance

### Decision question

What host-level admission, reservation, enforcement, accounting, recovery, and cleanup contract prevents individually valid validator attempts from collectively exhausting the host while preserving capacity for supervision, audit, and recovery?

### Proposed resolution

A trusted host-level admission controller is the sole gate through which an untrusted validator attempt may launch. It atomically reserves capacity against an approved aggregate profile before any untrusted process starts or receives executable input. The profile contains a configured maximum concurrent-attempt count, aggregate ceilings for every applicable resource category, and capacity that cannot be allocated to attempts because it is reserved for the supervisor, service manager or durable ownership layer, audit sink, and recovery path.

Admission and reservation are separate from per-attempt enforcement. Every admitted attempt must remain subject to its approved per-attempt controls. The aggregate controller must also prevent the sum of admitted reservations, live attributed consumption, retained cleanup charges, queues, retries, and recovery work from exceeding the aggregate profile. An attempt that is individually within its limits is not admissible when its reservation would overcommit any aggregate category.

### Governing invariants

1. The aggregate profile records a configured maximum concurrent-attempt value, `N`, greater than or equal to zero. `N` is an upper bound, not an entitlement to launch that many attempts when another aggregate category is exhausted.
2. One trusted host-level admission controller owns the authoritative reservation ledger. Every path capable of starting untrusted validator execution must pass through that controller.
3. Admission is an atomic compare-and-reserve operation. The controller evaluates the requested attempt against the current generation-safe ledger, every aggregate ceiling, every quarantined charge, and every protected host reserve before launch.
4. A reservation is established before untrusted launch. Staging or extraction performed before validator launch is itself charged to the owning attempt or to a separately bounded prelaunch reservation; it cannot consume unaccounted host capacity.
5. At zero capacity, at configured concurrency `N`, or when any category lacks capacity, the controller refuses the request deterministically before validator exposure. An `N+1` request cannot wait in an unbounded hidden queue or start on a best-effort basis.
6. Per-attempt enforcement and aggregate governance are both **REQUIRED**. A per-attempt ceiling does not prove aggregate safety, and an aggregate reservation does not replace a per-attempt hard limit or breach response.
7. Every validator process and descendant remains charged to the exact attempt and authoritative process-tree generation. Forking, reparenting, daemonizing, namespace transitions, helper processes, crash handlers, and cleanup workers cannot escape accounting.
8. Reservations remain charged until all terminal cleanup and reconciliation checks succeed. Process exit, result receipt, cancellation acknowledgement, or workspace deletion alone is not sufficient release evidence.
9. Incomplete or unverifiable cleanup quarantines the affected reservation. Quarantined capacity cannot be readmitted until a trusted owner completes generation-safe reconciliation and verifies that no owned process, handle, transport, policy object, workspace, artifact, queue entry, or other charged state remains.
10. After supervisor or admission-controller restart, admission remains closed until the ledger is reconstructed from durable attempt identities and authoritative host state. Ambiguous, missing, duplicate, stale, or replacement state is quarantined rather than adopted or released.
11. Ownership is generation-safe. A numeric process identifier, path, queue key, or reused attempt label cannot authorize charge transfer, cleanup, release, adoption, or termination.
12. Host reserves for the supervisor, service manager or durable ownership layer, audit sink, and recovery path remain unavailable to validator admission. Recovery work must not depend on capacity already promised to validators.
13. Retry, pending-result, cancellation, audit, supervision, and cleanup work is explicitly bounded. Retrying or cancelling one attempt cannot silently create multiple reservations, unbounded queue entries, or work that lacks an owning attempt generation.
14. Missing enforcement, observation, attribution, ledger durability, or mandatory evidence fails closed. The controller does not infer capacity from stale counters or substitute observation for enforcement.

## Aggregate accounting profile

The approved profile must account for all of the following dimensions. Implementations may use multiple platform primitives, but the combined evidence must show that each dimension is reserved, enforced where applicable, attributed, observed, and reconciled without gaps.

| Dimension | Admission and reservation rule | Runtime and terminal rule |
| --- | --- | --- |
| Concurrent attempts | Reserve one generation-bound slot before launch, subject to configured maximum `N`. | Retain the slot through verified terminal cleanup or quarantine it after incomplete cleanup. |
| Aggregate CPU | Reserve an approved CPU allocation or scheduling share with protected host headroom. | Attribute validator trees and helpers; enforce the aggregate response and record pressure and breach evidence. |
| Aggregate memory | Reserve approved memory including applicable kernel-accounted overhead. | Attribute descendants and handlers; never rely only on a cooperative in-process counter. |
| Processes and threads | Reserve process and thread capacity for the complete possible tree. | Prevent descendants, reparenting, or helper creation from escaping the attempt and aggregate census. |
| Descriptors and handles | Reserve file-descriptor, handle, socket, pipe, IPC, process-control, and supervisor-transport capacity. | Account for inherited, duplicated, transferred, and cleanup-held objects until verified closure. |
| Input and staging | Reserve compressed input, expanded bytes, file and directory counts, metadata, nesting, and preprocessing work. | Stop at the applicable bound, remove partial state, and retain charges until cleanup is verified. |
| Filesystem and temporary storage | Reserve workspace, staged, created, sparse, temporary, and metadata consumption. | Enforce quotas or reviewed equivalents and retain charges for residual or quarantined artifacts. |
| stdout and stderr | Reserve bounded capture and backpressure capacity separately for both streams. | Attribute bytes, truncation, retained evidence, and queued drains; diagnostics cannot borrow unbounded audit or recovery capacity. |
| Structured results and IPC | Reserve result bytes, message counts, channel buffers, names, and supervisor parsing capacity. | Bind all state to the exact attempt; reject stale, duplicate, oversized, or cross-attempt traffic and close it during verified cleanup. |
| Dumps and diagnostics | Reserve approved artifact bytes, file counts, handler processes, and retention or quarantine capacity; a zero-dump policy reserves no validator allocation but still reserves detection and recovery capacity. | Attribute crash handlers and artifacts; unauthorized or unbounded generation fails closed. |
| Audit buffers | Reserve bounded mandatory-assurance transport, buffer, sink, and retention capacity separately from optional diagnostics. | Missing or overflowed mandatory evidence prevents success; audit cleanup and durable handoff are verified. |
| Supervisor queues | Bound admission, launch, signal, termination, cleanup, reconciliation, and evidence work queues. | Queue entries remain attempt-generation-bound and cannot outlive their verified terminal disposition without quarantine. |
| Pending results | Bound result objects awaiting validation, persistence, acknowledgement, or disposal. | A pending, ambiguous, or disconnected result retains its ownership and required capacity until deterministic disposition. |
| Retry amplification | Reserve only the approved number of retries and prevent overlap unless the aggregate profile explicitly admits distinct generations. | Each retry receives a fresh identity and workspace; failed generations remain charged until verified cleanup. |
| Cancellation backlog | Reserve termination, escalation, observation, and evidence capacity for the maximum admitted cancellation set. | Cancellation does not release capacity; release follows complete tree termination and verified cleanup. |
| Cleanup backlog | Reserve cleanup and reconciliation work, storage, handles, and quarantine headroom. | Backlog saturation closes admission; incomplete items retain their original charges and exact ownership. |
| Protected host capacity | Exclude capacity required by the supervisor, service manager or durable owner, audit sink, and recovery path from attempt-allocatable totals. | Continuously verify that aggregate pressure has not consumed the reserve; loss of reserve closes admission and triggers recovery. |

## Ownership and observation

| Responsibility | Required owner | Contract |
| --- | --- | --- |
| Enforcement owner | Trusted host-level admission controller together with the approved kernel, service-manager, cgroup, job, VM, quota, or reviewed enforcement primitives | Own the authoritative atomic ledger, activate per-attempt and aggregate controls before launch, refuse overcommit, retain or quarantine charges, and close admission on ambiguity. |
| Observation owner | Trusted external supervisor and mandatory assurance-evidence path, independent of validator cooperation | Correlate authoritative process generations, enforcement counters, ledger transitions, queues, artifacts, cleanup state, and terminal outcomes; validator-supplied logs are never sole evidence. |
| Durable recovery owner | Approved service manager, external supervisor replacement owner, or reviewed equivalent | Reconstruct the ledger after restart, reconcile exact owned state, preserve quarantines, and prove that unrelated replacement state was neither adopted nor removed. |
| Profile owner | Architecture and platform owners through the applicable open decisions | Approve numeric values, reserve policy, platform accounting semantics, enforcement points, failure behavior, and evidence expectations for an exact platform profile. |

The same component may fulfill more than one role only when the trust boundary, persistence, failure independence, and evidence path are reviewed explicitly. Validator code and validator-controlled diagnostics cannot own enforcement, observation, cleanup verification, or release.

## Mandatory evidence

Future review and acceptance require host-observed, correlation-bound, bounded, and redacted evidence. No evidence described here has been produced by this documentation task.

| Evidence family | Mandatory content |
| --- | --- |
| Immutable aggregate profile | Exact profile identity; configured `N`; every per-attempt and aggregate limit; protected reserves; queue, retry, cancellation, cleanup, and quarantine bounds; platform and policy identities; approval identity. |
| Prelaunch capability record | Proof that the admission gate, accounting scopes, enforcement controls, observation hooks, durable ledger, audit path, and cleanup owner are active before untrusted exposure. |
| Atomic ledger transition | Request identity; attempt generation; prior and resulting ledger generations; requested reservation by category; reserve calculation; admission or refusal reason; monotonic ordering; authenticated owner. |
| Attribution record | Authoritative process-tree identity; descendants and helpers; workspaces; transports; handles; artifacts; queues; results; retries; cleanup work; every ownership change or reconciliation action. |
| Aggregate enforcement trace | Per-attempt and host-level counters and enforcement events under simultaneous CPU, memory, process, thread, descriptor, staging, storage, output, result, IPC, dump, diagnostic, audit, queue, retry, cancellation, and cleanup pressure. |
| Deterministic refusal trace | Zero-capacity refusal; admission through `N`; `N+1` refusal; category-specific capacity refusal; proof that validator execution did not begin; bounded refusal evidence. |
| Protected-reserve evidence | Available and consumed supervisor, durable-owner, audit-sink, and recovery capacity before admission, during maximum pressure, and through cancellation and cleanup. |
| Terminal cleanup record | Terminal outcome; complete tree exit; handle, transport, policy, workspace, artifact, queue, result, audit, and reservation disposition; residual scans; release or quarantine decision. |
| Restart reconstruction record | Durable ledger input; authoritative live-state census; generation matching; stale, missing, duplicate, and unrelated-state handling; quarantines; reconstructed totals; admission-closed interval. |
| Independent reproduction | Exact restored-clean platform profile, repeated pressure and failure cases, raw bounded evidence, reviewer identity and conclusion, and documented limitations or variance. |

## Failure categories and required behavior

The following are proposed architecture categories; their final names and transport encoding remain subject to P42-D009, P42-D012, and P42-D013.

| Failure category | Trigger | Required behavior |
| --- | --- | --- |
| Invalid or unapproved aggregate profile | Profile identity, numeric value, reserve, enforcement point, or approval is missing, ambiguous, stale, or unsupported. | Refuse launch and emit deterministic bounded evidence. |
| Admission capacity exhausted | `N` or any aggregate category lacks allocatable capacity after protected reserves and quarantines. | Refuse before validator exposure; do not best-effort launch or create an unbounded wait item. |
| Reservation or ledger conflict | Atomic update, generation check, persistence, or ownership comparison fails. | Close admission, retain existing charges, reconcile through the durable owner, and prevent result acceptance for affected attempts. |
| Attribution or accounting loss | A descendant, handle, artifact, queue item, result, helper, or resource counter cannot be bound to the exact attempt generation. | Fail closed, quarantine affected capacity, terminate or reconcile within reviewed authority, and prevent successful result acceptance. |
| Per-attempt or aggregate breach | Enforced consumption crosses an approved ceiling or protected host reserve is threatened. | Apply the approved stop or termination response, classify the attempt as failed or indeterminate, and retain reservations through verified cleanup. |
| Supervision or ownership loss | Supervisor, launcher, controller, connection, session, service, or ownership evidence disappears or restarts. | Close admission, invalidate affected success paths, preserve or reconstruct charges, and reconcile exact state generation-safely. |
| Mandatory-evidence loss | Required audit event, counter, correlation, or cleanup proof is missing, delayed beyond policy, corrupt, ambiguous, or over capacity. | Prevent success, close admission when system-wide assurance is affected, and retain bounded recovery evidence. |
| Cleanup incomplete | Any owned process, handle, transport, policy object, workspace, artifact, queue entry, pending result, audit item, or diagnostic state remains or cannot be verified absent. | Quarantine the full affected reservation; do not reuse capacity until trusted reconciliation succeeds. |
| Reconstruction failure | Durable and observed state cannot be reconciled without guessing, or unrelated replacement state cannot be excluded. | Keep admission closed, preserve quarantines, require reviewed remediation, and emit deterministic reconciliation-failure evidence. |

## Cleanup and reservation release

Cleanup is idempotent and generation-safe for every success, rejection after partial staging, resource breach, timeout, crash, forced termination, policy breach, supervision loss, cancellation, retry, and restart. The trusted cleanup owner must:

1. terminate or reconcile the complete process tree and every helper or crash handler;
2. close and verify all attempt-bound descriptors, handles, transports, IPC names, and policy objects;
3. dispose of or quarantine workspaces, staged input, temporary files, outputs, results, dumps, diagnostics, and bounded assurance evidence according to policy;
4. remove or deterministically retain queue, retry, cancellation, pending-result, audit, and cleanup entries;
5. perform residual process, mount, descriptor, transport, artifact, and policy-state checks;
6. append the terminal cleanup outcome to the durable generation-safe ledger; and
7. release the reservation only when every required check is **VERIFIED**.

Any failed or unavailable check produces an incomplete-cleanup outcome and retains or quarantines the reservation. Recovery may release it only after a trusted owner independently reconstructs the exact generation and verifies absence or approved disposition of all charged state. Time passage, process-ID reuse, path absence alone, service restart, or manual deletion without evidence is not release proof.

## Trusted assumptions

- The P42-D002 host-kernel and approved trusted-component assumptions remain in force; compromise of the host kernel, hypervisor when applicable, firmware, trusted supervisor, admission controller, durable ledger, service manager, audit sink, or recovery owner is **OUT OF SCOPE** for this record unless the threat model is reopened.
- All launch paths are mediated by the authoritative admission controller, and operators or other services cannot bypass the ledger while making an accepted Phase 4.2 claim.
- The exact platform exposes kernel- or hypervisor-backed enforcement and accounting semantics adequate for every mandatory category, or the profile refuses launch.
- Configuration, platform, policy, artifact, and ledger identities are immutable and authenticated for the lifetime of the attempt and its cleanup.
- Host capacity advertised to the aggregate profile excludes unrelated workloads or accounts for them conservatively; protected reserves cannot be allocated outside the approved ownership model.
- The durable owner can enumerate and generation-safely reconcile all attempt state required for cleanup and restart recovery.
- Mandatory assurance evidence is protected from validator mutation and has bounded capacity reserved independently of optional diagnostics.

## Residual risks

- Kernel defects, hypervisor defects, firmware behavior, and compromise of trusted control-plane components can invalidate enforcement or accounting.
- Some kernel memory, caches, I/O contention, scheduler effects, filesystem metadata, network-independent local resources, or platform-specific objects may be delayed, shared, or only indirectly attributable; exact-profile review must document this residual surface.
- Concurrent bursts between observation and enforcement may temporarily consume headroom even when the authoritative hard control eventually acts.
- Unrelated host workloads or operator actions can reduce available capacity outside the attempt ledger unless operational controls reserve or continuously reconcile it.
- Conservative reservations and retained quarantines can deny service even when observed use is low; this is preferable to unproved overcommit but creates availability risk.
- Correlated failure, mass cancellation, audit-sink degradation, cleanup storms, and restart reconstruction can consume recovery capacity faster than expected.
- Approved numeric values may become unsafe as validator workloads, runtimes, kernels, filesystems, enforcement primitives, or operational concurrency change.
- Accounting can show bounded quantity without proving confidentiality, integrity, syscall safety, device isolation, filesystem isolation, IPC isolation, or complete confinement; the other architecture layers remain mandatory.

## Unresolved numeric limits

No numeric value is approved or inferred by this record. The following remain **OPEN** and must be established empirically, reviewed, bound to the exact P42-D001 profile, and recorded through the applicable detailed decisions:

- maximum concurrent attempts `N`, including whether separate workload classes have distinct pools;
- aggregate and per-attempt values for BUD-CPU, BUD-TIME, BUD-MEM, BUD-PROC, BUD-THREAD, BUD-FD, BUD-FS, BUD-TEMP, BUD-STDOUT, BUD-STDERR, BUD-RESULT, BUD-IPC, BUD-RETRY, BUD-GRACE, BUD-INPUT, and BUD-DUMP;
- supervisor, service-manager or durable-owner, audit-sink, and recovery reserves by applicable category;
- admission headroom, counter variance, burst tolerance, enforcement latency, and any conservative rounding rule;
- bounds for admission, supervisor, audit, pending-result, retry, cancellation, cleanup, reconciliation, and quarantine backlogs;
- cleanup and reconciliation deadlines and the conditions under which quarantined capacity requires operator remediation; and
- restart-ledger durability, checkpoint, replay, and recovery-capacity limits.

An observed average, current host capacity, vendor default, single-attempt test, or provisional platform value cannot be promoted to an approved limit by this document.

## Exact traceability mapping

These mappings reuse existing identifiers. They do not change their status or text and do not make this traceability record an accepted requirement, budget, or P42-D governance decision.

### Applicable confinement requirements

| Exact identifier | Contribution to the proposed aggregate resolution |
| --- | --- |
| CONF-CPU-001 | Supplies the per-attempt CPU ceiling and host-observed breach evidence that aggregate CPU admission must compose. |
| CONF-MEM-001 | Supplies the per-attempt memory ceiling and recovery behavior that aggregate memory admission must compose. |
| CONF-PROC-001 | Binds accounting and control to an authoritative process or process-tree generation. |
| CONF-CHILD-001 | Requires descendants to remain prevented or contained and accounted. |
| CONF-HANDLE-001 | Requires explicit descriptor and handle inheritance and supports bounded aggregate object accounting. |
| CONF-FS-002 | Bounds writes to approved areas whose aggregate filesystem use must be reserved and enforced. |
| CONF-TEMP-001 | Makes temporary storage attempt-owned, bounded, observable, and subject to residual verification. |
| CONF-INPUT-001 | Requires bounded compressed, expanded, staged, and structural input accounting before launch and during staging. |
| CONF-OUTPUT-001 | Requires separate bounded stdout and stderr capture and overflow behavior. |
| CONF-OUTPUT-002 | Requires bounded, attempt-bound structured-result transport and deterministic rejection. |
| CONF-IPC-001 | Requires exact attempt-bound channels and cross-attempt isolation for aggregate IPC and transport accounting. |
| CONF-DUMP-001 | Requires dump and diagnostic artifacts and handlers to be disabled or bounded, confined, accounted, and cleaned. |
| CONF-SUPERVISOR-001 | Requires durable ownership, restart reconciliation, and generation-safe treatment of preexisting attempt state. |
| CONF-CLEANUP-001 | Requires cleanup or reconciliation of every owned process, transport, workspace, artifact, policy, and IPC state. |
| CONF-CLEANUP-002 | Prevents success when cleanup or restart-reconciliation verification is unavailable or fails. |
| CONF-OBS-001 | Requires mandatory trusted, redacted, correlation-bound lifecycle and policy evidence. |
| CONF-FAILCLOSED-001 | Requires deterministic prelaunch refusal whenever admission, enforcement, accounting, or evidence prerequisites are missing. |
| CONF-PORTABILITY-001 | Binds control and accounting claims to an exact supported platform and refuses unsupported profiles. |

### Applicable resource budgets

| Exact identifier | Aggregate use |
| --- | --- |
| BUD-CPU | Reserve and enforce aggregate validator CPU while preserving supervisor and recovery compute. |
| BUD-TIME | Bound slot occupancy, queued terminal work, and the duration of attempt-owned resource exposure. |
| BUD-MEM | Reserve and enforce aggregate memory with protected control-plane headroom. |
| BUD-PROC | Bound the total attributed process population across attempts. |
| BUD-THREAD | Bound the total attributed thread population where the exact platform can enforce it. |
| BUD-FD | Bound descriptors and applicable handles held by validator trees and attempt-owned control state. |
| BUD-FS | Bound aggregate staged, created, sparse, metadata, and retained workspace consumption. |
| BUD-TEMP | Bound aggregate scratch and cleanup-retained temporary storage. |
| BUD-STDOUT | Bound aggregate stdout capture, backpressure, and retained evidence. |
| BUD-STDERR | Bound aggregate stderr capture, backpressure, and retained evidence. |
| BUD-RESULT | Bound aggregate structured-result buffers, validation work, and pending results. |
| BUD-IPC | Bound aggregate approved message count and attempt-owned transport state. |
| BUD-RETRY | Prevent retry amplification and overlapping generations outside explicit admission. |
| BUD-GRACE | Reserve termination and forced-cleanup capacity through bounded escalation. |
| BUD-INPUT | Bound aggregate compressed input, expansion, extraction, structural counts, and staging work. |
| BUD-DUMP | Bound aggregate dump, diagnostic, handler, retention, and quarantine consumption. |

### Applicable governance decisions

| Exact identifier | Contribution to the proposed aggregate resolution |
| --- | --- |
| P42-D003 | Owns the confinement-composition question whose aggregate-governance gap this record proposes to address. |
| P42-D008 | Must select exact per-attempt and aggregate enforcement primitives and numeric resource profiles. |
| P42-D009 | Must select the trusted owner of deadlines, retries, cancellation, termination, and deterministic categories. |
| P42-D010 | Must select generation-safe process-tree identity, control, termination, and attribution. |
| P42-D012 | Must select bounded input, output, result, log, audit, and backpressure protocols. |
| P42-D013 | Must select immutable profile configuration and mandatory audit evidence, retention, and availability policy. |
| P42-D018 | Must select where input, expansion, and aggregate workspace bounds are enforced before and during staging. |
| P42-D019 | Must select durable ownership and restart reconstruction for attempts, cleanup, and reservations. |
| P42-D021 | Must select exact per-attempt channel identities and cross-attempt isolation needed for correct attribution. |
| P42-D022 | Must select dump, diagnostic, crash-handler, retention, quarantine, and cleanup policy. |

P42-D001 approval and exact-platform reconciliation remain later dependencies for final P42-D003 approval. P42-D016 supplies the independent-review governance question. Neither is resolved here.

## Approval record and continuing limitations

The project owner approved the immutable extraction identified above after independent review. The following limitations continue to apply:

- an independent reviewer verifies that the contract covers every mapped requirement, budget, decision, lifecycle state, failure path, trust assumption, and residual risk without silently creating accepted identifiers;
- approval is limited to the architecture-level traceability invariant; numeric and exact-platform work remains open;
- the future approval text identifies what is approved as an architecture invariant and what numeric and exact-platform work remains open;
- owners and enforcement, observation, durability, cleanup, audit, and recovery boundaries are unambiguous;
- the evidence prerequisites in the [gap-resolution evidence plan](phase42-d003-gap-resolution-evidence-plan.md) are accepted as future gates, while no test result is claimed here; and
- any requested exception to deterministic refusal, quarantine, protected reserves, generation-safe ownership, or verified-release semantics is either removed or explicitly rejected as incompatible with this recommendation.

Both D003-TRACE-AGG-001 and D003-TRACE-DEVICE-001 are already **APPROVED**, and D003-GAP-AGG-001 and D003-GAP-DEVICE-001 are already **RESOLVED** only by their corresponding immutable approved records. The remaining P42-D003 blockers are P42-D001 approval, exact-platform reconciliation, independent review of the reconciled P42-D003 package, and explicit project-owner action on P42-D003.

## Reopen triggers

This approved record must be reopened when:

- P42-D002 changes the hostile-validator, arbitrary-native-code, trust, or out-of-scope model;
- the production OS, kernel, runtime, service manager, cgroup or job hierarchy, VM layer, filesystem, quota mechanism, audit sink, deployment topology, or host-sharing model changes;
- an enforcement or accounting primitive changes semantics, becomes advisory, omits descendants or kernel-owned consumption, or cannot be observed independently;
- a new resource, queue, transport, artifact, diagnostic, helper, retry, cancellation, cleanup, or recovery path is introduced;
- approved numeric budgets, concurrency, workload classes, reserves, retention, or quarantine policy changes;
- testing finds overcommit, descendant escape, cross-attempt attribution, ledger races, protected-reserve erosion, cleanup leakage, stale release, unreconstructable state, or nondeterministic refusal;
- supervisor, admission-controller, durable-ledger, audit, or recovery ownership changes;
- mandatory evidence no longer supports independent reconstruction or becomes validator-controlled; or
- an exact platform cannot enforce or evidence a mandatory invariant and would require a best-effort downgrade.

## Nonclaims and project state

**OUT OF SCOPE:** selecting exact mechanisms, approving numeric limits, approving P42-D001, approving P42-D003, implementing controls, implementing or running tests, qualifying a platform, deploying, merging, or changing accepted requirement and budget text.

**PROHIBITED CLAIM:** this approval proves aggregate safety, prevents host exhaustion in an implementation, shows that any counter or mechanism works, demonstrates test passage, approves an aggregate profile, approves P42-D003, or authorizes Phase 4.2 implementation.

Phase 4.1 remains **REPORTED as rejected**. VAL-RESULT-001 remains **OPEN**. Phase 4.2 remains **PLANNED**. P42-D001 remains **OPEN** and provisional. P42-D002 remains **APPROVED** and bound to its immutable approved content. P42-D003 remains **OPEN** and **RECOMMENDED**. P42-D004 through P42-D022 remain **OPEN**. No Phase 4.2 implementation exists, no Phase 4.2 tests have been implemented or run, and implementation remains prohibited while Phase 4.1 is rejected.
