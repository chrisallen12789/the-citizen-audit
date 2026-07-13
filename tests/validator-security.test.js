const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Worker } = require("node:worker_threads");

const { canonicalStringify } = require("../kernel/lib/canonical-json");
const { extractStaticValidatorContract, loadValidatorRegistry } = require("../kernel/execution/validators");
const { REVIEWED_VALIDATOR_LIMITS } = require("../kernel/execution/validator-limits");
const { buildValidatorClosure, resolveAuthoritativeRoot } = require("./support/validator-closure-test-core");
const { runValidationPhase } = require("./support/validation-cycle-test-core");
const { loadValidatorRegistryForTest } = require("./support/validator-test-harness");

const REAL_VALIDATORS = path.join(__dirname, "..", "kernel", "execution", "validators");
const HOLDER = path.join(__dirname, "..", "kernel", "execution");
const PRODUCTION_WORKER_PATH = path.join(__dirname, "..", "kernel", "execution", "validator-worker.js");
const PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH = path.join(REAL_VALIDATORS, "execution-plan.js");
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

function launchProductionWorker(workerPayload, timeoutMs = 1500, workerOptions = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let worker;
    let resultPort = null;
    const directMessages = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const withObservedTransport = (result) => Object.assign({
      directMessages: [...directMessages],
      stdoutBytes,
      stderrBytes,
      stdioBytes: stdoutBytes + stderrBytes
    }, result);
    const cleanupStream = (stream) => {
      if (!stream) return;
      try { stream.removeAllListeners("data"); } catch (error) {}
      try { stream.destroy(); } catch (error) {}
    };
    const finish = (result, options = {}) => {
      if (settled) return;
      settled = true;
      const terminateWorker = options.terminateWorker !== false;
      (async () => {
        if (timer) clearTimeout(timer);
        if (resultPort) {
          try { resultPort.removeAllListeners(); } catch (error) {}
          try { resultPort.close(); } catch (error) {}
        }
        if (worker) {
          cleanupStream(worker.stdout);
          cleanupStream(worker.stderr);
          if (terminateWorker) {
            try { await worker.terminate(); } catch (error) {}
          }
        }
        resolve(withObservedTransport(result));
      })();
    };
    const timer = setTimeout(() => finish({ kind: "timeout" }), timeoutMs);
    try {
      worker = new Worker(PRODUCTION_WORKER_PATH, Object.assign({ workerData: workerPayload, stdout: true, stderr: true }, workerOptions));
    } catch (error) {
      finish({ kind: "startup-error", error });
      return;
    }
    if (worker.stdout) worker.stdout.on("data", (chunk) => { stdoutBytes += chunk.length; });
    if (worker.stderr) worker.stderr.on("data", (chunk) => { stderrBytes += chunk.length; });
    worker.on("message", (message) => {
      if (
        !resultPort
        && message
        && typeof message === "object"
        && message.type === "validator-harness-channel-v1"
        && message.port
        && typeof message.port.on === "function"
      ) {
        resultPort = message.port;
        resultPort.on("message", (resultMessage) => finish({ kind: "message", message: resultMessage }));
        resultPort.on("close", () => finish({ kind: "channel-closed" }));
        resultPort.start();
        return;
      }
      directMessages[directMessages.length] = message;
    });
    worker.on("error", (error) => finish({ kind: "error", error }));
    worker.on("exit", (code) => finish({ kind: "exit", code }, { terminateWorker: false }));
  });
}

function parseTransportedWorkerEnvelope(message) {
  assert.equal(typeof message, "string");
  assert.ok(Buffer.byteLength(message, "utf8") <= REVIEWED_VALIDATOR_LIMITS.maxResultBytes);
  const envelope = JSON.parse(message);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope, "raw"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope, "serializedResult"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope, "error"), false);
  return envelope;
}

function parseTransportedWorkerSuccessMessage(message) {
  const envelope = parseTransportedWorkerEnvelope(message);
  assert.equal(envelope.ok, true);
  assert.deepEqual(Object.keys(envelope).sort(), ["ok", "result"]);
  return envelope.result;
}

function parseTransportedWorkerFailureMessage(message) {
  const envelope = parseTransportedWorkerEnvelope(message);
  assert.equal(envelope.ok, false);
  assert.equal(typeof envelope.code, "string");
  if (Object.prototype.hasOwnProperty.call(envelope, "diagnostic")) {
    assert.equal(typeof envelope.diagnostic, "string");
  }
  return envelope;
}

function assertNoDirectWorkerMessages(outcome) {
  assert.deepEqual(outcome.directMessages || [], []);
}

function authoritativeWorkerContext(writeSetHash = "a".repeat(64)) {
  return {
    transaction: {
      action: "write_report",
      writeSetHash,
      affectedObjects: ["OBJ-1"],
      proposedWrites: [{ path: "public/data/report.json" }]
    },
    plan: {
      action: "write_report",
      writeSetHash,
      affectedObjects: ["OBJ-1"],
      writes: [{ path: "public/data/report.json" }]
    },
    writeSetHash
  };
}

function normalizedWorkerResult(problemText) {
  return {
    status: "passed",
    problems: [problemText],
    warnings: [],
    checkedObjects: ["OBJ-1"],
    checkedPaths: ["public/data/report.json"]
  };
}

function serializedWorkerResult(problemText) {
  return JSON.stringify({ ok: true, result: normalizedWorkerResult(problemText) });
}

function serializedWorkerResultBytes(problemText) {
  return Buffer.byteLength(serializedWorkerResult(problemText), "utf8");
}

function maxRepeatCountWithinReviewedBytes(token, slackBytes = 0) {
  const limit = REVIEWED_VALIDATOR_LIMITS.maxResultBytes - slackBytes;
  let low = 0;
  let high = REVIEWED_VALIDATOR_LIMITS.maxResultBytes;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (serializedWorkerResultBytes(token.repeat(mid)) <= limit) low = mid;
    else high = mid - 1;
  }
  return low;
}

function validatorSourceForResultExpression(expression) {
  return `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){return ${expression};}};\n`;
}

function validatorSourceForValidateBody(body) {
  return `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){${body}}};\n`;
}

function validatorGlobalAuthorityAuditBody() {
  return `
      const problems = [];
      function add(problem) { problems[problems.length] = problem; }
      function isObjectLike(value) { return value !== null && (typeof value === "object" || typeof value === "function"); }
      function keyText(key) { try { return String(key); } catch (error) { return "<key>"; } }
      function inspectValue(label, value, depth, seen) {
        if (!isObjectLike(value)) return;
        for (let index = 0; index < seen.length; index += 1) if (seen[index] === value) return;
        seen[seen.length] = value;
        let ctorName = "";
        let protoCtorName = "";
        try { ctorName = value.constructor && value.constructor.name; } catch (error) {}
        try {
          const proto = Object.getPrototypeOf(value);
          protoCtorName = proto && proto.constructor && proto.constructor.name;
        } catch (error) {}
        const labelLower = String(label).toLowerCase();
        const names = String(ctorName) + " " + String(protoCtorName);
        if (/Agent|Pool|Client|Dispatcher/.test(names)) add(label + " exposed dispatcher constructor");
        try { if (typeof value.dispatch === "function") add(label + " exposed dispatch"); } catch (error) {}
        if (/factory|callback/.test(labelLower) && typeof value === "function") add(label + " exposed internal function");
        if (/clients/.test(labelLower) && /Map/.test(names)) add(label + " exposed clients Map");
        if (/options/.test(labelLower) && isObjectLike(value)) add(label + " exposed options object");
        if (depth <= 0) return;
        let keys = [];
        try { keys = Reflect.ownKeys(value); } catch (error) { return; }
        for (let index = 0; index < keys.length; index += 1) {
          const key = keys[index];
          let descriptor;
          try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch (error) { continue; }
          if (!descriptor) continue;
          const childLabel = label + "." + keyText(key);
          if ("get" in descriptor && typeof descriptor.get === "function") inspectValue(childLabel + ".get", descriptor.get, depth - 1, seen);
          if ("set" in descriptor && typeof descriptor.set === "function") inspectValue(childLabel + ".set", descriptor.set, depth - 1, seen);
          if ("value" in descriptor) inspectValue(childLabel, descriptor.value, depth - 1, seen);
        }
      }
      function inspectGlobalSurface() {
        if (Object.getPrototypeOf(globalThis) !== null) add("validator global prototype was not detached");
        if (Object.isExtensible(globalThis)) add("validator global remained extensible");
        if (!Object.isFrozen(globalThis)) add("validator global was not frozen");
        let cursor = globalThis;
        let depth = 0;
        const seen = [];
        while (cursor !== null && depth < 10) {
          let keys = [];
          try { keys = Reflect.ownKeys(cursor); } catch (error) { add("Reflect.ownKeys failed at global depth " + depth); break; }
          for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            let descriptor;
            try { descriptor = Object.getOwnPropertyDescriptor(cursor, key); } catch (error) { continue; }
            if (!descriptor) continue;
            const label = "global[" + depth + "]." + keyText(key);
            if (typeof key === "symbol" && ("get" in descriptor || "set" in descriptor)) add(label + " retained symbol accessor");
            if ("value" in descriptor) inspectValue(label, descriptor.value, 2, seen);
            if ("get" in descriptor && typeof descriptor.get === "function") inspectValue(label + ".get", descriptor.get, 1, seen);
            if ("set" in descriptor && typeof descriptor.set === "function") inspectValue(label + ".set", descriptor.set, 1, seen);
          }
          cursor = Object.getPrototypeOf(cursor);
          depth += 1;
        }
        if (depth !== 1) add("validator global prototype chain was reachable");
      }
      inspectGlobalSurface();
      const symbols = [
        "undici.globalDispatcher.1",
        "audit.own.dispatcher",
        "audit.inherited.dispatcher",
        "audit.object-prototype.dispatcher",
        "audit.accessor.dispatcher",
        "audit.nonconfig.inherited.dispatcher",
        "audit.late.nextTick.dispatcher",
        "audit.late.microtask.dispatcher",
        "audit.late.promise.dispatcher",
        "audit.late.immediate.dispatcher",
        "audit.primitive.dispatcher"
      ];
      for (let index = 0; index < symbols.length; index += 1) {
        const name = symbols[index];
        let value;
        try { value = globalThis[Symbol.for(name)]; } catch (error) { value = undefined; }
        inspectValue("Symbol.for(" + name + ")", value, 3, []);
      }
      const stringKeys = [
        "auditOwnDispatcher",
        "auditInheritedDispatcher",
        "auditObjectPrototypeDispatcher",
        "auditLateNextTickDispatcher",
        "auditLateMicrotaskDispatcher",
        "auditLatePromiseDispatcher",
        "auditLateImmediateDispatcher"
      ];
      for (let index = 0; index < stringKeys.length; index += 1) {
        const name = stringKeys[index];
        let value;
        try { value = globalThis[name]; } catch (error) { value = undefined; }
        inspectValue(name, value, 3, []);
      }
      try { globalThis[Symbol.for("audit.primitive.dispatcher")] = { dispatch:function(){} }; } catch (error) {}
      inspectValue("rewritten primitive symbol", globalThis[Symbol.for("audit.primitive.dispatcher")], 3, []);
      try {
        Object.defineProperty(globalThis, Symbol.for("audit.define.dispatcher"), { value:{dispatch:function(){}}, configurable:true });
        add("defineProperty accepted a new symbol authority");
      } catch (error) {}
      inspectValue("defined symbol authority", globalThis[Symbol.for("audit.define.dispatcher")], 3, []);
      try { globalThis.auditLateImmediateDispatcher = { dispatch:function(){} }; } catch (error) {}
      inspectValue("rewritten string authority", globalThis.auditLateImmediateDispatcher, 3, []);
      try { if (Function("return typeof process")() !== "undefined") add("Function recovered process"); } catch (error) {}
      try { if (Function("return typeof console")() !== "undefined") add("Function recovered console"); } catch (error) {}
      try { if (require && require.constructor !== undefined) add("require constructor reachable"); } catch (error) {}
      try { if (module && module.constructor !== undefined) add("module constructor reachable"); } catch (error) {}
      try { if (exports && exports.constructor !== undefined) add("exports constructor reachable"); } catch (error) {}
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `;
}

async function withTemporaryProductionValidatorSource(filePath, source, callback) {
  const original = fs.readFileSync(filePath, "utf8");
  let originalMode = null;
  try {
    originalMode = fs.statSync(filePath).mode & 0o777;
  } catch (error) {}
  writeStrictFile(filePath, source);
  try {
    return await callback();
  } finally {
    fs.writeFileSync(filePath, original);
    if (originalMode !== null) {
      try { fs.chmodSync(filePath, originalMode); } catch (error) {}
    }
  }
}

function padAsciiToByteLength(source, targetBytes) {
  const current = Buffer.byteLength(source, "utf8");
  assert.ok(current <= targetBytes, "source must not already exceed target byte length");
  return source + " ".repeat(targetBytes - current);
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
    body: (marker) => `const fs=require("node:fs"); const file=${JSON.stringify(path.join(os.tmpdir(), `vsec-target-${process.pid}-${Date.now()}`))}; fs.writeFileSync(file,"x"); fs.renameSync(file,file+".renamed"); fs.chmodSync(file+".renamed",0o600); fs.unlinkSync(file+".renamed"); fs.writeFileSync(${JSON.stringify(marker)},"rename-unlink-chmod");`
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

test("registry loader sources contain no ordinary validator require path", () => {
  for (const sourcePath of [
    path.join(REAL_VALIDATORS, "index.js"),
    path.join(REAL_VALIDATORS, "registry-core.js")
  ]) {
    const source = fs.readFileSync(sourcePath, "utf8");
    assert.doesNotMatch(source, /require\.resolve\(modulePath\)/, sourcePath);
    assert.doesNotMatch(source, /delete require\.cache/, sourcePath);
    assert.doesNotMatch(source, /require\(resolvedModule\)/, sourcePath);
    assert.doesNotMatch(source, /require\(modulePath\)/, sourcePath);
  }
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
test("closure builder rejects non-allowlisted builtin (worker_threads)", () => {
  const id = `worker-threads-${seq++}`;
  const mp = path.join(scratch, `${id}.js`);
  writeStrictFile(mp, `const wt=require('worker_threads');\nmodule.exports={id:${JSON.stringify(id)},version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){return {status:'passed',problems:[]};}};`);
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

test("closure loader identity is bound to the real production implementation bytes", () => {
  const reg = loadValidatorRegistry();
  const implementationPath = require.resolve("../kernel/execution/validators/registry-core.js");
  const implementationBytes = fs.readFileSync(implementationPath);
  const implementationHash = crypto.createHash("sha256").update(implementationBytes).digest("hex");
  assert.equal(reg.closureLoaderRuntime.hash, implementationHash);

  const registryVersion = JSON.parse(fs.readFileSync(path.join(REAL_VALIDATORS, "registry.json"), "utf8")).version || null;
  const mutatedLoaderHash = crypto.createHash("sha256").update(Buffer.concat([implementationBytes, Buffer.from("\n// implementation mutation\n")])).digest("hex");
  const rebound = crypto.createHash("sha256").update(canonicalStringify({
    version: registryVersion,
    authoritativeRootPolicyId: reg.authoritativeRootPolicyId,
    closurePolicyVersion: "1.0.0",
    validatorRunner: reg.validatorRuntime,
    closureLoader: { ...reg.closureLoaderRuntime, hash: mutatedLoaderHash },
    validators: reg.entries
  })).digest("hex");
  assert.notEqual(rebound, reg.validatorSetHash);
});

test("production validation cycle executes authoritative validator ids through the reviewed registry", async () => {
  const reg = loadValidatorRegistry();
  const result = await require("../kernel/execution/validation-cycle").runValidationPhase(
    "candidate",
    ["execution-plan"],
    authoritativeWorkerContext(),
    { timeoutMs: 1500, expectedValidatorSetHash: reg.validatorSetHash }
  );
  assert.equal(result.status, "passed");
});

test("production validation-cycle exports no mutable LIMITS reference", () => {
  const validationCycle = require("../kernel/execution/validation-cycle");
  assert.equal(Object.prototype.hasOwnProperty.call(validationCycle, "LIMITS"), false);
});

test("production reviewed validator limits metadata is deeply frozen", () => {
  const limitsModule = require("../kernel/execution/validator-limits");
  assert.ok(Object.isFrozen(limitsModule));
  assert.ok(Object.isFrozen(limitsModule.REVIEWED_VALIDATOR_LIMITS));
  const before = { ...limitsModule.REVIEWED_VALIDATOR_LIMITS };
  try { limitsModule.REVIEWED_VALIDATOR_LIMITS.maxResultBytes = 1; } catch (error) {}
  try { limitsModule.REVIEWED_VALIDATOR_LIMITS.maxArrayLen = Infinity; } catch (error) {}
  assert.deepEqual(limitsModule.REVIEWED_VALIDATOR_LIMITS, before);
});

test("attempted direct-import mutation cannot alter later authoritative validation result", async () => {
  const validationCycle = require("../kernel/execution/validation-cycle");
  const limitsModule = require("../kernel/execution/validator-limits");
  const reg = loadValidatorRegistry();
  const baseline = await validationCycle.runValidationPhase(
    "candidate",
    ["execution-plan"],
    authoritativeWorkerContext("c".repeat(64)),
    { timeoutMs: 1500, expectedValidatorSetHash: reg.validatorSetHash }
  );
  assert.equal(baseline.status, "passed");

  validationCycle.LIMITS = { maxResultBytes: 1, maxArrayLen: 1, maxStdBytes: 1 };
  try { limitsModule.REVIEWED_VALIDATOR_LIMITS.maxResultBytes = 1; } catch (error) {}
  try { limitsModule.REVIEWED_VALIDATOR_LIMITS.maxArrayLen = 1; } catch (error) {}
  try { limitsModule.REVIEWED_VALIDATOR_LIMITS.maxStdBytes = 1; } catch (error) {}

  const afterMutationAttempt = await validationCycle.runValidationPhase(
    "candidate",
    ["execution-plan"],
    authoritativeWorkerContext("d".repeat(64)),
    { timeoutMs: 1500, expectedValidatorSetHash: reg.validatorSetHash }
  );
  assert.equal(afterMutationAttempt.status, "passed");
  assert.equal(limitsModule.REVIEWED_VALIDATOR_LIMITS.maxResultBytes, 262144);
  assert.equal(limitsModule.REVIEWED_VALIDATOR_LIMITS.maxArrayLen, 10000);
  assert.equal(limitsModule.REVIEWED_VALIDATOR_LIMITS.maxStdBytes, 65536);
});

test("direct worker launch with Infinity limits cannot disable fixed reviewed result bounds", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:["x".repeat(300000)],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("e".repeat(64)),
        limits: { maxResultBytes: Infinity, maxArrayLen: Infinity, maxStdBytes: Number.MAX_SAFE_INTEGER }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_RESULT_INVALID");
    }
  );
});

test("ASCII result below the reviewed UTF-8 byte ceiling passes through the production worker unchanged", async () => {
  const count = maxRepeatCountWithinReviewedBytes("x", 64);
  const problemText = "x".repeat(count);
  const expected = normalizedWorkerResult(problemText);
  assert.ok(Buffer.byteLength(JSON.stringify({ ok: true, result: expected }), "utf8") < REVIEWED_VALIDATOR_LIMITS.maxResultBytes);

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:["x".repeat(${count})],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("aa".repeat(32)),
        limits: { maxResultBytes: 1 }
      });
      assert.equal(outcome.kind, "message");
      assert.deepEqual(parseTransportedWorkerSuccessMessage(outcome.message), expected);
    }
  );
});

test("ASCII result above the reviewed UTF-8 byte ceiling fails closed in the production worker", async () => {
  const count = maxRepeatCountWithinReviewedBytes("x") + 1;
  assert.ok(serializedWorkerResultBytes("x".repeat(count)) > REVIEWED_VALIDATOR_LIMITS.maxResultBytes);

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:["x".repeat(${count})],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ab".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_RESULT_INVALID");
    }
  );
});

test("multibyte Unicode result with JavaScript length below the ceiling but UTF-8 bytes above it fails closed", async () => {
  const count = maxRepeatCountWithinReviewedBytes("é") + 1;
  const problemText = "é".repeat(count);
  const serialized = serializedWorkerResult(problemText);
  assert.ok(serialized.length < REVIEWED_VALIDATOR_LIMITS.maxResultBytes);
  assert.ok(Buffer.byteLength(serialized, "utf8") > REVIEWED_VALIDATOR_LIMITS.maxResultBytes);

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:["é".repeat(${count})],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ac".repeat(32)),
        limits: { maxResultBytes: Number.MAX_SAFE_INTEGER }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_RESULT_INVALID");
    }
  );
});

test("astral-character emoji result above the UTF-8 byte ceiling fails closed", async () => {
  const count = maxRepeatCountWithinReviewedBytes("😀") + 1;
  const problemText = "😀".repeat(count);
  assert.ok(Buffer.byteLength(serializedWorkerResult(problemText), "utf8") > REVIEWED_VALIDATOR_LIMITS.maxResultBytes);

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:["😀".repeat(${count})],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ad".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_RESULT_INVALID");
    }
  );
});

test("multibyte Unicode result immediately below the reviewed UTF-8 byte ceiling can pass", async () => {
  const count = maxRepeatCountWithinReviewedBytes("é");
  const problemText = "é".repeat(count);
  const expected = normalizedWorkerResult(problemText);
  assert.ok(Buffer.byteLength(JSON.stringify({ ok: true, result: expected }), "utf8") <= REVIEWED_VALIDATOR_LIMITS.maxResultBytes);
  assert.ok(Buffer.byteLength(serializedWorkerResult("é".repeat(count + 1)), "utf8") > REVIEWED_VALIDATOR_LIMITS.maxResultBytes);

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:["é".repeat(${count})],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ae".repeat(32)),
        limits: { maxResultBytes: 0, maxArrayLen: -1, maxStdBytes: "bogus" }
      });
      assert.equal(outcome.kind, "message");
      assert.deepEqual(parseTransportedWorkerSuccessMessage(outcome.message), expected);
    }
  );
});

test("direct worker launch with Infinity limits cannot disable fixed reviewed array bounds", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const checkedObjects=[]; for(let i=0;i<20050;i++) checkedObjects.push("OBJ-"+i); return {status:"passed",problems:[],warnings:[],checkedObjects,checkedPaths:["public/data/report.json"]};}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("7".repeat(64)),
        limits: { maxResultBytes: Infinity, maxArrayLen: Infinity, maxStdBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.match(parsed.problems.join(" "), /checkedObjects exceeds 10000 entries/i);
      assert.equal(parsed.checkedObjects.length, 10000);
    }
  );
});

test("direct production worker still fails closed on a circular result", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const c={}; c.self=c; return {status:"passed",problems:[c],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("af".repeat(32)),
        limits: { maxResultBytes: Infinity, maxArrayLen: Infinity, maxStdBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.match(parsed.problems.join(" "), /transport-safe primitive/i);
    }
  );
});

test("non-enumerable toJSON cannot cause a larger object to cross worker transport", async () => {
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-tojson-"));
  const toJsonMarker = path.join(markerDir, "tojson-marker.txt");
  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const problem={payload:"x".repeat(400000)}; Object.defineProperty(problem,"toJSON",{enumerable:false,value:function(){require("node:fs").writeFileSync(${JSON.stringify(toJsonMarker)},"called"); return "tiny";}}); return {status:"passed",problems:[problem],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("ag".repeat(32)),
          limits: { maxResultBytes: Infinity, maxArrayLen: Infinity, maxStdBytes: Infinity }
        });
        assert.equal(outcome.kind, "message");
        assert.equal(fs.existsSync(toJsonMarker), false);
        const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
        assert.match(parsed.problems.join(" "), /transport-safe primitive/i);
        assert.equal(outcome.message.includes('"tiny"'), false);
        assert.equal(outcome.message.includes('"payload"'), false);
        assert.ok(Buffer.byteLength(outcome.message, "utf8") < REVIEWED_VALIDATOR_LIMITS.maxResultBytes);
      }
    );
  } finally {
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
});

test("accessor properties cannot produce a smaller checked value than the transported representation", async () => {
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-getter-"));
  const getterMarker = path.join(markerDir, "getter-marker.txt");
  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const result={status:"passed",warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}; Object.defineProperty(result,"problems",{enumerable:true,get:function(){require("node:fs").writeFileSync(${JSON.stringify(getterMarker)},"getter"); return ["x".repeat(400000)];}}); return result;}};\n`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("ah".repeat(32)),
          limits: { maxResultBytes: Infinity, maxArrayLen: Infinity, maxStdBytes: Infinity }
        });
        assert.equal(outcome.kind, "message");
        assert.equal(fs.existsSync(getterMarker), false);
        const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
        assert.match(parsed.problems.join(" "), /accessor property/i);
        assert.equal(outcome.message.includes("x".repeat(1024)), false);
      }
    );
  } finally {
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
});

test("prototype getters and custom class instances cannot bypass the result ceiling", async () => {
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-prototype-"));
  const getterMarker = path.join(markerDir, "prototype-getter-marker.txt");
  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";\nclass AttackResult { constructor(){ this.status="passed"; this.warnings=[]; this.checkedObjects=["OBJ-1"]; this.checkedPaths=["public/data/report.json"]; } }\nObject.defineProperty(AttackResult.prototype,"problems",{enumerable:true,get:function(){require("node:fs").writeFileSync(${JSON.stringify(getterMarker)},"prototype-getter"); return ["x".repeat(400000)];}});\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){return new AttackResult();}};\n`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("ai".repeat(32)),
          limits: { maxResultBytes: Infinity, maxArrayLen: Infinity, maxStdBytes: Infinity }
        });
        assert.equal(outcome.kind, "message");
        assert.equal(fs.existsSync(getterMarker), false);
        const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
        assert.match(parsed.problems.join(" "), /problems is not an array/i);
        assert.equal(outcome.message.includes("x".repeat(1024)), false);
      }
    );
  } finally {
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
});

test("production validation cycle parent receives only the exact parsed contents of the bounded serialization", async () => {
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-parent-transport-"));
  const toJsonMarker = path.join(markerDir, "tojson-marker.txt");
  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const problem={payload:"x".repeat(400000)}; Object.defineProperty(problem,"toJSON",{enumerable:false,value:function(){require("node:fs").writeFileSync(${JSON.stringify(toJsonMarker)},"called"); return "tiny";}}); return {status:"passed",problems:[problem],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
      async () => {
        const reg = loadValidatorRegistry();
        const phase = await require("../kernel/execution/validation-cycle").runValidationPhase(
          "candidate",
          ["execution-plan"],
          authoritativeWorkerContext("aj".repeat(32)),
          { timeoutMs: 1500, expectedValidatorSetHash: reg.validatorSetHash }
        );
        assert.equal(fs.existsSync(toJsonMarker), false);
        assert.equal(phase.status, "failed");
        assert.equal(phase.results.length, 1);
        assert.match(phase.results[0].problems.join(" "), /transport-safe primitive/i);
        assert.equal(phase.results[0].problems.join(" ").includes("x".repeat(1024)), false);
      }
    );
  } finally {
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
});

test("validator cannot send an oversized direct parentPort message", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      try {
        const port = process.getBuiltinModule("worker_threads").parentPort;
        port.postMessage("Z".repeat(400000));
      } catch (error) {}
      return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ar".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.ok(Buffer.byteLength(outcome.message, "utf8") <= REVIEWED_VALIDATOR_LIMITS.maxResultBytes);
    }
  );
});

test("validator cannot recover worker MessagePort objects or create a direct MessageChannel", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      try {
        const workerThreads = process.getBuiltinModule("worker_threads");
        if (workerThreads && workerThreads.parentPort) workerThreads.parentPort.postMessage("direct-parent");
        if (workerThreads && workerThreads.MessageChannel) {
          const channel = new workerThreads.MessageChannel();
          channel.port1.postMessage("direct-port");
          if (workerThreads.parentPort) workerThreads.parentPort.postMessage(channel.port2, [channel.port2]);
        }
      } catch (error) {}
      return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bh".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
    }
  );
});

test("global console cannot expose internal stdio MessagePorts", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      function inspectConsole(label, candidate) {
        if (candidate === undefined) return;
        problems[problems.length] = label + " was available";
        try {
          if (candidate._stdout !== undefined) problems[problems.length] = label + "._stdout was available";
          if (candidate._stderr !== undefined) problems[problems.length] = label + "._stderr was available";
          if (candidate.Console !== undefined) problems[problems.length] = label + ".Console was available";
          const streams = [candidate._stdout, candidate._stderr];
          for (const stream of streams) {
            if (!stream) continue;
            const symbols = Object.getOwnPropertySymbols(stream);
            for (const symbol of symbols) {
              const value = stream[symbol];
              if (value && typeof value.postMessage === "function") {
                problems[problems.length] = label + " exposed stdio MessagePort";
                try {
                  value.postMessage({type:"stdioPayload",stream:"stdout",chunks:[{chunk:"Z".repeat(400000),encoding:"utf8"}]});
                } catch (error) {}
              }
            }
          }
        } catch (error) {
          problems[problems.length] = label + " inspection failed";
        }
      }
      inspectConsole("console", typeof console === "undefined" ? undefined : console);
      inspectConsole("globalThis.console", globalThis.console);
      try {
        const recovered = globalThis.constructor && globalThis.constructor.constructor("return console")();
        inspectConsole("constructor console", recovered);
      } catch (error) {}
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bn".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(outcome.stdioBytes, 0);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("default validator globals do not expose raw host authority", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      const blocked = [
        "console",
        "performance",
        "navigator",
        "fetch",
        "WebSocket",
        "crypto",
        "structuredClone",
        "setTimeout",
        "setInterval",
        "setImmediate",
        "queueMicrotask",
        "AbortController",
        "AbortSignal",
        "ReadableStream",
        "WritableStream",
        "TransformStream",
        "TextEncoder",
        "TextDecoder",
        "Blob",
        "FormData",
        "Headers",
        "Request",
        "Response",
        "MessagePort",
        "MessageChannel",
        "BroadcastChannel",
        "EventTarget",
        "Event",
        "MessageEvent"
      ];
      for (const name of blocked) {
        let value;
        try { value = globalThis[name]; } catch (error) { value = undefined; }
        if (value !== undefined) problems[problems.length] = name + " remained available";
      }
      try {
        const recoveredConsole = globalThis.constructor.constructor("return console")();
        if (recoveredConsole !== undefined) problems[problems.length] = "constructor chain recovered console";
      } catch (error) {}
      try {
        const recoveredCrypto = globalThis.constructor.constructor("return crypto")();
        if (recoveredCrypto !== undefined) problems[problems.length] = "constructor chain recovered crypto";
      } catch (error) {}
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bo".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(outcome.stdioBytes, 0);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("symbol-keyed globals cannot expose Undici-like host dispatchers", async () => {
  const preloadPath = path.join(scratch, `symbol-agent-preload-${seq++}.js`);
  writeStrictFile(preloadPath, `
    class Pool {
      dispatch() {}
    }
    class Agent {
      constructor() {
        this[Symbol("factory")] = function factory() { return new Pool(); };
        this[Symbol("clients")] = new Map();
        this[Symbol("options")] = { connect: function connect() {} };
        this.callbacks = [function callback() {}];
      }
      dispatch() {}
    }
    Object.defineProperty(globalThis, Symbol.for("undici.globalDispatcher.1"), {
      value: new Agent(),
      enumerable: false,
      configurable: false,
      writable: true
    });
  `);
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      function inspect(label, value) {
        if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
        const ctorName = value.constructor && value.constructor.name;
        const proto = Object.getPrototypeOf(value);
        const protoCtorName = proto && proto.constructor && proto.constructor.name;
        if (/Agent|Pool|Client|Dispatcher/.test(String(ctorName) + " " + String(protoCtorName))) problems[problems.length] = label + " exposed dispatcher constructor";
        if (typeof value.dispatch === "function") problems[problems.length] = label + " exposed dispatch";
        const ownKeys = Reflect.ownKeys(value);
        for (const key of ownKeys) {
          let child;
          try { child = value[key]; } catch (error) { continue; }
          if (child === null || (typeof child !== "object" && typeof child !== "function")) continue;
          if (typeof child === "function") problems[problems.length] = label + " exposed internal function";
          if (child instanceof Map) problems[problems.length] = label + " exposed internal Map";
          if (child && typeof child.dispatch === "function") problems[problems.length] = label + " manufactured dispatcher";
          try {
            if (typeof child === "function") {
              const produced = child({});
              if (produced && typeof produced.dispatch === "function") problems[problems.length] = label + " manufactured Pool";
            }
          } catch (error) {}
        }
      }
      const symbols = Object.getOwnPropertySymbols(globalThis);
      for (const symbol of symbols) inspect(String(symbol), globalThis[symbol]);
      const allKeys = Reflect.ownKeys(globalThis);
      for (const key of allKeys) {
        if (typeof key === "symbol") inspect("Reflect.ownKeys " + String(key), globalThis[key]);
      }
      inspect("Symbol.for undici", globalThis[Symbol.for("undici.globalDispatcher.1")]);
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bq".repeat(32))
      }, 1500, { execArgv: ["--require", preloadPath] });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(outcome.stdioBytes, 0);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("validator global boundary hides inherited and late-installed host authority", async () => {
  const preloadPath = path.join(scratch, `symbol-inherited-late-agent-preload-${seq++}.js`);
  writeStrictFile(preloadPath, `
    class Pool {
      dispatch() {}
    }
    class Client {
      dispatch() {}
    }
    class Dispatcher {
      dispatch() {}
    }
    class Agent {
      constructor() {
        this[Symbol("factory")] = function factory() { return new Pool(); };
        this[Symbol("clients")] = new Map();
        this[Symbol("options")] = { connect: function connect() {} };
        this.callbacks = [function callback() {}];
      }
      dispatch() {}
    }
    function makeAgent() { return new Agent(); }
    const proto = Object.getPrototypeOf(globalThis);
    Object.defineProperty(globalThis, Symbol.for("audit.own.dispatcher"), {
      value: makeAgent(),
      enumerable: false,
      configurable: true,
      writable: true
    });
    Object.defineProperty(proto, Symbol.for("audit.inherited.dispatcher"), {
      value: makeAgent(),
      enumerable: false,
      configurable: true,
      writable: true
    });
    Object.defineProperty(Object.prototype, Symbol.for("audit.object-prototype.dispatcher"), {
      value: makeAgent(),
      enumerable: false,
      configurable: false,
      writable: false
    });
    Object.defineProperty(proto, Symbol.for("audit.accessor.dispatcher"), {
      get() { return makeAgent(); },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(proto, Symbol.for("audit.nonconfig.inherited.dispatcher"), {
      value: makeAgent(),
      enumerable: false,
      configurable: false,
      writable: false
    });
    Object.defineProperty(globalThis, Symbol.for("audit.primitive.dispatcher"), {
      value: "primitive-before-lock",
      enumerable: false,
      configurable: true,
      writable: true
    });
    globalThis.auditOwnDispatcher = makeAgent();
    proto.auditInheritedDispatcher = makeAgent();
    Object.prototype.auditObjectPrototypeDispatcher = makeAgent();
    function installLate(kind) {
      globalThis[Symbol.for("audit.late." + kind + ".dispatcher")] = makeAgent();
      globalThis["auditLate" + kind[0].toUpperCase() + kind.slice(1) + "Dispatcher"] = makeAgent();
      try { globalThis[Symbol.for("audit.primitive.dispatcher")] = makeAgent(); } catch (error) {}
    }
    process.nextTick(() => installLate("nextTick"));
    queueMicrotask(() => installLate("microtask"));
    Promise.resolve().then(() => installLate("promise"));
    setImmediate(() => installLate("immediate"));
  `);
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(validatorGlobalAuthorityAuditBody()),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bs".repeat(32))
      }, 1500, { execArgv: ["--require", preloadPath] });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(outcome.stdioBytes, 0);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("validator-visible object graph exposes no host-realm authority", async () => {
  const preloadPath = path.join(scratch, `cross-realm-host-preload-${seq++}.js`);
  const hostMarker = path.join(scratch, `cross-realm-host-marker-${seq++}.txt`);
  const depPath = path.join(REAL_VALIDATORS, "cross-realm-dependency.js");
  const depSource = `"use strict";\nmodule.exports={array:[1,{nested:true}],object:{label:"dependency-object"},factory:function(){return {made:["dependency-result"]};}};\n`;
  writeStrictFile(preloadPath, `
    const fs = require("fs");
    class Pool { dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "pool-dispatch"); } }
    class Client { dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "client-dispatch"); } }
    class Dispatcher { dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "dispatcher-dispatch"); } }
    class Agent {
      constructor(label) {
        this.label = label;
        this[Symbol("factory")] = function factory() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "factory"); return new Pool(); };
        this[Symbol("clients")] = new Map([["client", new Client()]]);
        this[Symbol("options")] = { callback: function callback() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "callback"); } };
      }
      dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "agent-dispatch-" + this.label); }
    }
    function makeAgent(label) { return new Agent(label); }
    const proto = Object.getPrototypeOf(globalThis);
    Object.defineProperty(globalThis, Symbol.for("audit.host.own"), { value: makeAgent("own"), configurable: true, writable: true });
    Object.defineProperty(proto, Symbol.for("audit.host.inherited"), { value: makeAgent("inherited"), configurable: true, writable: true });
    Object.defineProperty(Object.prototype, Symbol.for("audit.host.object-prototype"), { value: makeAgent("object-prototype"), configurable: false, writable: false });
    Object.defineProperty(proto, Symbol.for("audit.host.accessor"), { get() { return makeAgent("accessor"); }, configurable: true });
    Object.defineProperty(Object.prototype, Symbol.for("audit.host.object-prototype-sentinel"), { value: "host-object-prototype", configurable: true });
    Object.defineProperty(Function.prototype, Symbol.for("audit.host.function-prototype-sentinel"), { value: "host-function-prototype", configurable: true });
    Object.defineProperty(Array.prototype, Symbol.for("audit.host.array-prototype-sentinel"), { value: "host-array-prototype", configurable: true });
    Object.defineProperty(Map.prototype, Symbol.for("audit.host.map-prototype-sentinel"), { value: "host-map-prototype", configurable: true });
    function installLate(label) {
      globalThis[Symbol.for("audit.host.late." + label)] = makeAgent(label);
      globalThis["auditHostLate" + label] = makeAgent(label + "-string");
    }
    process.nextTick(() => installLate("nextTick"));
    queueMicrotask(() => installLate("microtask"));
    Promise.resolve().then(() => installLate("promise"));
    setImmediate(() => installLate("immediate"));
  `);
  writeStrictFile(depPath, depSource);
  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";
const topProblems = [];
function runAudit(stage, context) {
  const problems = [];
  function add(problem) { problems[problems.length] = stage + ": " + problem; }
  function isObjectLike(value) { return value !== null && (typeof value === "object" || typeof value === "function"); }
  function keyText(key) { try { return String(key); } catch (error) { return "<key>"; } }
  const hostSymbols = [
    "audit.host.own",
    "audit.host.inherited",
    "audit.host.object-prototype",
    "audit.host.accessor",
    "audit.host.late.nextTick",
    "audit.host.late.microtask",
    "audit.host.late.promise",
    "audit.host.late.immediate",
    "audit.host.object-prototype-sentinel",
    "audit.host.function-prototype-sentinel",
    "audit.host.array-prototype-sentinel",
    "audit.host.map-prototype-sentinel"
  ].map((name) => Symbol.for(name));
  function inspectHostValue(label, value, seen) {
    if (!isObjectLike(value)) return;
    const ctorName = (() => { try { return value.constructor && value.constructor.name; } catch (error) { return ""; } })();
    const proto = (() => { try { return Object.getPrototypeOf(value); } catch (error) { return null; } })();
    const protoCtorName = (() => { try { return proto && proto.constructor && proto.constructor.name; } catch (error) { return ""; } })();
    if (/Agent|Pool|Client|Dispatcher/.test(String(ctorName) + " " + String(protoCtorName))) {
      add(label + " exposed host dispatcher constructor");
      try { if (typeof value.dispatch === "function") value.dispatch(); } catch (error) {}
    }
    try {
      if (typeof value.dispatch === "function" && value !== globalThis) {
        add(label + " exposed host dispatch function");
        try { value.dispatch(); } catch (error) {}
      }
    } catch (error) {}
    for (const symbol of hostSymbols) {
      try {
        if (value[symbol] !== undefined) add(label + " exposed host sentinel " + String(symbol));
      } catch (error) {}
    }
    if (seen.indexOf(value) !== -1) return;
    seen[seen.length] = value;
    let keys = [];
    try { keys = Reflect.ownKeys(value); } catch (error) { return; }
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      let descriptor;
      try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch (error) { continue; }
      if (!descriptor) continue;
      const childLabel = label + "." + keyText(key);
      if ("value" in descriptor && isObjectLike(descriptor.value) && seen.length < 160) inspectHostValue(childLabel, descriptor.value, seen);
      if ("get" in descriptor && typeof descriptor.get === "function") inspectHostValue(childLabel + ".get", descriptor.get, seen);
      if ("set" in descriptor && typeof descriptor.set === "function") inspectHostValue(childLabel + ".set", descriptor.set, seen);
    }
  }
  function inspectRecoveredGlobal(label, candidate) {
    if (!candidate || candidate === globalThis || !isObjectLike(candidate)) return;
    for (const symbol of hostSymbols) {
      try {
        if (candidate[symbol] !== undefined) {
          add(label + " recovered host global through " + String(symbol));
          inspectHostValue(label + ".hostGlobal", candidate[symbol], []);
        }
      } catch (error) {}
    }
    for (const name of ["auditHostLatenextTick", "auditHostLatemicrotask", "auditHostLatepromise", "auditHostLateimmediate"]) {
      try {
        if (candidate[name] !== undefined) {
          add(label + " recovered host global string authority " + name);
          inspectHostValue(label + "." + name, candidate[name], []);
        }
      } catch (error) {}
    }
  }
  function tryConstructorEscape(label, value) {
    const candidates = [value];
    try { if (value !== undefined && value !== null) candidates[candidates.length] = Object.getPrototypeOf(value); } catch (error) {}
    try { if (value && value.prototype !== undefined) candidates[candidates.length] = value.prototype; } catch (error) {}
    try { if (value && value.prototype !== undefined) candidates[candidates.length] = Object.getPrototypeOf(value.prototype); } catch (error) {}
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (!candidate) continue;
      try {
        const ctor = candidate.constructor;
        const fn = ctor && ctor.constructor;
        if (typeof fn === "function") inspectRecoveredGlobal(label + ".constructor[" + index + "]", fn("return globalThis")());
      } catch (error) {}
    }
  }
  function audit(label, value, depth, seen) {
    if (!isObjectLike(value) || depth < 0) return;
    if (!seen) seen = [];
    if (seen.indexOf(value) !== -1) return;
    seen[seen.length] = value;
    tryConstructorEscape(label, value);
    inspectHostValue(label, value, []);
    try {
      const proto = Object.getPrototypeOf(value);
      if (proto) audit(label + ".[[Prototype]]", proto, depth - 1, seen);
    } catch (error) {}
    try {
      if (value.prototype !== undefined) audit(label + ".prototype", value.prototype, depth - 1, seen);
    } catch (error) {}
    let keys = [];
    try { keys = Reflect.ownKeys(value); } catch (error) { return; }
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      let descriptor;
      try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch (error) { continue; }
      if (!descriptor) continue;
      const childLabel = label + "." + keyText(key);
      if ("value" in descriptor) audit(childLabel, descriptor.value, depth - 1, seen);
      if ("get" in descriptor) audit(childLabel + ".get", descriptor.get, depth - 1, seen);
      if ("set" in descriptor) audit(childLabel + ".set", descriptor.set, depth - 1, seen);
    }
  }
  function auditEverything(contextArg) {
    const fs = require("node:fs");
    const crypto = require("node:crypto");
    const path = require("node:path");
    const util = require("node:util");
    const assert = require("node:assert");
    const Buffer = require("node:buffer").Buffer;
    const dep = require("./cross-realm-dependency");
    const hash = crypto.createHash("sha256");
    hash.update("abc");
    const values = [];
    function capture(label, fn) {
      try { values[values.length] = [label, fn()]; } catch (error) { add(label + " capture failed: " + String(error && error.message ? error.message : error)); }
    }
    for (const pair of [
      ["globalThis", globalThis],
      ["context", contextArg],
      ["require", require],
      ["require.prototype", require.prototype],
      ["module", module],
      ["exports", exports],
      ["fs", fs],
      ["fs.readFileSync", fs.readFileSync],
      ["fs.writeFileSync", fs.writeFileSync],
      ["fs.realpathSync", fs.realpathSync],
      ["fs.statSync result", fs.statSync(__filename)],
      ["fs.readFileSync result", fs.readFileSync(__filename)],
      ["crypto", crypto],
      ["crypto.createHash", crypto.createHash],
      ["hash wrapper", hash],
      ["hash.update", hash.update],
      ["hash.digest", hash.digest],
      ["hash digest result", function(){ return hash.digest(); }],
      ["Buffer facade", Buffer],
      ["Buffer.from", Buffer.from],
      ["Buffer.byteLength", Buffer.byteLength],
      ["Buffer.isBuffer", Buffer.isBuffer],
      ["Buffer.concat", Buffer.concat],
      ["Buffer.alloc", Buffer.alloc],
      ["Buffer.allocUnsafe", Buffer.allocUnsafe],
      ["Buffer.from result", function(){ return Buffer.from("abc"); }],
      ["Buffer.concat result", function(){ return Buffer.concat([Buffer.from("a"), Buffer.from("b")]); }],
      ["path", path],
      ["path.join", path.join],
      ["path.resolve", path.resolve],
      ["path.relative", path.relative],
      ["path.dirname", path.dirname],
      ["path.basename", path.basename],
      ["path.extname", path.extname],
      ["path.normalize", path.normalize],
      ["path.isAbsolute", path.isAbsolute],
      ["path.posix", path.posix],
      ["path.posix.join", path.posix.join],
      ["path.win32", path.win32],
      ["path.win32.join", path.win32.join],
      ["util", util],
      ["util.format", util.format],
      ["assert", assert],
      ["assert.ok", assert.ok],
      ["assert.equal", assert.equal],
      ["assert.strictEqual", assert.strictEqual],
      ["assert.deepEqual", assert.deepEqual],
      ["assert.deepStrictEqual", assert.deepStrictEqual],
      ["JSON", JSON],
      ["JSON.parse", JSON.parse],
      ["JSON.stringify", JSON.stringify],
      ["JSON object", function(){ return JSON.parse('{"items":[{"id":"OBJ-1"}]}'); }],
      ["JSON array", function(){ return JSON.parse("[1]"); }],
      ["dependency exports", dep],
      ["dependency array", dep.array],
      ["dependency object", dep.object],
      ["dependency factory", dep.factory],
      ["dependency factory result", function(){ return dep.factory(); }]
    ]) {
      capture(pair[0], typeof pair[1] === "function" && pair[0].endsWith(" result") || pair[0] === "JSON object" || pair[0] === "JSON array" ? pair[1] : function(){ return pair[1]; });
    }
    for (let index = 0; index < values.length; index += 1) audit(values[index][0], values[index][1], 4, []);
  }
  try {
    auditEverything(context);
  } catch (error) {
    add("audit threw " + String(error && error.message ? error.message : error));
  }
  return problems;
}
topProblems.push.apply(topProblems, runAudit("top-level", undefined));
module.exports={
  id:"execution-plan",
  version:"1.0.0",
  supportedPhases:["candidate","post_write"],
  validate:function(context){
    const validateProblems = runAudit("validate", context);
    const problems = topProblems.concat(validateProblems);
    return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
  }
};
`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("bt".repeat(32))
        }, 2500, { execArgv: ["--require", preloadPath] });
        assert.equal(outcome.kind, "message");
        assertNoDirectWorkerMessages(outcome);
        assert.equal(outcome.stdioBytes, 0);
        const envelope = parseTransportedWorkerEnvelope(outcome.message);
        assert.equal(envelope.ok, true, JSON.stringify(envelope));
        const parsed = envelope.result;
        assert.equal(parsed.status, "passed", parsed.problems.join("\n"));
        assert.deepEqual(parsed.problems, []);
        assert.equal(fs.existsSync(hostMarker), false);
      }
    );
  } finally {
    try { fs.rmSync(depPath, { force: true }); } catch (error) {}
    try { fs.rmSync(hostMarker, { force: true }); } catch (error) {}
  }
});

test("local require failure membrane and cache lifecycle expose no raw host thrown values or partial exports", async () => {
  const suffix = `require-failure-${seq++}`;
  const preloadPath = path.join(scratch, `${suffix}-preload.js`);
  const hostMarker = path.join(scratch, `${suffix}-host-marker.txt`);
  const topMarker = path.join(scratch, `${suffix}-top-marker.txt`);
  const validateMarker = path.join(scratch, `${suffix}-validate-marker.txt`);
  const hostileGetterMarker = path.join(scratch, `${suffix}-hostile-getter-marker.txt`);
  const writtenDeps = [];
  const depName = (label) => `${suffix}-${label}.js`;
  const depPath = (label) => path.join(REAL_VALIDATORS, depName(label));
  const writeDep = (label, source) => {
    const filePath = depPath(label);
    writtenDeps[writtenDeps.length] = filePath;
    writeStrictFile(filePath, source);
  };
  const thrownCases = [
    ["compile-failure", `let require;`],
    ["error", `throw new Error("dependency error");`],
    ["custom-error", `class CustomDependencyError extends Error {}; throw new CustomDependencyError("custom dependency error");`],
    ["aggregate", `throw new AggregateError([new Error("inner")], "aggregate dependency error");`],
    ["string", `throw "dependency string";`],
    ["symbol", `throw Symbol.for("dependency.symbol");`],
    ["null", `throw null;`],
    ["object", `throw { label: "plain object", nested: { ok: true } };`],
    ["array", `throw ["array", { nested: true }];`],
    ["proxy", `throw new Proxy({ label: "proxy" }, { get(target, key) { if (key === "message") return "proxy message"; return target[key]; } });`],
    ["revoked-proxy", `const pair = Proxy.revocable({ label: "revoked" }, {}); pair.revoke(); throw pair.proxy;`],
    ["malformed-proxy-prototype", `throw new Proxy({}, { getPrototypeOf() { return 1; } });`],
    ["throwing-proxy-traps", `throw new Proxy({}, { get() { throw new Error("get trap"); }, getPrototypeOf() { throw new Error("prototype trap"); }, ownKeys() { throw new Error("ownKeys trap"); } });`],
    ["self-throwing-proxy-trap", `let thrown; thrown = new Proxy({}, { getPrototypeOf() { throw thrown; } }); throw thrown;`],
    ["accessor", `const thrown = {}; Object.defineProperty(thrown, "message", { get() { require("node:fs").writeFileSync(${JSON.stringify(hostileGetterMarker)}, "accessor-message"); return "accessor"; } }); throw thrown;`],
    ["cause", `throw new Error("outer", { cause: { nested: "cause" } });`],
    ["callsite", `Error.prepareStackTrace = function(error, sites) { return sites; }; const sites = new Error("callsite").stack; throw sites[0];`],
    ["promise", `throw Promise.resolve({ authority: function authority(){} });`],
    ["thenable", `throw { then(resolve) { resolve({ authority: function authority(){} }); } };`],
    ["export-primitive", `module.exports = 7; throw new Error("after primitive export");`],
    ["export-function", `module.exports = function partial(){}; throw new Error("after function export");`],
    ["export-object", `module.exports = { partial: true }; throw new Error("after object export");`],
    ["export-nested-object", `module.exports = { partial: { nested: true } }; throw new Error("after nested object export");`],
    ["export-array", `module.exports = ["partial", { nested: true }]; throw new Error("after array export");`],
    ["export-cycle", `const partial = { label: "partial" }; partial.self = partial; module.exports = partial; throw new Error("after cyclic export");`],
    ["hostile", `const fs = require("node:fs"); const thrown = {}; for (const key of ["toString", "message", "name", "stack"]) Object.defineProperty(thrown, key, { get() { fs.writeFileSync(${JSON.stringify(hostileGetterMarker)}, "getter-" + key); return key === "toString" ? function(){ return "hostile"; } : "hostile"; } }); throw thrown;`]
  ];
  writeStrictFile(preloadPath, `
    const fs = require("fs");
    class Pool { dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "pool"); } }
    class Client { dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "client"); } }
    class Dispatcher { dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "dispatcher"); } }
    class Agent {
      constructor(label) {
        this.label = label;
        this[Symbol("factory")] = function factory() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "factory"); return new Pool(); };
        this[Symbol("clients")] = new Map([["client", new Client()]]);
        this[Symbol("options")] = { callback: function callback() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "callback"); } };
      }
      dispatch() { fs.writeFileSync(${JSON.stringify(hostMarker)}, "agent-" + this.label); }
    }
    function makeAgent(label) { return new Agent(label); }
    const proto = Object.getPrototypeOf(globalThis);
    Object.defineProperty(proto, Symbol.for("audit.requireFailure.inheritedAgent"), { value: makeAgent("inherited"), configurable: true });
    Object.defineProperty(Object.prototype, Symbol.for("audit.requireFailure.objectPrototypeAgent"), { value: makeAgent("object-prototype"), configurable: true });
    Object.defineProperty(Function.prototype, Symbol.for("audit.requireFailure.functionPrototypeSentinel"), { value: "host-function-prototype", configurable: true });
    Object.defineProperty(Array.prototype, Symbol.for("audit.requireFailure.arrayPrototypeSentinel"), { value: "host-array-prototype", configurable: true });
    Object.defineProperty(Map.prototype, Symbol.for("audit.requireFailure.mapPrototypeSentinel"), { value: "host-map-prototype", configurable: true });
    function installLate(label) {
      globalThis[Symbol.for("audit.requireFailure.late." + label)] = makeAgent(label);
      globalThis["auditRequireFailureLate" + label] = makeAgent(label + "-string");
    }
    process.nextTick(() => installLate("nextTick"));
    queueMicrotask(() => installLate("microtask"));
    Promise.resolve().then(() => installLate("promise"));
    setImmediate(() => installLate("immediate"));
  `);
  try {
    for (const [label, statement] of thrownCases) {
      writeDep(`top-${label}`, `"use strict";\n${statement}\n`);
      writeDep(`validate-${label}`, `"use strict";\n${statement}\n`);
    }
    writeDep("top-sloppy-caller", `function outer(){ return inner(); } function inner(){ throw inner.caller; } outer();\n`);
    writeDep("validate-sloppy-caller", `function outer(){ return inner(); } function inner(){ throw inner.caller; } outer();\n`);
    writeDep("top-transitive-b", `"use strict";\nthrow new Error("top transitive leaf");\n`);
    writeDep("top-transitive-a", `"use strict";\nrequire("./${depName("top-transitive-b")}");\nmodule.exports={unreachable:true};\n`);
    writeDep("validate-transitive-b", `"use strict";\nthrow new Error("validate transitive leaf");\n`);
    writeDep("validate-transitive-a", `"use strict";\nrequire("./${depName("validate-transitive-b")}");\nmodule.exports={unreachable:true};\n`);
    writeDep("ok-direct", `"use strict";\nmodule.exports={label:"direct", nested:{ ok:true }, array:[1,{two:true}], factory:function(){return {made:["direct"]};}};\n`);
    writeDep("ok-transitive-b", `"use strict";\nmodule.exports={label:"transitive-b", values:["b"]};\n`);
    writeDep("ok-transitive-a", `"use strict";\nconst b=require("./${depName("ok-transitive-b")}");\nmodule.exports={label:"transitive-a", b};\n`);
    writeDep("cycle-a", `"use strict";\nexports.name="cycle-a"; const b=require("./${depName("cycle-b")}"); exports.fromB=b.name || "pending";\n`);
    writeDep("cycle-b", `"use strict";\nexports.name="cycle-b"; const a=require("./${depName("cycle-a")}"); exports.fromA=a.name || "pending";\n`);
    const topAttempts = thrownCases.map(([label]) => [1, 2].map((retry) => `topProblems.push.apply(topProblems, attempt("top", ${JSON.stringify(`${label}-retry-${retry}`)}, function(){ require("./${depName(`top-${label}`)}"); }));`).join("\n")).join("\n");
    const validateAttempts = thrownCases.map(([label]) => [1, 2, 3].map((retry) => `problems.push.apply(problems, attempt("validate", ${JSON.stringify(`${label}-retry-${retry}`)}, function(){ require("./${depName(`validate-${label}`)}"); }));`).join("\n")).join("\n");
    const validateTopRetries = thrownCases.map(([label]) => `problems.push.apply(problems, attempt("validate", ${JSON.stringify(`${label}-top-level-retry`)}, function(){ require("./${depName(`top-${label}`)}"); }));`).join("\n");
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";
const fs = require("node:fs");
try { Map.prototype.delete = function(){ return true; }; } catch (error) {}
const topProblems = [];
function isObjectLike(value) { return value !== null && (typeof value === "object" || typeof value === "function"); }
function keyText(key) { try { return String(key); } catch (error) { return "<key>"; } }
const hostSymbols = [
  "audit.requireFailure.inheritedAgent",
  "audit.requireFailure.objectPrototypeAgent",
  "audit.requireFailure.functionPrototypeSentinel",
  "audit.requireFailure.arrayPrototypeSentinel",
  "audit.requireFailure.mapPrototypeSentinel",
  "audit.requireFailure.late.nextTick",
  "audit.requireFailure.late.microtask",
  "audit.requireFailure.late.promise",
  "audit.requireFailure.late.immediate"
].map((name) => Symbol.for(name));
function mark(stage, label) {
  try { fs.writeFileSync(stage === "top" ? ${JSON.stringify(topMarker)} : ${JSON.stringify(validateMarker)}, label); } catch (error) {}
}
function add(problems, stage, problem) {
  problems[problems.length] = stage + ": " + problem;
  mark(stage, problem);
}
function inspectAuthority(problems, stage, label, value, seen) {
  if (!isObjectLike(value)) return;
  if (!seen) seen = [];
  if (seen.indexOf(value) !== -1) return;
  seen[seen.length] = value;
  let ctorName = "";
  let protoCtorName = "";
  try { ctorName = value.constructor && value.constructor.name; } catch (error) {}
  try {
    const proto = Object.getPrototypeOf(value);
    protoCtorName = proto && proto.constructor && proto.constructor.name;
  } catch (error) {}
  const names = String(ctorName) + " " + String(protoCtorName);
  if (/Agent|Pool|Client|Dispatcher|WorkerFailure/.test(names)) {
    add(problems, stage, label + " exposed host constructor " + names);
    try { if (typeof value.dispatch === "function") value.dispatch(); } catch (error) {}
  }
  try {
    if (typeof value.dispatch === "function") {
      add(problems, stage, label + " exposed dispatch");
      try { value.dispatch(); } catch (error) {}
    }
  } catch (error) {}
  for (const symbol of hostSymbols) {
    try {
      if (value[symbol] !== undefined) add(problems, stage, label + " exposed host sentinel " + String(symbol));
    } catch (error) {}
  }
  let keys = [];
  try { keys = Reflect.ownKeys(value); } catch (error) { return; }
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch (error) { continue; }
    if (!descriptor) continue;
    const childLabel = label + "." + keyText(key);
    if ("value" in descriptor && seen.length < 180) inspectAuthority(problems, stage, childLabel, descriptor.value, seen);
    if ("get" in descriptor && typeof descriptor.get === "function") inspectAuthority(problems, stage, childLabel + ".get", descriptor.get, seen);
    if ("set" in descriptor && typeof descriptor.set === "function") inspectAuthority(problems, stage, childLabel + ".set", descriptor.set, seen);
  }
}
function inspectRecoveredGlobal(problems, stage, label, candidate) {
  if (!candidate || candidate === globalThis || !isObjectLike(candidate)) return;
  add(problems, stage, label + " recovered distinct global");
  for (const symbol of hostSymbols) {
    try {
      if (candidate[symbol] !== undefined) inspectAuthority(problems, stage, label + ".hostGlobal." + String(symbol), candidate[symbol], []);
    } catch (error) {}
  }
  for (const name of ["auditRequireFailureLatenextTick", "auditRequireFailureLatemicrotask", "auditRequireFailureLatepromise", "auditRequireFailureLateimmediate"]) {
    try {
      if (candidate[name] !== undefined) inspectAuthority(problems, stage, label + ".hostGlobal." + name, candidate[name], []);
    } catch (error) {}
  }
}
function tryConstructorEscape(problems, stage, label, value) {
  const candidates = [value];
  try { if (value !== undefined && value !== null) candidates[candidates.length] = Object.getPrototypeOf(value); } catch (error) {}
  try { if (value && value.prototype !== undefined) candidates[candidates.length] = value.prototype; } catch (error) {}
  try { if (value && value.prototype !== undefined) candidates[candidates.length] = Object.getPrototypeOf(value.prototype); } catch (error) {}
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate) continue;
    try {
      const ctor = candidate.constructor;
      const fn = ctor && ctor.constructor;
      if (typeof fn === "function") inspectRecoveredGlobal(problems, stage, label + ".constructor[" + index + "]", fn("return globalThis")());
    } catch (error) {}
  }
}
function auditCaught(problems, stage, label, caught) {
  if (isObjectLike(caught)) {
    try {
      if (Object.getPrototypeOf(caught) !== null) add(problems, stage, label + " caught value did not have a null prototype");
    } catch (error) { add(problems, stage, label + " prototype inspection threw"); }
    try { if (!Object.isFrozen(caught)) add(problems, stage, label + " caught value was not frozen"); } catch (error) { add(problems, stage, label + " frozen inspection threw"); }
    try {
      const keys = Reflect.ownKeys(caught);
      const expected = ["code", "message", "name"];
      const actual = keys.filter((key) => typeof key === "string").sort();
      if (keys.some((key) => typeof key === "symbol") || actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        add(problems, stage, label + " caught value exposed unreviewed fields");
      }
      for (const key of actual) {
        const descriptor = Object.getOwnPropertyDescriptor(caught, key);
        if (!descriptor || typeof descriptor.value !== "string" || descriptor.get || descriptor.set) add(problems, stage, label + "." + key + " was not a primitive data field");
      }
    } catch (error) { add(problems, stage, label + " primitive-field inspection threw"); }
  }
  tryConstructorEscape(problems, stage, label, caught);
  inspectAuthority(problems, stage, label, caught, []);
  for (const key of ["stack", "cause", "message", "name"]) {
    try {
      const value = caught && caught[key];
      if (isObjectLike(value)) inspectAuthority(problems, stage, label + "." + key, value, []);
    } catch (error) { add(problems, stage, label + "." + key + " accessor threw"); }
  }
  if (isObjectLike(caught)) {
    let keys = [];
    try { keys = Reflect.ownKeys(caught); } catch (error) { add(problems, stage, label + " ownKeys threw"); }
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      let descriptor;
      try { descriptor = Object.getOwnPropertyDescriptor(caught, key); } catch (error) { add(problems, stage, label + " descriptor threw"); continue; }
      if (!descriptor) continue;
      if ("value" in descriptor) inspectAuthority(problems, stage, label + "." + keyText(key), descriptor.value, []);
      if ("get" in descriptor) inspectAuthority(problems, stage, label + "." + keyText(key) + ".get", descriptor.get, []);
      if ("set" in descriptor) inspectAuthority(problems, stage, label + "." + keyText(key) + ".set", descriptor.set, []);
    }
  }
}
function auditValue(problems, stage, label, value, seen) {
  if (!isObjectLike(value)) return;
  if (!seen) seen = [];
  if (seen.indexOf(value) !== -1) return;
  seen[seen.length] = value;
  tryConstructorEscape(problems, stage, label, value);
  inspectAuthority(problems, stage, label, value, []);
  try {
    const proto = Object.getPrototypeOf(value);
    if (proto) auditValue(problems, stage, label + ".[[Prototype]]", proto, seen);
  } catch (error) {}
  try {
    if (value.prototype !== undefined) auditValue(problems, stage, label + ".prototype", value.prototype, seen);
  } catch (error) {}
  let keys = [];
  try { keys = Reflect.ownKeys(value); } catch (error) { return; }
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch (error) { continue; }
    if (!descriptor) continue;
    if ("value" in descriptor) auditValue(problems, stage, label + "." + keyText(key), descriptor.value, seen);
    if ("get" in descriptor) auditValue(problems, stage, label + "." + keyText(key) + ".get", descriptor.get, seen);
    if ("set" in descriptor) auditValue(problems, stage, label + "." + keyText(key) + ".set", descriptor.set, seen);
  }
}
function attempt(stage, label, fn) {
  const problems = [];
  try {
    fn();
    add(problems, stage, label + " did not throw");
  } catch (caught) {
    auditCaught(problems, stage, label, caught);
  }
  return problems;
}
function auditBridgeFailures(stage) {
  const problems = [];
  try { require("node:fs").writeFileSync(1, "x"); add(problems, stage, "fs fd write did not throw"); } catch (caught) { auditCaught(problems, stage, "fs fd write", caught); }
  try { require("node:assert").ok(false, "expected assertion failure"); add(problems, stage, "assert failure did not throw"); } catch (caught) { auditCaught(problems, stage, "assert failure", caught); }
  try {
    const hash = require("node:crypto").createHash("sha256");
    hash.digest("hex");
    hash.update("after digest");
    add(problems, stage, "hash update after digest did not throw");
  } catch (caught) {
    auditCaught(problems, stage, "hash update after digest", caught);
  }
  return problems;
}
function auditNormalDependencies(stage) {
  const problems = [];
  try {
    const direct = require("./${depName("ok-direct")}");
    const transitive = require("./${depName("ok-transitive-a")}");
    const cycleA = require("./${depName("cycle-a")}");
    const cycleB = require("./${depName("cycle-b")}");
    const directAgain = require("./${depName("ok-direct")}");
    const transitiveAgain = require("./${depName("ok-transitive-a")}");
    const cycleAAgain = require("./${depName("cycle-a")}");
    const cycleBAgain = require("./${depName("cycle-b")}");
    if (direct.label !== "direct") add(problems, stage, "normal direct dependency did not load");
    if (transitive.b.label !== "transitive-b") add(problems, stage, "normal transitive dependency did not load");
    if (cycleA.name !== "cycle-a" || cycleB.name !== "cycle-b") add(problems, stage, "cycle dependency did not load");
    if (direct !== directAgain || transitive !== transitiveAgain) add(problems, stage, "successfully loaded dependencies were not retained in cache");
    if (cycleA !== cycleAAgain || cycleB !== cycleBAgain) add(problems, stage, "successful cycle participants were not retained in cache");
    if (require("node:path").posix.join("a", "b") !== "a/b") add(problems, stage, "path builtin failed");
    if (require("node:buffer").Buffer.from("abc").toString("utf8") !== "abc") add(problems, stage, "buffer builtin failed");
    auditValue(problems, stage, "normal direct dependency", direct, []);
    auditValue(problems, stage, "normal transitive dependency", transitive, []);
    auditValue(problems, stage, "cycle A dependency", cycleA, []);
    auditValue(problems, stage, "cycle B dependency", cycleB, []);
    auditValue(problems, stage, "dependency factory result", direct.factory(), []);
  } catch (caught) {
    add(problems, stage, "normal dependency path threw");
    auditCaught(problems, stage, "normal dependency path", caught);
  }
  return problems;
}
${topAttempts}
topProblems.push.apply(topProblems, attempt("top", "sloppy-caller", function(){ require("./${depName("top-sloppy-caller")}"); }));
topProblems.push.apply(topProblems, attempt("top", "transitive", function(){ require("./${depName("top-transitive-a")}"); }));
topProblems.push.apply(topProblems, attempt("top", "transitive-leaf-direct-retry", function(){ require("./${depName("top-transitive-b")}"); }));
topProblems.push.apply(topProblems, attempt("top", "transitive-parent-second-retry", function(){ require("./${depName("top-transitive-a")}"); }));
topProblems.push.apply(topProblems, auditBridgeFailures("top"));
topProblems.push.apply(topProblems, auditNormalDependencies("top"));
module.exports={
  id:"execution-plan",
  version:"1.0.0",
  supportedPhases:["candidate","post_write"],
  validate:function(){
    const problems = topProblems.slice();
${validateAttempts}
${validateTopRetries}
    problems.push.apply(problems, attempt("validate", "sloppy-caller", function(){ require("./${depName("validate-sloppy-caller")}"); }));
    problems.push.apply(problems, attempt("validate", "transitive", function(){ require("./${depName("validate-transitive-a")}"); }));
    problems.push.apply(problems, attempt("validate", "transitive-leaf-direct-retry", function(){ require("./${depName("validate-transitive-b")}"); }));
    problems.push.apply(problems, attempt("validate", "transitive-parent-second-retry", function(){ require("./${depName("validate-transitive-a")}"); }));
    problems.push.apply(problems, attempt("validate", "top-transitive-parent-validate-retry", function(){ require("./${depName("top-transitive-a")}"); }));
    problems.push.apply(problems, auditBridgeFailures("validate"));
    problems.push.apply(problems, auditNormalDependencies("validate"));
    return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
  }
};
`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("bu".repeat(32))
        }, 3000, { execArgv: ["--require", preloadPath] });
        assert.equal(outcome.kind, "message");
        assertNoDirectWorkerMessages(outcome);
        assert.equal(outcome.stdioBytes, 0);
        const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
        assert.equal(parsed.status, "passed", parsed.problems.join("\n"));
        assert.deepEqual(parsed.problems, []);
        assert.equal(fs.existsSync(hostMarker), false);
        assert.equal(fs.existsSync(topMarker), false);
        assert.equal(fs.existsSync(validateMarker), false);
        assert.equal(fs.existsSync(hostileGetterMarker), false);
      }
    );
  } finally {
    for (const filePath of writtenDeps) {
      try { fs.rmSync(filePath, { force: true }); } catch (error) {}
    }
    for (const filePath of [hostMarker, topMarker, validateMarker, hostileGetterMarker]) {
      try { fs.rmSync(filePath, { force: true }); } catch (error) {}
    }
  }
});

test("failed CommonJS cycle participants roll back atomically while prior and successful loads stay cached", async () => {
  const suffix = `failed-cycle-${seq++}`;
  const writtenDeps = [];
  const depName = (label) => `${suffix}-${label}.js`;
  const depPath = (label) => path.join(REAL_VALIDATORS, depName(label));
  const writeDep = (label, source) => {
    const filePath = depPath(label);
    writtenDeps[writtenDeps.length] = filePath;
    writeStrictFile(filePath, source);
  };
  const stateRequire = `require("./${depName("state")}")`;
  const bump = (key) => `state.counts[${JSON.stringify(key)}]=(state.counts[${JSON.stringify(key)}]||0)+1;`;
  const twoNodeCases = [
    ["primitive", `exports.before="discarded";module.exports=7;`],
    ["function", `module.exports=function provisionalFunction(){};`],
    ["object", `module.exports={shape:"object"};`],
    ["array", `module.exports=["array",{nested:true}];`],
    ["nested", `module.exports={shape:{nested:{value:true}}};`],
    ["self-reference", `const partial={shape:"self-reference"};partial.self=partial;module.exports=partial;`, `let thrown;thrown=new Proxy({}, {getPrototypeOf(){throw thrown;}});throw thrown;`]
  ];
  const threeNodeCases = ["a", "b", "c"];
  const topFailedAttempts = [];
  const validateFailedAttempts = [];
  const expectedCounts = [];

  writeDep("state", `"use strict";\nconst counts=Object.create(null);module.exports={counts,token:Object.create(null)};\n`);
  writeDep("stable", `"use strict";\nconst state=${stateRequire};${bump("stable")}module.exports={label:"stable",token:Object.create(null)};\n`);

  for (const [label, exportAssignment, failureStatement] of twoNodeCases) {
    const aLabel = `two-${label}-a`;
    const bLabel = `two-${label}-b`;
    writeDep(aLabel, `"use strict";\nconst state=${stateRequire};${bump(aLabel)}${exportAssignment}\nrequire("./${depName(bLabel)}");\n${failureStatement || `throw new Error("failed two-node ${label} cycle");`}\n`);
    writeDep(bLabel, `"use strict";\nconst state=${stateRequire};${bump(bLabel)}module.exports={participant:"b-partial"};\nconst a=require("./${depName(aLabel)}");\nmodule.exports={participant:"b",a};\n`);
    topFailedAttempts[topFailedAttempts.length] = `expectFailure(${JSON.stringify(`top ${label} A`)},function(){require("./${depName(aLabel)}");});\nexpectFailure(${JSON.stringify(`top ${label} B`)},function(){require("./${depName(bLabel)}");});`;
    validateFailedAttempts[validateFailedAttempts.length] = `expectFailure(${JSON.stringify(`validate ${label} A 1`)},function(){require("./${depName(aLabel)}");});\nexpectFailure(${JSON.stringify(`validate ${label} B 1`)},function(){require("./${depName(bLabel)}");});\nexpectFailure(${JSON.stringify(`validate ${label} A 2`)},function(){require("./${depName(aLabel)}");});\nexpectFailure(${JSON.stringify(`validate ${label} B 2`)},function(){require("./${depName(bLabel)}");});`;
    expectedCounts[expectedCounts.length] = `checkCount(${JSON.stringify(aLabel)},6);checkCount(${JSON.stringify(bLabel)},6);`;
  }

  for (const failedAt of threeNodeCases) {
    const labels = {
      a: `three-fail-${failedAt}-a`,
      b: `three-fail-${failedAt}-b`,
      c: `three-fail-${failedAt}-c`
    };
    writeDep(labels.a, `"use strict";\nconst state=${stateRequire};${bump(labels.a)}module.exports={participant:"a-partial"};\nconst b=require("./${depName(labels.b)}");module.exports={participant:"a",b};${failedAt === "a" ? `throw new Error("failed at three-node A");` : ""}\n`);
    writeDep(labels.b, `"use strict";\nconst state=${stateRequire};${bump(labels.b)}module.exports={participant:"b-partial"};\nconst c=require("./${depName(labels.c)}");module.exports={participant:"b",c};${failedAt === "b" ? `throw new Error("failed at three-node B");` : ""}\n`);
    writeDep(labels.c, `"use strict";\nconst state=${stateRequire};${bump(labels.c)}module.exports={participant:"c-partial"};\nconst a=require("./${depName(labels.a)}");module.exports={participant:"c",a};${failedAt === "c" ? `throw new Error("failed at three-node C");` : ""}\n`);
    topFailedAttempts[topFailedAttempts.length] = `expectFailure(${JSON.stringify(`top three fail ${failedAt} A`)},function(){require("./${depName(labels.a)}");});`;
    validateFailedAttempts[validateFailedAttempts.length] = `expectFailure(${JSON.stringify(`validate three fail ${failedAt} A 1`)},function(){require("./${depName(labels.a)}");});\nexpectFailure(${JSON.stringify(`validate three fail ${failedAt} B 1`)},function(){require("./${depName(labels.b)}");});\nexpectFailure(${JSON.stringify(`validate three fail ${failedAt} C 1`)},function(){require("./${depName(labels.c)}");});\nexpectFailure(${JSON.stringify(`validate three fail ${failedAt} A 2`)},function(){require("./${depName(labels.a)}");});\nexpectFailure(${JSON.stringify(`validate three fail ${failedAt} B 2`)},function(){require("./${depName(labels.b)}");});\nexpectFailure(${JSON.stringify(`validate three fail ${failedAt} C 2`)},function(){require("./${depName(labels.c)}");});`;
    expectedCounts[expectedCounts.length] = `checkCount(${JSON.stringify(labels.a)},7);checkCount(${JSON.stringify(labels.b)},7);checkCount(${JSON.stringify(labels.c)},7);`;
  }

  writeDep("nested-parent", `"use strict";\nconst state=${stateRequire};${bump("nested-parent")}let caught=false;let caughtCode="";\ntry{require("./${depName("nested-child")}");}catch(error){caught=true;caughtCode=error&&error.code;}\nmodule.exports={ok:true,caught,caughtCode,token:Object.create(null)};\n`);
  writeDep("nested-child", `"use strict";\nconst state=${stateRequire};${bump("nested-child")}require("./${depName("nested-leaf")}");\nthrow new Error("caught nested child failure");\n`);
  writeDep("nested-leaf", `"use strict";\nconst state=${stateRequire};${bump("nested-leaf")}module.exports={label:"nested-leaf",token:Object.create(null)};\n`);

  writeDep("caught-cycle-parent", `"use strict";\nconst state=${stateRequire};${bump("caught-cycle-parent")}let caught=false;let childReturned=false;let caughtCode="";\ntry{require("./${depName("caught-cycle-b")}");childReturned=true;}catch(error){caught=true;caughtCode=error&&error.code;}\nmodule.exports={ok:true,caught,childReturned,caughtCode,token:Object.create(null)};\n`);
  writeDep("caught-cycle-b", `"use strict";\nconst state=${stateRequire};${bump("caught-cycle-b")}module.exports={participant:"b-partial"};let caught=false;\ntry{require("./${depName("caught-cycle-c")}");}catch(error){caught=true;}\nmodule.exports={participant:"b-apparent-success",caught};\n`);
  writeDep("caught-cycle-c", `"use strict";\nconst state=${stateRequire};${bump("caught-cycle-c")}module.exports={participant:"c-partial"};\nrequire("./${depName("caught-cycle-b")}");\nthrow new Error("cycle member failure caught by cycle ancestor");\n`);

  writeDep("success-child", `"use strict";\nconst state=${stateRequire};${bump("success-child")}module.exports={label:"success-child",token:Object.create(null)};\n`);
  writeDep("success-parent", `"use strict";\nconst state=${stateRequire};${bump("success-parent")}const child=require("./${depName("success-child")}");module.exports={label:"success-parent",child,token:Object.create(null)};\n`);
  writeDep("success-two-a", `"use strict";\nconst state=${stateRequire};${bump("success-two-a")}module.exports={participant:"a"};const b=require("./${depName("success-two-b")}");module.exports.b=b;\n`);
  writeDep("success-two-b", `"use strict";\nconst state=${stateRequire};${bump("success-two-b")}module.exports={participant:"b"};const a=require("./${depName("success-two-a")}");module.exports.a=a;\n`);
  writeDep("success-three-a", `"use strict";\nconst state=${stateRequire};${bump("success-three-a")}module.exports={participant:"a"};const b=require("./${depName("success-three-b")}");module.exports.b=b;\n`);
  writeDep("success-three-b", `"use strict";\nconst state=${stateRequire};${bump("success-three-b")}module.exports={participant:"b"};const c=require("./${depName("success-three-c")}");module.exports.c=c;\n`);
  writeDep("success-three-c", `"use strict";\nconst state=${stateRequire};${bump("success-three-c")}module.exports={participant:"c"};const a=require("./${depName("success-three-a")}");module.exports.a=a;\n`);

  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";
const problems=[];
function add(problem){problems[problems.length]=problem;}
let poisonedPrototypeCalls=0;
function poisonedPrototypeOperation(){poisonedPrototypeCalls+=1;throw new Error("poisoned prototype operation was called");}
function replacePrototypeOperation(label,target,key){try{target[key]=poisonedPrototypeOperation;if(target[key]!==poisonedPrototypeOperation)add(label+" was not replaced");}catch(error){add(label+" replacement threw");}}
replacePrototypeOperation("Map.prototype.delete",Map.prototype,"delete");
replacePrototypeOperation("Map.prototype.get",Map.prototype,"get");
replacePrototypeOperation("Map.prototype.has",Map.prototype,"has");
replacePrototypeOperation("Map.prototype.set",Map.prototype,"set");
replacePrototypeOperation("Array.prototype.push",Array.prototype,"push");
replacePrototypeOperation("Array.prototype.pop",Array.prototype,"pop");
replacePrototypeOperation("Array.prototype iterator",Array.prototype,Symbol.iterator);
replacePrototypeOperation("Array.prototype.values",Array.prototype,"values");
replacePrototypeOperation("Array.prototype.keys",Array.prototype,"keys");
replacePrototypeOperation("Array.prototype.entries",Array.prototype,"entries");
try{Symbol.iterator=Symbol("validator-replacement-iterator");}catch(error){}
function auditFailure(label,caught){
  if(caught===null||(typeof caught!=="object"&&typeof caught!=="function")){add(label+" exposed a non-object failure");return;}
  try{if(Object.getPrototypeOf(caught)!==null)add(label+" failure prototype was not null");}catch(error){add(label+" failure prototype inspection threw");}
  try{if(!Object.isFrozen(caught))add(label+" failure was not frozen");}catch(error){add(label+" frozen inspection threw");}
  let keys=[];try{keys=Reflect.ownKeys(caught);}catch(error){add(label+" ownKeys threw");return;}
  let names=0;let messages=0;let codes=0;
  for(let index=0;index<keys.length;index+=1){
    const key=keys[index];
    if(typeof key!=="string"){add(label+" exposed a symbol field");continue;}
    if(key==="name")names+=1;else if(key==="message")messages+=1;else if(key==="code")codes+=1;else add(label+" exposed field "+String(key));
    const descriptor=Object.getOwnPropertyDescriptor(caught,key);
    if(!descriptor||typeof descriptor.value!=="string"||descriptor.get!==undefined||descriptor.set!==undefined)add(label+"."+String(key)+" was not a string data field");
  }
  if(keys.length!==3||names!==1||messages!==1||codes!==1)add(label+" did not expose exactly name/message/code");
  if(caught.name!=="ValidatorRequireFailure"||caught.message!=="validator dependency could not be loaded"||caught.code!=="VALIDATOR_THROW")add(label+" failure fields were not the reviewed values");
  try{if(caught.constructor!==undefined||("stack" in caught)||("cause" in caught))add(label+" exposed constructor, stack, or cause");}catch(error){add(label+" hidden-field inspection threw");}
}
function expectFailure(label,fn){try{fn();add(label+" returned failed provisional exports");}catch(error){auditFailure(label,error);}}
function expectSuccess(label,fn){try{return fn();}catch(error){add(label+" threw");auditFailure(label,error);return null;}}
const state=${stateRequire};
function checkCount(key,expected){if(state.counts[key]!==expected)add(key+" initialized "+String(state.counts[key])+" times; expected "+String(expected));}
const stableTop=expectSuccess("stable preload",function(){return require("./${depName("stable")}");});
const nestedParentTop=expectSuccess("nested parent",function(){return require("./${depName("nested-parent")}");});
const nestedParentAgain=expectSuccess("nested parent cached",function(){return require("./${depName("nested-parent")}");});
if(!nestedParentTop||nestedParentTop!==nestedParentAgain||nestedParentTop.caught!==true||nestedParentTop.caughtCode!=="VALIDATOR_THROW")add("caught nested failure did not leave its successful parent cached");
const caughtCycleParentTop=expectSuccess("caught cycle parent",function(){return require("./${depName("caught-cycle-parent")}");});
const caughtCycleParentAgain=expectSuccess("caught cycle parent cached",function(){return require("./${depName("caught-cycle-parent")}");});
if(!caughtCycleParentTop||caughtCycleParentTop!==caughtCycleParentAgain||caughtCycleParentTop.caught!==true||caughtCycleParentTop.childReturned!==false||caughtCycleParentTop.caughtCode!=="VALIDATOR_THROW")add("caught cycle-member failure committed an invalid participant or displaced its successful caller");
${topFailedAttempts.join("\n")}
module.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){
  if(require("./${depName("state")}")!==state||require("./${depName("stable")}")!==stableTop)add("a module loaded before failed transactions lost its cached identity");
${validateFailedAttempts.join("\n")}
  expectFailure("nested child retry 1",function(){require("./${depName("nested-child")}");});
  expectFailure("nested child retry 2",function(){require("./${depName("nested-child")}");});
  const nestedLeaf=expectSuccess("nested leaf direct load",function(){return require("./${depName("nested-leaf")}");});
  const nestedLeafAgain=expectSuccess("nested leaf cached load",function(){return require("./${depName("nested-leaf")}");});
  if(!nestedLeaf||nestedLeaf!==nestedLeafAgain)add("successful nested leaf was not identity-stable");
  expectFailure("nested child retry with preloaded leaf",function(){require("./${depName("nested-child")}");});
  if(require("./${depName("nested-leaf")}")!==nestedLeaf)add("failed child transaction removed a dependency loaded before it began");
  if(require("./${depName("nested-parent")}")!==nestedParentTop)add("caught nested failure parent was reinitialized");
  expectFailure("caught cycle B retry 1",function(){require("./${depName("caught-cycle-b")}");});
  expectFailure("caught cycle C retry 1",function(){require("./${depName("caught-cycle-c")}");});
  expectFailure("caught cycle B retry 2",function(){require("./${depName("caught-cycle-b")}");});
  expectFailure("caught cycle C retry 2",function(){require("./${depName("caught-cycle-c")}");});
  if(require("./${depName("caught-cycle-parent")}")!==caughtCycleParentTop)add("successful caller outside a failed cycle was reinitialized");
  const successParent=expectSuccess("successful transaction parent",function(){return require("./${depName("success-parent")}");});
  const successChild=expectSuccess("successful transaction child",function(){return require("./${depName("success-child")}");});
  if(!successParent||!successChild||successParent.child!==successChild||require("./${depName("success-parent")}")!==successParent||require("./${depName("success-child")}")!==successChild)add("successful non-cycle transaction was not cached identity-stably");
  const successTwoA=expectSuccess("successful two-cycle A",function(){return require("./${depName("success-two-a")}");});
  const successTwoB=expectSuccess("successful two-cycle B",function(){return require("./${depName("success-two-b")}");});
  if(!successTwoA||!successTwoB||successTwoA.b!==successTwoB||successTwoB.a!==successTwoA||require("./${depName("success-two-a")}")!==successTwoA||require("./${depName("success-two-b")}")!==successTwoB)add("successful two-node cycle was not committed identity-stably");
  const successThreeA=expectSuccess("successful three-cycle A",function(){return require("./${depName("success-three-a")}");});
  const successThreeB=expectSuccess("successful three-cycle B",function(){return require("./${depName("success-three-b")}");});
  const successThreeC=expectSuccess("successful three-cycle C",function(){return require("./${depName("success-three-c")}");});
  if(!successThreeA||!successThreeB||!successThreeC||successThreeA.b!==successThreeB||successThreeB.c!==successThreeC||successThreeC.a!==successThreeA||require("./${depName("success-three-a")}")!==successThreeA||require("./${depName("success-three-b")}")!==successThreeB||require("./${depName("success-three-c")}")!==successThreeC)add("successful three-node cycle was not committed identity-stably");
${expectedCounts.join("\n")}
  checkCount("stable",1);checkCount("nested-parent",1);checkCount("nested-child",4);checkCount("nested-leaf",4);
  checkCount("caught-cycle-parent",1);checkCount("caught-cycle-b",5);checkCount("caught-cycle-c",5);
  checkCount("success-parent",1);checkCount("success-child",1);checkCount("success-two-a",1);checkCount("success-two-b",1);checkCount("success-three-a",1);checkCount("success-three-b",1);checkCount("success-three-c",1);
  if(poisonedPrototypeCalls!==0)add("validator-realm prototype replacements participated in cache bookkeeping");
  return {status:problems.length?"failed":"passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
}};
`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("ca".repeat(32))
        }, 6000);
        assert.equal(outcome.kind, "message");
        assertNoDirectWorkerMessages(outcome);
        assert.equal(outcome.stdioBytes, 0);
        const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
        assert.equal(parsed.status, "passed", parsed.problems.join("\n"));
        assert.deepEqual(parsed.problems, []);
      }
    );
  } finally {
    for (const filePath of writtenDeps) {
      try { fs.rmSync(filePath, { force: true }); } catch (error) {}
    }
  }
});

test("uncaught local dependency failure fails closed without exposing host messages", async () => {
  const depPath = path.join(REAL_VALIDATORS, `uncaught-require-failure-${seq++}.js`);
  writeStrictFile(depPath, `"use strict";\nthrow new Error("uncaught dependency failure");\n`);
  try {
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";\nrequire("./${path.basename(depPath)}");\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
      async () => {
        const reg = loadValidatorRegistry();
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("bv".repeat(32))
        }, 1500);
        assert.equal(outcome.kind, "message");
        assertNoDirectWorkerMessages(outcome);
        const envelope = parseTransportedWorkerFailureMessage(outcome.message);
        assert.equal(envelope.code, "VALIDATOR_THROW");
      }
    );
  } finally {
    try { fs.rmSync(depPath, { force: true }); } catch (error) {}
  }
});

test("non-neutralizable symbol-keyed global authority fails closed before validator execution", async () => {
  const preloadPath = path.join(scratch, `symbol-agent-locked-preload-${seq++}.js`);
  const topLevelMarker = path.join(scratch, `symbol-agent-locked-top-marker-${seq++}.txt`);
  const validateMarker = path.join(scratch, `symbol-agent-locked-validate-marker-${seq++}.txt`);
  writeStrictFile(preloadPath, `
    class Agent {
      dispatch() {}
    }
    Object.defineProperty(globalThis, Symbol.for("undici.globalDispatcher.1"), {
      value: new Agent(),
      enumerable: false,
      configurable: false,
      writable: false
    });
  `);
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nconst fs=require("node:fs");\nfs.writeFileSync(${JSON.stringify(topLevelMarker)},"top-level");\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){fs.writeFileSync(${JSON.stringify(validateMarker)},"validate"); return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("br".repeat(32))
      }, 1500, { execArgv: ["--require", preloadPath] });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(outcome.stdioBytes, 0);
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "WORKER_INTERNAL_FAILURE");
      assert.equal(fs.existsSync(topLevelMarker), false);
      assert.equal(fs.existsSync(validateMarker), false);
    }
  );
});

test("fs facade cannot write directly to stdout or stderr file descriptors", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      const fs = require("node:fs");
      for (const fd of [1, 2]) {
        try {
          fs.writeFileSync(fd, "Z".repeat(400000));
          problems[problems.length] = "writeFileSync accepted fd " + fd;
        } catch (error) {}
      }
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bp".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(outcome.stdioBytes, 0);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("MessagePort.prototype.postMessage replacement cannot forge harness success", async () => {
  const marker = path.join(os.tmpdir(), `vsec-messageport-post-${seq++}.txt`);
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nconst fs=require("node:fs");\ntry{const wt=process.getBuiltinModule("worker_threads"); const originalPost=wt.MessagePort.prototype.postMessage; wt.MessagePort.prototype.postMessage=function(){return originalPost.call(this, JSON.stringify({ok:true,result:{status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}}));};}catch(error){}\ntry{MessagePort.prototype.postMessage=function(){return undefined;};}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){fs.writeFileSync(${JSON.stringify(marker)},"validate-called"); throw new Error("must fail despite forged postMessage");}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bi".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_THROW");
      assert.equal(fs.readFileSync(marker, "utf8"), "validate-called");
      assert.equal(outcome.message.includes('"status":"passed"'), false);
    }
  );
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
});

test("MessagePort.prototype.close replacement cannot suppress harness completion", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      try {
        const wt = process.getBuiltinModule("worker_threads");
        wt.MessagePort.prototype.close = function(){ return undefined; };
      } catch (error) {}
      try { MessagePort.prototype.close = function(){ return undefined; }; } catch (error) {}
      return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bj".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerSuccessMessage(outcome.message).status, "passed");
    }
  );
});

test("validator cannot forge a success envelope before runtime contract verification", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\ntry{const port=process.getBuiltinModule("worker_threads").parentPort; port.postMessage(JSON.stringify({ok:true,result:{status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}}));}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){throw new Error("should not report passed");}};\nmodule.exports.version="9.9.9";\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const direct = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("as".repeat(32))
      });
      assert.equal(direct.kind, "message");
      assertNoDirectWorkerMessages(direct);
      assert.equal(parseTransportedWorkerFailureMessage(direct.message).code, "VALIDATOR_RESULT_INVALID");

      const phase = await require("../kernel/execution/validation-cycle").runValidationPhase(
        "candidate",
        ["execution-plan"],
        authoritativeWorkerContext("at".repeat(32)),
        { timeoutMs: 1500, expectedValidatorSetHash: reg.validatorSetHash }
      );
      assert.equal(phase.status, "failed");
      assert.match(phase.problems.join(" "), /VALIDATOR_RESULT_INVALID/);
    }
  );
});

test("global process aliases and constructor chains cannot recover the worker channel", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const attempts = [
        function(){ return globalThis.process; },
        function(){ return global && global.process; },
        function(){ return Function("return process")(); },
        function(){ return ({}).constructor.constructor("return process")(); },
        function(){ return require.constructor.constructor("return process")(); },
        function(){ return module.constructor && module.constructor.constructor("return process")(); }
      ];
      for (const attempt of attempts) {
        try {
          const proc = attempt();
          const port = proc && proc.getBuiltinModule && proc.getBuiltinModule("worker_threads").parentPort;
          if (port) port.postMessage("forged");
        } catch (error) {}
      }
      return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("au".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerSuccessMessage(outcome.message).status, "passed");
    }
  );
});

test("process.getBuiltinModule cannot bypass the runtime builtin allowlist", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const blocked = ["child_process", "net", "worker_threads", "module"];
      const problems = [];
      for (const name of blocked) {
        try {
          const viaProcess = process.getBuiltinModule(name);
          if (viaProcess) problems.push("process builtin " + name + " was reachable");
        } catch (error) {}
      }
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("av".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("validator mutation of host primordials cannot weaken envelope construction", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      try { JSON.stringify = function(){ return "{\\"ok\\":true,\\"result\\":{\\"status\\":\\"passed\\",\\"problems\\":[],\\"warnings\\":[],\\"checkedObjects\\":[],\\"checkedPaths\\":[]}}"; }; } catch (error) {}
      try { Buffer.byteLength = function(){ return 1; }; } catch (error) {}
      try { Promise.resolve = function(value){ return { then:function(resolve){ return resolve(value); } }; }; } catch (error) {}
      try { Object.getOwnPropertyDescriptor = function(){ return { value: [] }; }; } catch (error) {}
      try { Map.prototype.has = function(){ return true; }; Map.prototype.get = function(){ return {}; }; } catch (error) {}
      try { Set.prototype.has = function(){ return true; }; } catch (error) {}
      try { Array.prototype.includes = function(){ return true; }; } catch (error) {}
      return {status:"passed",problems:["x".repeat(300000)],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("aw".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerFailureMessage(outcome.message).code, "VALIDATOR_RESULT_INVALID");
    }
  );
});

test("replacing Promise.prototype.then cannot bypass validate execution", async () => {
  const marker = path.join(os.tmpdir(), `vsec-promise-then-${seq++}.txt`);
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nconst fs=require("node:fs");\ntry{Promise.prototype.then=function(onFulfilled){return Promise.resolve({raw:{status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}});};}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const count=fs.existsSync(${JSON.stringify(marker)})?Number(fs.readFileSync(${JSON.stringify(marker)},"utf8")):0; fs.writeFileSync(${JSON.stringify(marker)},String(count+1)); throw new Error("validate must run and fail");}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ax".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerFailureMessage(outcome.message).code, "VALIDATOR_THROW");
      assert.equal(fs.readFileSync(marker, "utf8"), "1");
    }
  );
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
});

test("replacing Promise.prototype.catch cannot change rejection handling", async () => {
  const marker = path.join(os.tmpdir(), `vsec-promise-catch-${seq++}.txt`);
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nconst fs=require("node:fs");\ntry{Promise.prototype.catch=function(onRejected){return Promise.resolve({status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]});};}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){fs.writeFileSync(${JSON.stringify(marker)},"called"); return Promise.reject(new Error("reject must fail"));}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ay".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerFailureMessage(outcome.message).code, "VALIDATOR_REJECTION");
      assert.equal(fs.readFileSync(marker, "utf8"), "called");
    }
  );
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
});

test("validate is invoked exactly once before success is possible", async () => {
  const marker = path.join(os.tmpdir(), `vsec-validate-once-${seq++}.txt`);
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nconst fs=require("node:fs");\ntry{Promise.prototype.then=function(){return Promise.resolve({raw:{status:"passed",problems:[],warnings:[],checkedObjects:[],checkedPaths:[]}});};}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const count=fs.existsSync(${JSON.stringify(marker)})?Number(fs.readFileSync(${JSON.stringify(marker)},"utf8")):0; fs.writeFileSync(${JSON.stringify(marker)},String(count+1)); return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("az".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerSuccessMessage(outcome.message).status, "passed");
      assert.equal(fs.readFileSync(marker, "utf8"), "1");
    }
  );
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
});

test("replacing Array.prototype.push cannot suppress normalization problems", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      try { Array.prototype.push = function(){ return this.length; }; } catch (error) {}
      return {status:"not-a-valid-status",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ba".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "failed");
      assert.match(parsed.problems.join(" "), /status is invalid/);
    }
  );
});

test("array and string prototype replacement cannot alter closure or transport enforcement", async () => {
  const marker = path.join(os.tmpdir(), `vsec-array-string-${seq++}.txt`);
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\ntry{Array.prototype.slice=function(){return [];}; Array.prototype.includes=function(){return true;}; Array.prototype.sort=function(){return this;}; Array.prototype[Symbol.iterator]=function*(){yield \"forged\";}; String.prototype.slice=function(){return \"tiny\";}; String.prototype.startsWith=function(){return false;}; String.prototype.split=function(){return [this];};}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const fs=require("node:fs"); fs.writeFileSync(${JSON.stringify(marker)},"called"); const checkedObjects=[]; for(let i=0;i<20050;i++) checkedObjects[checkedObjects.length]=\"OBJ-\"+i; return {status:"passed",problems:[],warnings:[],checkedObjects,checkedPaths:["public/data/report.json"]};}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bb".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "failed");
      assert.match(parsed.problems.join(" "), /checkedObjects exceeds 10000 entries/);
      assert.equal(fs.readFileSync(marker, "utf8"), "called");
    }
  );
  try { fs.rmSync(marker, { force: true }); } catch (error) {}
});

test("broad intrinsic prototype mutations cannot affect harness normalization", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      try { Object.getOwnPropertyDescriptor = function(){ return { value: "passed" }; }; Object.prototype.status = "passed"; } catch (error) {}
      try { Map.prototype.has = function(){ return true; }; Map.prototype.get = function(){ return "forged"; }; } catch (error) {}
      try { Set.prototype.has = function(){ return true; }; } catch (error) {}
      try { JSON.stringify = function(){ return "{\\"ok\\":true,\\"result\\":{\\"status\\":\\"passed\\",\\"problems\\":[],\\"warnings\\":[],\\"checkedObjects\\":[],\\"checkedPaths\\":[]}}"; }; } catch (error) {}
      try { Buffer.byteLength = function(){ return 1; }; Buffer.prototype.toString = function(){ return "tiny"; }; } catch (error) {}
      try { Error.prototype.toString = function(){ return "tiny"; }; RegExp.prototype.test = function(){ return true; }; } catch (error) {}
      try { Promise.resolve = function(value){ return { then:function(resolve){ return resolve(value); } }; }; Promise.prototype.then = function(resolve){ return resolve({status:"passed",problems:[],warnings:[],checkedObjects:[],checkedPaths:[]}); }; } catch (error) {}
      try { String.prototype.startsWith = function(){ return false; }; Function.prototype.call = function(){ return undefined; }; } catch (error) {}
      return {status:"not-a-valid-status",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bc".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "failed");
      assert.match(parsed.problems.join(" "), /status is invalid/);
    }
  );
});

test("thenables and custom Promise subclasses cannot bypass normalization or rejection", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      return { then:function(resolve){ resolve({status:"not-a-valid-status",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}); } };
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bd".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "failed");
      assert.match(parsed.problems.join(" "), /status is invalid/);
    }
  );

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      return { then:function(resolve, reject){ reject(new Error("thenable rejection")); } };
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("be".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      assert.equal(parseTransportedWorkerFailureMessage(outcome.message).code, "VALIDATOR_REJECTION");
    }
  );

  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      class EvilPromise extends Promise {}
      return new EvilPromise((resolve) => resolve({status:"not-a-valid-status",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}));
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bf".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "failed");
      assert.match(parsed.problems.join(" "), /status is invalid/);
    }
  );
});

test("host capability facades do not expose host constructors or harness lexical state", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      const pathMod = require("node:path");
      const bufferMod = require("node:buffer").Buffer;
      const probes = [
        ["path.join.constructor", function(){ return pathMod.join.constructor; }],
        ["path.join prototype constructor", function(){ const proto = Object.getPrototypeOf(pathMod.join); return proto && proto.constructor; }],
        ["buffer.from.constructor", function(){ return bufferMod.from.constructor; }],
        ["buffer.from prototype constructor", function(){ const proto = Object.getPrototypeOf(bufferMod.from); return proto && proto.constructor; }],
        ["JSON.stringify.constructor", function(){ return JSON.stringify.constructor; }],
        ["object constructor chain", function(){ return ({}).constructor && ({}).constructor.constructor; }]
      ];
      for (const probe of probes) {
        try {
          const ctor = probe[1]();
          if (typeof ctor !== "function") continue;
          let proc;
          try { proc = ctor("return process")(); } catch (error) {}
          if (proc && proc.getBuiltinModule) problems[problems.length] = probe[0] + " recovered process";
          let lexical = "error";
          try { lexical = ctor("return typeof HARNESS_RESULT_PORT")(); } catch (error) {}
          if (lexical !== "undefined" && lexical !== "error") problems[problems.length] = probe[0] + " reached harness lexical state";
        } catch (error) {}
      }
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bg".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("capability facade return values do not expose raw host-native prototypes", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      const fs = require("node:fs");
      const crypto = require("node:crypto");
      const path = require("node:path");
      const Buffer = require("node:buffer").Buffer;
      function checkWrapped(label, value) {
        try {
          if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
          const proto = Object.getPrototypeOf(value);
          if (proto !== null) problems[problems.length] = label + " exposed a host prototype";
          if (value.constructor !== undefined) problems[problems.length] = label + " exposed constructor";
          try {
            const escaped = value.constructor && value.constructor.constructor && value.constructor.constructor("return process")();
            if (escaped && escaped.getBuiltinModule) problems[problems.length] = label + " recovered process";
          } catch (error) {}
        } catch (error) {
          problems[problems.length] = label + " probe failed";
        }
      }
      const hash = crypto.createHash("sha256");
      checkWrapped("crypto hash", hash);
      try {
        const proto = Object.getPrototypeOf(hash);
        if (proto) proto.digest = function(){ return "0".repeat(64); };
      } catch (error) {}
      if (crypto.createHash("sha256").update("abc").digest("hex") !== "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") problems[problems.length] = "hash digest was mutable";
      checkWrapped("hash digest bytes", crypto.createHash("sha256").update("abc").digest());
      checkWrapped("fs stats", fs.statSync(__filename));
      checkWrapped("fs bytes", fs.readFileSync(__filename));
      checkWrapped("buffer bytes", Buffer.from("abc"));
      const parsedJson = JSON.parse('{"items":[{"id":"OBJ-1"}]}');
      if (Object.getPrototypeOf(parsedJson) !== null) problems[problems.length] = "JSON object exposed a host prototype";
      if (parsedJson.constructor !== undefined) problems[problems.length] = "JSON object exposed constructor";
      if (parsedJson.items.constructor !== undefined) problems[problems.length] = "JSON array exposed constructor";
      if (typeof path.join("a", "b") !== "string" || path.posix.join("a", "b") !== "a/b") problems[problems.length] = "path string facade failed";
      if (typeof path.parse !== "undefined") problems[problems.length] = "path object-returning parse exposed";
      if (typeof fs.createReadStream !== "undefined") problems[problems.length] = "fs stream factory exposed";
      if (typeof fs.openSync !== "undefined") problems[problems.length] = "fs raw file descriptor open exposed";
      if (typeof crypto.createHmac !== "undefined") problems[problems.length] = "crypto raw Hmac factory exposed";
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bk".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("fs.realpathSync facade cannot return raw host Buffer for encoding overloads", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`
      const problems = [];
      const fs = require("node:fs");
      function checkRealpath(label, value) {
        if (typeof value !== "string") {
          problems[problems.length] = label + " did not return a primitive string";
          if (value && (typeof value === "object" || typeof value === "function")) {
            const proto = Object.getPrototypeOf(value);
            if (proto) problems[problems.length] = label + " exposed host prototype";
            if (value.constructor !== undefined) problems[problems.length] = label + " exposed constructor";
            if (value.constructor && typeof value.constructor.allocUnsafe === "function") problems[problems.length] = label + " recovered Buffer.allocUnsafe";
          }
          return;
        }
        if (!value.endsWith("execution-plan.js")) problems[problems.length] = label + " returned unexpected path";
      }
      checkRealpath("default", fs.realpathSync(__filename));
      checkRealpath("string buffer option", fs.realpathSync(__filename, "buffer"));
      checkRealpath("object buffer option", fs.realpathSync(__filename, {encoding:"buffer"}));
      return {status:problems.length ? "failed" : "passed",problems,warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};
    `),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("bm".repeat(32))
      });
      assert.equal(outcome.kind, "message");
      assertNoDirectWorkerMessages(outcome);
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
      assert.deepEqual(parsed.problems, []);
    }
  );
});

test("validator throwing a large ASCII Error cannot create an oversized worker message", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`throw new Error("x".repeat(400000));`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ak".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_THROW");
      assert.equal(outcome.message.includes("x".repeat(1024)), false);
    }
  );
});

test("validator throwing a large emoji Error cannot create an oversized worker message", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`throw new Error("\\u{1F600}".repeat(200000));`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("al".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_THROW");
    }
  );
});

test("validator rejected Promise with a large Error remains within the worker message bound", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`return Promise.reject(new Error("x".repeat(400000)));`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("am".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_REJECTION");
      assert.equal(outcome.message.includes("x".repeat(1024)), false);
    }
  );
});

test("validator thrown strings, objects, proxies, and message getters cannot bypass the failure bound", async () => {
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-failure-values-"));
  const toStringMarker = path.join(markerDir, "to-string.txt");
  const getterMarker = path.join(markerDir, "message-getter.txt");
  const proxyMarker = path.join(markerDir, "proxy-getter.txt");
  const cases = [
    ["string", `throw "x".repeat(400000);`],
    ["object", `throw {message:"x".repeat(400000),toString:function(){require("node:fs").writeFileSync(${JSON.stringify(toStringMarker)},"toString"); return "x".repeat(400000);}};`],
    ["message getter", `const thrown={}; Object.defineProperty(thrown,"message",{get:function(){require("node:fs").writeFileSync(${JSON.stringify(getterMarker)},"getter"); return "x".repeat(400000);}}); throw thrown;`],
    ["proxy", `const thrown=new Proxy({}, {get:function(target, prop){if(prop==="message"){require("node:fs").writeFileSync(${JSON.stringify(proxyMarker)},"proxy"); return "x".repeat(400000);} return undefined;}}); throw thrown;`]
  ];
  try {
    for (const [name, body] of cases) {
      await withTemporaryProductionValidatorSource(
        PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
        validatorSourceForValidateBody(body),
        async () => {
          const reg = loadValidatorRegistry();
          const outcome = await launchProductionWorker({
            validatorId: "execution-plan",
            expectedValidatorSetHash: reg.validatorSetHash,
            phase: "candidate",
            context: authoritativeWorkerContext(`an-${name}`),
            limits: { maxResultBytes: Infinity }
          });
          assert.equal(outcome.kind, "message");
          const envelope = parseTransportedWorkerFailureMessage(outcome.message);
          assert.equal(envelope.code, "VALIDATOR_THROW");
          assert.equal(outcome.message.includes("x".repeat(1024)), false);
        }
      );
    }
    assert.equal(fs.existsSync(toStringMarker), false);
    assert.equal(fs.existsSync(getterMarker), false);
    assert.equal(fs.existsSync(proxyMarker), false);
  } finally {
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
});

test("top-level validator exception cannot create an oversized worker response", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    `"use strict";\nthrow new Error("x".repeat(400000));\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("ao".repeat(32)),
        limits: { maxResultBytes: Infinity }
      });
      assert.equal(outcome.kind, "message");
      const envelope = parseTransportedWorkerFailureMessage(outcome.message);
      assert.equal(envelope.code, "VALIDATOR_THROW");
      assert.equal(outcome.message.includes("x".repeat(1024)), false);
    }
  );
});

test("oversized failure diagnostics are replaced by a compact deterministic envelope", async () => {
  const reg = loadValidatorRegistry();
  const hugeValidatorId = "x".repeat(400000);
  const outcome = await launchProductionWorker({
    validatorId: hugeValidatorId,
    expectedValidatorSetHash: reg.validatorSetHash,
    phase: "candidate",
    context: authoritativeWorkerContext("ap".repeat(32)),
    limits: { maxResultBytes: Infinity }
  });
  assert.equal(outcome.kind, "message");
  const envelope = parseTransportedWorkerFailureMessage(outcome.message);
  assert.equal(envelope.code, "REGISTRY_MISMATCH");
  assert.equal(outcome.message.includes("x".repeat(1024)), false);
});

test("normal validator exceptions fail closed through the production validation cycle", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForValidateBody(`throw new Error("x".repeat(400000));`),
    async () => {
      const reg = loadValidatorRegistry();
      const phase = await require("../kernel/execution/validation-cycle").runValidationPhase(
        "candidate",
        ["execution-plan"],
        authoritativeWorkerContext("aq".repeat(32)),
        { timeoutMs: 1500, expectedValidatorSetHash: reg.validatorSetHash }
      );
      assert.equal(phase.status, "failed");
      assert.match(phase.problems.join(" "), /VALIDATOR_THROW/);
      assert.equal(phase.problems.join(" ").includes("x".repeat(1024)), false);
    }
  );
});

test("direct worker launch with maxResultBytes set to 1 cannot replace reviewed internal limits", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("f".repeat(64)),
        limits: { maxResultBytes: 1, maxArrayLen: 1, maxStdBytes: 1 }
      });
      assert.equal(outcome.kind, "message");
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
    }
  );
});

test("direct worker launch ignores invalid caller-supplied limit types in favor of fixed reviewed limits", async () => {
  await withTemporaryProductionValidatorSource(
    PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
    validatorSourceForResultExpression(`{status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]}`),
    async () => {
      const reg = loadValidatorRegistry();
      const outcome = await launchProductionWorker({
        validatorId: "execution-plan",
        expectedValidatorSetHash: reg.validatorSetHash,
        phase: "candidate",
        context: authoritativeWorkerContext("9".repeat(64)),
        limits: {
          maxResultBytes: "Infinity",
          maxArrayLen: { bogus: true },
          maxStdBytes: -1
        }
      });
      assert.equal(outcome.kind, "message");
      const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
      assert.equal(parsed.status, "passed");
    }
  );
});

test("production worker direct attack cannot execute an external validator from a temporary root", async () => {
  const reg = loadValidatorRegistry();
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-worker-external-"));
  const topLevelMarker = path.join(externalRoot, "top-level-marker.txt");
  const validateMarker = path.join(externalRoot, "validate-marker.txt");
  const validatorPath = path.join(externalRoot, "external-pass.js");
  try {
    writeStrictFile(validatorPath, `"use strict";\nrequire("node:fs").writeFileSync(${JSON.stringify(topLevelMarker)},"top-level");\nmodule.exports={id:"external-pass",version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){require("node:fs").writeFileSync(${JSON.stringify(validateMarker)},"validate"); return {status:"passed",problems:[],warnings:[]};}};`);
    const closure = buildValidatorClosure(validatorPath, externalRoot);
    const outcome = await launchProductionWorker({
      validatorId: "external-pass",
      expectedValidatorSetHash: reg.validatorSetHash,
      phase: "candidate",
      context: {},
      limits: { maxResultBytes: 262144, maxArrayLen: 10000 },
      closure: { closureRoot: closure.closureRoot, entryRelPath: closure.entryRelPath, modules: closure.manifest, closureHash: "0".repeat(64) },
      expectedContract: { id: "external-pass", version: "1.0.0", semantic: false, actions: [], supportedPhases: ["candidate"] }
    });
    assert.equal(outcome.kind, "message");
    const envelope = parseTransportedWorkerFailureMessage(outcome.message);
    assert.equal(envelope.code, "REGISTRY_MISMATCH");
    assert.equal(fs.existsSync(topLevelMarker), false);
    assert.equal(fs.existsSync(validateMarker), false);
  } finally {
    fs.rmSync(externalRoot, { recursive: true, force: true });
  }
});

test("production worker verifies validatorSetHash before validator execution", async () => {
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-worker-hash-"));
  const topLevelMarker = path.join(externalRoot, "top-level-marker.txt");
  const validateMarker = path.join(externalRoot, "validate-marker.txt");
  const validatorPath = path.join(externalRoot, "external-pass.js");
  try {
    writeStrictFile(validatorPath, `"use strict";\nrequire("node:fs").writeFileSync(${JSON.stringify(topLevelMarker)},"top-level");\nmodule.exports={id:"execution-plan",version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){require("node:fs").writeFileSync(${JSON.stringify(validateMarker)},"validate"); return {status:"passed",problems:[],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};`);
    const closure = buildValidatorClosure(validatorPath, externalRoot);
    const outcome = await launchProductionWorker({
      validatorId: "execution-plan",
      expectedValidatorSetHash: "0".repeat(64),
      phase: "candidate",
      context: {
        transaction: { action: "write_report", writeSetHash: "a".repeat(64), affectedObjects: ["OBJ-1"], proposedWrites: [{ path: "public/data/report.json" }] },
        plan: { action: "write_report", writeSetHash: "a".repeat(64), affectedObjects: ["OBJ-1"], writes: [{ path: "public/data/report.json" }] },
        writeSetHash: "a".repeat(64)
      },
      limits: { maxResultBytes: 262144, maxArrayLen: 10000 },
      closure: { closureRoot: closure.closureRoot, entryRelPath: closure.entryRelPath, modules: closure.manifest, closureHash: "0".repeat(64) },
      expectedContract: { id: "execution-plan", version: "1.0.0", semantic: false, actions: [], supportedPhases: ["candidate"] }
    });
    assert.equal(outcome.kind, "message");
    const envelope = parseTransportedWorkerFailureMessage(outcome.message);
    assert.equal(envelope.code, "REGISTRY_MISMATCH");
    assert.equal(fs.existsSync(topLevelMarker), false);
    assert.equal(fs.existsSync(validateMarker), false);
  } finally {
    fs.rmSync(externalRoot, { recursive: true, force: true });
  }
});

test("production worker ignores caller-supplied closure material and executes only the authoritative descriptor", async () => {
  const reg = loadValidatorRegistry();
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-worker-authoritative-"));
  const topLevelMarker = path.join(externalRoot, "top-level-marker.txt");
  const validateMarker = path.join(externalRoot, "validate-marker.txt");
  const validatorPath = path.join(externalRoot, "external-pass.js");
  try {
    writeStrictFile(validatorPath, `"use strict";\nrequire("node:fs").writeFileSync(${JSON.stringify(topLevelMarker)},"top-level");\nmodule.exports={id:"execution-plan",version:"1.0.0",semantic:false,actions:[],supportedPhases:["candidate"],validate:function(){require("node:fs").writeFileSync(${JSON.stringify(validateMarker)},"validate"); return {status:"passed",problems:[],warnings:[]};}};`);
    const closure = buildValidatorClosure(validatorPath, externalRoot);
    const writeSetHash = "b".repeat(64);
    const outcome = await launchProductionWorker({
      validatorId: "execution-plan",
      expectedValidatorSetHash: reg.validatorSetHash,
      phase: "candidate",
      context: {
        transaction: { action: "write_report", writeSetHash, affectedObjects: ["OBJ-1"], proposedWrites: [{ path: "public/data/report.json" }] },
        plan: { action: "write_report", writeSetHash, affectedObjects: ["OBJ-1"], writes: [{ path: "public/data/report.json" }] },
        writeSetHash
      },
      limits: { maxResultBytes: 262144, maxArrayLen: 10000 },
      closure: { closureRoot: closure.closureRoot, entryRelPath: closure.entryRelPath, modules: closure.manifest, closureHash: "0".repeat(64) },
      expectedContract: { id: "execution-plan", version: "9.9.9", semantic: true, actions: ["bogus"], supportedPhases: ["candidate"] }
    });
    assert.equal(outcome.kind, "message");
    const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
    assert.equal(parsed.status, "passed");
    assert.equal(fs.existsSync(topLevelMarker), false);
    assert.equal(fs.existsSync(validateMarker), false);
  } finally {
    fs.rmSync(externalRoot, { recursive: true, force: true });
  }
});

test("entry top-level code cannot replace a captured dependency or falsify hashing through crypto prototypes", async () => {
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), "vsec-dep-substitution-"));
  const originalMarker = path.join(markerDir, "original-dependency.txt");
  const maliciousMarker = path.join(markerDir, "malicious-dependency.txt");
  const depName = `execution-plan-preverified-dependency-${seq++}.js`;
  const depPath = path.join(REAL_VALIDATORS, depName);
  let originalSource = `"use strict";\nconst fs=require("node:fs");\nmodule.exports={run:function(){fs.writeFileSync(${JSON.stringify(originalMarker)},"original"); return "original";}};\n`;
  let maliciousSource = `"use strict";\nconst fs=require("node:fs");\nmodule.exports={run:function(){fs.writeFileSync(${JSON.stringify(maliciousMarker)},"malicious"); return "malicious";}};\n`;
  const targetBytes = Math.max(Buffer.byteLength(originalSource, "utf8"), Buffer.byteLength(maliciousSource, "utf8"));
  originalSource = padAsciiToByteLength(originalSource, targetBytes);
  maliciousSource = padAsciiToByteLength(maliciousSource, targetBytes);
  assert.equal(Buffer.byteLength(originalSource, "utf8"), Buffer.byteLength(maliciousSource, "utf8"));
  try {
    writeStrictFile(depPath, originalSource);
    await withTemporaryProductionValidatorSource(
      PRODUCTION_EXECUTION_PLAN_VALIDATOR_PATH,
      `"use strict";\nconst fs=require("node:fs");\nconst path=require("node:path");\nconst crypto=require("node:crypto");\nconst depPath=path.join(__dirname,${JSON.stringify(depName)});\nconst originalSource=fs.readFileSync(depPath,"utf8");\nconst originalHash=crypto.createHash("sha256").update(originalSource).digest("hex");\ntry{const proto=Object.getPrototypeOf(crypto.createHash("sha256")); if(proto) proto.digest=function(){return originalHash;};}catch(error){}\nfs.writeFileSync(depPath,${JSON.stringify(maliciousSource)});\nconst dep=require("./${depName}");\ntry{fs.writeFileSync(depPath,originalSource);}catch(error){}\nmodule.exports={id:"execution-plan",version:"1.0.0",supportedPhases:["candidate","post_write"],validate:function(){const value=dep.run(); return {status:value==="original"?"passed":"failed",problems:value==="original"?[]:["unverified dependency executed"],warnings:[],checkedObjects:["OBJ-1"],checkedPaths:["public/data/report.json"]};}};\n`,
      async () => {
        const reg = loadValidatorRegistry();
        const descriptor = reg.descriptors.get("execution-plan");
        assert.ok(descriptor.closure.modules.some((entry) => entry.relPath.endsWith(depName)), "dependency must be present in the authoritative closure manifest");
        const outcome = await launchProductionWorker({
          validatorId: "execution-plan",
          expectedValidatorSetHash: reg.validatorSetHash,
          phase: "candidate",
          context: authoritativeWorkerContext("bl".repeat(32))
        });
        assert.equal(outcome.kind, "message");
        assertNoDirectWorkerMessages(outcome);
        const parsed = parseTransportedWorkerSuccessMessage(outcome.message);
        assert.equal(parsed.status, "passed");
        assert.equal(fs.existsSync(originalMarker), true);
        assert.equal(fs.existsSync(maliciousMarker), false);
        assert.equal(fs.readFileSync(depPath, "utf8"), originalSource);
      }
    );
  } finally {
    try { fs.writeFileSync(depPath, originalSource); } catch (error) {}
    try { fs.rmSync(depPath, { force: true }); } catch (error) {}
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
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
  assert.equal(reg.descriptors.get("__proto__"), undefined);
  assert.equal(reg.descriptors.has("__proto__"), false);
  assert.equal(reg.contracts.get("constructor"), undefined);
  assert.equal(reg.contracts.has("constructor"), false);
});

test("production exports do not expose a test-only root override", () => {
  const validators = require("../kernel/execution/validators");
  assert.equal(Object.prototype.hasOwnProperty.call(validators, "loadValidatorRegistryForTest"), false);
});

for (const unsafeId of ["__proto__", "prototype", "constructor"]) {
  test(`registry loader rejects unsafe validator id ${unsafeId}`, () => {
    const dir = tempValidatorDir();
    try {
      installAttackValidator(
        dir,
        unsafeId,
        sideEffectAttackSource(unsafeId, "")
      );
      assert.throws(
        () => loadValidatorRegistryForTest({ validatorsDir: dir, projectRoot: path.resolve(dir, "..", "..", "..") }),
        /unsafe validator id/i
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

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
