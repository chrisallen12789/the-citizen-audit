const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runValidationPhase } = require("../kernel/execution/validation-cycle");
const { loadValidatorRegistry } = require("../kernel/execution/validators");

const REAL_VALIDATORS = path.join(__dirname, "..", "kernel", "execution", "validators");
// Temp validator dirs are created UNDER kernel/execution so the modules' relative
// requires ("../../lib/...") resolve exactly as in production.
const HOLDER = path.join(__dirname, "..", "kernel", "execution");

function tempValidatorDir() {
  const dir = fs.mkdtempSync(path.join(HOLDER, "vsec-"));
  for (const f of fs.readdirSync(REAL_VALIDATORS)) fs.copyFileSync(path.join(REAL_VALIDATORS, f), path.join(dir, f));
  return dir;
}
function readRegistry(dir) { return JSON.parse(fs.readFileSync(path.join(dir, "registry.json"), "utf8")); }
function writeRegistry(dir, reg) { fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify(reg)); }

const mkValidator = (over) => Object.assign(
  { id: "v", version: "1.0.0", semantic: false, supportedPhases: ["candidate"], validate: () => ({ status: "passed", problems: [], warnings: [] }) },
  over
);

// ---- Result-handling: every abnormal outcome must fail closed ----
const ABNORMAL = {
  "non-object result": () => "nope",
  "null result": () => null,
  "array result": () => [],
  "invalid status": () => ({ status: "weird", problems: [] }),
  "missing status": () => ({ problems: [] }),
  "success with problems (lie)": () => ({ status: "passed", problems: ["actually invalid"] }),
  "failure without a problem": () => ({ status: "failed", problems: [] }),
  "malformed problems array": () => ({ status: "passed", problems: "nope" }),
  "throws an exception": () => { throw new Error("boom"); }
};
for (const [name, validate] of Object.entries(ABNORMAL)) {
  test(`validator result fails closed: ${name}`, async () => {
    const phase = await runValidationPhase("candidate", [mkValidator({ validate })], { transaction: {}, plan: { writes: [], affectedObjects: [] } }, { timeoutMs: 200 });
    assert.equal(phase.status, "failed", `${name} must fail closed`);
  });
}

test("clean validator passes (sanity)", async () => {
  const phase = await runValidationPhase("candidate", [mkValidator({})], {}, { timeoutMs: 200 });
  assert.equal(phase.status, "passed");
});

test("asynchronous validator that exceeds the timeout fails closed", async () => {
  const slow = mkValidator({ validate: () => new Promise((r) => setTimeout(() => r({ status: "passed", problems: [] }), 3000)) });
  const phase = await runValidationPhase("candidate", [slow], {}, { timeoutMs: 150 });
  assert.equal(phase.status, "failed");
  assert.match(phase.problems.join(" "), /timed out/);
});

// ---- Registry/loader integrity: fail closed ----
test("symlinked validator module is rejected", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readRegistry(dir);
    const victim = reg.validators.find((v) => !v.semantic);
    const modPath = path.join(dir, victim.module);
    const outside = path.join(os.tmpdir(), `evilv-${Date.now()}.js`);
    fs.writeFileSync(outside, `module.exports={id:${JSON.stringify(victim.id)},version:${JSON.stringify(victim.version)},semantic:false,supportedPhases:${JSON.stringify(victim.supportedPhases)},validate:()=>({status:"passed",problems:[]})};`);
    fs.rmSync(modPath); fs.symlinkSync(outside, modPath);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /unavailable|regular file/i);
    fs.rmSync(outside, { force: true });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("wrong action binding is rejected", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readRegistry(dir);
    reg.validators.find((v) => v.semantic).actions = ["some_other_action"];
    writeRegistry(dir, reg);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /action binding mismatch/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("semantic-flag mismatch is rejected", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readRegistry(dir);
    const structural = reg.validators.find((v) => !v.semantic);
    structural.semantic = true; structural.actions = ["write_report"];
    writeRegistry(dir, reg);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /semantic flag mismatch/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("version mismatch is rejected", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readRegistry(dir); reg.validators[0].version = "9.9.9"; writeRegistry(dir, reg);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /version mismatch/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("duplicate validator id is rejected", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readRegistry(dir); reg.validators.push({ ...reg.validators[0] }); writeRegistry(dir, reg);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /Duplicate validator id/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("module path escape is rejected", () => {
  const dir = tempValidatorDir();
  try {
    const reg = readRegistry(dir); reg.validators[0].module = "../evil.js"; writeRegistry(dir, reg);
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }), /escapes validator directory/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("malformed registry.json is rejected", () => {
  const dir = tempValidatorDir();
  try {
    fs.writeFileSync(path.join(dir, "registry.json"), "{ not json");
    assert.throws(() => loadValidatorRegistry({ validatorsDir: dir }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("tampering a validator module changes the bound validatorSetHash", () => {
  const dir = tempValidatorDir();
  try {
    const before = loadValidatorRegistry({ validatorsDir: dir }).validatorSetHash;
    const semantic = readRegistry(dir).validators.find((v) => v.semantic);
    fs.appendFileSync(path.join(dir, semantic.module), "\n// tamper\n");
    const after = loadValidatorRegistry({ validatorsDir: dir }).validatorSetHash;
    assert.notEqual(after, before, "moduleHash must be folded into validatorSetHash");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
