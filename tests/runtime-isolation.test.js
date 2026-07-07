const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createWorkspace, cleanupWorkspace, assertWorkspaceIsolation, workspaceRoot } = require("../kernel/runtime/agent-workspace");
const { probeIsolationCapability, runExternalAgentIsolated } = require("../kernel/runtime/isolation-adapter");
const { snapshotGovernedTree, inspectAndRestoreGovernedTree, diffGovernedTrees } = require("../kernel/runtime/governed-tree-guard");
const { runTransactionalAgent } = require("../kernel/runtime/transactional-runtime");
const { recordRuntimeIsolationBarrier, runtimeIsolationBarrierPath } = require("../kernel/execution/runtime-isolation-barrier");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-iso-root-"));
  fs.mkdirSync(path.join(root, "institution", "nested"), { recursive: true });
  fs.mkdirSync(path.join(root, "kernel", "runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, "institution", "charter.md"), "ORIGINAL CHARTER");
  fs.writeFileSync(path.join(root, "institution", "nested", "notes.md"), "ORIGINAL NOTES");
  fs.chmodSync(path.join(root, "institution", "charter.md"), 0o640);
  return { root, charter: path.join(root, "institution", "charter.md"), notes: path.join(root, "institution", "nested", "notes.md") };
}

function cleanup(fx) { fs.rmSync(fx.root, { recursive: true, force: true }); }
function nodeAgent(source) { return { command: process.execPath, args: ["-e", source] }; }
function runIsolated(fx, runId, source) {
  const workspace = createWorkspace(fx.root, runId);
  const result = runExternalAgentIsolated(fx.root, workspace, nodeAgent(source));
  return { workspace, result };
}

function restoreCase(name, mutate, verify) {
  test(name, () => {
    const fx = fixture();
    const before = snapshotGovernedTree(fx.root);
    mutate(fx);
    const inspection = inspectAndRestoreGovernedTree(fx.root, before);
    assert.equal(inspection.changed, true);
    assert.equal(inspection.restoration.verified, true, inspection.restoration.problems.join("\n"));
    const after = snapshotGovernedTree(fx.root);
    assert.deepEqual(diffGovernedTrees(before, after), []);
    verify(fx);
    cleanup(fx);
  });
}

test("isolation capability probe verifies chroot seccomp sandbox with no live-root exposure", () => {
  const report = probeIsolationCapability();
  assert.equal(report.kind, "unshare-chroot-seccomp");
  assert.equal(report.available, true, report.reason || "isolation unavailable");
});



test("sandboxed agent has no effective, bounding, or ambient capabilities", () => {
  const fx = fixture();
  const workspace = createWorkspace(fx.root, "RUN-ISO-CAPS-1");
  const result = runExternalAgentIsolated(fx.root, workspace, { command: "capsh", args: ["--print"] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Current:\s*=\s*$/m);
  assert.match(result.stdout, /Bounding set\s*=\s*$/m);
  assert.match(result.stdout, /Ambient set = <unsupported>|Ambient set =\s*$/m);
  assert.match(result.stdout, /no-new-privs=1/);
  cleanupWorkspace(workspace); cleanup(fx);
});


test("non-system agent executable is mounted alone without exposing sibling host files", () => {
  const fx = fixture();
  const hostAgentDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-agent-bin-"));
  const agentPath = path.join(hostAgentDir, "agent.sh");
  const secretPath = path.join(hostAgentDir, "secret.txt");
  fs.writeFileSync(secretPath, "HOST SECRET");
  fs.writeFileSync(agentPath, `#!/bin/sh\nif [ -e ${JSON.stringify(secretPath)} ]; then exit 91; fi\nprintf isolated > /workspace/outputs/result.txt\n`);
  fs.chmodSync(agentPath, 0o500);
  const workspace = createWorkspace(fx.root, "RUN-ISO-BIN-1");
  const result = runExternalAgentIsolated(fx.root, workspace, { command: agentPath, args: [] });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(workspace.outputDir, "result.txt"), "utf8"), "isolated");
  cleanupWorkspace(workspace); fs.rmSync(hostAgentDir, { recursive: true, force: true }); cleanup(fx);
});

test("agent executable inside the live institution is rejected before execution", () => {
  const fx = fixture();
  const agentPath = path.join(fx.root, "institution", "agent.sh");
  fs.writeFileSync(agentPath, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(agentPath, 0o500);
  const workspace = createWorkspace(fx.root, "RUN-ISO-LIVE-BIN-1");
  assert.throws(
    () => runExternalAgentIsolated(fx.root, workspace, { command: agentPath, args: [] }),
    (error) => error && error.code === "ISOLATION_UNAVAILABLE" && /inside the live institution/.test(error.message)
  );
  cleanupWorkspace(workspace); cleanup(fx);
});

test("sandbox exposes no proc filesystem or inherited file descriptors", () => {
  const fx = fixture();
  const hostAgentDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-fd-probe-"));
  const sourcePath = path.join(hostAgentDir, "fd-probe.c");
  const executablePath = path.join(hostAgentDir, "fd-probe");
  fs.writeFileSync(sourcePath, `
    #include <errno.h>
    #include <fcntl.h>
    #include <unistd.h>
    int main(void) {
      if (access("/proc/self/fd", F_OK) == 0) return 91;
      for (int fd = 3; fd < 256; ++fd) {
        errno = 0;
        if (fcntl(fd, F_GETFD) != -1 || errno != EBADF) return 92;
      }
      return 0;
    }
  `);
  const compiled = require("node:child_process").spawnSync("/usr/bin/gcc", ["-O2", "-static", "-Wall", "-Wextra", "-Werror", "-o", executablePath, sourcePath], { encoding: "utf8" });
  assert.equal(compiled.status, 0, compiled.stderr);
  const workspace = createWorkspace(fx.root, "RUN-ISO-FD-1");
  const result = runExternalAgentIsolated(fx.root, workspace, { command: executablePath, args: [] });
  assert.equal(result.status, 0, result.stderr);
  cleanupWorkspace(workspace); fs.rmSync(hostAgentDir, { recursive: true, force: true }); cleanup(fx);
});

test("workspace is outside live root and contains no symlink", () => {
  const fx = fixture();
  const workspace = createWorkspace(fx.root, "RUN-ISO-WORK-1");
  assert.equal(assertWorkspaceIsolation(fx.root, workspace.dir), true);
  assert.ok(!workspace.dir.startsWith(`${fx.root}${path.sep}`));
  cleanupWorkspace(workspace);
  cleanup(fx);
});

test("workspace symlink is rejected", () => {
  const fx = fixture();
  const workspace = createWorkspace(fx.root, "RUN-ISO-LINK-1");
  fs.symlinkSync(fx.root, path.join(workspace.outputDir, "live-link"));
  assert.throws(() => assertWorkspaceIsolation(fx.root, workspace.dir), /symlink/i);
  cleanupWorkspace(workspace);
  cleanup(fx);
});

test("absolute live-root modification is prevented", () => {
  const fx = fixture();
  const source = `
    const fs=require('fs');
    try { fs.writeFileSync(${JSON.stringify(fx.charter)}, 'TAMPERED'); process.exit(91); }
    catch (error) { process.exit(0); }
  `;
  const { workspace, result } = runIsolated(fx, "RUN-ISO-ABS-1", source);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER");
  cleanupWorkspace(workspace); cleanup(fx);
});

test("new governed file creation is prevented", () => {
  const fx = fixture();
  const target = path.join(fx.root, "institution", "new.md");
  const { workspace, result } = runIsolated(fx, "RUN-ISO-CREATE-1", `const fs=require('fs');try{fs.writeFileSync(${JSON.stringify(target)},'x');process.exit(91)}catch(e){process.exit(0)}`);
  assert.equal(result.status, 0); assert.equal(fs.existsSync(target), false);
  cleanupWorkspace(workspace); cleanup(fx);
});

test("governed deletion is prevented", () => {
  const fx = fixture();
  const { workspace, result } = runIsolated(fx, "RUN-ISO-DELETE-1", `const fs=require('fs');try{fs.unlinkSync(${JSON.stringify(fx.charter)});process.exit(91)}catch(e){process.exit(0)}`);
  assert.equal(result.status, 0); assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER");
  cleanupWorkspace(workspace); cleanup(fx);
});

test("governed rename is prevented", () => {
  const fx = fixture();
  const renamed = path.join(fx.root, "institution", "renamed.md");
  const { workspace, result } = runIsolated(fx, "RUN-ISO-RENAME-1", `const fs=require('fs');try{fs.renameSync(${JSON.stringify(fx.charter)},${JSON.stringify(renamed)});process.exit(91)}catch(e){process.exit(0)}`);
  assert.equal(result.status, 0); assert.equal(fs.existsSync(renamed), false); assert.equal(fs.existsSync(fx.charter), true);
  cleanupWorkspace(workspace); cleanup(fx);
});

test("governed permission change is prevented", () => {
  const fx = fixture();
  const { workspace, result } = runIsolated(fx, "RUN-ISO-MODE-1", `const fs=require('fs');try{fs.chmodSync(${JSON.stringify(fx.charter)},0o777);process.exit(91)}catch(e){process.exit(0)}`);
  assert.equal(result.status, 0); assert.equal(fs.statSync(fx.charter).mode & 0o777, 0o640);
  cleanupWorkspace(workspace); cleanup(fx);
});

test("governed symlink creation is prevented", () => {
  const fx = fixture();
  const link = path.join(fx.root, "institution", "escape-link");
  const { workspace, result } = runIsolated(fx, "RUN-ISO-SYMLINK-1", `const fs=require('fs');try{fs.symlinkSync('/tmp',${JSON.stringify(link)});process.exit(91)}catch(e){process.exit(0)}`);
  assert.equal(result.status, 0); assert.equal(fs.existsSync(link), false);
  cleanupWorkspace(workspace); cleanup(fx);
});

test("nested governed directory creation is prevented", () => {
  const fx = fixture();
  const target = path.join(fx.root, "institution", "a", "b", "c");
  const { workspace, result } = runIsolated(fx, "RUN-ISO-NEST-1", `const fs=require('fs');try{fs.mkdirSync(${JSON.stringify(target)},{recursive:true});process.exit(91)}catch(e){process.exit(0)}`);
  assert.equal(fs.existsSync(target), false, "host governed path remains absent even if a mirror path is created inside the chroot");
  cleanupWorkspace(workspace); cleanup(fx);
});

test("shell redirection to governed path is prevented", () => {
  const fx = fixture();
  const workspace = createWorkspace(fx.root, "RUN-ISO-SHELL-1");
  const result = runExternalAgentIsolated(fx.root, workspace, { command: "sh", args: ["-c", `printf TAMPERED > ${JSON.stringify(fx.charter)}`] });
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER");
  cleanupWorkspace(workspace); cleanup(fx);
});

test("subprocess-spawned governed write is prevented", () => {
  const fx = fixture();
  const source = `
    const cp=require('child_process');
    const r=cp.spawnSync('sh',['-c',${JSON.stringify(`printf TAMPERED > ${JSON.stringify(fx.charter)}`)}]);
    process.exit(r.status===0?91:0);
  `;
  const { workspace, result } = runIsolated(fx, "RUN-ISO-SUBPROC-1", source);
  assert.equal(result.status, 0); assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER");
  cleanupWorkspace(workspace); cleanup(fx);
});


test("nested user namespace escape is blocked by seccomp", () => {
  const fx = fixture();
  const source = `
    const cp=require('child_process');
    const r=cp.spawnSync('unshare',['--user','--map-root-user','--mount','true']);
    process.exit(r.status===0?91:0);
  `;
  const { workspace, result } = runIsolated(fx, "RUN-ISO-NESTED-NS-1", source);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER");
  cleanupWorkspace(workspace); cleanup(fx);
});

test("mount and remount syscalls are blocked inside the sandbox", () => {
  const fx = fixture();
  const source = `
    const cp=require('child_process');
    const a=cp.spawnSync('mount',['-t','tmpfs','none','/tmp']);
    const b=cp.spawnSync('mount',['-o','remount,rw','/usr']);
    process.exit(a.status===0||b.status===0?91:0);
  `;
  const { workspace, result } = runIsolated(fx, "RUN-ISO-MOUNT-1", source);
  assert.equal(result.status, 0, result.stderr);
  cleanupWorkspace(workspace); cleanup(fx);
});

test("agent environment exposes no live-root variable", () => {
  const fx = fixture();
  const workspace = createWorkspace(fx.root, "RUN-ISO-ENV-1");
  const result = runExternalAgentIsolated(fx.root, workspace, nodeAgent(`
    const fs=require('fs');
    fs.writeFileSync(process.env.CITIZEN_AUDIT_OUTPUT_DIR+'/env.json', JSON.stringify(process.env));
  `));
  assert.equal(result.status, 0);
  const env = JSON.parse(fs.readFileSync(path.join(workspace.outputDir, "env.json"), "utf8"));
  assert.equal(Object.values(env).includes(fx.root), false);
  assert.equal(env.CITIZEN_AUDIT_OUTPUT_DIR, "/workspace/outputs");
  cleanupWorkspace(workspace); cleanup(fx);
});

restoreCase("guard restores newly created governed file", (fx) => fs.writeFileSync(path.join(fx.root, "institution", "created.md"), "NEW"), (fx) => assert.equal(fs.existsSync(path.join(fx.root, "institution", "created.md")), false));
restoreCase("guard restores modified governed bytes", (fx) => fs.writeFileSync(fx.charter, "TAMPERED"), (fx) => assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER"));
restoreCase("guard restores deleted governed file", (fx) => fs.unlinkSync(fx.charter), (fx) => assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER"));
restoreCase("guard restores renamed governed file", (fx) => fs.renameSync(fx.charter, path.join(fx.root, "institution", "renamed.md")), (fx) => { assert.equal(fs.existsSync(path.join(fx.root, "institution", "renamed.md")), false); assert.equal(fs.existsSync(fx.charter), true); });
restoreCase("guard restores permission-only drift", (fx) => fs.chmodSync(fx.charter, 0o777), (fx) => assert.equal(fs.statSync(fx.charter).mode & 0o777, 0o640));
restoreCase("guard removes introduced symlink", (fx) => fs.symlinkSync("/tmp", path.join(fx.root, "institution", "link")), (fx) => assert.throws(() => fs.lstatSync(path.join(fx.root, "institution", "link")), /ENOENT/));
restoreCase("guard removes newly created nested paths", (fx) => { const target=path.join(fx.root,"institution","x","y"); fs.mkdirSync(target,{recursive:true}); fs.writeFileSync(path.join(target,"z"),"x"); }, (fx) => assert.equal(fs.existsSync(path.join(fx.root,"institution","x")), false));
restoreCase("guard restores combined byte type mode symlink and existence drift", (fx) => {
  fs.writeFileSync(fx.charter, "TAMPERED");
  fs.unlinkSync(fx.notes);
  fs.chmodSync(fx.charter, 0o777);
  fs.symlinkSync("/tmp", path.join(fx.root, "institution", "link"));
  fs.mkdirSync(path.join(fx.root, "institution", "newdir"));
}, (fx) => {
  assert.equal(fs.readFileSync(fx.charter, "utf8"), "ORIGINAL CHARTER");
  assert.equal(fs.statSync(fx.charter).mode & 0o777, 0o640);
  assert.equal(fs.readFileSync(fx.notes, "utf8"), "ORIGINAL NOTES");
});

test("production runtime rejects in-process agent without invoking it", async () => {
  const fx = fixture();
  let invoked = false;
  const result = await runTransactionalAgent({ rootDir: fx.root, runId: "RUN-ISO-FN-1", agent: { fn: () => { invoked = true; } }, actor: { type: "agent", id: "A" }, action: "x", affectedObjects: [] });
  assert.equal(invoked, false); assert.equal(result.institutionalResult, "agent_rejected");
  cleanup(fx);
});

test("isolation unavailable fails closed before agent starts", () => {
  const fx = fixture();
  const marker = path.join(os.tmpdir(), `phase4-agent-start-${process.pid}-${Date.now()}`);
  const script = `
    const fs=require('fs');
    const original=fs.existsSync;
    fs.existsSync=(value)=>String(value).endsWith('/unshare') ? false : original(value);
    const {runTransactionalAgent}=require(${JSON.stringify(path.join(__dirname, "..", "kernel", "runtime", "transactional-runtime.js"))});
    runTransactionalAgent({
      rootDir:${JSON.stringify(fx.root)},
      runId:'RUN-ISO-NO-CHILD-1',
      agent:{command:process.execPath,args:['-e',${JSON.stringify(`require('fs').writeFileSync(${JSON.stringify(marker)},'started')`)}]},
      actor:{type:'agent',id:'A'},action:'x',affectedObjects:[]
    }).then((result)=>process.stdout.write(JSON.stringify(result)));
  `;
  const child = require("node:child_process").spawnSync(process.execPath, ["-e", script], { encoding: "utf8", cwd: path.join(__dirname, "..") });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.institutionalResult, "isolation_unavailable");
  assert.equal(result.agentProcess.ran, false);
  assert.equal(fs.existsSync(marker), false);
  fs.rmSync(marker, { force: true });
  cleanup(fx);
});

test("cleanup failure cannot convert agent failure into success", async () => {
  const fx = fixture();
  const originalRm = fs.rmSync;
  fs.rmSync = function patched(target, options) {
    if (String(target).includes("RUN-ISO-CLEAN-1")) throw new Error("injected cleanup failure");
    return originalRm.call(fs, target, options);
  };
  let result;
  try {
    result = await runTransactionalAgent({ rootDir: fx.root, runId: "RUN-ISO-CLEAN-1", agent: nodeAgent("process.exit(9)"), actor: { type: "agent", id: "A" }, action: "x", affectedObjects: [] });
  } finally {
    fs.rmSync = originalRm;
  }
  assert.equal(result.institutionalResult, "agent_failed");
  assert.match(result.cleanup.error, /cleanup failure/);
  const workspacePath = workspaceRoot(fx.root);
  originalRm.call(fs, path.join(workspacePath, "RUN-ISO-CLEAN-1"), { recursive: true, force: true });
  originalRm.call(fs, path.join(workspacePath, "RUN-ISO-CLEAN-1.sandbox"), { recursive: true, force: true });
  cleanup(fx);
});


test("durable runtime isolation barrier blocks later agent execution before start", async () => {
  const fx = fixture();
  const marker = path.join(os.tmpdir(), `phase4-barrier-agent-${process.pid}-${Date.now()}`);
  recordRuntimeIsolationBarrier(fx.root, {
    runId: "RUN-ISO-BARRIER-SOURCE",
    beforeHash: "b".repeat(64),
    afterHash: null,
    problems: ["injected unprovable restoration"]
  });
  assert.equal(fs.existsSync(runtimeIsolationBarrierPath(fx.root)), true);
  const result = await runTransactionalAgent({
    rootDir: fx.root,
    runId: "RUN-ISO-BARRIER-NEXT",
    agent: nodeAgent(`require('fs').writeFileSync(${JSON.stringify(marker)},'started')`),
    actor: { type: "agent", id: "A" },
    action: "x",
    affectedObjects: []
  });
  assert.equal(result.institutionalResult, "recovery_required");
  assert.equal(result.agentProcess.ran, false);
  assert.equal(fs.existsSync(marker), false);
  cleanup(fx);
});
