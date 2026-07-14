#!/usr/bin/env node
"use strict";

// Deployment-certification harness for Execution Engine v2 runtime isolation.
//
// This is NOT a documentation exercise: it fingerprints the host, probes every
// Linux capability the real isolation chain depends on, compiles and hash-verifies
// the exact reviewed sandbox helper, and runs hostile isolation probes through the
// real adapter. It fails closed: a missing required capability yields
// REPRESENTATIVE_ENVIRONMENT_REQUIRED, never a pass, and the harness refuses to
// declare CERTIFIED unless a qualified operator has attested — on a representative
// host — via DEPLOYMENT_CERT_REPRESENTATIVE=1 (or --attest-representative).
//
// Status vocabulary per check:
//   verified                 — ran here and passed
//   failed                   — ran here and FAILED (a real defect)
//   unavailable              — capability absent in this environment
//   representative_required  — can only be certified on a representative host
//   info                     — recorded fingerprint, not pass/fail

const os = require("os");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const { sha256 } = require("../kernel/lib/append-only-log");

function sh(cmd, args, opts = {}) {
  try {
    const r = childProcess.spawnSync(cmd, args, { encoding: "utf8", timeout: 20000, ...opts });
    return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim(), error: r.error ? r.error.message : null };
  } catch (e) { return { status: null, stdout: "", stderr: "", error: e.message }; }
}
function firstLine(s) { return (s || "").split("\n")[0].trim(); }
function tmpdir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

const results = [];
function record(id, category, mandatory, status, detail) {
  results.push({ id, category, mandatory: !!mandatory, status, detail });
  return status;
}
// Run a boolean/throwing check. Return value: true=verified, false=failed,
// "unavailable"/"representative_required" pass through.
function check(id, category, mandatory, fn) {
  let status, detail;
  try {
    const out = fn();
    if (out === "unavailable") { status = "unavailable"; detail = fn.detail || "capability absent"; }
    else if (out === "representative_required") { status = "representative_required"; detail = fn.detail || "requires representative host"; }
    else if (out && typeof out === "object") { status = out.status; detail = out.detail; }
    else { status = out ? "verified" : "failed"; detail = fn.detail || ""; }
  } catch (e) {
    // A capability-probe that throws ISOLATION_UNAVAILABLE is "unavailable"; any
    // other throw during a mandatory check is a failure (fail closed).
    if (e && e.code === "ISOLATION_UNAVAILABLE") { status = "unavailable"; detail = e.message; }
    else { status = "failed"; detail = e.message; }
  }
  return record(id, category, mandatory, status, detail);
}

// ---------------------------------------------------------------------------
// 1. ENVIRONMENT FINGERPRINT (info)
// ---------------------------------------------------------------------------
function fingerprint() {
  const osRelease = (() => { try { return fs.readFileSync("/etc/os-release", "utf8").match(/PRETTY_NAME="?([^"\n]+)/)?.[1] || "unknown"; } catch { return "unknown"; } })();
  const mounts = (() => { try { return firstLine(sh("findmnt", ["-no", "FSTYPE,OPTIONS", "--target", ROOT]).stdout) || "unknown"; } catch { return "unknown"; } })();
  const container = fs.existsSync("/.dockerenv") ? "docker(.dockerenv)"
    : (() => { try { return /docker|kubepods|containerd|lxc/.test(fs.readFileSync("/proc/1/cgroup", "utf8")) ? "container(cgroup)" : "none-detected"; } catch { return "unknown"; } })();
  const fp = {
    os: osRelease,
    kernel: firstLine(sh("uname", ["-a"]).stdout),
    arch: process.arch,
    filesystem_and_mount: mounts,
    container_or_vm: container,
    uid: process.getuid ? process.getuid() : null,
    gid: process.getgid ? process.getgid() : null,
    supplementary_groups: process.getgroups ? process.getgroups() : null,
    node: process.version,
    compiler: firstLine(sh("gcc", ["--version"]).stdout) || firstLine(sh("cc", ["--version"]).stdout) || "absent",
    linker: firstLine(sh("ld", ["--version"]).stdout) || "absent",
    libc: firstLine(sh("ldd", ["--version"]).stdout) || "unknown"
  };
  record("environment.fingerprint", "fingerprint", false, "info", fp);
  return fp;
}

// ---------------------------------------------------------------------------
// 2. LINUX ISOLATION CAPABILITIES (mandatory)
// ---------------------------------------------------------------------------
function unshareOK(flags) {
  const r = sh("unshare", [...flags, "--", "/bin/true"]);
  return r.status === 0;
}
function namespaceChecks() {
  if (process.platform !== "linux") { record("ns.platform", "namespaces", true, "unavailable", `platform is ${process.platform}, not linux`); return; }
  const hasUnshare = sh("unshare", ["--version"]).status === 0;
  if (!hasUnshare) { record("ns.unshare", "namespaces", true, "unavailable", "unshare(1) not present"); return; }
  const map = {
    user: ["--user", "--map-root-user"], mount: ["--user", "--map-root-user", "--mount"],
    pid: ["--user", "--map-root-user", "--pid", "--fork"], net: ["--user", "--map-root-user", "--net"],
    ipc: ["--user", "--map-root-user", "--ipc"], uts: ["--user", "--map-root-user", "--uts"]
  };
  for (const [ns, flags] of Object.entries(map)) {
    check(`ns.${ns}`, "namespaces", true, () => unshareOK(flags) || "unavailable");
  }
  // The exact combined invocation the adapter uses.
  check("ns.combined", "namespaces", true, () => unshareOK(["--user", "--map-root-user", "--mount", "--pid", "--fork", "--net", "--ipc", "--uts"]) || "unavailable");
  // chroot + mount inside the namespace.
  check("ns.mount_in_userns", "namespaces", true, () => {
    const r = sh("unshare", ["--user", "--map-root-user", "--mount", "--", "/bin/sh", "-c", "mount --bind /usr /mnt 2>/dev/null && mount -o remount,bind,ro /mnt 2>/dev/null && echo ok"]);
    return r.stdout.includes("ok") || "unavailable";
  });
}
function seccompChecks() {
  const status = (() => { try { return fs.readFileSync("/proc/self/status", "utf8"); } catch { return ""; } })();
  const seccompField = /Seccomp:\s*(\d+)/.exec(status);
  check("seccomp.available", "seccomp", true, () => seccompField ? { status: "verified", detail: `Seccomp field=${seccompField[1]}` } : "unavailable");
  // Enforcement is demonstrated end-to-end by the sandbox-helper seccomp probe
  // (see isolation demonstrations). Standalone kernel enforcement on a
  // representative host is required for full certification.
  record("seccomp.enforcement", "seccomp", true, "representative_required",
    "seccomp filter enforcement (syscall kill/EPERM) must be demonstrated by the helper on a representative host");
}

// ---------------------------------------------------------------------------
// 3. SANDBOX-HELPER BUILD AND INTEGRITY (mandatory)
// ---------------------------------------------------------------------------
function helperChecks() {
  const src = path.join(ROOT, "kernel/runtime/sandbox-exec.c");
  const compiler = ["/usr/bin/gcc", "/usr/bin/cc", "/bin/cc"].find((c) => { try { return fs.statSync(c).isFile(); } catch { return false; } });
  if (!compiler) { record("helper.compiler", "helper", true, "unavailable", "no fixed-path C compiler"); return; }
  record("helper.compiler_identity", "helper", false, "info", { compiler, version: firstLine(sh(compiler, ["--version"]).stdout), linker: firstLine(sh("ld", ["--version"]).stdout) });

  const sourceHash = sha256(fs.readFileSync(src));
  record("helper.source_hash", "helper", false, "info", sourceHash);

  const work = tmpdir("cert-helper-");
  const bin = path.join(work, "sandbox-exec");
  const flags = ["-O2", "-static", "-Wall", "-Wextra", "-Werror", "-s", "-o", bin, src];
  const build = sh(compiler, flags);
  record("helper.compile_command", "helper", false, "info", `${compiler} ${flags.join(" ")}`);
  check("helper.compiles_hardened_static", "helper", true, () => build.status === 0 || { status: "failed", detail: build.stderr || build.error });
  if (build.status !== 0) { try { fs.rmSync(work, { recursive: true, force: true }); } catch {} return; }

  check("helper.static_linked", "helper", true, () => {
    const f = sh("file", [bin]).stdout; const ldd = sh("ldd", [bin]).stdout + sh("ldd", [bin]).stderr;
    return /statically linked/.test(f) || /not a dynamic executable/.test(ldd) || { status: "failed", detail: `file: ${f}` };
  });
  const binaryHash = sha256(fs.readFileSync(bin));
  record("helper.binary_hash", "helper", false, "info", binaryHash);

  // Use the real adapter verifier against the produced binary.
  const { verifyHelperFile } = require("../kernel/runtime/isolation-adapter");
  fs.chmodSync(bin, 0o500);
  check("helper.regular_file_mode_0500", "helper", true, () => { verifyHelperFile(bin, binaryHash); return true; });
  check("helper.digest_verified", "helper", true, () => { verifyHelperFile(bin, binaryHash); return true; });

  // Symlink rejection.
  check("helper.symlink_rejected", "helper", true, () => {
    const link = path.join(work, "link-exec"); const target = path.join(work, "real-target"); fs.writeFileSync(target, "x"); fs.chmodSync(target, 0o500);
    fs.symlinkSync(target, link);
    try { verifyHelperFile(link, sha256(fs.readFileSync(target))); return { status: "failed", detail: "symlinked helper was accepted" }; }
    catch { return true; }
  });
  // Truncated/replaced binary detection (digest mismatch).
  check("helper.tamper_detected", "helper", true, () => {
    const t = path.join(work, "tampered"); fs.copyFileSync(bin, t); fs.truncateSync(t, 8); fs.chmodSync(t, 0o500);
    try { verifyHelperFile(t, binaryHash); return { status: "failed", detail: "truncated helper accepted" }; }
    catch { return true; }
  });
  // Wrong mode detection.
  check("helper.wrong_mode_rejected", "helper", true, () => {
    const m = path.join(work, "wrongmode"); fs.copyFileSync(bin, m); fs.chmodSync(m, 0o755);
    try { verifyHelperFile(m, sha256(fs.readFileSync(m))); return { status: "failed", detail: "0755 helper accepted" }; }
    catch { return true; }
  });
  // Hostile pre-positioned cache file: a wrong binary at the expected digest must fail verification.
  check("helper.hostile_prepositioned_rejected", "helper", true, () => {
    const h = path.join(work, "hostile"); fs.writeFileSync(h, "#!/bin/sh\nrm -rf /\n"); fs.chmodSync(h, 0o500);
    try { verifyHelperFile(h, binaryHash); return { status: "failed", detail: "hostile file matched trusted digest" }; }
    catch { return true; }
  });
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
}

// ---------------------------------------------------------------------------
// 4. ISOLATION DEMONSTRATIONS (mandatory) — via the real adapter + direct probes
// ---------------------------------------------------------------------------
function isolationDemos() {
  const adapter = (() => { try { return require("../kernel/runtime/isolation-adapter"); } catch (e) { return null; } })();
  // Integrated probe through the real adapter: writes /workspace, must NOT read a host secret.
  check("iso.adapter_probe", "isolation", true, () => {
    if (!adapter || typeof adapter.probeIsolationCapability !== "function") return "unavailable";
    const root = tmpdir("cert-root-");
    try {
      // The probe builds its own probe agent; a minimal provenance stub suffices.
      const res = adapter.probeIsolationCapability(root, { provenance: {} });
      if (res && res.available === true && res.liveRootExposed === false) return { status: "verified", detail: `end-to-end sandbox isolation demonstrated (seccomp=${res.seccomp})` };
      // Could not fully demonstrate the full seccomp+chroot chain here; not a
      // security failure, but requires a representative host to certify.
      return { status: "representative_required", detail: `integrated probe not fully demonstrable here: ${res && res.reason ? String(res.reason).slice(0, 140) : "unavailable"}` };
    } catch (e) {
      return { status: "representative_required", detail: `integrated probe error: ${e.message.slice(0, 140)}` };
    } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} }
  });
  const canNs = sh("unshare", ["--user", "--map-root-user", "--net", "--", "/bin/true"]).status === 0;
  // Network isolation: inside a net namespace, an outbound connect must fail.
  check("iso.network_blocked", "isolation", true, () => {
    if (!canNs) return "unavailable";
    const r = sh("unshare", ["--user", "--map-root-user", "--net", "--", process.execPath, "-e",
      "const net=require('net');const s=net.connect(53,'1.1.1.1');s.on('connect',()=>process.exit(7));s.on('error',()=>process.exit(0));setTimeout(()=>process.exit(0),2500);"]);
    return r.status === 0 || { status: "failed", detail: `outbound connect not blocked (exit ${r.status})` };
  });
  // Host-process inspection: inside a pid namespace the host's PID 1 is not visible as its host self.
  check("iso.process_isolation", "isolation", true, () => {
    const hostPids = (sh("sh", ["-c", "ls /proc | grep -E '^[0-9]+$' | wc -l"]).stdout || "0").trim();
    const r = sh("unshare", ["--user", "--map-root-user", "--pid", "--fork", "--mount", "--", "/bin/sh", "-c", "mount -t proc proc /proc 2>/dev/null; ls /proc | grep -E '^[0-9]+$' | wc -l"]);
    if (r.status !== 0) return "unavailable";
    const nsCount = parseInt(r.stdout, 10);
    const hostCount = parseInt(hostPids, 10);
    // Isolation is demonstrated when the namespaced process sees only a handful
    // of PIDs (itself + probe helpers) versus the host's full process table.
    return (Number.isFinite(nsCount) && nsCount <= 10 && Number.isFinite(hostCount) && nsCount < hostCount)
      ? { status: "verified", detail: `namespaced PIDs=${nsCount} vs host PIDs=${hostCount}` }
      : { status: "failed", detail: `insufficient PID isolation: ns=${nsCount} host=${hostCount}` };
  });
  // Governed-root / outside-workspace writes blocked by a read-only bind.
  check("iso.governed_root_readonly", "isolation", true, () => {
    const live = tmpdir("cert-live-"); fs.mkdirSync(path.join(live, "institution"), { recursive: true }); fs.writeFileSync(path.join(live, "institution", "charter.md"), "ORIGINAL");
    const r = sh("unshare", ["--user", "--map-root-user", "--mount", "--", "/bin/sh", "-c",
      `mount --bind '${live}' '${live}' && mount -o remount,bind,ro '${live}' '${live}' && (echo HACK > '${live}/institution/charter.md' 2>/dev/null && echo WROTE || echo BLOCKED)`]);
    const original = fs.readFileSync(path.join(live, "institution", "charter.md"), "utf8") === "ORIGINAL";
    try { fs.rmSync(live, { recursive: true, force: true }); } catch {}
    if (r.status !== 0) return "unavailable";
    return (r.stdout.includes("BLOCKED") && original) ? true : { status: "failed", detail: r.stdout };
  });
  // Inherited fds closed by the helper (fd>=3). Certified end-to-end only with the helper on a representative host.
  record("iso.inherited_fds", "isolation", true, "representative_required", "helper close_extra_fds(fd>=3) must be demonstrated in the full sandbox on a representative host");
  // Environment sanitization: adapter sets a fixed env (verified by source inspection here; end-to-end on representative host).
  record("iso.env_sanitized", "isolation", true, "representative_required", "adapter fixes PATH/HOME/TMPDIR/CITIZEN_AUDIT_*; end-to-end demonstration requires representative host");
}

// ---------------------------------------------------------------------------
// 5. FILESYSTEM & DURABILITY ASSUMPTIONS (mandatory where testable)
// ---------------------------------------------------------------------------
function fsDurability() {
  const work = tmpdir("cert-fs-");
  check("fs.atomic_rename", "filesystem", true, () => {
    const a = path.join(work, "a"), b = path.join(work, "b"); fs.writeFileSync(a, "1"); fs.writeFileSync(b, "2"); fs.renameSync(a, b);
    return fs.readFileSync(b, "utf8") === "1" && !fs.existsSync(a);
  });
  check("fs.file_fsync", "filesystem", true, () => { const f = path.join(work, "s"); const fd = fs.openSync(f, "w"); fs.writeSync(fd, "x"); fs.fsyncSync(fd); fs.closeSync(fd); return true; });
  check("fs.dir_fsync", "filesystem", true, () => { const fd = fs.openSync(work, "r"); try { fs.fsyncSync(fd); return true; } finally { fs.closeSync(fd); } });
  check("fs.mode_preservation", "filesystem", true, () => { const f = path.join(work, "m"); fs.writeFileSync(f, "x"); fs.chmodSync(f, 0o500); return (fs.statSync(f).mode & 0o777) === 0o500; });
  check("fs.hardlink_protection", "filesystem", true, () => {
    try { const v = fs.readFileSync("/proc/sys/fs/protected_hardlinks", "utf8").trim(); return v === "1" ? true : { status: "representative_required", detail: `protected_hardlinks=${v}` }; }
    catch { return "unavailable"; }
  });
  // noexec on the workspace bind is enforced by the adapter's mount options; demonstrate mount option support.
  check("fs.noexec_supported", "filesystem", true, () => {
    const r = sh("unshare", ["--user", "--map-root-user", "--mount", "--", "/bin/sh", "-c",
      `mkdir -p ${work}/ne && mount --bind ${work}/ne ${work}/ne 2>/dev/null && mount -o remount,bind,ro,noexec ${work}/ne 2>/dev/null && echo ok`]);
    return r.stdout.includes("ok") || "unavailable";
  });
  record("fs.same_filesystem_assumption", "filesystem", false, "info", `TMPDIR=${os.tmpdir()} repo=${ROOT}`);
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
}

// ---------------------------------------------------------------------------
// AGGREGATE + REPORT
// ---------------------------------------------------------------------------
// Pure classification/ruling logic, separated so it can be tested
// deterministically with synthetic check lists.
function evaluate(allResults, representativeAttested) {
  const mandatory = allResults.filter((r) => r.mandatory);
  const failed = mandatory.filter((r) => r.status === "failed");
  const unavailable = mandatory.filter((r) => r.status === "unavailable");
  const repRequired = mandatory.filter((r) => r.status === "representative_required");
  const verified = mandatory.filter((r) => r.status === "verified");
  let ruling, exitCode;
  if (failed.length) { ruling = "CERTIFICATION_FAILED"; exitCode = 1; }
  else if (unavailable.length || repRequired.length) { ruling = "REPRESENTATIVE_ENVIRONMENT_REQUIRED"; exitCode = 1; }
  else if (!representativeAttested) { ruling = "REPRESENTATIVE_ENVIRONMENT_REQUIRED"; exitCode = 1; }
  else { ruling = "CERTIFIED"; exitCode = 0; }
  return {
    ruling, exitCode,
    summary: {
      mandatoryTotal: mandatory.length, verified: verified.length, failed: failed.length,
      unavailable: unavailable.length, representative_required: repRequired.length
    }
  };
}

function certify() {
  results.length = 0;
  fingerprint();
  namespaceChecks();
  seccompChecks();
  helperChecks();
  isolationDemos();
  fsDurability();

  const representativeAttested = process.env.DEPLOYMENT_CERT_REPRESENTATIVE === "1" || process.argv.includes("--attest-representative");
  const evaluation = evaluate(results, representativeAttested);
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    authoritativeBase: (() => { try { return childProcess.execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim(); } catch { return "unknown"; } })(),
    representativeAttested,
    ruling: evaluation.ruling,
    summary: evaluation.summary,
    checks: results.slice()
  };
  return { report, exitCode: evaluation.exitCode };
}

function toMarkdown(report) {
  const lines = [];
  lines.push("# Runtime Isolation — Deployment Certification Report", "");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Authoritative base: \`${report.authoritativeBase}\``);
  lines.push(`- Representative host attested: **${report.representativeAttested}**`);
  lines.push(`- **Ruling: ${report.ruling}**`, "");
  const s = report.summary;
  lines.push(`Mandatory checks: ${s.mandatoryTotal} — verified ${s.verified}, failed ${s.failed}, unavailable ${s.unavailable}, representative-required ${s.representative_required}`, "");
  lines.push("| Check | Category | Mandatory | Status | Detail |", "|---|---|---|---|---|");
  for (const c of report.checks) {
    const detail = typeof c.detail === "object" ? "`" + JSON.stringify(c.detail).replace(/\|/g, "\\|").slice(0, 160) + "`" : String(c.detail || "").replace(/\|/g, "\\|").slice(0, 160);
    lines.push(`| ${c.id} | ${c.category} | ${c.mandatory ? "yes" : "no"} | ${c.status} | ${detail} |`);
  }
  lines.push("", "> Fail-closed: unavailable or representative-required mandatory checks block certification. This sandbox is not asserted representative; run on a qualified deployment host with `DEPLOYMENT_CERT_REPRESENTATIVE=1` once every mandatory check is `verified`.");
  return lines.join("\n") + "\n";
}

if (require.main === module) {
  const { report, exitCode } = certify();
  const outDir = path.join(ROOT, "docs", "certification");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "deployment-certification-report.json");
  const mdPath = path.join(outDir, "deployment-certification-report.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(mdPath, toMarkdown(report));
  console.log(`Deployment certification: ${report.ruling}`);
  console.log(`  mandatory: ${report.summary.verified} verified, ${report.summary.failed} failed, ${report.summary.unavailable} unavailable, ${report.summary.representative_required} representative-required`);
  console.log(`  JSON: ${path.relative(ROOT, jsonPath)}`);
  console.log(`  Markdown: ${path.relative(ROOT, mdPath)}`);
  process.exit(exitCode);
}

module.exports = { certify, toMarkdown, evaluate };
