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
  write(root, "kernel/runtime/run.js", "// Active legacy execution is permanently disabled.\nmodule.exports={};\n");
  write(root, "kernel/runtime/transactional-runtime.js", `
    function run(){resolveRegisteredAgent();snapshotGovernedTree();runExternalAgentIsolated();executeApprovedTransaction();}
    module.exports={run};
  `);
  write(root, "kernel/runtime/isolation-adapter.js", `
    const cp=require('child_process');
    const binaryHash='reviewed';
    function verifyHelperFile(){}
    function probeIsolationCapability(){return true;}
    function run(){
      const report={seccomp:true,liveRootExposed:false};
      if(!probeIsolationCapability()){const e=new Error('no isolation');e.code='ISOLATION_UNAVAILABLE';throw e;}
      verifyHelperFile(binaryHash);
      return cp.spawnSync('unshare',['--user','--mount','--pid','--','chroot','sandbox','/sandbox-exec']);
    }
    module.exports={run};
  `);
  write(root, "kernel/runtime/sandbox-exec.c", `
    #include <linux/seccomp.h>
    #define CLONE_NEWUSER 1
    #define CLONE_NEWNS 2
    #define __NR_mount 1
    #define __NR_umount2 2
    #define __NR_unshare 3
    #define __NR_setns 4
    #define __NR_pivot_root 5
    #define __NR_chroot 6
    #define __NR_open_tree 7
    #define __NR_move_mount 8
    #define __NR_fsopen 9
    #define __NR_mount_setattr 10
    void close_extra_fds(void){}
    int lock_privileges(void){return 0;}
    int main(){close_extra_fds();lock_privileges();prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0);syscall(SYS_seccomp,SECCOMP_SET_MODE_FILTER,0,0);chdir("/workspace");}
  `);
  write(root, "scripts/bypass-audit-config.json", JSON.stringify({
    version: "test-3.0.0",
    categories: { "1": "orchestrator", "2": "isolation", "3": "generated", "4": "test", "5": "recovery", "6": "unacceptable" },
    governedRecordPrefixes: ["institution/", "kernel/registry/", "kernel/execution/state/"],
    classifications: [
      { path: "kernel/runtime/run.js", category: 3, justification: "permanently disabled legacy display entry", capabilities: [] },
      { path: "kernel/runtime/transactional-runtime.js", category: 1, justification: "authoritative transactional runtime", capabilities: [] },
      { path: "kernel/runtime/isolation-adapter.js", category: 2, justification: "reviewed isolation adapter", capabilities: ["processExecution"] },
      { path: "kernel/runtime/sandbox-exec.c", category: 2, justification: "reviewed seccomp launcher", capabilities: [] }
    ]
  }, null, 2));
  return { root };
}

function updateConfig(fx, entry) {
  const configPath = path.join(fx.root, "scripts", "bypass-audit-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.classifications = config.classifications.filter((candidate) => candidate.path !== entry.path);
  config.classifications.push(entry);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function cleanup(fx) {
  fs.rmSync(fx.root, { recursive: true, force: true });
}

function violations(report) {
  return report.behavioralViolations.map((item) => `${item.file}: ${item.violation}`).join("\n");
}

function reportEntry(report, file) {
  return report.classified.find((entry) => entry.file === file);
}

test("repository-wide capability audit is clean and fully owned", () => {
  const report = run({ now: "2026-07-07T00:00:00.000Z" });
  assert.equal(report.summary.pass, true, `${violations(report)}\n${JSON.stringify(report.unexplained)}`);
  assert.equal(report.summary.classified, report.summary.mutationCapableFiles);
  assert.equal(report.summary.unexplained, 0);
  assert.equal(report.summary.behavioralViolations, 0);
  assert.match(report.assuranceStatement, /AST\/import analysis/i);
  assert.doesNotMatch(report.assuranceStatement, /no bypass exists/i);
});

test("clean AST capability fixture passes", () => {
  const fx = fixture();
  const report = run({ rootDir: fx.root, now: "fixed" });
  assert.equal(report.summary.pass, true, violations(report));
  cleanup(fx);
});

test("computed-property filesystem call is detected", () => {
  const fx = fixture();
  write(fx.root, "scripts/computed.js", `const fs=require('fs');fs['writeFileSync']('x','x');`);
  updateConfig(fx, { path: "scripts/computed.js", category: 3, justification: "fixture", capabilities: [] });
  const report = run({ rootDir: fx.root, now: "fixed" });
  assert.match(violations(report), /Discovered capability is not owned.*filesystemMutation/i);
  cleanup(fx);
});

test("aliased filesystem namespace call is detected", () => {
  const fx = fixture();
  write(fx.root, "scripts/alias.js", `const filesystem=require('fs');const second=filesystem;second.writeFileSync('x','x');`);
  updateConfig(fx, { path: "scripts/alias.js", category: 3, justification: "fixture", capabilities: [] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /filesystemMutation/);
  cleanup(fx);
});

test("inline require().member mutator alias is detected", () => {
  const fx = fixture();
  write(fx.root, "scripts/inline-alias.js", `const put=require('fs').writeFileSync;function go(){put('x','y');}module.exports={go};`);
  updateConfig(fx, { path: "scripts/inline-alias.js", category: 3, justification: "fixture", capabilities: [] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /filesystemMutation/);
  cleanup(fx);
});

test("inline require().member executor alias is detected", () => {
  const fx = fixture();
  write(fx.root, "scripts/inline-exec.js", `const spawn=require('child_process').spawnSync;function go(){spawn('sh',['-c','echo']);}module.exports={go};`);
  updateConfig(fx, { path: "scripts/inline-exec.js", category: 3, justification: "fixture", capabilities: [] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /processExecution/);
  cleanup(fx);
});

// Value-flow and dynamic-loading capability forms (Phase 4.1 expanded coverage).
const VALUE_FLOW_FORMS = {
  reassigned_alias: [`let w=null;w=require('fs').writeFileSync;w('x','y');`, /filesystemMutation/],
  call_invoke: [`const w=require('fs').writeFileSync;w.call(null,'x','y');`, /filesystemMutation/],
  apply_invoke: [`const w=require('fs').writeFileSync;w.apply(null,['x','y']);`, /filesystemMutation/],
  reflect_apply: [`const w=require('fs').writeFileSync;Reflect.apply(w,null,['x','y']);`, /filesystemMutation/],
  object_storage: [`const o={};o.put=require('fs').writeFileSync;o.put('x','y');`, /filesystemMutation/],
  array_storage: [`const a=[require('fs').writeFileSync];a[0]('x','y');`, /filesystemMutation/],
  param_passthrough: [`function run(fn){fn('x','y');}run(require('fs').writeFileSync);`, /filesystemMutation/],
  factory_return: [`function mk(){return require('fs').writeFileSync;}const w=mk();w('x','y');`, /filesystemMutation/],
  nested_member: [`const a={b:require('fs')};a.b.writeFileSync('x','y');`, /filesystemMutation/],
  chown: [`require('fs').chownSync('x',0,0);`, /filesystemMutation/],
  dynamic_import: [`async function g(){const m=await import('fs');m.writeFileSync('x','y');}`, /unknown|dynamic import/i],
  function_ctor: [`const f=Function('return require')();f('fs');`, /unknown|Function-constructor/i],
  create_require: [`const {createRequire}=require('module');const r=createRequire(__filename);r('fs');`, /unknown|createRequire/i]
};
for (const [name, [source, pattern]] of Object.entries(VALUE_FLOW_FORMS)) {
  test(`capability audit flags value-flow form: ${name}`, () => {
    const fx = fixture();
    write(fx.root, `scripts/vf-${name}.js`, source);
    updateConfig(fx, { path: `scripts/vf-${name}.js`, category: 3, justification: "fixture", capabilities: [] });
    const report = run({ rootDir: fx.root, now: "fixed" });
    const entry = report.unexplained.find((u) => u.file === `scripts/vf-${name}.js`) || report.behavioralViolations.find((v) => v.file === `scripts/vf-${name}.js`);
    assert.ok(entry, `${name} must be flagged (fail closed), not silently missed`);
    assert.match(violations(report), pattern);
    cleanup(fx);
  });
}

test("destructured renamed filesystem call is detected", () => {
  const fx = fixture();
  write(fx.root, "scripts/destructured.js", `const {writeFileSync:put}=require('node:fs');put('x','x');`);
  updateConfig(fx, { path: "scripts/destructured.js", category: 3, justification: "fixture", capabilities: [] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /filesystemMutation/);
  cleanup(fx);
});

test("local wrapper function is classified as mutation-capable", () => {
  const fx = fixture();
  write(fx.root, "scripts/wrapper.js", `const fs=require('fs');function persist(){fs.writeFileSync('x','x');}module.exports={persist};`);
  updateConfig(fx, { path: "scripts/wrapper.js", category: 3, justification: "fixture", capabilities: [] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /filesystemMutation/);
  cleanup(fx);
});

test("transitive mutation helper capability reaches its caller", () => {
  const fx = fixture();
  write(fx.root, "lib/mutation-helper.js", `const fs=require('fs');exports.persist=()=>fs.writeFileSync('x','x');`);
  write(fx.root, "scripts/caller.js", `const helper=require('../lib/mutation-helper');helper.persist();`);
  updateConfig(fx, { path: "lib/mutation-helper.js", category: 5, justification: "fixture helper", capabilities: ["filesystemMutation", "durableStateMutation"] });
  updateConfig(fx, { path: "scripts/caller.js", category: 3, justification: "fixture caller", capabilities: [] });
  const report = run({ rootDir: fx.root, now: "fixed" });
  const caller = reportEntry(report, "scripts/caller.js");
  assert.ok(caller.transitiveCapabilities.includes("filesystemMutation"));
  assert.match(violations(report), /scripts\/caller\.js: Discovered capability is not owned.*filesystemMutation/i);
  cleanup(fx);
});

test("indirect child-process execution is traced into runtime caller", () => {
  const fx = fixture();
  write(fx.root, "lib/process-helper.js", `const cp=require('child_process');exports.launch=()=>cp.spawnSync('true');`);
  write(fx.root, "kernel/runtime/indirect.js", `const helper=require('../../lib/process-helper');helper.launch();`);
  updateConfig(fx, { path: "lib/process-helper.js", category: 5, justification: "fixture helper", capabilities: ["processExecution"] });
  updateConfig(fx, { path: "kernel/runtime/indirect.js", category: 2, justification: "claimed safe runtime", capabilities: ["processExecution"] });
  const report = run({ rootDir: fx.root, now: "fixed" });
  const caller = reportEntry(report, "kernel/runtime/indirect.js");
  assert.ok(caller.transitiveCapabilities.includes("processExecution"));
  assert.match(violations(report), /indirect process-execution capability not routed/i);
  cleanup(fx);
});

test("dynamic computed filesystem capability fails closed as unknown", () => {
  const fx = fixture();
  write(fx.root, "scripts/dynamic.js", `const fs=require('fs');const name=process.argv[2];fs[name]('x','x');`);
  updateConfig(fx, { path: "scripts/dynamic.js", category: 3, justification: "fixture", capabilities: [] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /Unknown capability.*dynamic computed capability call/i);
  cleanup(fx);
});

test("unclassified mutation-capable module fails closed", () => {
  const fx = fixture();
  write(fx.root, "scripts/unowned.js", `require('fs').writeFileSync('x','x');`);
  const report = run({ rootDir: fx.root, now: "fixed" });
  assert.equal(report.summary.pass, false);
  assert.equal(report.summary.unexplained, 1);
  assert.equal(report.unexplained[0].file, "scripts/unowned.js");
  cleanup(fx);
});

test("production module falsely classified as test-only fails", () => {
  const fx = fixture();
  write(fx.root, "scripts/fake-test.js", `require('fs').writeFileSync('x','x');`);
  updateConfig(fx, { path: "scripts/fake-test.js", category: 4, justification: "false claim", capabilities: ["filesystemMutation", "durableStateMutation"] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /falsely classified as test-only/i);
  cleanup(fx);
});

test("generated-output owner cannot directly mutate a governed literal path", () => {
  const fx = fixture();
  write(fx.root, "scripts/bad-generated.js", `const fs=require('fs');fs.writeFileSync('institution/charter.md','x');`);
  updateConfig(fx, { path: "scripts/bad-generated.js", category: 3, justification: "generated output", capabilities: ["filesystemMutation", "durableStateMutation"] });
  assert.match(violations(run({ rootDir: fx.root, now: "fixed" })), /direct governed-prefix mutation/i);
  cleanup(fx);
});

test("production callback and isolation-disable surfaces fail runtime behavior checks", () => {
  const fx = fixture();
  write(fx.root, "kernel/runtime/transactional-runtime.js", `
    function run(options){
      if(options.disableIsolation)return;
      options.approvalProvider();
      options.onStep();
      resolveRegisteredAgent();snapshotGovernedTree();runExternalAgentIsolated();executeApprovedTransaction();
    }
  `);
  const text = violations(run({ rootDir: fx.root, now: "fixed" }));
  assert.match(text, /approval callback/i);
  assert.match(text, /fault callback/i);
  assert.match(text, /isolation-disable/i);
  cleanup(fx);
});

test("invalid JavaScript fails the AST inventory instead of being skipped", () => {
  const fx = fixture();
  write(fx.root, "scripts/broken.js", `const = ;`);
  assert.throws(() => run({ rootDir: fx.root, now: "fixed" }), (error) => error && error.code === "AST_PARSE_FAILURE");
  cleanup(fx);
});
