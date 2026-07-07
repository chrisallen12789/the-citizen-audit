const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");

const ISOLATION_KIND = "unshare-chroot-seccomp";
const helperSourcePath = path.join(__dirname, "sandbox-exec.c");

function fixedExecutable(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function helperSourceHash() {
  return sha256(fs.readFileSync(helperSourcePath));
}

function ensureSandboxHelper() {
  const sourceHash = helperSourceHash();
  const binDir = path.join(os.tmpdir(), "the-citizen-audit-runtime", "bin");
  const destination = path.join(binDir, `sandbox-exec-${sourceHash.slice(0, 24)}`);
  if (fs.existsSync(destination)) return destination;
  const compiler = fixedExecutable(["/usr/bin/gcc", "/usr/bin/cc", "/bin/cc"]);
  if (!compiler) throw Object.assign(new Error("A C compiler is required to build the seccomp sandbox launcher."), { code: "ISOLATION_UNAVAILABLE" });
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${process.pid}.tmp`;
  const result = childProcess.spawnSync(compiler, ["-O2", "-static", "-Wall", "-Wextra", "-s", "-o", temporary, helperSourcePath], {
    encoding: "utf8",
    timeout: 30000,
    env: { PATH: "/usr/bin:/bin" }
  });
  if (result.status !== 0 || !fs.existsSync(temporary)) {
    fs.rmSync(temporary, { force: true });
    const error = new Error(`Could not build the seccomp sandbox launcher: ${(result.stderr || result.error?.message || `compiler exit ${result.status}`).trim()}`);
    error.code = "ISOLATION_UNAVAILABLE";
    throw error;
  }
  fs.chmodSync(temporary, 0o500);
  try { fs.renameSync(temporary, destination); } catch (error) {
    if (!fs.existsSync(destination)) throw error;
    fs.rmSync(temporary, { force: true });
  }
  return destination;
}

function resolveAgentExecutable(command) {
  const candidates = path.isAbsolute(command)
    ? [command]
    : ["/usr/sbin", "/usr/bin", "/sbin", "/bin"].map((directory) => path.join(directory, command));
  for (const candidate of candidates) {
    try {
      const resolved = fs.realpathSync(candidate);
      const stat = fs.statSync(resolved);
      if (stat.isFile() && (stat.mode & 0o111) !== 0) return resolved;
    } catch {}
  }
  const error = new Error(`External agent executable is unavailable or not executable: ${command}.`);
  error.code = "EXTERNAL_AGENT_REQUIRED";
  throw error;
}

function prepareSandboxFilesystem(workspace, helperPath, executable) {
  const sandbox = workspace.sandboxDir;
  for (const relative of ["usr", "dev", "workspace", "tmp"]) fs.mkdirSync(path.join(sandbox, relative), { recursive: true, mode: 0o755 });
  for (const [link, target] of [["bin", "usr/bin"], ["lib", "usr/lib"], ["lib64", "usr/lib64"], ["sbin", "usr/sbin"]]) {
    const linkPath = path.join(sandbox, link);
    if (!fs.existsSync(linkPath)) fs.symlinkSync(target, linkPath);
  }
  for (const device of ["null", "urandom", "random"]) {
    const target = path.join(sandbox, "dev", device);
    if (!fs.existsSync(target)) fs.writeFileSync(target, "");
  }
  const launcher = path.join(sandbox, "sandbox-exec");
  fs.copyFileSync(helperPath, launcher);
  fs.chmodSync(launcher, 0o500);

  const systemProvided = executable === "/usr" || executable.startsWith("/usr/");
  const executableTarget = systemProvided
    ? executable
    : `/agent-bin/${sha256(executable).slice(0, 16)}-${path.basename(executable)}`;
  if (!systemProvided) {
    const target = path.join(sandbox, executableTarget.slice(1));
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    if (!fs.existsSync(target)) fs.writeFileSync(target, "");
  }
  return Object.freeze({ launcher, executable: executableTarget, executableSource: systemProvided ? "" : executable });
}

function sanitizedEnvironment() {
  return {
    PATH: "/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: "/workspace",
    TMPDIR: "/tmp",
    CITIZEN_AUDIT_WORKSPACE: "/workspace",
    CITIZEN_AUDIT_INPUT_DIR: "/workspace/inputs",
    CITIZEN_AUDIT_OUTPUT_DIR: "/workspace/outputs"
  };
}

function assertExternalAgent(agent) {
  if (agent && typeof agent === "object" && Object.prototype.hasOwnProperty.call(agent, "fn")) {
    const error = new Error("In-process function agents are prohibited in the production runtime.");
    error.code = "IN_PROCESS_AGENT_PROHIBITED";
    throw error;
  }
  if (!agent || typeof agent !== "object" || typeof agent.command !== "string" || !agent.command.trim()) {
    const error = new Error("Production runtime requires an external-process agent command.");
    error.code = "EXTERNAL_AGENT_REQUIRED";
    throw error;
  }
  if (agent.args !== undefined && (!Array.isArray(agent.args) || agent.args.some((value) => typeof value !== "string"))) {
    throw new Error("External agent args must be an array of strings.");
  }
}

function sandboxWrapper() {
  return [
    "set -eu",
    "sandbox=$1",
    "work=$2",
    "tmp=$3",
    "agent_source=$4",
    "agent_target=$5",
    "shift 5",
    "mount --make-rprivate /",
    "target=\"$sandbox/usr\"",
    "mkdir -p \"$target\"",
    "mount --bind /usr \"$target\"",
    "mount -o remount,bind,ro,nosuid,nodev \"$target\"",
    "if [ -n \"$agent_source\" ]; then",
    "  mount --bind \"$agent_source\" \"$sandbox$agent_target\"",
    "  mount -o remount,bind,ro,nosuid,nodev \"$sandbox$agent_target\"",
    "fi",
    "mount --bind \"$work\" \"$sandbox/workspace\"",
    "mount -o remount,bind,rw,nosuid,nodev,noexec \"$sandbox/workspace\"",
    "mount --bind \"$tmp\" \"$sandbox/tmp\"",
    "mount -o remount,bind,rw,nosuid,nodev,noexec \"$sandbox/tmp\"",
    "for device in null urandom random; do",
    "  mount --bind \"/dev/$device\" \"$sandbox/dev/$device\"",
    "done",
    "exec chroot \"$sandbox\" /sandbox-exec \"$agent_target\" \"$@\""
  ].join("\n");
}

function spawnSandboxed(workspace, agent) {
  const unshare = fixedExecutable(["/usr/bin/unshare", "/bin/unshare"]);
  if (!unshare) throw Object.assign(new Error("unshare is unavailable."), { code: "ISOLATION_UNAVAILABLE" });
  const helper = ensureSandboxHelper();
  const executable = resolveAgentExecutable(agent.command);
  const sandbox = prepareSandboxFilesystem(workspace, helper, executable);
  const result = childProcess.spawnSync(unshare, [
    "--user", "--map-root-user", "--mount", "--pid", "--fork",
    "--net", "--ipc", "--uts", "--",
    "/bin/sh", "-ceu", sandboxWrapper(), "sh", workspace.sandboxDir, workspace.dir, workspace.tmpDir,
    sandbox.executableSource, sandbox.executable, ...(agent.args || [])
  ], {
    cwd: workspace.dir,
    encoding: "utf8",
    env: sanitizedEnvironment(),
    timeout: Number.isInteger(agent.timeoutMs) ? agent.timeoutMs : 120000,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return result;
}


function probeIsolationCapability() {
  if (process.platform !== "linux") {
    const report = Object.freeze({ available: false, kind: ISOLATION_KIND, reason: `Unsupported operating system: ${process.platform}.` });
    return report;
  }

  const base = fs.mkdtempSync(path.join(os.tmpdir(), "citizen-audit-isolation-probe-"));
  const hostSecretDir = path.join(base, "host-secret");
  const workspace = {
    dir: path.join(base, "workspace"),
    inputDir: path.join(base, "workspace", "inputs"),
    outputDir: path.join(base, "workspace", "outputs"),
    tmpDir: path.join(base, "workspace", "tmp"),
    sandboxDir: path.join(base, "sandbox")
  };
  fs.mkdirSync(hostSecretDir, { recursive: true });
  for (const value of [workspace.inputDir, workspace.outputDir, workspace.tmpDir, workspace.sandboxDir]) fs.mkdirSync(value, { recursive: true });
  const hostSecret = path.join(hostSecretDir, "secret.txt");
  fs.writeFileSync(hostSecret, "ORIGINAL", "utf8");
  const probeScript = [
    "set -eu",
    "printf allowed > /workspace/allowed.txt",
    `if [ -e ${JSON.stringify(hostSecret)} ]; then exit 91; fi`,
    "mkdir -p /tmp/mount-test",
    "if mount -t tmpfs none /tmp/mount-test 2>/dev/null; then exit 92; fi",
    "if unshare --user --map-root-user --mount true 2>/dev/null; then exit 93; fi"
  ].join("\n");

  let result;
  try {
    result = spawnSandboxed(workspace, { command: "/bin/sh", args: ["-ceu", probeScript] });
    const available = result.status === 0
      && fs.readFileSync(hostSecret, "utf8") === "ORIGINAL"
      && fs.readFileSync(path.join(workspace.dir, "allowed.txt"), "utf8") === "allowed";
    const report = Object.freeze({
      available,
      kind: ISOLATION_KIND,
      reason: available ? null : (result.error ? result.error.message : (result.stderr || `probe exited ${result.status}`).trim()),
      status: result.status,
      seccomp: true,
      liveRootExposed: false
    });
    return report;
  } catch (error) {
    const report = Object.freeze({ available: false, kind: ISOLATION_KIND, reason: error.message, status: null, seccomp: false, liveRootExposed: false });
    return report;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

function runExternalAgentIsolated(rootDir, workspace, agent) {
  assertExternalAgent(agent);
  const liveRoot = fs.realpathSync(rootDir);
  if (liveRoot === "/usr" || liveRoot.startsWith("/usr/")) {
    const error = new Error("The live institution root cannot reside under /usr because /usr is exposed read-only as sandbox runtime support.");
    error.code = "ISOLATION_UNAVAILABLE";
    error.capability = Object.freeze({ available: false, kind: ISOLATION_KIND, reason: error.message, seccomp: true, liveRootExposed: true });
    throw error;
  }
  const executable = resolveAgentExecutable(agent.command);
  if (executable === liveRoot || executable.startsWith(`${liveRoot}${path.sep}`)) {
    const error = new Error("The agent executable cannot reside inside the live institution root.");
    error.code = "ISOLATION_UNAVAILABLE";
    error.capability = Object.freeze({ available: false, kind: ISOLATION_KIND, reason: error.message, seccomp: true, liveRootExposed: true });
    throw error;
  }
  const capability = probeIsolationCapability();
  if (!capability.available) {
    const error = new Error(`Required agent isolation is unavailable: ${capability.reason || "capability probe failed"}`);
    error.code = "ISOLATION_UNAVAILABLE";
    error.capability = capability;
    throw error;
  }
  const workRoot = fs.realpathSync(workspace.dir);
  if (workRoot === liveRoot || workRoot.startsWith(`${liveRoot}${path.sep}`)) throw new Error("Agent workspace must be outside the live institution root.");
  const result = spawnSandboxed(workspace, agent);
  return Object.freeze({
    isolation: capability,
    status: result.status === null ? 1 : result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null
  });
}

module.exports = {
  ISOLATION_KIND,
  assertExternalAgent,
  ensureSandboxHelper,
  probeIsolationCapability,
  runExternalAgentIsolated
};
