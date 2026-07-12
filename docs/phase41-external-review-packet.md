# Phase 4.1 external review packet

## Summary and objective

The Citizen Audit Execution Engine is a governed execution subsystem. Phase 4.1 focuses on the validator worker: authoritative source selection, closure loading, JavaScript realm/facade restrictions, CommonJS loader behavior, result normalization, and worker transport. The objective of this packet is to enable an independent software-security or runtime reviewer to reproduce, challenge, and classify evidence without relying on chat history or checkpoint prose.

The authoritative review baseline is `e0e14e199c86a7a1e24ece8edd7d8f1090e735ef`. Its branch status is **REJECTED** and PR #21 remains under HOLD under the controlling project status. Do not treat this packet as a request to activate, deploy, or change governance.

## Scope and exclusions

| In scope | Excluded / OUT OF SCOPE |
| --- | --- |
| Validator registry/hash binding; closure verification and source capture; worker realm and facades; CommonJS cache/cycles/generations; result serialization and private-channel parsing; attempt/result lifecycle. | OS process confinement; filesystem policy enforcement by the OS; network denial; child-process containment; CPU/memory cgroups or equivalents; syscall controls; deployment review; GitHub CI or third-party certification. |

The JavaScript-level trust boundary is shown in the [assurance case](phase41-assurance-case.md#objective-and-boundary). Future OS evaluation belongs only in [Phase 4.2 planning](phase42-os-confinement-planning.md).

## Repository setup

1. Check out commit `e0e14e199c86a7a1e24ece8edd7d8f1090e735ef` in a clean worktree.
2. Record `git rev-parse HEAD`, `git status --short`, runtime version, OS, and package-lock-derived dependency state.
3. Read this packet, the [assurance case](phase41-assurance-case.md), [invariant catalog](phase41-invariant-catalog.md), and [checkpoint history](phase41-checkpoint-history.md).
4. Inspect the named source and test entry points before drawing conclusions from reports.
5. Reproduce only defensive validation evidence within an authorized local review environment. Do not use production systems, credentials, or external targets.

## Relevant files and test entry points

| Purpose | Paths / commands to inspect |
| --- | --- |
| Attempt and validation lifecycle | `kernel/execution/orchestrator-core.js`, `kernel/execution/validation-cycle.js`, `kernel/execution/validation-result-store.js`, `kernel/execution/state-machine.js`. |
| Worker and loader | `kernel/execution/validator-worker.js`, `kernel/execution/validator-closure.js`, `kernel/execution/validator-limits.js`. |
| Registry and contracts | `kernel/execution/validators/index.js`, `kernel/execution/validators/registry-core.js`, `kernel/execution/validators/registry.json`. |
| Primary regressions | `node --test --test-concurrency=1 tests/validator-security.test.js`; `node --test --test-concurrency=1 tests/execution-orchestrator.test.js`. |
| Reported evidence | `docs/phase41-validator-review.md`, `docs/phase41-coverage-matrix.md`, and commits listed in [history](phase41-checkpoint-history.md). |

Do not infer a pass result from the reports. They are REPORTED until you execute and preserve your own command output. Classify source facts, test reproduction, and design inferences separately using the [status rules](phase41-assurance-index.md#evidence-status-labels).

## High-priority questions

1. Does a valid `validatorSetHash` prove the exact validator-entry generation that produced each transported result remains valid at acceptance time?
2. What occurs if that entry generation becomes invalid between validator execution, private-channel success transport, validation-result persistence, and transition to a successful attempt outcome?
3. Is a generation token represented in the worker envelope, validation phase, durable result artifact, and execution-attempt ledger transition? If not, can stale success be rejected fail-closed?
4. Are `VAL-GENERATION-001` loader protections incorrectly being used as evidence for [VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation)?
5. Do reported realm, loader, channel, result-bound, and cleanup tests reproduce on the intended runtime and platform matrix?

## Current unresolved issue

[VAL-RESULT-001](phase41-invariant-catalog.md#val-result-001-attempt-success-is-bound-to-a-valid-validator-entry-generation) is OPEN. Once the exact validator-entry generation used by an attempt becomes invalid, that attempt must never be accepted or transported as successful. The current documentation found module-cache generations in the worker and a set hash in attempt bindings, but no established attempt-level generation binding. Treat this as a review blocker.

## Known limitations

The repository reports Windows-host checks and notes that Linux-host termination reproduction was not local; that is REPORTED. Process confinement has not started. Passing regression cases do not cover all possible runtime interleavings. The trusted computing base includes the host runtime, Node worker/vm behavior, repository checkout, and harness code. No absolute security conclusion is justified.

## Expected reviewer deliverables

- A reproduction record: commit, parent, OS/runtime versions, commands, exit status, and preserved output hashes or logs.
- An invariant-by-invariant classification using the stable IDs in the [catalog](phase41-invariant-catalog.md).
- A design analysis of the OPEN attempt-generation/result binding, including whether it is actually absent, insufficient, or demonstrably broken.
- Minimal, non-offensive regression recommendations for any confirmed gap, and an explicit statement of assumptions/limitations.
- A conclusion that distinguishes reviewed evidence from unverified claims. Do not confer acceptance or any certification status.

## Responsible disclosure and prohibited claims

Report suspected defects privately through the project’s existing authorized maintainer channel; do not include credentials, private contact details, exploit instructions, or live-target details in repository documentation. Do not claim deployment approval, GitHub CI certification, third-party certification, OS-level confinement, complete sandbox security, or that Phase 4.1 is accepted. See the [handoff](phase41-documentation-handoff.md) for branch limits.
