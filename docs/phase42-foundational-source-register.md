# Phase 4.2 foundational source register

## Status

**REPORTED:** the supplied packet records these source references as reviewed on **2026-07-12**. This documentation integration did not independently re-verify external sources. Official project, vendor, kernel, standards, or manual documentation is preferred. These sources support platform facts and methodology; they do not certify The Citizen Audit.

## Ubuntu and platform sources

### SRC-UBU-001

**Ubuntu release cycle.** Canonical states that Ubuntu LTS releases are issued every two years, receive five years of standard security maintenance, and are recommended for stability and production use; this records the Ubuntu 24.04 LTS standard-support horizon through 2029.

- https://ubuntu.com/about/release-cycle

### SRC-UBU-002

**Ubuntu 24.04 LTS release notes.** Documents Linux 6.8 and systemd 255.4 in the base release.

- https://documentation.ubuntu.com/release-notes/24.04/

### SRC-UBU-003

**Ubuntu kernel lifecycle and enablement stack.** Documents that Ubuntu Server 24.04 defaults to the GA kernel while HWE is optional, and lists support windows for the GA and HWE kernel lines.

- https://ubuntu.com/kernel/lifecycle

### SRC-UBU-004

**Ubuntu privilege restriction.** Documents AppArmor as Ubuntu’s default supported Mandatory Access Control mechanism and lists cgroups and filesystem capabilities among privilege-restriction features.

- https://documentation.ubuntu.com/security/security-features/privilege-restriction/

### SRC-UBU-005

**Ubuntu security-feature overview.** Documents current security features and versions across Ubuntu releases, including AppArmor and broader process/kernel protections.

- https://documentation.ubuntu.com/security/security-features/security-features-overview/

### SRC-UBU-006

**Ubuntu security updates.** Documents fixed-release security backports and different support treatment for `Main`, `Restricted`, `Universe`, and `Multiverse` packages.

- https://documentation.ubuntu.com/security/security-updates/

### SRC-UBU-007

**Ubuntu 26.04 LTS release notes.** Records the April 23, 2026 release of Ubuntu 26.04 LTS and its standard-support horizon through April 2031.

- https://documentation.ubuntu.com/release-notes/26.04/

### SRC-UBU-008

**Ubuntu LTS-to-LTS upgrade guidance.** Ubuntu Community Hub guidance hosted on Canonical infrastructure describes the supported 24.04-to-26.04 upgrade window as following the initial 26.04 release. It is supplementary community guidance, not formal vendor release-policy documentation.

- https://discourse.ubuntu.com/t/best-practice-for-a-successful-release-upgrade-to-26-04/80868

### SRC-UBU-009

**Ubuntu 26.04 release schedule.** Documents the 2026-04-23 Ubuntu 26.04 final release and the scheduled 2026-08-27 Ubuntu 26.04.1 point release.

- https://documentation.ubuntu.com/release-notes/26.04/schedule/

## Linux and system-service sources

### SRC-LNX-001

**Linux cgroup v2.** Kernel documentation describes hierarchical process organization and controlled resource distribution.

- https://docs.kernel.org/admin-guide/cgroup-v2.html

### SRC-LNX-002

**Seccomp BPF.** Kernel documentation describes syscall filtering using BPF programs.

- https://docs.kernel.org/userspace-api/seccomp_filter.html

### SRC-LNX-003

**No New Privileges.** Kernel documentation explains `no_new_privs` and its role in preventing privilege gain through setuid, setgid, and file capabilities.

- https://docs.kernel.org/userspace-api/no_new_privs.html

### SRC-LNX-004

**PID file descriptors.** The Linux manual page documents pidfds as file descriptors referring to exact tasks and supporting signaling, polling, and waiting without relying only on numeric PID identity.

- https://man7.org/linux/man-pages/man2/pidfd_open.2.html

### SRC-LNX-005

**Landlock.** Kernel documentation describes Landlock as a stackable unprivileged access-control mechanism for restricting ambient rights.

- https://docs.kernel.org/userspace-api/landlock.html

### SRC-LNX-006

**systemd execution controls.** systemd documentation lists service-execution controls including `NoNewPrivileges`, namespace restrictions, filesystem protections, address-family restrictions, syscall filters, runtime directories, and environment controls.

- https://www.freedesktop.org/software/systemd/man/systemd.exec.html

### SRC-LNX-007

**systemd resource control.** Documents cgroup-backed service and scope resource controls.

- https://www.freedesktop.org/software/systemd/man/systemd.resource-control.html

### SRC-LNX-008

**Linux namespaces.** The Linux manual page documents namespace isolation of global system resources and the relevant namespace families.

- https://man7.org/linux/man-pages/man7/namespaces.7.html

## Alternative-platform sources

### SRC-DEB-001

**Debian 13 release information.** Documents Debian 13’s release date, point releases, and five-year lifecycle.

- https://www.debian.org/releases/trixie/

### SRC-RHL-001

**RHEL 10 SELinux documentation.** Documents SELinux Mandatory Access Control and process/file/network policy control.

- https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html-single/using_selinux/index

### SRC-RHL-002

**RHEL 10 release notes.** Documents the cgroup v2 direction in RHEL 10.

- https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/10.0_release_notes/

## Threat-modeling sources

### SRC-TM-001

**OWASP Threat Modeling Project.** Frames threat modeling around understanding the system, identifying what can go wrong, deciding responses, and reviewing whether the work is adequate.

- https://owasp.org/www-project-threat-modeling/

### SRC-TM-002

**OWASP Threat Modeling Cheat Sheet.** Describes system decomposition, trust boundaries, threat identification, mitigations, and validation as core threat-model activities.

- https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html

## Source limitations

- Availability of an OS feature does not prove that the project configured or tested it correctly.
- Vendor support windows do not replace project-level requalification after updates.
- Documentation does not establish that a cloud, VM, container, or CI environment exposes the required host privileges or kernel controls.
- The project must capture exact runtime evidence from the approved profile rather than relying on these webpages during acceptance.
- SRC-UBU-007 currently states Ubuntu 26.04 support through April 2031, while SRC-UBU-001 currently lists standard security maintenance through May 2031. Reverify the exact authoritative support-end date during the final P42-D001 comparison and approval; this discrepancy does not change the present provisional decision posture.
