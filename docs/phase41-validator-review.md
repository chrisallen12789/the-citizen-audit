# Phase 4.1 — Semantic-Validator Adversarial Review

Base checkpoint: `b461a0c` · Review commit: (this checkpoint) · Ruling: **HOLD — CODE CORRECTIONS VERIFIED; DEPLOYMENT CERTIFICATION REQUIRED**

## Method
Attacks driven directly against the real modules: result handling via
`kernel/execution/validation-cycle.js` (`runValidationPhase`) and registry
integrity via `kernel/execution/validators/index.js` (`loadValidatorRegistry`).
Every abnormal outcome was reproduced before any code change. Regressions live in
`tests/validator-security.test.js` (19/19).

## Security model (verified)
Validators are **integrity-bound trusted code**: the registry loader rejects
path-escape, duplicate ids, version/semantic/action-binding mismatch, and
malformed registries; each module is re-read and re-hashed on every execution and
its `moduleHash` is folded into `validatorSetHash`, which is bound into the
immutable execution attempt. Semantic validation is mandatory per action
(fail-closed unless a governed `nonSemantic` opt-out with justification). Post-write
validation runs against **live post-write state**; failure triggers Phase-2
rollback. Validation results are computed by the orchestrator itself and bound
into `validationResultHash`, so results cannot be caller-supplied or replayed.

## Findings

### 1. Symlinked validator module accepted — CORRECTED (severity: medium, defense-in-depth)
- **Attack:** replace a validator module file inside the validators dir with a
  symlink to a contract-valid module outside the reviewed set.
- **Reproduced:** loader accepted it (the path-escape check only constrains the
  entry path; read/require follow the symlink).
- **Correction:** `loadValidatorRegistry` now `lstat`s the module and rejects any
  non-regular/symlinked file before hashing — consistent with the symlink
  rejection used elsewhere (`institutionFile`, decision-store).
- **Regression:** "symlinked validator module is rejected".
- **Result:** fails closed; real registry still loads 8 validators; suite green.

### 2. Synchronous validator hang defeats the timeout — PARTIAL / RESIDUAL (severity: low-exploitability)
- **Attack:** a validator whose `validate()` runs a synchronous busy/infinite loop.
- **Reproduced:** 1500 ms of synchronous work under a 300 ms timeout returned
  `passed` in ~1501 ms — `Promise.race` cannot preempt synchronous work; an
  infinite loop would hang the orchestrator.
- **Why not fixed here:** true preemption requires a worker thread / child process
  with a hard `terminate()`. The validator context carries function closures
  (`createCandidateState`), so it cannot be structure-cloned; a correct worker
  executor must **reconstruct** the context inside the worker from the serializable
  plan/writes/manifest. That is a substantial change to the core, 201-test
  execution path; rushing it under review would risk destabilizing verified
  behavior. **Not claimed fixed.**
- **Mitigation (why low-exploitability):** validators are hash-verified, governed,
  and (now) symlink-rejected — a hanging validator cannot be introduced without
  defeating controls already verified. The async-timeout path *does* fail closed.
- **Recommended hardening:** worker-thread/child-process validator executor with a
  hard timeout; context reconstructed from serializable inputs. Tracked as a
  residual; HOLD retained.

### 3. Validator-result `checkedObjects` not enforced ⊇ affectedObjects — PARTIAL (documented)
- Coverage of affected objects is enforced at **plan build** (write-set must cover
  affected objects) and exact-materialization verifies live state, so an omitted
  affected object is caught there. The validator's own `checkedObjects` is recorded
  but not separately enforced. Recommended (optional) defense-in-depth: assert
  semantic `checkedObjects ⊇ plan.affectedObjects`.

## Verified fail-closed (regressions added)
non-object / null / array / invalid-status / missing-status / success-with-problems
/ failure-without-problem / malformed-problems / throws / async-timeout — all
`failed`. Loader: malformed registry / duplicate id / wrong-action / semantic-flag
/ version / path-escape — all rejected; module tamper changes `validatorSetHash`.

## Observed totals (this checkpoint)
validator 19/19 · execution 201/201 · runtime-isolation 48/48 · runtime-integration
28/28 · fault 31/31 · bypass self-test 29/29 · capability audit passed · JS syntax
clean · QA 159 files.

---

## Update — preemptive execution boundary (finding 2 now CORRECTED)

Architecture selected: **`worker_threads` per-validator boundary** with a hard
`worker.terminate()` deadline (`kernel/execution/validation-cycle.js` +
`kernel/execution/validator-worker.js`). Rationale: current validators do not use
the context's function closures (candidate-state), so the context is fully
serializable; the worker reconstructs it from `rootDir/phase/transaction/plan/
writeSetHash/attemptId/manifest`, reads live post-write state from `rootDir`, and
proves **exact-verified-bytes execution** by re-reading, re-hashing, and compiling
the exact bytes (closing the verify→execute TOCTOU). Child-process was not needed;
worker threads give hard termination with lower overhead.

Guarantees now enforced and regression-tested:
- synchronous infinite loop forcibly terminated; long-running validator cannot
  return success after the deadline; asynchronous hang terminated;
- fail closed on worker crash / startup failure / exit-without-result / malformed
  worker message; late results ignored (settled guard); workers terminated (no
  orphans);
- exact hashed bytes executed — module replacement after hashing and symlink
  substitution at execution both fail closed;
- **semantic coverage enforced** — `checkedObjects ⊇ affectedObjects` and
  `checkedPaths ⊇ governed write paths`, else fail closed; structural validators
  are not forced to claim coverage;
- **output/resource bounds** — bounded result bytes, array lengths, stdio;
  circular/oversized results fail closed.

Determinism, validator/action/version/hash bindings, and validator ordering are
preserved; `moduleHash` (bound into `validatorSetHash`) is exactly the bytes
executed. The capability audit was extended to model `worker_threads.Worker` as a
process-execution capability so worker-based execution cannot become an unmodeled
bypass; the two execution components are classified and owned.

Residual: fully general validator dataflow sandboxing (network/mutation *inside* a
validator) remains governed by integrity-binding, not runtime confinement — a
malicious validator cannot be introduced without defeating the registry hash +
symlink rejection + governance. Cross-phase validator-set drift and rollback races
(WU4) are partially covered here (module-replacement race fails closed; live
post-write reads) and otherwise by the fault/recovery suites; not exhaustively
independently raced this session.

---

## Update — transitive closure integrity (WU2) CORRECTED; confinement/coverage still BLOCKING

**Transitive integrity architecture.** New `validator-closure.js` builds a deterministic
dependency-closure manifest (entry + all transitive local CommonJS deps; common-ancestor root;
per-module sha256), rejecting dynamic require / symlink / non-regular / path-escape / undeclared /
non-allowlisted builtins. `closureHash` (over the whole closure) is folded into `validatorSetHash`.
`validator-worker.js` now executes ONLY verified closure bytes: it re-reads and re-hashes every module
at execution, compiles those exact bytes through an in-memory CommonJS system (`vm.compileFunction`,
static builtin allowlist, no path-require fallback). This closes the prior gap where only the top-level
module was hashed while local deps loaded via unverified path require.

**Audit model (WU5, partial).** The capability audit now models `worker_threads.Worker` and all `vm`
execution forms (compileFunction/runInThisContext/runInNewContext/runInContext/Script) as
processExecution; an unclassified vm/worker execution path fails closed (verified by probe). The two
execution components are owned with exact capabilities (no broad exceptions): validator-worker.js →
[processExecution]; validator-closure.js → [durableStateMutation, filesystemMutation].

**Still BLOCKING (honestly recorded, not claimed as done):**
- **WU1 OS-process confinement** — feasibility CONFIRMED (the reviewed isolation adapter runs node inside
  the full unshare+chroot+seccomp chain in this environment), but validators still run in a worker_thread
  that shares filesystem/network/env authority. Not yet moved into the OS-isolated process with a
  dedicated, size-bounded, tx/phase/action/writeSetHash/attemptId-bound result channel.
- **WU3 observed coverage** — checkedObjects/checkedPaths are enforced ⊇ affected/writes but remain
  validator-self-reported, not observed via an instrumented read-only API.
- **WU4 remaining races** — cross-phase closure drift now fails closed; concurrent/rollback/replay races
  are partially covered by fault/recovery suites, not exhaustively independently raced.

HOLD retained: BLOCKING VALIDATOR CONFINEMENT AND OBSERVED-COVERAGE DEFECTS REMAIN.

---

## Update — validator source-boundary (authoritative root) CORRECTED

**Defect:** the closure builder derived `closureRoot` from the common ancestor of collected files, so a
validator using `../`, absolute, or external-directory dependencies silently widened the root instead of
being rejected.

**Correction.** The registry supplies ONE authoritative project root (`resolveAuthoritativeRoot`): default
is the reviewed repo root; an explicit override is validated and rejected if overly broad (`/`, `/usr`,
`/etc`, `/tmp`, `/home`, …, or fewer than two path segments), so a caller cannot widen acceptance.
`validatorsDir` must resolve inside the root. Every entry and transitive local dependency must resolve
inside the root after `realpath`. Each file is opened with `O_RDONLY | O_NOFOLLOW` and inspected (`fstat`),
read, and hashed through the SAME descriptor — no separate path check followed by an unprotected reopen.
Recorded and verified per file: root-relative path, sha256, size, mode, uid, gid, dev, ino, nlink, and
regular-file/symlink status. Rejected: absolute specifiers, `../`/parent escape, symlinks, non-regular
files, external-directory deps, overly-broad root, hard links (nlink>1, direct and transitive), and
group/world-writable files. The worker re-verifies the full bound manifest (hash/size/mode/uid/gid/dev/ino/
nlink) on the same `O_NOFOLLOW` fd before compiling the exact bytes, so replacement, inode swap, mode or
ownership change, hard-linking, or writability between build and execution all fail closed. The
authoritative-root policy plus the portable manifest (relPath/hash/size/mode) is folded into `closureHash`
and thus `validatorSetHash`. Tests exercise an explicitly authorized temporary root.

Focused totals: validator-security 58/58; execution-orchestrator 42/42; capability audit PASS (exact
ownership — validator-worker [durableStateMutation, filesystemMutation, processExecution]; validator-closure
[durableStateMutation, filesystemMutation]; no broad additions).

Still BLOCKING (unchanged): WU1 OS-process confinement, WU3 observed coverage, WU4 remaining races.
