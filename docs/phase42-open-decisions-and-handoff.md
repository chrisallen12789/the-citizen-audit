# Phase 4.2 open decisions and handoff

## Decision register

**OPEN:** this register prevents implementation from beginning on unstated assumptions. Each decision requires explicit architectural review and recorded approval before it becomes an implementation constraint. Candidate mechanisms are described in [the platform decision matrix](phase42-platform-decision-matrix.md).

| ID | Question and why it matters | Candidate options | Required evidence | Dependency | Owner role | Status | Prohibited premature assumption |
| --- | --- | --- | --- | --- | --- | --- |
| P42-D001 | Which operating system is the authoritative production baseline? It defines available controls and claims. | Linux profile; another OS; VM-hosted profile. | Supported-host inventory and threat-model review. | Deployment owners. | Architecture owner | OPEN | Linux developer familiarity equals production support. |
| P42-D002 | What threat model and attacker capabilities are in scope? It determines meaningful guarantees. | Validator-only; local user; supply-chain; service compromise scopes. | Reviewed threat model and asset map. | P42-D001. | Security architecture owner | OPEN | A generic sandbox threat model is sufficient. |
| P42-D003 | Which confinement mechanism combination satisfies the requirements? | Direct OS primitives; namespaces/cgroups/filtering; container; VM; combination. | Requirement-to-control mapping and negative tests. | P42-D001, P42-D002. | Architecture owner | OPEN | A container alone is the approved boundary. |
| P42-D004 | Is a container runtime a required dependency? It changes TCB and operations. | No container; rootful runtime; rootless runtime; VM image. | Dependency, patching, and lifecycle assessment. | P42-D003. | Platform owner | OPEN | Runtime presence proves isolation. |
| P42-D005 | What service-account model provides least privilege? | Dedicated account; service manager identity; rootless mapping; VM guest account. | Identity/ACL tests and credential review. | P42-D001, P42-D003. | Platform security owner | OPEN | Current developer identity is acceptable. |
| P42-D006 | How are validator artifacts, inputs, mounts, and temporary storage exposed? | Read-only mounts; copy-in/out; private image; bounded workspace. | Access matrix, cleanup, and provenance tests. | P42-D003, P42-D014. | Runtime design owner | OPEN | Working directory is harmless by default. |
| P42-D007 | Where is network denial enforced? | Network namespace; host firewall/policy; runtime policy; VM network. | Negative connectivity tests and configuration capture. | P42-D001, P42-D003. | Network security owner | OPEN | No application network API means no network authority. |
| P42-D008 | How are CPU, memory, count, descriptor, and storage budgets enforced? | cgroups; rlimits; job/service controls; VM allocation; combination. | Controlled exhaustion evidence and host-impact assessment. | P42-D001, P42-D003. | Platform owner | OPEN | Observing usage is enforcing a limit. |
| P42-D009 | Which supervisor owns deadlines, exit taxonomy, retries, and termination grace? | Orchestrator; dedicated launcher; service manager; layered ownership. | Fault timelines and deterministic-category review. | P42-D003. | Execution architecture owner | OPEN | Validator-provided timeout or exit code is authoritative. |
| P42-D010 | How are process trees identified and terminated? | PID namespace; cgroup/job; process group; service scope; combination. | Descendant and orphan-negative tests. | P42-D001, P42-D003. | Runtime design owner | OPEN | Killing a direct child cleans descendants. |
| P42-D011 | What syscall-filter scope is required and where supported? | None with documented rationale; minimal profile; broader profile; platform equivalent. | Threat-model mapping and syscall-negative evidence. | P42-D001, P42-D002. | Security architecture owner | OPEN | A filter profile is portable or complete. |
| P42-D012 | What logging and input/output boundary is safe and bounded? | Pipes; framed IPC; files; broker; structured audit sink. | Schema, size, redaction, malformed-output tests. | P42-D006, P42-D009. | Execution architecture owner | OPEN | stdout/stderr can carry trusted success. |
| P42-D013 | Which immutable configuration, environment policy, and audit retention model apply? | Minimal allowlist; profile manifests; external audit sink; local redacted log. | Environment/redaction and audit availability review. | P42-D001, P42-D012. | Operations/security owner | OPEN | Ambient host configuration is acceptable input. |
| P42-D014 | How is executable and dependency provenance bound to a launch? | Signed/hashed artifact; immutable image digest; checkout manifest; brokered store. | Rebuild record and mismatch-negative test. | P42-D006. | Supply-chain owner | OPEN | A filesystem path identifies trusted bytes. |
| P42-D015 | Which development platforms and CI environments are supported? | Linux-only; VM path; native adapters; unsupported refusal. | Capability matrix and reproduced platform evidence. | P42-D001, P42-D003. | Developer experience owner | OPEN | Development behavior equals production behavior. |
| P42-D016 | What external review is required before implementation and before later acceptance? | Internal architecture review; independent review; platform/security sign-off; staged review. | Review criteria, artifacts, and recorded conclusions. | P42-D002 through P42-D015. | Governance owner | OPEN | This documentation package is approval. |

## Handoff

This branch created the following **PLANNED** architecture package:

- [Architecture](phase42-confinement-architecture.md)
- [Requirements](phase42-confinement-requirements.md)
- [Platform decision matrix](phase42-platform-decision-matrix.md)
- [Process-supervision contract](phase42-process-supervision-contract.md)
- [Resource-budget framework](phase42-resource-budget.md)
- [Test and evidence plan](phase42-test-and-evidence-plan.md)
- This decision register and handoff

The starting commit is `ee7434f2dbe76fa5b1de35cbbbde7c0bd29ea4ea`. The package adds documentation only; no code or tests are changed. **REPORTED:** Phase 4.1 remains blocked because VAL-RESULT-001 remains OPEN, as recorded by [the Phase 4.1 assurance index](phase41-assurance-index.md). Phase 4.2 remains **PLANNED**. This branch must not be merged automatically. Implementation must not begin until this decision package is reviewed and approved, and all status references must be reconciled after Phase 4.1 changes.

**OUT OF SCOPE:** modifying the blocked Phase 4.1 implementation, changing governance state, or claiming deployment approval. **PROHIBITED CLAIM:** this handoff, its future review, or any candidate mechanism is evidence that confinement is implemented, accepted, certified, production secure, or completely isolated.
