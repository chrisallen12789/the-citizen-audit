# Phase 4.2 OS-confinement architecture

## Status and objective

**PLANNED.** This architecture defines the future OS-level confinement boundary around the validator worker for The Citizen Audit Execution Engine. It is a design and acceptance package, not an implementation record. The governing requirements are in [the confinement requirements](phase42-confinement-requirements.md), candidate approaches are compared in [the platform decision matrix](phase42-platform-decision-matrix.md), and unresolved choices are recorded in [the handoff register](phase42-open-decisions-and-handoff.md).

**VERIFIED:** the repository contains the high-level [Phase 4.2 planning foundation](phase42-os-confinement-planning.md) and the [Phase 4.1 assurance case](phase41-assurance-case.md). **REPORTED:** Phase 4.1 is rejected with [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation) OPEN. This package does not alter that status.

**PROHIBITED CLAIM:** this document must not be read to say that OS confinement exists, has been tested, is accepted, or is approved for deployment.

## Boundary definition

The intended boundary starts when the execution orchestrator prepares an immutable validation request and asks a supervisor to launch a confined validator process. It ends when an active accountable owner has validated a bounded result, terminated and accounted for the exact process tree, and completed cleanup. If the immediate supervisor or its connection fails, the boundary remains responsible for containment and later reconciliation rather than allowing an unowned validator tree to continue. The supervisor, host operating system, and selected enforcement mechanisms are outside the validator's authority.

| Layer | Intended role | Not equivalent to |
| --- | --- | --- |
| JavaScript-realm controls | Restrict values and APIs visible to validator JavaScript. | An OS security boundary. |
| Node worker isolation | Separate work and messaging within a Node runtime. | A separate process, filesystem policy, or network policy. |
| Process isolation | Separate validator address space and lifecycle from its supervisor. | Kernel-enforced restrictions by itself. |
| Kernel-enforced isolation | Enforce selected identity, filesystem, network, resource, and process rules. | Complete isolation or an absolute-security claim. |
| Deployment-level controls | Constrain host image, credentials, service configuration, and operational access. | Proof that every in-process component is trustworthy. |

The details of the process protocol are specified in [the process-supervision contract](phase42-process-supervision-contract.md). Resource limits are a separate future framework in [the resource budget](phase42-resource-budget.md).

## Trust model

### Trusted computing base

The future trusted computing base (TCB) includes the selected host kernel and its configured enforcement features; the process supervisor and execution orchestrator; the executable launcher and its CONF-HANDLE-001 inherited-handle policy; the selected runtime; the approved validator artifact and dependency provenance verifier; the bounded-input and staging verifier; the result parser; the logging/audit sink; and the host account, service manager, watchdog, broker, runtime, or VM owner selected to enforce CONF-SUPERVISOR-001. This is an architectural assumption, not evidence that these components are defect-free.

### Trusted host components

Trusted host components construct the allowlisted environment; validate, safely stage, and bound launch input; bind verification to exact executed bytes; set budgets; construct the exact inherited-handle set; establish durable tree ownership before exposure; start the validator; observe its generation-safe process-tree identity; reconcile after restart; validate bounded output; and clean resources. They retain authority over host credentials, repository state, deployment configuration, audit records, supervisor-owned handles, ownership/policy objects, and all paths outside the future validation workspace. A numeric PID alone is not sufficient evidence of exact process identity.

### Untrusted validator components

The validator executable, its loaded modules, input-derived data, output, diagnostics, descendants it attempts to create, and all behavior after launch are untrusted for confinement purposes. JavaScript-level validator controls described by Phase 4.1 may continue to be useful, but they do not remove the need for the intended OS boundary.

## Lifecycle

### Launch sequence

1. The orchestrator supplies a request, provenance references, approved policy, and bounded launch-input manifest to the supervisor.
2. The supervisor validates and accounts for structured input, staged artifacts, configuration, metadata, and transport frames against CONF-INPUT-001, BUD-INPUT, and the OPEN P42-D020 staging policy before launch; it verifies platform identity, executable/dependency provenance, exact-byte binding, staging safety, and all required enforcement capabilities.
3. The supervisor creates a unique, bounded validation workspace and immutable configuration, then establishes the reviewed ownership and parent-death/restart-reconciliation arrangement required by CONF-SUPERVISOR-001 before exposing validator execution.
4. It constructs an allowlisted environment and the CONF-HANDLE-001 exact inherited-handle set, configures the selected candidate enforcement mechanisms, and starts the isolated process with a monitored generation-safe control identity. Human-readable PID data may be recorded, but is not the authoritative identity.
5. The supervisor records a launch audit event and applies the startup deadline. Failure at any step is governed by CONF-FAILCLOSED-001 in [the confinement requirements](phase42-confinement-requirements.md).

### Validation sequence

1. The validator receives only the approved input transport and working directory.
2. The supervisor measures configured budgets and captures bounded stdout, stderr, and structured result transport.
3. On a parseable result and normal exit, the supervisor verifies that the exact preflight-verified bytes were executed, exit semantics, provenance binding, active ownership, output bounds, and cleanup preconditions before accepting success.
4. A failure, policy breach, malformed result, or missing evidence is categorized deterministically and fails closed.

### Normal termination

The validator exits with a defined success or validation-failure code; the supervisor closes transports, verifies the complete process tree has exited, removes the workspace, emits redacted audit data, and only then returns a final outcome.

### Abnormal termination and cleanup

Startup timeout, validation timeout, crash, signal, resource breach, malformed output, oversized output, or cleanup error triggers containment. The supervisor records the cause, stops input/output transport, requests graceful termination for the configured grace period, forcibly terminates remaining descendants, verifies no residual process or temporary artifact remains within its authority, and reports failure. Cleanup failure is not success; see CONF-CLEANUP-002 in [the confinement requirements](phase42-confinement-requirements.md).

### Supervision loss and restart reconciliation

Supervisor crash, launcher crash, orchestrator disconnect, controlling-service restart, host-side cancellation, parent termination, lost result transport, and a partially completed launch are future terminal containment conditions under CONF-SUPERVISOR-001. The reviewed ownership mechanism must terminate or quarantine the exact owned tree so it cannot silently run without an accountable owner. After restart, the replacement supervisor reconciles preexisting processes, workspaces, transports, and policy objects against exact process-generation and attempt identity; it must neither adopt nor kill an unrelated replacement process based only on PID. Loss of supervision invalidates the attempt and prevents successful result transport.

## Protected host authorities and expected guarantees

Protected authorities include host filesystem paths and repository state; network credentials and host connectivity; inherited environment secrets; open files, directory descriptors, sockets, named pipes, IPC channels, process-control objects, supervisor transports, and audit handles; user/service-account privileges; process creation and descendants; ownership and watchdog policy objects; CPU, memory, storage, descriptor, input, and output capacity; audit log integrity; and validator artifact identity including exact executed bytes.

**REQUIRED:** a selected implementation must measurably deny or constrain each authority according to the requirements, including explicit inherited-handle control, bounded and safely staged launch input, exact-byte provenance, default network denial, generation-safe process identity, supervision-loss containment, bounded resources, controlled process trees, restart reconciliation, and fail-closed lifecycle handling. The intended guarantee is limited to the reviewed configuration and stated platform assumptions. It does not guarantee safety against kernel, runtime, supervisor, configuration, or side-channel defects.

## Assumptions, non-goals, and residual risks

Assumptions are that a supported host can enforce the selected controls, the TCB is configured correctly, a reviewed ownership mechanism remains effective across immediate-supervisor loss or can reconcile safely after restart, the supervisor can identify and terminate the relevant process tree, and independent reviewers can reproduce evidence. **OPEN:** authoritative production operating system, exact mechanism set, numerical budgets, and the ownership/restart mechanism are not yet chosen.

**OUT OF SCOPE:** changing Phase 4.1 code or tests; implementing any confinement mechanism; certifying a third party; selecting a production deployment; and proving complete isolation. This architecture does not authorize validator functionality changes.

Residual risks include defects in the kernel, runtime, container/runtime stack where used, supervisor, policy configuration, hardware and timing side channels, host-wide denial of service outside quotas, logging leaks, and platform differences. A container alone is not treated as a complete security boundary.

## Phase relationships and review gate

Phase 4.1 concerns JavaScript-level source, realm, loader, and result controls; it remains **REPORTED** as rejected with its blocker OPEN according to [the assurance index](phase41-assurance-index.md). Phase 4.2 is a separate **PLANNED** OS-confinement layer and cannot convert Phase 4.1 evidence into OS-level evidence.

Later deployment phases may consume an approved Phase 4.2 design, platform decision, evidence set, and operational configuration. They must re-evaluate host image, credentials, logging, deployment topology, and runtime version. Implementation must not begin until the decision register and this package have explicit architectural review and approval.
