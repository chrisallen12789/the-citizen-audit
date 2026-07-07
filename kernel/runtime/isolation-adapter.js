const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { sha256 } = require("../lib/append-only-log");
const { fsyncDirectory } = require("../execution/durable-io");
const { verifyResolvedAgent } = require("./agent-registry");
const { ISOLATION_ADAPTER_VERSION, SANDBOX_HELPER_SOURCE_PATH, reviewedSandboxHelperSourceHash } = require("./runtime-provenance");

const ISOLATION_KIND = "unshare-chroot-seccomp";
const helperSourcePath = SANDBOX_HELPER_SOURCE_PATH;
const trustedHelpers = new Map();

function fixedExecutable(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}
function helperSourceHash() { return reviewedSandboxHelperSourceHash(); }
function assertOwnedDirectory(directory, expectedMode = 0o700) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Sandbox helper cache is not a regular directory: ${directory}.`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error("Sandbox helper cache ownership mismatch.");
  if ((stat.mode & 0o777) !== expectedMode) throw new Error(`Sandbox helper cache mode must be ${expectedMode.toString(8)}.`);
}
function verifyHelperFile(filePath, expectedDigest) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Sandbox helper is not a regular file.");
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error("Sandbox helper ownership mismatch.");
  if ((stat.mode & 0o777) !== 0o500) throw new Error("Sandbox helper mode must be 0500.");
  const digest = sha256(fs.readFileSync(filePath));
  if (digest !== expectedDigest) throw new Error("Sandbox helper binary digest verification failed.");
  return digest;
}
function privateCacheRoot(rootDir) {
  if (!rootDir) throw new Error("Sandbox helper requires an institution root.");
  return path.join(rootDir, ".runtime", "sandbox-helper-cache");
}
function compileHelper(rootDir) {
  const sourceHash = helperSourceHash();
  const cacheRoot = privateCacheRoot(rootDir);
  fs.mkdirSync(cacheRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(cacheRoot, 0o700);
  assertOwnedDirectory(cacheRoot);
  const compiler = fixedExecutable(["/usr/bin/gcc", "/usr/bin/cc", "/bin/cc"]);
  if (!compiler) throw Object.assign(new Error("A C compiler is required to build the seccomp sandbox launcher."), { code: "ISOLATION_UNAVAILABLE" });
  const buildDir = fs.mkdtempSync(path.join(cacheRoot, ".build-"));
  fs.chmodSync(buildDir, 0o700);
  const temporary = path.join(buildDir, "sandbox-exec");
  try {
    const result = childProcess.spawnSync(compiler, ["-O2", "-static", "-Wall", "-Wextra", "-Werror", "-s", "-o", temporary, helperSourcePath], {
      encoding: "utf8", timeout: 30000, env: { PATH: "/usr/bin:/bin" }
    });
    if (result.status !== 0 || !fs.existsSync(temporary)) {
      const error = new Error(`Could not build the seccomp sandbox launcher: ${(result.stderr || result.error?.message || `compiler exit ${result.status}`).trim()}`);
      error.code = "ISOLATION_UNAVAILABLE";
      throw error;
    }
    fs.chmodSync(temporary, 0o500);
    const binaryHash = sha256(fs.readFileSync(temporary));
    verifyHelperFile(temporary, binaryHash);
    const destination = path.join(cacheRoot, `sandbox-exec-${sourceHash}-${binaryHash}`);
    try {
      fs.linkSync(temporary, destination);
      fs.chmodSync(destination, 0o500);
      fsyncDirectory(cacheRoot);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    verifyHelperFile(destination, binaryHash);
    return Object.freeze({ path: destination, sourceHash, binaryHash });
  } finally {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
}
function ensureSandboxHelper(rootDir) {
  const sourceHash = helperSourceHash();
  const key = `${fs.realpathSync(rootDir)}:${sourceHash}`;
  let helper = trustedHelpers.get(key);
  if (!helper) {
    helper = compileHelper(rootDir);
    trustedHelpers.set(key, helper);
  }
  assertOwnedDirectory(privateCacheRoot(rootDir));
  verifyHelperFile(helper.path, helper.binaryHash);
  if (helper.sourceHash !== helperSourceHash()) throw new Error("Sandbox helper reviewed source changed after compilation.");
  return helper;
}
function clearTrustedHelperCacheForTests() { trustedHelpers.clear(); }

function prepareSandboxFilesystem(workspace, helper, executable) {
  verifyHelperFile(helper.path, helper.binaryHash);
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
  fs.copyFileSync(helper.path, launcher, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(launcher, 0o500);
  verifyHelperFile(launcher, helper.binaryHash);

  const systemProvided = executable === "/usr" || executable.startsWith("/usr/");
  const executableTarget = systemProvided ? executable : `/agent-bin/${sha256(executable).slice(0, 16)}-${path.basename(executable)}`;
  if (!systemProvided) {
    const target = path.join(sandbox, executableTarget.slice(1));
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    fs.writeFileSync(target, "", { flag: "wx", mode: 0o500 });
  }
  return Object.freeze({ launcher, executable: executableTarget, executableSource: systemProvided ? "" : executable });
}
function sanitizedEnvironment() {
  return { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", HOME: "/workspace", TMPDIR: "/tmp", CITIZEN_AUDIT_WORKSPACE: "/workspace", CITIZEN_AUDIT_INPUT_DIR: "/workspace/inputs", CITIZEN_AUDIT_OUTPUT_DIR: "/workspace/outputs" };
}
function sandboxWrapper() {
  return [
    "set -eu", "sandbox=$1", "work=$2", "tmp=$3", "agent_source=$4", "agent_target=$5", "shift 5",
    "mount --make-rprivate /", "target=\"$sandbox/usr\"", "mkdir -p \"$target\"", "mount --bind /usr \"$target\"", "mount -o remount,bind,ro,nosuid,nodev \"$target\"",
    "if [ -n \"$agent_source\" ]; then", "  mount --bind \"$agent_source\" \"$sandbox$agent_target\"", "  mount -o remount,bind,ro,nosuid,nodev \"$sandbox$agent_target\"", "fi",
    "mount --bind \"$work\" \"$sandbox/workspace\"", "mount -o remount,bind,rw,nosuid,nodev,noexec \"$sandbox/workspace\"",
    "mount --bind \"$tmp\" \"$sandbox/tmp\"", "mount -o remount,bind,rw,nosuid,nodev,noexec \"$sandbox/tmp\"",
    "for device in null urandom random; do", "  mount --bind \"/dev/$device\" \"$sandbox/dev/$device\"", "done",
    "exec chroot \"$sandbox\" /sandbox-exec \"$agent_target\" \"$@\""
  ].join("\n");
}
function spawnSandboxed(rootDir, workspace, agent) {
  const unshare = fixedExecutable(["/usr/bin/unshare", "/bin/unshare"]);
  if (!unshare) throw Object.assign(new Error("unshare is unavailable."), { code: "ISOLATION_UNAVAILABLE" });
  verifyResolvedAgent(agent);
  const helper = ensureSandboxHelper(rootDir);
  const sandbox = prepareSandboxFilesystem(workspace, helper, agent.command);
  const result = childProcess.spawnSync(unshare, ["--user", "--map-root-user", "--mount", "--pid", "--fork", "--net", "--ipc", "--uts", "--", "/bin/sh", "-ceu", sandboxWrapper(), "sh", workspace.sandboxDir, workspace.dir, workspace.tmpDir, sandbox.executableSource, sandbox.executable, ...(agent.args || [])], {
    cwd: workspace.dir, encoding: "utf8", env: sanitizedEnvironment(), timeout: Number.isInteger(agent.timeoutMs) ? agent.timeoutMs : 120000, maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]
  });
  verifyHelperFile(helper.path, helper.binaryHash);
  return { result, helper };
}
function probeIsolationCapability(rootDir, resolvedAgent) {
  if (process.platform !== "linux") return Object.freeze({ available: false, kind: ISOLATION_KIND, reason: `Unsupported operating system: ${process.platform}.` });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "citizen-audit-isolation-probe-"));
  const hostSecretDir = path.join(base, "host-secret");
  const workspace = { dir: path.join(base, "workspace"), inputDir: path.join(base, "workspace", "inputs"), outputDir: path.join(base, "workspace", "outputs"), tmpDir: path.join(base, "workspace", "tmp"), sandboxDir: path.join(base, "sandbox") };
  fs.mkdirSync(hostSecretDir, { recursive: true });
  for (const value of [workspace.inputDir, workspace.outputDir, workspace.tmpDir, workspace.sandboxDir]) fs.mkdirSync(value, { recursive: true });
  const hostSecret = path.join(hostSecretDir, "secret.txt");
  fs.writeFileSync(hostSecret, "ORIGINAL", "utf8");
  const probeArgs = ["-e", `const fs=require('fs');fs.writeFileSync('/workspace/allowed.txt','allowed');if(fs.existsSync(${JSON.stringify(hostSecret)}))process.exit(91);`];
  const probe = Object.freeze({ ...resolvedAgent, command: process.execPath, args: probeArgs, expectedExecutableDigest: sha256(fs.readFileSync(process.execPath)), provenance: { ...resolvedAgent.provenance, executableRealPath: fs.realpathSync(process.execPath), executableDigest: sha256(fs.readFileSync(process.execPath)), argumentsDigest: require("../lib/append-only-log").sha256(require("../lib/canonical-json").canonicalStringify(probeArgs)) } });
  try {
    const { result } = spawnSandboxed(rootDir, workspace, probe);
    const available = result.status === 0 && fs.readFileSync(hostSecret, "utf8") === "ORIGINAL" && fs.readFileSync(path.join(workspace.dir, "allowed.txt"), "utf8") === "allowed";
    return Object.freeze({ available, kind: ISOLATION_KIND, reason: available ? null : (result.error ? result.error.message : (result.stderr || `probe exited ${result.status}`).trim()), status: result.status, seccomp: true, liveRootExposed: false });
  } catch (error) {
    return Object.freeze({ available: false, kind: ISOLATION_KIND, reason: error.message, status: null, seccomp: false, liveRootExposed: false });
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
function runExternalAgentIsolated(rootDir, workspace, agent) {
  verifyResolvedAgent(agent);
  const liveRoot = fs.realpathSync(rootDir);
  if (liveRoot === "/usr" || liveRoot.startsWith("/usr/")) throw Object.assign(new Error("The live institution root cannot reside under /usr because /usr is exposed read-only as sandbox runtime support."), { code: "ISOLATION_UNAVAILABLE" });
  if (agent.command === liveRoot || agent.command.startsWith(`${liveRoot}${path.sep}`)) throw Object.assign(new Error("The registered agent executable cannot reside inside the live institution root."), { code: "ISOLATION_UNAVAILABLE" });
  const capability = probeIsolationCapability(rootDir, agent);
  if (!capability.available) {
    const error = new Error(`Required agent isolation is unavailable: ${capability.reason || "capability probe failed"}`); error.code = "ISOLATION_UNAVAILABLE"; error.capability = capability; throw error;
  }
  const workRoot = fs.realpathSync(workspace.dir);
  if (workRoot === liveRoot || workRoot.startsWith(`${liveRoot}${path.sep}`)) throw new Error("Agent workspace must be outside the live institution root.");
  const { result, helper } = spawnSandboxed(rootDir, workspace, agent);
  return Object.freeze({
    isolation: capability,
    status: result.status === null ? 1 : result.status,
    signal: result.signal || null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null,
    provenance: Object.freeze({ ...agent.provenance, isolationAdapterVersion: ISOLATION_ADAPTER_VERSION, sandboxHelperSourceHash: helper.sourceHash, sandboxHelperBinaryHash: helper.binaryHash })
  });
}
module.exports = { ISOLATION_ADAPTER_VERSION, ISOLATION_KIND, clearTrustedHelperCacheForTests, ensureSandboxHelper, probeIsolationCapability, reviewedSandboxHelperSourceHash, runExternalAgentIsolated, verifyHelperFile };
