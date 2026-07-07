#define _GNU_SOURCE
#include <errno.h>
#include <linux/audit.h>
#include <linux/capability.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>

#ifndef SECCOMP_RET_KILL_PROCESS
#define SECCOMP_RET_KILL_PROCESS SECCOMP_RET_KILL
#endif

#if defined(__x86_64__)
#define EXPECTED_ARCH AUDIT_ARCH_X86_64
#elif defined(__aarch64__)
#define EXPECTED_ARCH AUDIT_ARCH_AARCH64
#else
#error "Unsupported architecture for sandbox-exec"
#endif

#define MAX_INSNS 256
static struct sock_filter filter_insns[MAX_INSNS];
static size_t filter_len = 0;

static void stmt(uint16_t code, uint32_t k) {
    if (filter_len >= MAX_INSNS) _exit(125);
    filter_insns[filter_len++] = (struct sock_filter){ code, 0, 0, k };
}

static void jump(uint16_t code, uint32_t k, uint8_t jt, uint8_t jf) {
    if (filter_len >= MAX_INSNS) _exit(125);
    filter_insns[filter_len++] = (struct sock_filter){ code, jt, jf, k };
}

static void deny_errno(int syscall_nr, int err) {
    jump(BPF_JMP | BPF_JEQ | BPF_K, (uint32_t) syscall_nr, 0, 1);
    stmt(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (err & SECCOMP_RET_DATA));
}

static void close_extra_fds(void) {
#ifdef __NR_close_range
    if (syscall(__NR_close_range, 3u, ~0u, 0u) == 0) return;
#endif
    long maximum = sysconf(_SC_OPEN_MAX);
    if (maximum < 0 || maximum > 1048576) maximum = 65536;
    for (int fd = 3; fd < maximum; ++fd) (void) close(fd);
}

static int lock_privileges(void) {
    struct __user_cap_header_struct header = { _LINUX_CAPABILITY_VERSION_3, 0 };
    struct __user_cap_data_struct data[2] = {0};

    if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) return -1;
    for (int cap = 0; cap <= 63; ++cap) {
        if (prctl(PR_CAPBSET_DROP, cap, 0, 0, 0) != 0 && errno != EINVAL) return -1;
    }
    if (syscall(SYS_capset, &header, &data) != 0) return -1;
    if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_CLEAR_ALL, 0, 0, 0) != 0 && errno != EINVAL) {
        /* Older kernels may not implement the ambient capability API. */
    }
    return 0;
}

static int install_filter(void) {
    const uint32_t namespace_flags =
        0x00020000u | /* CLONE_NEWNS */
        0x02000000u | /* CLONE_NEWCGROUP */
        0x04000000u | /* CLONE_NEWUTS */
        0x08000000u | /* CLONE_NEWIPC */
        0x10000000u | /* CLONE_NEWUSER */
        0x20000000u | /* CLONE_NEWPID */
        0x40000000u | /* CLONE_NEWNET */
        0x00000080u;  /* CLONE_NEWTIME */

    stmt(BPF_LD | BPF_W | BPF_ABS, (uint32_t) offsetof(struct seccomp_data, arch));
    jump(BPF_JMP | BPF_JEQ | BPF_K, EXPECTED_ARCH, 1, 0);
    stmt(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS);
    stmt(BPF_LD | BPF_W | BPF_ABS, (uint32_t) offsetof(struct seccomp_data, nr));

#ifdef __NR_mount
    deny_errno(__NR_mount, EPERM);
#endif
#ifdef __NR_umount2
    deny_errno(__NR_umount2, EPERM);
#endif
#ifdef __NR_unshare
    deny_errno(__NR_unshare, EPERM);
#endif
#ifdef __NR_setns
    deny_errno(__NR_setns, EPERM);
#endif
#ifdef __NR_pivot_root
    deny_errno(__NR_pivot_root, EPERM);
#endif
#ifdef __NR_chroot
    deny_errno(__NR_chroot, EPERM);
#endif
#ifdef __NR_open_tree
    deny_errno(__NR_open_tree, EPERM);
#endif
#ifdef __NR_move_mount
    deny_errno(__NR_move_mount, EPERM);
#endif
#ifdef __NR_fsopen
    deny_errno(__NR_fsopen, EPERM);
#endif
#ifdef __NR_fsconfig
    deny_errno(__NR_fsconfig, EPERM);
#endif
#ifdef __NR_fsmount
    deny_errno(__NR_fsmount, EPERM);
#endif
#ifdef __NR_mount_setattr
    deny_errno(__NR_mount_setattr, EPERM);
#endif
#ifdef __NR_open_by_handle_at
    deny_errno(__NR_open_by_handle_at, EPERM);
#endif
#ifdef __NR_name_to_handle_at
    deny_errno(__NR_name_to_handle_at, EPERM);
#endif
#ifdef __NR_ptrace
    deny_errno(__NR_ptrace, EPERM);
#endif
#ifdef __NR_process_vm_writev
    deny_errno(__NR_process_vm_writev, EPERM);
#endif
#ifdef __NR_clone3
    deny_errno(__NR_clone3, ENOSYS);
#endif
#ifdef __NR_clone
    jump(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone, 0, 3);
    stmt(BPF_LD | BPF_W | BPF_ABS, (uint32_t) offsetof(struct seccomp_data, args[0]));
    jump(BPF_JMP | BPF_JSET | BPF_K, namespace_flags, 0, 1);
    stmt(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM);
#endif

    stmt(BPF_RET | BPF_K, SECCOMP_RET_ALLOW);
    struct sock_fprog program = { .len = (unsigned short) filter_len, .filter = filter_insns };
    if (syscall(SYS_seccomp, SECCOMP_SET_MODE_FILTER, 0, &program) != 0) return -1;
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "sandbox-exec: command required\n");
        return 125;
    }
    if (chdir("/workspace") != 0) {
        perror("sandbox-exec: chdir");
        return 125;
    }
    (void) prctl(PR_SET_DUMPABLE, 0, 0, 0, 0);
    close_extra_fds();
    if (lock_privileges() != 0) {
        perror("sandbox-exec: privileges");
        return 125;
    }
    if (install_filter() != 0) {
        perror("sandbox-exec: seccomp");
        return 125;
    }
    execvp(argv[1], &argv[1]);
    perror("sandbox-exec: execvp");
    return 127;
}
