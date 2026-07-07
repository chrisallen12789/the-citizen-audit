const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { run } = require("../scripts/bypass-audit");

function write(root, relativePath, source) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bypass-audit-fixture-"));
  const classifications = [
    { path: "kernel/runtime/run.js", category: 3, justification: "legacy dry-run diagnostics" },
    { path: "kernel/runtime/transactional-runtime.js", category: 1, justification: "orchestrator-only runtime integration" },
    { path: "kernel/runtime/isolation-adapter.js", category: 2, justification: "approved isolation adapter" },
    { path: "kernel/runtime/sandbox-exec.c", category: 2, justification: "approved seccomp launcher" },
    { path: "kernel/runtime/agent-workspace.js", category: 2, justification: "workspace only" }
  ];
  write(root, "kernel/runtime/run.js", `const fs=require('fs');\n// Active legacy execution is permanently disabled.\nfs.writeFileSync('docs/agent-reports/status.md','dry');\n`);
  write(root, "kernel/runtime/transactional-runtime.js", `function x(){snapshotGovernedTree();runExternalAgentIsolated();executeApprovedTransaction();}\n`);
  write(root, "kernel/runtime/isolation-adapter.js", `const {spawnSync}=require('child_process');\nconst ISOLATION_KIND='unshare-chroot-seccomp';\nfunction probeIsolationCapability(){}\nfunction run(){if(!probeIsolationCapability()) { const e=new Error('no'); e.code='ISOLATION_UNAVAILABLE'; throw e; } const report={seccomp:true,liveRootExposed:false}; return spawnSync('unshare',['--user','--mount','--pid','--','chroot','sandbox','/sandbox-exec']);}\n`);
  write(root, "kernel/runtime/sandbox-exec.c", `#include <linux/seccomp.h>\n#define CLONE_NEWUSER 1\n#define CLONE_NEWNS 2\n#define __NR_mount 1\n#define __NR_umount2 2\n#define __NR_unshare 3\n#define __NR_setns 4\n#define __NR_pivot_root 5\n#define __NR_chroot 6\n#define __NR_open_tree 7\n#define __NR_move_mount 8\n#define __NR_fsopen 9\n#define __NR_mount_setattr 10\nvoid close_extra_fds(void){}\nint lock_privileges(void){return 0;}\nint main(){close_extra_fds();lock_privileges();prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0);syscall(SYS_seccomp,SECCOMP_SET_MODE_FILTER,0,0);chdir("/workspace");}\n`);
  write(root, "kernel/runtime/agent-workspace.js", `const fs=require('fs');fs.mkdirSync('/tmp/work');\n`);
  write(root, "scripts/bypass-audit-config.json", JSON.stringify({
    version: "test",
    categories: { "1": "orchestrator", "2": "isolation", "3": "generated", "4": "test", "5": "recovery", "6": "bad" },
    governedRecordPrefixes: ["institution/", "kernel/registry/"],
    classifications
  }, null, 2));
  return { root, classifications };
}

function updateConfig(fx, entry) {
  const configPath = path.join(fx.root, "scripts", "bypass-audit-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.classifications = config.classifications.filter((candidate) => candidate.path !== entry.path);
  config.classifications.push(entry);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function cleanup(fx) { fs.rmSync(fx.root, { recursive: true, force: true }); }
function violations(report) { return report.behavioralViolations.map((item) => `${item.file}: ${item.violation}`).join("\n"); }

test("repository-wide bypass audit is behaviorally clean", () => {
  const report = run({ now: "2026-07-06T00:00:00.000Z" });
  assert.equal(report.summary.pass, true, violations(report));
  assert.equal(report.summary.unexplained, 0);
  assert.equal(report.summary.behavioralViolations, 0);
});

test("bypass audit classifies every mutation-capable file with behavior results", () => {
  const report = run({ now: "2026-07-06T00:00:00.000Z" });
  assert.equal(report.summary.classified, report.summary.mutationCapableFiles);
  for (const entry of report.classified) {
    assert.ok(entry.category >= 1 && entry.category <= 6);
    assert.ok(entry.justification);
    assert.equal(entry.sourceBehaviorChecks, "passed", `${entry.file}: ${entry.violations.join(", ")}`);
  }
});

test("clean behavioral fixture passes", () => {
  const fx = fixture();
  const report = run({ rootDir: fx.root, now: "fixed" });
  assert.equal(report.summary.pass, true, violations(report));
  cleanup(fx);
});

test("uncontrolled runtime spawn fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/evil.js", `require('child_process').spawn('sh',[]);`);
  updateConfig(fx, { path: "kernel/runtime/evil.js", category: 2, justification: "claimed isolation" });
  const report = run({ rootDir: fx.root, now: "fixed" });
  assert.match(violations(report), /outside the approved isolation adapter/);
  cleanup(fx);
});

test("uncontrolled runtime exec fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/evil.js", `require('child_process').exec('touch x');`);
  updateConfig(fx, { path: "kernel/runtime/evil.js", category: 2, justification: "claimed isolation" });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /outside the approved isolation adapter/);
  cleanup(fx);
});

test("legacy uncontrolled override flag fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/run.js", `const fs=require('fs');fs.writeFileSync('x','x');if(process.argv.includes('--legacy-uncontrolled-ack')){}; // Active legacy execution is permanently disabled`);
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /override flag/);
  cleanup(fx);
});

test("production in-process agent adapter fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/transactional-runtime.js", `function x(agent){if(typeof agent.fn==='function')agent.fn();snapshotGovernedTree();runExternalAgentIsolated();executeApprovedTransaction();}`);
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /in-process function agent/);
  cleanup(fx);
});

test("caller-controlled isolation disable fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/transactional-runtime.js", `function x(options){if(options.disableIsolation)return; snapshotGovernedTree();runExternalAgentIsolated();executeApprovedTransaction();}`);
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /isolation-disable/);
  cleanup(fx);
});

test("caller-controlled sentinel protection fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/transactional-runtime.js", `function x(options){snapshotGovernedSentinels(options.sentinelPaths);runExternalAgentIsolated();executeApprovedTransaction();}`);
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /sentinel/);
  cleanup(fx);
});

test("unclassified mutation-capable file fails audit", () => {
  const fx = fixture();
  write(fx.root, "scripts/unclassified.js", `require('fs').writeFileSync('x','x');`);
  const report = run({ rootDir: fx.root, now: "fixed" });
  assert.equal(report.summary.unexplained, 1);
  assert.equal(report.summary.pass, false);
  cleanup(fx);
});

test("production file falsely classified test-only fails audit", () => {
  const fx = fixture();
  write(fx.root, "scripts/fake-test.js", `require('fs').writeFileSync('x','x');`);
  updateConfig(fx, { path: "scripts/fake-test.js", category: 4, justification: "not actually a test" });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /falsely classified/);
  cleanup(fx);
});

test("category 3 direct governed-prefix mutation fails audit", () => {
  const fx = fixture();
  write(fx.root, "scripts/bad-generated.js", `require('fs').writeFileSync('institution/charter.md','x');`);
  updateConfig(fx, { path: "scripts/bad-generated.js", category: 3, justification: "claimed generated output" });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /governed-prefix mutation/);
  cleanup(fx);
});

test("isolation adapter without capability probe, chroot, seccomp, and fail-closed behavior fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/isolation-adapter.js", `const {spawnSync}=require('child_process');function run(){return spawnSync('node',[]);}`);
  const text = violations(run({ rootDir: fx.root, now: "fixed" }));
  assert.match(text, /capability probe/);
  assert.match(text, /chrooted sandbox/);
  assert.match(text, /sandbox launcher/);
  assert.match(text, /seccomp/);
  assert.match(text, /fail-closed/);
  cleanup(fx);
});

test("silent unisolated fallback fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/isolation-adapter.js", `const {spawnSync}=require('child_process');function probeIsolationCapability(){} const report={seccomp:true,liveRootExposed:false}; // chroot sandbox /sandbox-exec --user --mount --pid\nfunction run(options){if(options.allowUnisolated)return spawnSync('node',[]);const e=new Error();e.code='ISOLATION_UNAVAILABLE';throw e;}`);
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /unsafe fallback|disable surface/);
  cleanup(fx);
});


test("missing sandbox helper fails audit", () => {
  const fx = fixture();
  fs.rmSync(path.join(fx.root, "kernel/runtime/sandbox-exec.c"));
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /security file was not scanned or is missing/);
  cleanup(fx);
});

test("sandbox helper without seccomp enforcement fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/sandbox-exec.c", `int main(){chdir("/workspace");}`);
  const text = violations(run({ rootDir: fx.root, now: "fixed" }));
  assert.match(text, /seccompFilter|noNewPrivileges|blocksMount/);
  cleanup(fx);
});

test("isolation adapter that bind-mounts the live root fails audit", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/isolation-adapter.js", `const {spawnSync}=require('child_process');function probeIsolationCapability(){} const report={seccomp:true,liveRootExposed:false}; // chroot sandbox /sandbox-exec --user --mount --pid\nfunction run(rootDir){ mount --bind rootDir sandbox/live; const e=new Error();e.code='ISOLATION_UNAVAILABLE';return spawnSync('unshare',[]);}`);
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /live institution root/);
  cleanup(fx);
});
