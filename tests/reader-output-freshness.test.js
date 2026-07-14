const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const validator = require("../scripts/reader-output-freshness");

const root = path.resolve(__dirname, "..");
const scriptPath = path.join(root, "scripts", "reader-output-freshness.js");
const canonicalPdfPath = path.join(root, ...validator.PUBLIC_PDF_PATH.split("/"));

function makeFixture(t) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reader-freshness-"));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const expected = validator.buildExpectedReaderOutputs({ rootDir: fixtureRoot });
  for (const relativePath of expected.keys()) {
    const source = path.join(root, ...relativePath.split("/"));
    const destination = path.join(fixtureRoot, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  for (const relativePath of [validator.STYLESHEET_PATH, validator.PUBLIC_PDF_PATH]) {
    const source = path.join(root, ...relativePath.split("/"));
    const destination = path.join(fixtureRoot, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  return fixtureRoot;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function snapshotTree(rootDir) {
  const snapshot = [];
  function visit(current) {
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((a, b) => validator.compareCodePoints(a.name, b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(rootDir, absolute).replace(/\\/g, "/");
      const stat = fs.statSync(absolute);
      const record = {
        path: relative,
        type: entry.isDirectory() ? "directory" : "file",
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        mode: stat.mode
      };
      if (entry.isFile()) record.sha256 = sha256(fs.readFileSync(absolute));
      snapshot.push(record);
      if (entry.isDirectory()) visit(absolute);
    }
  }
  visit(rootDir);
  return snapshot;
}

function validateFixture(fixtureRoot, sourcePdf = canonicalPdfPath) {
  return validator.validateReaderOutputs({ rootDir: fixtureRoot, canonicalPdfPath: sourcePdf });
}

function assertOneFailure(failures, relativePath, reason) {
  assert.ok(failures.some((failure) => failure.path === relativePath && failure.reason === reason),
    `${relativePath} reports ${reason}`);
}

test("fresh exact reader checkout passes with the approved output cardinality", (t) => {
  const fixtureRoot = makeFixture(t);
  const expected = validator.buildExpectedReaderOutputs({ rootDir: fixtureRoot });
  assert.equal([...expected.keys()].filter((item) => item.endsWith(".html")).length, 19);
  assert.equal([...expected.keys()].filter((item) => item.endsWith(".json")).length, 1);
  assert.deepEqual(validateFixture(fixtureRoot), []);
});

test("validator writes nothing and the snapshot detects same-content touches", (t) => {
  const fixtureRoot = makeFixture(t);
  const before = snapshotTree(fixtureRoot);
  assert.deepEqual(validateFixture(fixtureRoot), []);
  const after = snapshotTree(fixtureRoot);
  assert.deepEqual(after, before);

  const auditIndex = path.join(fixtureRoot, "public", "audit.html");
  const content = fs.readFileSync(auditIndex);
  fs.writeFileSync(auditIndex, content);
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(auditIndex, future, future);
  assert.notDeepEqual(snapshotTree(fixtureRoot), before, "same bytes with changed mtime are detected");
});

test("the actual CLI is read-only and accepts only an explicit canonical PDF", () => {
  const before = snapshotTree(path.join(root, "public"));
  const result = spawnSync(process.execPath, [scriptPath, "--canonical-pdf", canonicalPdfPath], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /19 HTML files, 1 JSON file/);
  assert.deepEqual(snapshotTree(path.join(root, "public")), before);

  const missing = spawnSync(process.execPath, [scriptPath], { cwd: root, encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /canonical-pdf-source: invalid argument/);
  assert.doesNotMatch(missing.stderr, /[A-Za-z]:\\/);
});

test("argument parsing rejects missing values, duplicates, and unsupported options", () => {
  assert.deepEqual(validator.parseArguments([]), { error: "--canonical-pdf is required" });
  assert.deepEqual(validator.parseArguments(["--canonical-pdf"]), {
    error: "--canonical-pdf requires a path"
  });
  assert.deepEqual(validator.parseArguments(["--other", "value"]), { error: "unsupported argument" });
  assert.deepEqual(
    validator.parseArguments(["--canonical-pdf", "one.pdf", "--canonical-pdf", "two.pdf"]),
    { error: "duplicate --canonical-pdf argument" }
  );
});

test("validator implementation contains no filesystem mutation API", () => {
  const source = fs.readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(
    source,
    /fs\.(?:writeFile|writeFileSync|appendFile|appendFileSync|copyFile|copyFileSync|rename|renameSync|truncate|truncateSync|mkdir|mkdirSync|unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync|createWriteStream)\b/
  );
});

for (const [label, relativePath] of [
  ["audit index", "public/audit.html"],
  ["numbered Section", "public/audit/section-08-food-assistance.html"],
  ["Appendix", "public/audit/appendix-a-open-questions.html"]
]) {
  test(`deliberately stale ${label} fails`, (t) => {
    const fixtureRoot = makeFixture(t);
    const target = path.join(fixtureRoot, ...relativePath.split("/"));
    fs.appendFileSync(target, "stale\n");
    assertOneFailure(validateFixture(fixtureRoot), relativePath, "content mismatch");
  });
}

test("missing and unexpected reader pages are diagnosed deterministically", (t) => {
  const fixtureRoot = makeFixture(t);
  const missing = "public/audit/section-01-executive-summary.html";
  fs.rmSync(path.join(fixtureRoot, ...missing.split("/")));
  const unexpected = "public/audit/unexpected.html";
  fs.writeFileSync(path.join(fixtureRoot, ...unexpected.split("/")), "unexpected\n");
  const failures = validateFixture(fixtureRoot);
  assertOneFailure(failures, missing, "missing");
  assertOneFailure(failures, unexpected, "unexpected");
  assert.deepEqual(
    failures,
    [...failures].sort((a, b) =>
      validator.compareCodePoints(a.path, b.path) || validator.compareCodePoints(a.reason, b.reason)
    )
  );
  assert.ok(failures.every((failure) => !failure.path.includes("\\")));
});

test("altered and missing publication search output fail", (t) => {
  const fixtureRoot = makeFixture(t);
  const relative = "public/data/publication-search.json";
  const target = path.join(fixtureRoot, ...relative.split("/"));
  fs.appendFileSync(target, "stale\n");
  assertOneFailure(validateFixture(fixtureRoot), relative, "content mismatch");
  fs.rmSync(target);
  assertOneFailure(validateFixture(fixtureRoot), relative, "missing");
});

test("stylesheet absence and missing reader linkage fail", (t) => {
  const fixtureRoot = makeFixture(t);
  fs.rmSync(path.join(fixtureRoot, ...validator.STYLESHEET_PATH.split("/")));
  assertOneFailure(validateFixture(fixtureRoot), validator.STYLESHEET_PATH, "stylesheet missing");

  const page = "public/audit/appendix-b-transparency-scorecard.html";
  const pagePath = path.join(fixtureRoot, ...page.split("/"));
  fs.writeFileSync(pagePath, fs.readFileSync(pagePath, "utf8").replace(validator.STYLESHEET_LINK, ""));
  const failures = validateFixture(fixtureRoot);
  assertOneFailure(failures, page, "stylesheet unlinked");
  assertOneFailure(failures, page, "content mismatch");
});

test("canonical PDF argument and both PDF identities are enforced without path leakage", (t) => {
  const fixtureRoot = makeFixture(t);
  assertOneFailure(
    validator.validateReaderOutputs({ rootDir: fixtureRoot }),
    "canonical-pdf-source",
    "invalid argument"
  );

  const missingSource = path.join(fixtureRoot, "missing-source.pdf");
  assertOneFailure(validateFixture(fixtureRoot, missingSource), "canonical-pdf-source", "missing");

  const wrongSource = path.join(fixtureRoot, "wrong-source.pdf");
  fs.writeFileSync(wrongSource, "not the canonical PDF");
  let failures = validateFixture(fixtureRoot, wrongSource);
  assertOneFailure(failures, "canonical-pdf-source", "PDF mismatch");
  assert.doesNotMatch(failures.map(validator.formatFailure).join("\n"), /release03-reader-output-freshness/i);

  const publicPdf = path.join(fixtureRoot, ...validator.PUBLIC_PDF_PATH.split("/"));
  fs.appendFileSync(publicPdf, "altered");
  failures = validateFixture(fixtureRoot);
  assertOneFailure(failures, validator.PUBLIC_PDF_PATH, "PDF mismatch");
});

test("independent expected manifests are byte-identical", (t) => {
  const fixtureRoot = makeFixture(t);
  const first = validator.buildExpectedReaderOutputs({ rootDir: fixtureRoot });
  const second = validator.buildExpectedReaderOutputs({ rootDir: fixtureRoot });
  assert.deepEqual([...first], [...second]);
  for (const [relativePath, text] of first) {
    assert.equal(sha256(Buffer.from(text, "utf8")), sha256(Buffer.from(second.get(relativePath), "utf8")));
  }
});

test("CRLF and LF reader text compare equivalently without trimming", (t) => {
  const fixtureRoot = makeFixture(t);
  const expected = validator.buildExpectedReaderOutputs({ rootDir: fixtureRoot });
  for (const relativePath of expected.keys()) {
    const target = path.join(fixtureRoot, ...relativePath.split("/"));
    const lfText = validator.normalizeText(fs.readFileSync(target, "utf8"));
    fs.writeFileSync(target, lfText.replace(/\n/g, "\r\n"));
  }
  assert.deepEqual(validateFixture(fixtureRoot), []);

  const auditIndex = path.join(fixtureRoot, "public", "audit.html");
  fs.appendFileSync(auditIndex, " ");
  assertOneFailure(validateFixture(fixtureRoot), "public/audit.html", "content mismatch");
});

test("failure formatting is sorted, POSIX-relative, explicit, and machine-path free", (t) => {
  const fixtureRoot = makeFixture(t);
  fs.rmSync(path.join(fixtureRoot, "public", "audit.html"));
  fs.writeFileSync(path.join(fixtureRoot, "public", "audit", "zzz.html"), "extra");
  const lines = validateFixture(fixtureRoot).map(validator.formatFailure);
  assert.deepEqual(lines, [...lines].sort(validator.compareCodePoints));
  assert.ok(lines.every((line) => line.startsWith("- public/") && !line.includes("\\")));
  assert.ok(lines.some((line) => line.includes("actual-sha256=<absent>")));
  assert.ok(lines.some((line) => line.includes("expected-sha256=<absent>")));
  assert.doesNotMatch(lines.join("\n"), /[A-Za-z]:\//);
});
