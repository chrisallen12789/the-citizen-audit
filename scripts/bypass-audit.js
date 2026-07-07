const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "..");
const defaultConfigPath = path.join(repositoryRoot, "scripts", "bypass-audit-config.json");
const defaultReportPath = path.join(repositoryRoot, "docs", "bypass-audit-report.json");

const PATTERNS = [
  { name: "writeFileSync", re: /\bwriteFileSync\s*\(/ },
  { name: "writeFile", re: /\bwriteFile\s*\(/ },
  { name: "appendFileSync", re: /\bappendFileSync\s*\(/ },
  { name: "appendFile", re: /\bappendFile\s*\(/ },
  { name: "unlinkSync", re: /\bunlinkSync\s*\(/ },
  { name: "unlink", re: /\bunlink\s*\(/ },
  { name: "rmSync", re: /\brmSync\s*\(/ },
  { name: "rmdirSync", re: /\brmdirSync\s*\(/ },
  { name: "rm", re: /\bfs\.rm\s*\(/ },
  { name: "renameSync", re: /\brenameSync\s*\(/ },
  { name: "rename", re: /\bfs\.rename\s*\(/ },
  { name: "mkdirSync", re: /\bmkdirSync\s*\(/ },
  { name: "symlinkSync", re: /\bsymlinkSync\s*\(/ },
  { name: "copyFileSync", re: /\bcopyFileSync\s*\(/ },
  { name: "cpSync", re: /\bcpSync\s*\(/ },
  { name: "createWriteStream", re: /\bcreateWriteStream\s*\(/ },
  { name: "fchmodSync", re: /\bfchmodSync\s*\(/ },
  { name: "chmodSync", re: /\bchmodSync\s*\(/ },
  { name: "atomicReplaceFile", re: /\batomicReplaceFile\s*\(/ },
  { name: "writeCanonicalJsonAtomic", re: /\bwriteCanonicalJsonAtomic\s*\(/ },
  { name: "writeBytesDurable", re: /\bwriteBytesDurable\s*\(/ },
  { name: "unlinkDurable", re: /\bunlinkDurable\s*\(/ },
  { name: "spawnSync", re: /\bspawnSync\s*\(/ },
  { name: "spawn", re: /\bspawn\s*\(/ },
  { name: "execSync", re: /\bexecSync\s*\(/ },
  { name: "exec", re: /\bexec\s*\(/ },
  { name: "fork", re: /\bfork\s*\(/ }
];

const PROCESS_PATTERNS = new Set(["spawn", "spawnSync", "exec", "execSync", "fork"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", ".runtime", ".wrangler", "public"]);
const APPROVED_AGENT_EXECUTION_ADAPTER = "kernel/runtime/isolation-adapter.js";
const SANDBOX_HELPER = "kernel/runtime/sandbox-exec.c";
const REQUIRED_SECURITY_FILES = [
  "kernel/runtime/run.js",
  "kernel/runtime/transactional-runtime.js",
  APPROVED_AGENT_EXECUTION_ADAPTER,
  SANDBOX_HELPER
];

function walk(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      files.push(...walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".c"))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function scanFile(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath).split(path.sep).join("/");
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const hits = [];
  if (relative.endsWith(".js")) {
    lines.forEach((line, index) => {
      for (const pattern of PATTERNS) {
        if (pattern.re.test(line)) hits.push({ line: index + 1, pattern: pattern.name });
      }
    });
  }
  return { file: relative, source, lines, hits };
}

function loadConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const map = new Map();
  for (const entry of config.classifications || []) map.set(entry.path, entry);
  return { config, map };
}

function capabilityFlags(result) {
  const source = result.source;
  return {
    filesystemMutation: result.hits.some((hit) => !PROCESS_PATTERNS.has(hit.pattern)),
    processExecution: result.hits.some((hit) => PROCESS_PATTERNS.has(hit.pattern)),
    inProcessAgentSurface: /(?:agent|options)\.fn\b|typeof\s+(?:agent|options)\.fn/.test(source),
    legacyOverrideFlag: /legacy-uncontrolled-ack|uncontrolled.*ack/i.test(source),
    callerControlledSentinels: /sentinelPaths|snapshotGovernedSentinels/.test(source),
    isolationDisableSurface: /disableIsolation|skipIsolation|bypassIsolation|unsafeFallback|allowUnisolated/i.test(source),
    isolationProbe: /probeIsolationCapability/.test(source),
    chrootIsolation: /\bchroot\b/.test(source),
    sandboxLauncher: /sandbox-exec/.test(source),
    seccompClaim: /seccomp\s*:\s*true|SECCOMP_SET_MODE_FILTER/.test(source),
    liveRootNotExposed: /liveRootExposed\s*:\s*false/.test(source),
    namespaceIsolation: /--user["']?\s*,|--mount["']?\s*,|--pid["']?\s*,/.test(source),
    orchestratorCall: /executeApprovedTransaction\s*\(/.test(source)
  };
}

function helperFlags(source) {
  return {
    noNewPrivileges: /PR_SET_NO_NEW_PRIVS/.test(source),
    seccompFilter: /SECCOMP_SET_MODE_FILTER/.test(source),
    locksPrivileges: /lock_privileges\s*\(/.test(source),
    blocksMount: /__NR_mount/.test(source) && /__NR_umount2/.test(source),
    blocksNamespaceEntry: /__NR_unshare/.test(source) && /__NR_setns/.test(source),
    blocksRootEscape: /__NR_pivot_root/.test(source) && /__NR_chroot/.test(source),
    blocksModernMountApi: /__NR_open_tree|__NR_move_mount|__NR_fsopen|__NR_mount_setattr/.test(source),
    restrictsNamespaceClone: /CLONE_NEWUSER/.test(source) && /CLONE_NEWNS/.test(source),
    workspaceCwd: /chdir\("\/workspace"\)/.test(source),
    closesInheritedFds: /close_extra_fds\s*\(/.test(source)
  };
}

function sameLineGovernedMutation(result, governedPrefixes) {
  const mutationLines = new Set(result.hits.filter((hit) => !PROCESS_PATTERNS.has(hit.pattern)).map((hit) => hit.line));
  for (const lineNumber of mutationLines) {
    const line = result.lines[lineNumber - 1] || "";
    if (governedPrefixes.some((prefix) => line.includes(prefix))) return true;
  }
  return false;
}

function behavioralViolations(result, entry, config) {
  const flags = capabilityFlags(result);
  const violations = [];
  const file = result.file;
  const category = entry && entry.category;

  if (file === "kernel/runtime/run.js") {
    if (flags.processExecution || /child_process/.test(result.source)) violations.push("Legacy runtime contains a process-execution path.");
    if (flags.legacyOverrideFlag) violations.push("Legacy uncontrolled execution override flag is present.");
    if (!/legacy active execution is permanently disabled|Active legacy execution is permanently disabled/.test(result.source)) {
      violations.push("Legacy runtime lacks an explicit permanent active-execution prohibition.");
    }
  }

  if (file.startsWith("kernel/runtime/") && flags.processExecution && file !== APPROVED_AGENT_EXECUTION_ADAPTER) {
    violations.push("Runtime process execution occurs outside the approved isolation adapter.");
  }

  if (file === "kernel/runtime/transactional-runtime.js") {
    if (flags.inProcessAgentSurface) violations.push("Production transactional runtime accepts an in-process function agent.");
    if (flags.callerControlledSentinels) violations.push("Caller-controlled sentinel protection is present.");
    if (flags.isolationDisableSurface) violations.push("Caller-controlled isolation-disable or unsafe fallback surface is present.");
    if (!/runExternalAgentIsolated/.test(result.source)) violations.push("Transactional runtime is not bound to the approved external isolation adapter.");
    if (!/snapshotGovernedTree/.test(result.source)) violations.push("Transactional runtime lacks the always-on governed-tree guard.");
    if (!flags.orchestratorCall) violations.push("Transactional runtime does not route approved mutation through executeApprovedTransaction.");
  }

  if (file === APPROVED_AGENT_EXECUTION_ADAPTER) {
    if (!flags.processExecution) violations.push("Approved isolation adapter has no process-execution implementation.");
    if (!flags.isolationProbe) violations.push("Isolation adapter does not perform an explicit capability probe.");
    if (!flags.chrootIsolation) violations.push("Isolation adapter does not place the agent inside a chrooted sandbox.");
    if (!flags.sandboxLauncher) violations.push("Isolation adapter does not invoke the approved sandbox launcher.");
    if (!flags.seccompClaim) violations.push("Isolation adapter does not bind execution to seccomp enforcement.");
    if (!flags.liveRootNotExposed) violations.push("Isolation adapter does not explicitly attest that the live institution root is absent from the sandbox.");
    if (!flags.namespaceIsolation) violations.push("Isolation adapter does not create the required operating-system namespaces.");
    if (!/ISOLATION_UNAVAILABLE/.test(result.source)) violations.push("Isolation adapter does not expose fail-closed unavailable-isolation behavior.");
    if (flags.isolationDisableSurface) violations.push("Isolation adapter contains an unsafe fallback or disable surface.");
    if (/mount\s+--bind[^\n]*(?:rootDir|liveRoot)|\$liveRoot|\$rootDir/.test(result.source)) {
      violations.push("Isolation adapter appears to expose the live institution root through a bind mount.");
    }
  }

  if (file === SANDBOX_HELPER) {
    const helper = helperFlags(result.source);
    for (const [field, present] of Object.entries(helper)) {
      if (!present) violations.push(`Sandbox launcher is missing required control: ${field}.`);
    }
  }

  if (category === 4 && !file.startsWith("tests/")) violations.push("Production file is falsely classified as test-only.");
  if (category === 2 && !["kernel/runtime/agent-workspace.js", APPROVED_AGENT_EXECUTION_ADAPTER, SANDBOX_HELPER].includes(file)) {
    violations.push("Isolation category is assigned to an unapproved implementation file.");
  }
  if (category === 3 && sameLineGovernedMutation(result, config.governedRecordPrefixes || [])) {
    violations.push("Generated-output classification contains a direct governed-prefix mutation.");
  }
  if (category === 6) violations.push("File is explicitly classified as an unacceptable bypass.");

  return { flags, violations };
}

function requiredBehaviorChecks(scannedByPath) {
  const violations = [];
  for (const required of REQUIRED_SECURITY_FILES) {
    if (!scannedByPath.has(required)) violations.push({ file: required, violation: "Required runtime security file was not scanned or is missing." });
  }
  return violations;
}

function run(options = {}) {
  const rootDir = path.resolve(options.rootDir || repositoryRoot);
  const configPath = path.resolve(options.configPath || (rootDir === repositoryRoot ? defaultConfigPath : path.join(rootDir, "scripts", "bypass-audit-config.json")));
  const { config, map } = loadConfig(configPath);
  const scanned = walk(rootDir).map((filePath) => scanFile(rootDir, filePath));
  const mutationFiles = scanned.filter((result) => result.hits.length > 0);
  const scannedByPath = new Map(scanned.map((result) => [result.file, result]));
  const classified = [];
  const securityChecks = [];
  const unexplained = [];
  const violations = requiredBehaviorChecks(scannedByPath);

  for (const result of mutationFiles) {
    const entry = map.get(result.file);
    if (!entry) {
      unexplained.push({ file: result.file, hits: result.hits });
      continue;
    }
    const behavior = behavioralViolations(result, entry, config);
    const record = {
      file: result.file,
      category: entry.category,
      justification: entry.justification,
      hitCount: result.hits.length,
      detectedCapabilities: behavior.flags,
      sourceBehaviorChecks: behavior.violations.length ? "failed" : "passed",
      violations: behavior.violations
    };
    classified.push(record);
    for (const violation of behavior.violations) violations.push({ file: result.file, violation });
  }

  for (const file of REQUIRED_SECURITY_FILES) {
    const result = scannedByPath.get(file);
    if (!result) continue;
    const entry = map.get(file) || null;
    if (!entry) {
      violations.push({ file, violation: "Required runtime security file has no classification." });
    }
    const behavior = behavioralViolations(result, entry, config);
    securityChecks.push({
      file,
      category: entry ? entry.category : null,
      detectedCapabilities: file === SANDBOX_HELPER ? helperFlags(result.source) : behavior.flags,
      status: behavior.violations.length ? "failed" : "passed",
      violations: behavior.violations
    });
    if (!mutationFiles.some((item) => item.file === file)) {
      for (const violation of behavior.violations) violations.push({ file, violation });
    }
  }

  const mutationPaths = new Set(mutationFiles.map((result) => result.file));
  const semanticPaths = new Set(REQUIRED_SECURITY_FILES);
  const staleClassifications = [...map.keys()].filter((file) => !mutationPaths.has(file) && !semanticPaths.has(file)).sort();
  const unacceptable = classified.filter((record) => record.category === 6);
  const deduplicatedViolations = [...new Map(violations.map((item) => [`${item.file}\0${item.violation}`, item])).values()];
  const pass = unexplained.length === 0 && unacceptable.length === 0 && deduplicatedViolations.length === 0;

  return {
    generatedAt: options.now || new Date().toISOString(),
    configVersion: config.version,
    categories: config.categories,
    governedRecordPrefixes: config.governedRecordPrefixes,
    approvedAgentExecutionAdapter: APPROVED_AGENT_EXECUTION_ADAPTER,
    sandboxHelper: SANDBOX_HELPER,
    summary: {
      mutationCapableFiles: mutationFiles.length,
      classified: classified.length,
      securityChecks: securityChecks.length,
      unexplained: unexplained.length,
      unacceptable: unacceptable.length,
      behavioralViolations: deduplicatedViolations.length,
      staleClassifications: staleClassifications.length,
      pass
    },
    classified: classified.sort((a, b) => a.file.localeCompare(b.file)),
    securityChecks: securityChecks.sort((a, b) => a.file.localeCompare(b.file)),
    unexplained: unexplained.sort((a, b) => a.file.localeCompare(b.file)),
    unacceptable,
    behavioralViolations: deduplicatedViolations.sort((a, b) => a.file.localeCompare(b.file) || a.violation.localeCompare(b.violation)),
    staleClassifications
  };
}

module.exports = { APPROVED_AGENT_EXECUTION_ADAPTER, PATTERNS, REQUIRED_SECURITY_FILES, SANDBOX_HELPER, run };

if (require.main === module) {
  const discover = process.argv.includes("--discover");
  const report = run();
  if (discover) {
    console.log(JSON.stringify({ unexplained: report.unexplained.map((item) => item.file), stale: report.staleClassifications, violations: report.behavioralViolations }, null, 2));
    process.exit(report.summary.pass ? 0 : 1);
  }
  fs.mkdirSync(path.dirname(defaultReportPath), { recursive: true });
  fs.writeFileSync(defaultReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Bypass audit: ${report.summary.mutationCapableFiles} mutation-capable files, ${report.summary.classified} classified, ${report.summary.unexplained} unexplained, ${report.summary.behavioralViolations} behavioral violations.`);
  console.log(`Report written to ${path.relative(repositoryRoot, defaultReportPath)}`);
  if (!report.summary.pass) {
    for (const item of report.unexplained) console.error(`Unexplained: ${item.file}`);
    for (const item of report.behavioralViolations) console.error(`Violation: ${item.file}: ${item.violation}`);
    process.exit(1);
  }
  console.log("Bypass audit passed: classifications and source behavior are consistent; no uncontrolled governed mutation path was found.");
}
