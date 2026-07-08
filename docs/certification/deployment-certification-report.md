# Runtime Isolation — Deployment Certification Report

- Generated: 2026-07-08T03:29:57.237Z
- Authoritative base: `73134669dd1cf2741f8f905e863d198adfa14118`
- Representative host attested: **false**
- **Ruling: REPRESENTATIVE_ENVIRONMENT_REQUIRED**

Mandatory checks: 30 — verified 26, failed 0, unavailable 0, representative-required 4

| Check | Category | Mandatory | Status | Detail |
|---|---|---|---|---|
| environment.fingerprint | fingerprint | no | info | `{"os":"Ubuntu 24.04.4 LTS","kernel":"Linux vm 6.18.5 #1 SMP PREEMPT_DYNAMIC @0 x86_64 x86_64 x86_64 GNU/Linux","arch":"x64","filesystem_and_mount":"ext4   rw,re` |
| ns.user | namespaces | yes | verified |  |
| ns.mount | namespaces | yes | verified |  |
| ns.pid | namespaces | yes | verified |  |
| ns.net | namespaces | yes | verified |  |
| ns.ipc | namespaces | yes | verified |  |
| ns.uts | namespaces | yes | verified |  |
| ns.combined | namespaces | yes | verified |  |
| ns.mount_in_userns | namespaces | yes | verified |  |
| seccomp.available | seccomp | yes | verified | Seccomp field=0 |
| seccomp.enforcement | seccomp | yes | representative_required | seccomp filter enforcement (syscall kill/EPERM) must be demonstrated by the helper on a representative host |
| helper.compiler_identity | helper | no | info | `{"compiler":"/usr/bin/gcc","version":"gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0","linker":"GNU ld (GNU Binutils for Ubuntu) 2.42"}` |
| helper.source_hash | helper | no | info | 8ad66b0894f7add0720e6e252703796b696f047df8faa4e1bb5c0f1338fa967c |
| helper.compile_command | helper | no | info | /usr/bin/gcc -O2 -static -Wall -Wextra -Werror -s -o /tmp/cert-helper-iQiGdw/sandbox-exec /home/claude/citizen-audit-phase41-review/kernel/runtime/sandbox-exec. |
| helper.compiles_hardened_static | helper | yes | verified |  |
| helper.static_linked | helper | yes | verified |  |
| helper.binary_hash | helper | no | info | 711891db2550525eb08c185e44ad36ddb2d214ed2508c3fb0ccc0309c187c425 |
| helper.regular_file_mode_0500 | helper | yes | verified |  |
| helper.digest_verified | helper | yes | verified |  |
| helper.symlink_rejected | helper | yes | verified |  |
| helper.tamper_detected | helper | yes | verified |  |
| helper.wrong_mode_rejected | helper | yes | verified |  |
| helper.hostile_prepositioned_rejected | helper | yes | verified |  |
| iso.adapter_probe | isolation | yes | verified | end-to-end sandbox isolation demonstrated (seccomp=true) |
| iso.network_blocked | isolation | yes | verified |  |
| iso.process_isolation | isolation | yes | verified | namespaced PIDs=4 vs host PIDs=64 |
| iso.governed_root_readonly | isolation | yes | verified |  |
| iso.inherited_fds | isolation | yes | representative_required | helper close_extra_fds(fd>=3) must be demonstrated in the full sandbox on a representative host |
| iso.env_sanitized | isolation | yes | representative_required | adapter fixes PATH/HOME/TMPDIR/CITIZEN_AUDIT_*; end-to-end demonstration requires representative host |
| fs.atomic_rename | filesystem | yes | verified |  |
| fs.file_fsync | filesystem | yes | verified |  |
| fs.dir_fsync | filesystem | yes | verified |  |
| fs.mode_preservation | filesystem | yes | verified |  |
| fs.hardlink_protection | filesystem | yes | representative_required | protected_hardlinks=0 |
| fs.noexec_supported | filesystem | yes | verified |  |
| fs.same_filesystem_assumption | filesystem | no | info | TMPDIR=/tmp repo=/home/claude/citizen-audit-phase41-review |

> Fail-closed: unavailable or representative-required mandatory checks block certification. This sandbox is not asserted representative; run on a qualified deployment host with `DEPLOYMENT_CERT_REPRESENTATIVE=1` once every mandatory check is `verified`.
