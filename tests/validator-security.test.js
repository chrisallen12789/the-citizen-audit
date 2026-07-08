const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runValidationPhase } = require("../kernel/execution/validation-cycle");
const { loadValidatorRegistry } = require("../kernel/execution/validators");

const REAL_VALIDATORS = path.join(__dirname, "..", "kernel", "execution", "validators");
const HOLDER = path.join(__dirname, "..", "kernel", "execution");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-mods-"));
test.after(() => { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) {} });

let seq = 0;
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
  fs.writeFileSync(modulePath, src);
  const moduleHash = crypto.createHash("sha256").update(fs.readFileSync(modulePath)).digest("hex");
  return { id, version, modulePath, moduleHash, semantic, actions, supportedPhases };
}
function rawDescriptor(id, source, over = {}) {
  const modulePath = path.join(scratch, `${id}.js`);
  fs.writeFileSync(modulePath, source);
  const moduleHash = crypto.createHash("sha256").update(fs.readFileSync(modulePath)).digest("hex");
  return Object.assign({ id, version: "1.0.0", modulePath, moduleHash, semantic: false, actions: [], supportedPhases: ["candidate"] }, over);
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
  assert.match(phase.problems.join(" "), /hash mismatch/i);
});
test("symlinked module at execution fails closed", async () => {
  const real = makeValidatorModule("return {status:'passed',problems:[]};");
  const outside = path.join(os.tmpdir(), `evil-exec-${seq++}.js`);
  fs.writeFileSync(outside, `module.exports={id:${JSON.stringify(real.id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:"passed",problems:[]};}};`);
  const linkPath = path.join(scratch, `link-${seq++}.js`);
  fs.symlinkSync(outside, linkPath);
  const moduleHash = crypto.createHash("sha256").update(fs.readFileSync(linkPath)).digest("hex");
  assert.equal((await runOne({ ...real, modulePath: linkPath, moduleHash })).status, "failed");
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
const writeReg = (d, r) => fs.writeFileSync(path.join(d, "registry.json"), JSON.stringify(r));
test("loader rejects symlinked validator module", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readReg(dir); const v = reg.validators.find((x) => !x.semantic);
    const modPath = path.join(dir, v.module); const outside = path.join(os.tmpdir(), `evilv-${Date.now()}.js`);
    fs.writeFileSync(outside, `module.exports={id:${JSON.stringify(v.id)},version:${JSON.stringify(v.version)},semantic:false,supportedPhases:${JSON.stringify(v.supportedPhases)},validate:()=>({status:"passed",problems:[]})};`);
    fs.rmSync(modPath); fs.symlinkSync(outside, modPath);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /unavailable|regular file/i);
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
    try { const r = readReg(dir); mutate(r); writeReg(dir, r); assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), rx); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
test("tampering a validator module changes the bound validatorSetHash", () => {
  const dir = tempValidatorDir();
  try {
    const before = loadValidatorRegistry({ validatorsDir: dir }).validatorSetHash;
    fs.appendFileSync(path.join(dir, readReg(dir).validators.find((v) => v.semantic).module), "\n// tamper\n");
    assert.notEqual(loadValidatorRegistry({ validatorsDir: dir }).validatorSetHash, before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
