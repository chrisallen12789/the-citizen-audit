# Phase 4.2 OS confinement planning

## Status and purpose

**PLANNED only.** Phase 4.2 has not started. This document frames later evaluation; it does not select, implement, or approve a confinement technology. Phase 4.1 remains blocked on [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation), according to an imported independent checkpoint review whose raw record is not contained in this branch, independently of this future work.

JavaScript-level realm controls described in the [assurance case](phase41-assurance-case.md) do not supply OS-level process, filesystem, network, or resource boundaries.

## Requirements

| Evaluation area | Requirement to evaluate | Acceptance evidence to plan |
| --- | --- | --- |
| Process isolation | Validator execution should have an explicit process boundary appropriate to the reviewed threat model. | Design review, process-tree observations, and reproducible termination tests. |
| Filesystem boundaries | Validator should receive only necessary read/write paths with a defined temporary-storage policy. | Path-access matrix, negative tests, cleanup record, and provenance of mounted/copied inputs. |
| Network denial | Validator network access should be denied unless a future governed exception specifies otherwise. | Reproducible positive/negative connectivity observations and configuration review. |
| Child processes | Child-process creation should be prevented or contained with descendants governed. | Spawn-attempt evidence, process-tree capture, and cleanup verification. |
| CPU limits | A noncooperative validator must not consume unbounded CPU. | Measured limit behavior and safe timeout/termination evidence. |
| Wall-clock limits | Execution has a monotonic deadline independent of validator cooperation. | Boundary tests with recorded timing assumptions. |
| Memory limits | Memory exhaustion should fail closed within defined operational behavior. | Controlled limit tests and host-impact assessment. |
| Output limits | stdout/stderr and result transport remain bounded across the process boundary. | Byte-accounting evidence and abnormal-output cleanup tests. |
| Temporary storage | Scratch data is isolated, bounded, and removed after normal/abnormal termination. | Lifecycle trace and cleanup tests. |
| Environment variables | Secrets and host-specific variables are minimized or absent. | Environment allowlist/diff evidence; no secret values in test logs. |
| Syscall restrictions | Where the target platform supports them, syscall exposure is explicitly evaluated. | Platform-specific policy review and negative evidence suitable for the mechanism. |
| Process-tree termination | Timeout/failure must terminate descendants, not only a direct launcher. | Process-tree and orphan check after normal/failure paths. |
| Abnormal cleanup | Crashes, forced termination, and startup failures leave no unsafe artifacts/locks. | Recovery matrix and post-condition checks. |
| Observability | Confinement decisions and failures are reviewable without disclosing sensitive data. | Structured event/provenance design and retention review. |
| Reproducible testing | Tests run in documented Linux environments and distinguish local from remote evidence. | Versioned environment recipe and independent reproduction record. |

## Design questions and candidate mechanisms

| Area | Open design questions | Candidate mechanisms to evaluate, not prescribe |
| --- | --- | --- |
| Linux assumptions | Which supported distributions, kernels, container runtimes, and privilege models are in scope? | Dedicated unprivileged process, container runtime, namespaces, cgroups, seccomp, MAC frameworks, service manager controls. |
| Filesystem and temporary data | Read-only source? How are candidate state and scratch data supplied and erased? | Bind mounts, copy-in/copy-out staging, private temporary directory, namespace mounts, explicit allowlists. |
| Network and child processes | Is denial enforced by namespace, policy, or broker? Are helpers ever legitimate? | Network namespace, firewall/policy primitives, executable allowlisting, PID namespace, brokered helper. |
| Resource limits | Which limits are hard versus advisory, and how are host-wide effects handled? | cgroup v2, rlimits, job/service controls, watchdog. |
| Portability | What equivalent controls exist for non-Linux developer hosts and CI? Which claims remain Linux-only? | Documented unsupported modes, VM-based test environment, platform adapters after review. |
| Observability | What can be logged without leaking validator inputs or environment secrets? | Structured status events, redacted diagnostics, resource counters, provenance hashes. |

No candidate above is a final technology choice. Selection requires repository evidence, threat-model review, platform decision, and subsequent design review.

## Unresolved platform decisions and residual risks

Linux is the anticipated primary evaluation platform, but its exact kernel/distribution/container assumptions are OPEN. Portability, local developer behavior, privileged versus rootless operation, filesystem semantic differences, and reliable process-tree cleanup remain OPEN. Even after later confinement, residual risks may include kernel/runtime defects, misconfiguration, side channels, denial of service within configured quotas, trusted-broker defects, and incomplete observability. Future acceptance evidence must state these limits rather than claim complete isolation.

## Gate to later work

Before Phase 4.2 implementation begins, record a reviewed threat model, supported-platform decision, measurable requirements, and test environment. Keep Phase 4.2 evidence separate from Phase 4.1 JavaScript-level claims. The [external review packet](phase41-external-review-packet.md) remains the Phase 4.1 reproduction entry point.
