const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runValidationPhase } = require("../kernel/execution/validation-cycle");
const { extractStaticValidatorContract, loadValidatorRegistry } = require("../kernel/execution/validators");
const { buildValidatorClosure } = require("../kernel/execution/validator-closure");
const { loadValidatorRegistryForTest } = require("./support/validator-test-harness");

const REAL_VALIDATORS = path.join(__dirname, "..", "kernel", "execution", "validators");
const HOLDER = path.join(__dirname, "..", "kernel", "execution");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-mods-"));
test.after(() => { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) {} });

let seq = 0;
function writeStrictFile(filePath, content) {
  fs.writeFileSync(filePath, content);
  try { fs.chmodSync(filePath, 0o600); } catch (e) {}
}
function makeValidatorModule(validateBody, opts = {}) {
  const id = opts.id || `tv-${seq++}`;
  const version = opts.version || "1.0.0";
  const semantic = opts.semantic || false;
  const actions = opts.actions || [];
  const supportedPhases = opts.supportedPhases || ["candidate"];
  const src = `"use strict";
function validate(context){ ${validateBody} }
module.exports={id:${JSON.stringify(id)},version:${JSON.stringify(version)},semantic:${semantic},actions:${JSON.stringify(actions)},supportedPhases:${JSON.stringify(supportedPhases)},validate};
`;
  const modulePath = path.join(scratch, `${id}.js`);
  writeStrictFile(modulePath, src);
  const moduleHash = crypto.createHash("sha256").update(fs.readFileSync(modulePath)).digest("hex");
  const c = buildValidatorClosure(modulePath, scratch);
  const closure = { closureRoot: c.closureRoot, rootPolicy: c.rootPolicy, entryRelPath: c.entryRelPath, modules: c.manifest, builtins: c.builtins, closureHash: c.closureHash };
  const contract = { id, version, semantic, actions: [...actions].sort(), supportedPhases: [...supportedPhases].sort() };
  return { id, version, modulePath, moduleHash, semantic, actions, supportedPhases, closure, contract };
}
function rawDescriptor(id, source, over = {}) {
  const modulePath = path.join(scratch, `${id}.js`);
  writeStrictFile(modulePath, source);
  const moduleHash = crypto.createHash("sha256").update(fs.readFileSync(modulePath)).digest("hex");
  let closure = null;
  try { const c = buildValidatorClosure(modulePath, scratch); closure = { closureRoot: c.closureRoot, rootPolicy: c.rootPolicy, entryRelPath: c.entryRelPath, modules: c.manifest, builtins: c.builtins, closureHash: c.closureHash }; } catch (e) { closure = { __buildError: e.message, closureRoot: path.dirname(modulePath), entryRelPath: path.basename(modulePath), modules: [{ relPath: path.basename(modulePath), hash: moduleHash }], builtins: [] }; }
  return Object.assign({ id, version: "1.0.0", modulePath, moduleHash, semantic: false, actions: [], supportedPhases: ["candidate"], closure, contract: { id, version: "1.0.0", semantic: false, actions: [], supportedPhases: ["candidate"] } }, over);
}
async function runOne(descriptor, context = {}, timeoutMs = 1500) {
  return runValidationPhase(descriptor.supportedPhases[0], [descriptor], context, { timeoutMs });
}

const ABNORMAL = {
  "non-object result": "return 'nope';",
  "null result": "return null;",
  "array result": "return [];",
  "invalid status": "return {status:'weird',problems:[]};",
  "missing status": "return {problems:[]};",
  "success with problems (lie)": "return {status:'passed',problems:['actually invalid']};",
  "failure without a problem": "return {status:'failed',problems:[]};",
  "malformed problems array": "return {status:'passed',problems:'nope'};",
  "throws an exception": "throw new Error('boom');",
  "returns undefined (no result)": "return undefined;"
};
for (const [name, body] of Object.entries(ABNORMAL)) {
  test(`validator result fails closed: ${name}`, async () => {
    assert.equal((await runOne(makeValidatorModule(body))).status, "failed", `${name} must fail closed`);
  });
}
test("clean validator passes (sanity)", async () => {
  assert.equal((await runOne(makeValidatorModule("return {status:'passed',problems:[],warnings:[]};"))).status, "passed");
});

// WORK UNIT 1 — preemptive timeout
test("synchronous infinite loop is forcibly terminated and fails closed", async () => {
  const start = Date.now();
  const phase = await runOne(makeValidatorModule("while(true){} return {status:'passed',problems:[]};"), {}, 500);
  assert.equal(phase.status, "failed");
  assert.ok(Date.now() - start < 4000, "must terminate promptly");
  assert.match(phase.problems.join(" "), /timed out/);
});
test("synchronous long-running validator cannot return success after the deadline", async () => {
  const phase = await runOne(makeValidatorModule("var t=Date.now(); while(Date.now()-t<2000){} return {status:'passed',problems:[]};"), {}, 300);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /timed out/);
});
test("asynchronous hang is terminated and fails closed", async () => {
  const phase = await runOne(makeValidatorModule("return new Promise(function(){ setInterval(function(){}, 1000); });"), {}, 300);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /timed out/);
});
test("async validator whose event loop drains fails closed (no result)", async () => {
  const phase = await runOne(makeValidatorModule("return new Promise(function(){});"), {}, 800);
  assert.equal(phase.status, "failed");
});
test("worker crash (process.exit during load) fails closed", async () => {
  const id = `crash-${seq++}`;
  const d = rawDescriptor(id, `process.exit(1);\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`);
  assert.equal((await runOne(d)).status, "failed");
});
test("worker startup failure (module syntax error) fails closed", async () => {
  const d = rawDescriptor(`synerr-${seq++}`, "this is (((not valid javascript");
  assert.equal((await runOne(d)).status, "failed");
});

// WORK UNIT 1 — exact bytes / replacement races
test("module replaced after hashing fails closed (exact-bytes execution)", async () => {
  const d = makeValidatorModule("return {status:'passed',problems:[]};");
  fs.writeFileSync(d.modulePath, `module.exports={id:${JSON.stringify(d.id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};\n// swapped\n`);
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /hash mismatch|size mismatch|integrity|inode/i);
});
test("symlinked closure module is rejected at build (registry load)", () => {
  const real = makeValidatorModule("return {status:'passed',problems:[]};");
  const outside = path.join(os.tmpdir(), `evil-exec-${seq++}.js`);
  writeStrictFile(outside, `module.exports={id:${JSON.stringify(real.id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`);
  const linkPath = path.join(scratch, `link-${seq++}.js`);
  try { fs.symlinkSync(outside, linkPath); } catch (error) { if (error.code === "EPERM") return; throw error; }
  assert.throws(() => buildValidatorClosure(linkPath, scratch), /symlink/i);
});

// WORK UNIT 3 — output/resource bounds
test("oversized checkedObjects array fails closed", async () => {
  assert.equal((await runOne(makeValidatorModule("var a=[]; for(var i=0;i<20000;i++)a.push('o'+i); return {status:'passed',problems:[],checkedObjects:a,checkedPaths:[]};"))).status, "failed");
});
test("oversized result payload fails closed", async () => {
  assert.equal((await runOne(makeValidatorModule("var big='x'.repeat(300000); return {status:'passed',problems:[big]};"))).status, "failed");
});
test("circular result structure fails closed", async () => {
  assert.equal((await runOne(makeValidatorModule("var c={}; c.self=c; return {status:'passed',problems:[c]};"))).status, "failed");
});

// WORK UNIT 2 — semantic coverage enforcement
const semCtx = { plan: { affectedObjects: ["OBJ-A", "OBJ-B"], writes: [{ path: "public/data/a.json" }, { path: "public/data/b.json" }] } };
const semD = (body) => makeValidatorModule(body, { semantic: true, actions: ["write_report"], supportedPhases: ["candidate"] });
test("semantic validator passes when coverage is complete", async () => {
  assert.equal((await runOne(semD("return {status:'passed',problems:[],checkedObjects:['OBJ-A','OBJ-B'],checkedPaths:['public/data/a.json','public/data/b.json']};"), semCtx)).status, "passed");
});
test("semantic coverage fails closed when an affected object is omitted", async () => {
  const phase = await runOne(semD("return {status:'passed',problems:[],checkedObjects:['OBJ-A'],checkedPaths:['public/data/a.json','public/data/b.json']};"), semCtx);
  assert.equal(phase.status, "failed"); assert.match(phase.problems.join(" "), /omitted affected object/);
});
test("semantic coverage fails closed with empty checkedObjects", async () => {
  assert.equal((await runOne(semD("return {status:'passed',problems:[],checkedObjects:[],checkedPaths:['public/data/a.json','public/data/b.json']};"), semCtx)).status, "failed");
});
test("semantic coverage fails closed when duplicating one object while omitting another", async () => {
  assert.equal((await runOne(semD("return {status:'passed',problems:[],checkedObjects:['OBJ-A','OBJ-A'],checkedPaths:['public/data/a.json','public/data/b.json']};"), semCtx)).status, "failed");
});
test("semantic coverage fails closed when a governed write path is omitted", async () => {
  const phase = await runOne(semD("return {status:'passed',problems:[],checkedObjects:['OBJ-A','OBJ-B'],checkedPaths:['public/data/a.json']};"), semCtx);
  assert.equal(phase.status, "failed"); assert.match(phase.problems.join(" "), /omitted governed write path/);
});
test("non-semantic structural validator is not forced to claim coverage", async () => {
  assert.equal((await runOne(makeValidatorModule("return {status:'passed',problems:[]};", { semantic: false }), semCtx)).status, "passed");
});

// Registry/loader integrity
function tempValidatorDir() {
  const dir = fs.mkdtempSync(path.join(HOLDER, "vsec-"));
  for (const f of fs.readdirSync(REAL_VALIDATORS)) fs.copyFileSync(path.join(REAL_VALIDATORS, f), path.join(dir, f));
  return dir;
}
const readReg = (d) => JSON.parse(fs.readFileSync(path.join(d, "registry.json"), "utf8"));
const writeReg = (d, r) => writeStrictFile(path.join(d, "registry.json"), JSON.stringify(r));

function legacyLoadValidatorRegistry(dir) {
  const registry = readReg(dir);
  const modules = registry.validators.map((entry) => path.resolve(dir, entry.module));
  const script = `
    const modules = JSON.parse(process.argv[1]);
    for (const modulePath of modules) {
      const resolved = require.resolve(modulePath);
      delete require.cache[resolved];
      require(resolved);
    }
  `;
  const result = spawnSync(process.execPath, ["-e", script, JSON.stringify(modules)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `legacy loader exited ${result.status}`);
}

function installAttackValidator(dir, id, source) {
  const registry = readReg(dir);
  registry.validators.unshift({ id, module: `${id}.js`, version: "1.0.0", supportedPhases: ["candidate"] });
  writeReg(dir, registry);
  writeStrictFile(path.join(dir, `${id}.js`), source);
}

function sideEffectAttackSource(id, body) {
  return `"use strict";\n${body}\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`;
}

function assertLegacyExecutesButRegistryDoesNot(dir, markerPath) {
  assert.equal(fs.existsSync(markerPath), false);
  legacyLoadValidatorRegistry(dir);
  assert.equal(fs.existsSync(markerPath), true, "legacy registry path should have executed the attack payload");
  fs.rmSync(markerPath, { force: true });
  try { loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: path.resolve(dir, "..", "..", "..") }); } catch (error) {}
  assert.equal(fs.existsSync(markerPath), false, "hardened registry must not execute the attack payload");
}

test("static contract parser extracts literal metadata without executing code", () => {
  const source = `const NEVER = (() => { throw new Error("must not execute"); })();\nmodule.exports={id:"static-1",version:"1.2.3",semantic:true,actions:["write_report"],supportedPhases:["candidate","post_write"],validate:function(){return {status:"passed",problems:[]};}};`;
  const contract = extractStaticValidatorContract(source, "static-1");
  assert.deepEqual(contract, { id: "static-1", version: "1.2.3", semantic: true, actions: ["write_report"], supportedPhases: ["candidate", "post_write"] });
});

for (const [name, source, rx] of [
  ["module exports indirection", `const contract={id:"dyn-1",version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}}; module.exports=contract;`, /static object literal/i],
  ["dynamic actions", `module.exports={id:"dyn-2",version:"1.0.0",semantic:true,actions:ACTIONS,supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`, /static string-literal array/i],
  ["dynamic supported phases", `module.exports={id:"dyn-3",version:"1.0.0",semantic:false,actions:[],supportedPhases:PHASES,validate:function(){return {status:"passed",problems:[]};}};`, /static string-literal array/i]
]) {
  test(`static contract parser rejects ${name}`, () => {
    assert.throws(() => extractStaticValidatorContract(source, name), rx);
  });
}

for (const scenario of [
  {
    name: "top-level fs.writeFileSync",
    body: (marker) => `require("node:fs").writeFileSync(${JSON.stringify(marker)},"fs-write");`
  },
  {
    name: "top-level rename/unlink/chmod",
    body: (marker) => `const fs=require("node:fs"); const file=${JSON.stringify(`${os.tmpdir()}\\vsec-target-${process.pid}-${Date.now()}`)}; fs.writeFileSync(file,"x"); fs.renameSync(file,file+".renamed"); fs.chmodSync(file+".renamed",0o600); fs.unlinkSync(file+".renamed"); fs.writeFileSync(${JSON.stringify(marker)},"rename-unlink-chmod");`
  },
  {
    name: "top-level child_process spawn",
    body: (marker) => `require("node:child_process").spawnSync(process.execPath,["-e","process.exit(0)"]); require("node:fs").writeFileSync(${JSON.stringify(marker)},"child-process");`
  },
  {
    name: "top-level worker_threads.Worker",
    body: (marker) => `const { Worker } = require("node:worker_threads"); const worker=new Worker("process.exit(0)",{eval:true}); worker.terminate(); require("node:fs").writeFileSync(${JSON.stringify(marker)},"worker");`
  },
  {
    name: "top-level network access",
    body: (marker) => `const server=require("node:net").createServer(); server.listen(0,()=>server.close()); require("node:fs").writeFileSync(${JSON.stringify(marker)},"network");`
  },
  {
    name: "top-level environment access",
    body: (marker) => `require("node:fs").writeFileSync(${JSON.stringify(marker)},String(process.env.PATH ? "env" : "missing"));`
  },
  {
    name: "top-level approval access",
    body: (marker) => `require("../../approvals/decision-store"); require("node:fs").writeFileSync(${JSON.stringify(marker)},"approval");`
  },
  {
    name: "top-level ledger access",
    body: (marker) => `require("../ledger"); require("node:fs").writeFileSync(${JSON.stringify(marker)},"ledger");`
  }
]) {
  test(`registry loading does not execute ${scenario.name}`, () => {
    const dir = tempValidatorDir();
    const marker = path.join(os.tmpdir(), `vsec-marker-${seq++}.txt`);
    const id = `attack-${seq++}`;
    try {
      installAttackValidator(dir, id, sideEffectAttackSource(id, scenario.body(marker)));
      assertLegacyExecutesButRegistryDoesNot(dir, marker);
    } finally {
      fs.rmSync(marker, { force: true });
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("registry loading does not execute a direct dependency side effect", () => {
  const dir = tempValidatorDir();
  const marker = path.join(os.tmpdir(), `vsec-marker-${seq++}.txt`);
  try {
    writeStrictFile(path.join(dir, "attack-dep.js"), `require("node:fs").writeFileSync(${JSON.stringify(marker)},"direct-dependency"); module.exports={tag:function(){return "ok";}};`);
    installAttackValidator(dir, "attack-direct-dependency", sideEffectAttackSource("attack-direct-dependency", `require("./attack-dep.js");`));
    assertLegacyExecutesButRegistryDoesNot(dir, marker);
  } finally {
    fs.rmSync(marker, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("registry loading does not execute a transitive dependency side effect", () => {
  const dir = tempValidatorDir();
  const marker = path.join(os.tmpdir(), `vsec-marker-${seq++}.txt`);
  try {
    writeStrictFile(path.join(dir, "attack-transitive-leaf.js"), `require("node:fs").writeFileSync(${JSON.stringify(marker)},"transitive-dependency"); module.exports={tag:function(){return "ok";}};`);
    writeStrictFile(path.join(dir, "attack-transitive-mid.js"), `require("./attack-transitive-leaf.js"); module.exports={tag:function(){return "ok";}};`);
    installAttackValidator(dir, "attack-transitive-root", sideEffectAttackSource("attack-transitive-root", `require("./attack-transitive-mid.js");`));
    assertLegacyExecutesButRegistryDoesNot(dir, marker);
  } finally {
    fs.rmSync(marker, { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("registry loader source contains no ordinary validator require path", () => {
  const source = fs.readFileSync(path.join(REAL_VALIDATORS, "index.js"), "utf8");
  assert.doesNotMatch(source, /require\.resolve\(modulePath\)/);
  assert.doesNotMatch(source, /delete require\.cache/);
  assert.doesNotMatch(source, /require\(resolvedModule\)/);
  assert.doesNotMatch(source, /require\(modulePath\)/);
});
test("loader rejects symlinked validator module", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readReg(dir); const v = reg.validators.find((x) => !x.semantic);
    const modPath = path.join(dir, v.module); const outside = path.join(os.tmpdir(), `evilv-${Date.now()}.js`);
    writeStrictFile(outside, `module.exports={id:${JSON.stringify(v.id)},version:${JSON.stringify(v.version)},semantic:false,supportedPhases:${JSON.stringify(v.supportedPhases)},validate:()=>({status:"passed",problems:[]})};`);
    fs.rmSync(modPath); try { fs.symlinkSync(outside, modPath); } catch (error) { if (error.code === "EPERM") return; throw error; }
    assert.throws(() => loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: path.resolve(dir, "..", "..", "..") }), /unavailable|regular file/i);
    fs.rmSync(outside, { force: true });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
for (const [name, mutate, rx] of [
  ["wrong action binding", (r) => { r.validators.find((v) => v.semantic).actions = ["other"]; }, /action binding mismatch/i],
  ["semantic flag mismatch", (r) => { const s = r.validators.find((v) => !v.semantic); s.semantic = true; s.actions = ["write_report"]; }, /semantic flag mismatch/i],
  ["version mismatch", (r) => { r.validators[0].version = "9.9.9"; }, /version mismatch/i],
  ["duplicate id", (r) => { r.validators.push({ ...r.validators[0] }); }, /Duplicate validator id/i],
  ["module path escape", (r) => { r.validators[0].module = "../evil.js"; }, /escapes validator directory/i]
]) {
  test(`loader fails closed: ${name}`, () => {
    const dir = tempValidatorDir();
    try { const r = readReg(dir); mutate(r); writeReg(dir, r); assert.throws(() => loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: path.resolve(dir, "..", "..", "..") }), rx); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
test("tampering a validator module changes the bound validatorSetHash", () => {
  const dir = tempValidatorDir();
  try {
    const before = loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: path.resolve(dir, "..", "..", "..") }).validatorSetHash;
    fs.appendFileSync(path.join(dir, readReg(dir).validators.find((v) => v.semantic).module), "\n// tamper\n");
    assert.notEqual(loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: path.resolve(dir, "..", "..", "..") }).validatorSetHash, before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- WORK UNIT 2: transitive closure integrity ----
function makeValidatorWithDep() {
  const dep = path.join(scratch, `dep-${seq}.js`);
  writeStrictFile(dep, "module.exports={tag:function(){return 'ok';}};");
  const id = `wd-${seq++}`;
  const modulePath = path.join(scratch, `${id}.js`);
  writeStrictFile(modulePath, `const d=require('./${path.basename(dep)}');\nfunction validate(context){ d.tag(); return {status:'passed',problems:[]}; }\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate};`);
  const c = buildValidatorClosure(modulePath, scratch);
  return { id, version: "1.0.0", modulePath, moduleHash: c.manifest[0].hash, semantic: false, actions: [], supportedPhases: ["candidate"], closure: { closureRoot: c.closureRoot, rootPolicy: c.rootPolicy, entryRelPath: c.entryRelPath, modules: c.manifest, builtins: c.builtins, closureHash: c.closureHash }, contract: { id, version: "1.0.0", semantic: false, actions: [], supportedPhases: ["candidate"] }, depPath: dep };
}

test("closure binds transitive dependency: entry replacement fails closed", async () => {
  const d = makeValidatorModule("return {status:'passed',problems:[]};");
  fs.appendFileSync(d.modulePath, "\n// swapped\n");
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /hash mismatch|size mismatch|integrity|inode/i);
});
test("closure binds transitive dependency: dependency replacement fails closed", async () => {
  const d = makeValidatorWithDep();
  fs.appendFileSync(d.depPath, "\n// tampered dep\n"); // replace dependency AFTER closure hashing
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /hash mismatch|size mismatch|integrity|inode/i);
});
test("closure builder rejects dynamic require", () => {
  const id = `dynreq-${seq++}`;
  const mp = path.join(scratch, `${id}.js`);
  writeStrictFile(mp, `const x=require(process.env.MOD||'./nope');\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:'passed',problems:[]};}};`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /dynamic or non-literal require/i);
});
test("closure builder rejects non-allowlisted builtin (child_process)", () => {
  const id = `cp-${seq++}`;
  const mp = path.join(scratch, `${id}.js`);
  writeStrictFile(mp, `const cp=require('child_process');\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:'passed',problems:[]};}};`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /non-allowlisted/i);
});
test("closure builder rejects non-allowlisted builtin (net)", () => {
  const id = `net-${seq++}`;
  const mp = path.join(scratch, `${id}.js`);
  writeStrictFile(mp, `const net=require('net');\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:'passed',problems:[]};}};`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /non-allowlisted/i);
});
test("worker rejects an undeclared closure dependency at execution", async () => {
  const d = makeValidatorWithDep();
  // Remove the dependency from the bound manifest, keep the entry requiring it:
  d.closure.modules = d.closure.modules.filter((m) => m.relPath === d.closure.entryRelPath);
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /undeclared closure dependency/i);
});
test("closureHash is folded into validatorSetHash (real registry)", () => {
  const { loadValidatorRegistry } = require("../kernel/execution/validators");
  const reg = loadValidatorRegistry();
  for (const [, d] of reg.descriptors) { assert.ok(d.closure && typeof d.closure.closureHash === "string" && d.closure.modules.length >= 1); }
  assert.match(reg.validatorRuntime.hash, /^[a-f0-9]{64}$/);
  assert.match(reg.closureLoaderRuntime.hash, /^[a-f0-9]{64}$/);
  assert.equal(typeof reg.authoritativeRootPolicyId, "string");
  const entry = reg.entries.find((candidate) => candidate.id === "execution-plan");
  assert.ok(entry && entry.contract && Array.isArray(entry.contract.supportedPhases));
});
test("registry descriptors are deep-frozen after loading", () => {
  const reg = loadValidatorRegistry();
  const descriptor = reg.descriptors.get("execution-plan");
  assert.ok(Object.isFrozen(descriptor));
  assert.ok(Object.isFrozen(descriptor.contract));
  assert.ok(Object.isFrozen(descriptor.actions));
  assert.ok(Object.isFrozen(descriptor.supportedPhases));
  assert.ok(Object.isFrozen(descriptor.closure));
  assert.ok(Object.isFrozen(descriptor.closure.rootPolicy));
  assert.ok(Object.isFrozen(descriptor.closure.modules));
  assert.ok(Object.isFrozen(descriptor.closure.modules[0]));
});

test("registry collections are actually immutable", () => {
  const reg = loadValidatorRegistry();
  const originalDescriptor = reg.descriptors.get("execution-plan");
  const originalContract = reg.contracts.get("execution-plan");
  assert.equal(typeof reg.descriptors.set, "undefined");
  assert.equal(typeof reg.descriptors.delete, "undefined");
  assert.equal(typeof reg.descriptors.clear, "undefined");
  assert.equal(typeof reg.contracts.set, "undefined");
  assert.equal(typeof reg.contracts.delete, "undefined");
  assert.equal(typeof reg.contracts.clear, "undefined");
  reg.descriptors.extra = "x";
  reg.descriptors.get = () => null;
  delete reg.descriptors.size;
  assert.equal(reg.descriptors.get("execution-plan"), originalDescriptor);
  assert.equal(reg.contracts.get("execution-plan"), originalContract);
  assert.equal(Object.prototype.hasOwnProperty.call(reg.descriptors, "extra"), false);
  assert.equal(reg.descriptors.size > 0, true);
});

test("production exports do not expose a test-only root override", () => {
  const validators = require("../kernel/execution/validators");
  assert.equal(Object.prototype.hasOwnProperty.call(validators, "loadValidatorRegistryForTest"), false);
});

// ---- WORK UNIT 4: cross-phase re-verification ----
test("closure is re-verified at post_write: drift before post-write fails closed", async () => {
  // A validator that supports both phases; candidate passes, then its bytes drift
  // before post_write -> worker re-hash mismatch -> fail closed.
  const id = `xp-${seq++}`;
  const mp = path.join(scratch, `${id}.js`);
  writeStrictFile(mp, `module.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate","post_write"],validate:function(){return {status:"passed",problems:[]};}};`);
  const c = buildValidatorClosure(mp, scratch);
  const d = { id, version: "1.0.0", modulePath: mp, moduleHash: c.manifest[0].hash, semantic: false, actions: [], supportedPhases: ["candidate", "post_write"], closure: { closureRoot: c.closureRoot, rootPolicy: c.rootPolicy, entryRelPath: c.entryRelPath, modules: c.manifest, builtins: c.builtins, closureHash: c.closureHash }, contract: { id, version: "1.0.0", semantic: false, actions: [], supportedPhases: ["candidate", "post_write"] } };
  assert.equal((await runValidationPhase("candidate", [d], {}, { timeoutMs: 1500 })).status, "passed");
  fs.appendFileSync(mp, "\n// drift before post-write\n");
  const post = await runValidationPhase("post_write", [d], {}, { timeoutMs: 1500 });
  assert.equal(post.status, "failed");
  assert.match(post.problems.join(" "), /hash mismatch|size mismatch|integrity|inode/i);
});

// ---- Authoritative-root source boundary (this checkpoint) ----
const { resolveAuthoritativeRoot } = require("../kernel/execution/validator-closure");

function writeModule(name, src) { const p = path.join(scratch, name); writeStrictFile(p, src); return p; }
const VALID_BODY = `module.exports={id:"x",version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`;

test("root: overly broad root '/' is rejected", () => {
  assert.throws(() => resolveAuthoritativeRoot("/"), /overly broad|too shallow/i);
});
test("root: bare system dirs are rejected as overly broad", () => {
  for (const r of ["/usr", "/etc", "/tmp", "/home"]) assert.throws(() => resolveAuthoritativeRoot(r), /overly broad|does not exist/i);
});
test("root: an explicitly authorized temporary test root is accepted", () => {
  const authorized = fs.mkdtempSync(path.join(os.tmpdir(), "authz-root-"));
  const mp = path.join(authorized, "v.js"); writeStrictFile(mp, VALID_BODY);
  const c = buildValidatorClosure(mp, authorized);
  assert.equal(c.closureRoot, fs.realpathSync(authorized));
  assert.equal(c.modules.length, 1);
  fs.rmSync(authorized, { recursive: true, force: true });
});
test("boundary: `../` dependency escape is rejected", () => {
  const mp = writeModule(`esc-${seq++}.js`, `const x=require("../escape-target.js");\n${VALID_BODY}`);
  writeStrictFile(path.join(scratch, "..", "escape-target.js"), "module.exports={};");
  assert.throws(() => buildValidatorClosure(mp, scratch), /escapes authoritative root|outside/i);
  try { fs.rmSync(path.join(scratch, "..", "escape-target.js")); } catch (e) {}
});
test("boundary: absolute dependency specifier is rejected", () => {
  const mp = writeModule(`abs-${seq++}.js`, `const x=require("/etc/hosts");\n${VALID_BODY}`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /absolute dependency|escapes/i);
});
test("boundary: external-directory dependency is rejected", () => {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "ext-dep-"));
  writeStrictFile(path.join(outsideDir, "dep.js"), "module.exports={};");
  const rel = path.relative(scratch, path.join(outsideDir, "dep.js"));
  const mp = writeModule(`extdir-${seq++}.js`, `const x=require(${JSON.stringify("./" + rel)});\n${VALID_BODY}`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /escapes authoritative root|outside/i);
  fs.rmSync(outsideDir, { recursive: true, force: true });
});
test("boundary: symlinked dependency is rejected", () => {
  const target = path.join(os.tmpdir(), `symdep-${seq++}.js`); writeStrictFile(target, "module.exports={};");
  const link = path.join(scratch, `dep-link-${seq}.js`);
  try { fs.symlinkSync(target, link); } catch (error) { if (error.code === "EPERM") return; throw error; }
  const mp = writeModule(`usesym-${seq++}.js`, `const x=require("./${path.basename(link)}");\n${VALID_BODY}`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /symlink/i);
  fs.rmSync(target, { force: true });
});
test("boundary: index.js resolution escaping the root is rejected", () => {
  // require("..") would resolve to <scratch>/../index.js (outside the root)
  const mp = writeModule(`idx-${seq++}.js`, `const x=require("..");\n${VALID_BODY}`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /escapes authoritative root|outside|not found/i);
});
test("boundary: hard-linked validator file is rejected", () => {
  const mp = writeModule(`hl-${seq++}.js`, VALID_BODY);
  const link = path.join(scratch, `hl-link-${seq}.js`);
  fs.linkSync(mp, link); // nlink now 2
  assert.throws(() => buildValidatorClosure(mp, scratch), /hard-linked/i);
  fs.rmSync(link, { force: true });
});
test("boundary: transitive hard-linked dependency is rejected", () => {
  const dep = path.join(scratch, `hldep-${seq}.js`); writeStrictFile(dep, "module.exports={};");
  fs.linkSync(dep, path.join(scratch, `hldep-link-${seq}.js`));
  const mp = writeModule(`useshl-${seq++}.js`, `const x=require("./${path.basename(dep)}");\n${VALID_BODY}`);
  assert.throws(() => buildValidatorClosure(mp, scratch), /hard-linked/i);
});
test("boundary: group/world-writable validator file is rejected", () => {
  if (process.platform === "win32") return;
  const mp = writeModule(`ww-${seq++}.js`, VALID_BODY);
  fs.chmodSync(mp, 0o666);
  assert.throws(() => buildValidatorClosure(mp, scratch), /group\/world-writable/i);
});

// Exec-time metadata verification (worker re-verifies the bound manifest).
function builtDescriptor(src) {
  const id = `meta-${seq++}`;
  const mp = writeModule(`${id}.js`, `module.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`);
  const c = buildValidatorClosure(mp, scratch);
  return { id, version: "1.0.0", modulePath: mp, moduleHash: c.manifest[0].hash, semantic: false, actions: [], supportedPhases: ["candidate"], closure: { closureRoot: c.closureRoot, rootPolicy: c.rootPolicy, entryRelPath: c.entryRelPath, modules: JSON.parse(JSON.stringify(c.manifest)), builtins: c.builtins, closureHash: c.closureHash }, contract: { id, version: "1.0.0", semantic: false, actions: [], supportedPhases: ["candidate"] } };
}
test("exec: mode change vs bound manifest fails closed", async () => {
  const d = builtDescriptor();
  const originalMode = d.closure.modules[0].mode;
  d.closure.modules[0].mode = originalMode === 0o600 ? 0o400 : 0o600;
  assert.notEqual(d.closure.modules[0].mode, originalMode);
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /mode change/i);
});
test("exec: ownership change vs bound manifest fails closed", async () => {
  const d = builtDescriptor(); d.closure.modules[0].uid = d.closure.modules[0].uid + 12345;
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /ownership change/i);
});
test("exec: inode replacement vs bound manifest fails closed", async () => {
  const d = builtDescriptor(); d.closure.modules[0].ino = String(d.closure.modules[0].ino) + "9";
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /inode replacement/i);
});
test("exec: replacement between build and read fails closed (fd re-verify)", async () => {
  const d = builtDescriptor();
  fs.writeFileSync(d.modulePath, `module.exports={id:${JSON.stringify(d.id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};// replaced with different bytes and size`);
  const phase = await runOne(d);
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /hash mismatch|size mismatch/i);
});
