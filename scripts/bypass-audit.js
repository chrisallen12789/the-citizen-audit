const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const repositoryRoot = path.resolve(__dirname, "..");
const defaultConfigPath = path.join(repositoryRoot, "scripts", "bypass-audit-config.json");
const defaultReportPath = path.join(repositoryRoot, "docs", "bypass-audit-report.json");
const IGNORE_DIRS = new Set(["node_modules", ".git", ".runtime", ".wrangler", "public"]);
const APPROVED_AGENT_EXECUTION_ADAPTER = "kernel/runtime/isolation-adapter.js";
const SANDBOX_HELPER = "kernel/runtime/sandbox-exec.c";
const REQUIRED_SECURITY_FILES = ["kernel/runtime/run.js", "kernel/runtime/transactional-runtime.js", APPROVED_AGENT_EXECUTION_ADAPTER, SANDBOX_HELPER];
const FS_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"]);
const PROCESS_MODULES = new Set(["child_process", "node:child_process"]);
const FS_MUTATORS = new Set(["writeFileSync","writeFile","appendFileSync","appendFile","unlinkSync","unlink","rmSync","rm","rmdirSync","rmdir","renameSync","rename","mkdirSync","mkdir","symlinkSync","symlink","copyFileSync","copyFile","cpSync","cp","createWriteStream","fchmodSync","fchmod","chmodSync","chmod","truncateSync","truncate","linkSync","link","openSync"]);
const PROCESS_EXECUTORS = new Set(["spawn","spawnSync","exec","execSync","execFile","execFileSync","fork"]);
const DURABLE_PRIMITIVES = new Set(["appendEntry","recordTransaction","createExecutionAttempt","transitionExecutionAttempt","writeCanonicalJsonAtomic","writeBytesDurable","atomicReplaceFile","unlinkDurable","writeValidationResult","writePreStateManifest","writeRollbackResult"]);
const TRANSACTION_PRIMITIVES = new Set(["recordTransaction","createExecutionAttempt","transitionExecutionAttempt"]);
const CAPABILITIES = Object.freeze(["filesystemMutation","processExecution","transactionRecording","eventWriting","durableStateMutation"]);

function posix(value) { return value.split(path.sep).join("/"); }
function walk(dir) {
  const files=[]; if(!fs.existsSync(dir)) return files;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.isDirectory()){if(!IGNORE_DIRS.has(entry.name))files.push(...walk(path.join(dir,entry.name)));}
    else if(entry.isFile()&&(entry.name.endsWith(".js")||entry.name.endsWith(".c")))files.push(path.join(dir,entry.name));
  }
  return files;
}
function staticProperty(node) {
  if(!node) return null;
  if(!node.computed&&node.property&&node.property.type==="Identifier") return node.property.name;
  if(node.computed&&node.property&&node.property.type==="Literal"&&typeof node.property.value==="string") return node.property.value;
  if(node.computed&&node.property&&node.property.type==="TemplateLiteral"&&node.property.expressions.length===0) return node.property.quasis[0].value.cooked;
  return null;
}
function staticString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}
function requireTarget(node) {
  if(!node||node.type!=="CallExpression"||node.callee.type!=="Identifier"||node.callee.name!=="require"||node.arguments.length!==1) return null;
  const arg=node.arguments[0]; return arg.type==="Literal"&&typeof arg.value==="string"?arg.value:null;
}
function resolveLocalModule(rootDir, fromFile, request) {
  if(!request||!request.startsWith(".")) return null;
  const base=path.resolve(path.dirname(path.join(rootDir,fromFile)),request);
  for(const candidate of [base,`${base}.js`,path.join(base,"index.js")]) {
    try { if(fs.lstatSync(candidate).isFile()) return posix(path.relative(rootDir,candidate)); } catch {}
  }
  return null;
}
function parseJs(source,file) {
  try { return acorn.parse(source,{ecmaVersion:"latest",sourceType:"script",allowHashBang:true,locations:true}); }
  catch(first){ try{return acorn.parse(source,{ecmaVersion:"latest",sourceType:"module",allowHashBang:true,locations:true});}catch(second){const e=new Error(`${file}: JavaScript parse failed: ${second.message}`);e.code="AST_PARSE_FAILURE";throw e;} }
}
function children(node) {
  const result=[];
  for(const [key,value] of Object.entries(node||{})) {
    if(["loc","start","end"].includes(key))continue;
    if(value&&typeof value.type==="string")result.push(value);
    else if(Array.isArray(value))for(const item of value)if(item&&typeof item.type==="string")result.push(item);
  }
  return result;
}
function functionName(node,parent) {
  if(node.id&&node.id.name)return node.id.name;
  if(parent&&parent.type==="VariableDeclarator"&&parent.id.type==="Identifier")return parent.id.name;
  if(parent&&parent.type==="Property")return staticProperty(parent)||"<property>";
  return `<anonymous@${node.loc.start.line}>`;
}
function addCapability(target,name,line,reason) {
  if(!target.capabilities.has(name))target.capabilities.set(name,[]);
  target.capabilities.get(name).push({line,reason});
}
function analyzeJs(rootDir,file,source) {
  const ast=parseJs(source,file);
  const namespaces=new Map();
  const importedFns=new Map();
  const aliases=new Map();
  const localFunctions=new Map();
  const functionNodes=[];
  const unknown=[];
  const moduleState={capabilities:new Map(),edges:[],calls:[],unknown,literalMutationPaths:[]};

  function bindPattern(pattern,target) {
    if(pattern.type==="Identifier") namespaces.set(pattern.name,target);
    else if(pattern.type==="ObjectPattern") for(const prop of pattern.properties||[]) {
      if(prop.type!=="Property")continue; const imported=prop.computed ? (prop.key.type==="Literal" ? prop.key.value : null) : (prop.key.type==="Identifier" ? prop.key.name : prop.key.value); const local=prop.value.type==="Identifier"?prop.value.name:null;
      if(imported&&local) importedFns.set(local,{module:target,name:imported});
    }
  }
  function firstPass(node,parent=null) {
    if(node.type==="VariableDeclarator"&&node.init) {
      const req=requireTarget(node.init);
      if(req) bindPattern(node.id,req);
      else if(node.id.type==="Identifier"&&node.init.type==="Identifier") aliases.set(node.id.name,node.init.name);
      else if(node.id.type==="Identifier"&&node.init.type==="MemberExpression") {
        const prop=staticProperty(node.init); if(prop&&node.init.object.type==="Identifier") importedFns.set(node.id.name,{module:namespaces.get(node.init.object.name)||node.init.object.name,name:prop});
      }
    }
    if(["FunctionDeclaration","FunctionExpression","ArrowFunctionExpression"].includes(node.type)) {
      const name=functionName(node,parent); localFunctions.set(name,node); functionNodes.push({name,node});
    }
    for(const child of children(node))firstPass(child,node);
  }
  firstPass(ast);
  function resolveAlias(name){const seen=new Set();while(aliases.has(name)&&!seen.has(name)){seen.add(name);name=aliases.get(name);}return name;}
  function resolveCall(callee) {
    if(callee.type==="Identifier") {
      const name=resolveAlias(callee.name);
      if(importedFns.has(name))return importedFns.get(name);
      if(localFunctions.has(name))return {module:file,name,local:true};
      return {module:null,name};
    }
    if(callee.type==="MemberExpression") {
      const prop=staticProperty(callee);
      if(!prop) {
        if(callee.object.type==="Identifier"&&(FS_MODULES.has(namespaces.get(callee.object.name))||PROCESS_MODULES.has(namespaces.get(callee.object.name)))) unknown.push({line:callee.loc.start.line,reason:"dynamic computed capability call"});
        return null;
      }
      if(callee.object.type==="Identifier") {
        const object=resolveAlias(callee.object.name); return {module:namespaces.get(object)||object,name:prop};
      }
      const req=requireTarget(callee.object); if(req)return {module:req,name:prop};
    }
    return null;
  }
  function stateFor(fn){return fn||moduleState;}
  function secondPass(node,parent=null,current=null) {
    let next=current;
    if(["FunctionDeclaration","FunctionExpression","ArrowFunctionExpression"].includes(node.type)) {
      const name=functionName(node,parent); if(!node.__auditState)node.__auditState={name,capabilities:new Map(),edges:[],calls:[],unknown,literalMutationPaths:[]}; next=node.__auditState;
    }
    if(node.type==="CallExpression") {
      const resolved=resolveCall(node.callee); const target=stateFor(next);
      if(resolved) {
        const line=node.loc.start.line;
        if((FS_MODULES.has(resolved.module) || resolved.module === null) && FS_MUTATORS.has(resolved.name)){
          addCapability(target,"filesystemMutation",line,`${resolved.module || "wrapper"}.${resolved.name}`);
          addCapability(target,"durableStateMutation",line,`${resolved.module || "wrapper"}.${resolved.name}`);
          const literalPath=staticString(node.arguments[0]);
          if(literalPath)target.literalMutationPaths.push({line,path:literalPath,primitive:resolved.name});
        }
        else if((PROCESS_MODULES.has(resolved.module) || resolved.module === null) && PROCESS_EXECUTORS.has(resolved.name))addCapability(target,"processExecution",line,`${resolved.module || "wrapper"}.${resolved.name}`);
        else if(DURABLE_PRIMITIVES.has(resolved.name)) {
          addCapability(target,"durableStateMutation",line,resolved.name);
          if(TRANSACTION_PRIMITIVES.has(resolved.name))addCapability(target,"transactionRecording",line,resolved.name);
          if(file.startsWith("kernel/events/"))addCapability(target,"eventWriting",line,resolved.name);
        }
        if(resolved.local)target.calls.push(resolved.name);
        else if(resolved.module&&resolved.module.startsWith(".")) { const dep=resolveLocalModule(rootDir,file,resolved.module); if(dep)target.edges.push({module:dep,exportName:resolved.name,line}); }
        else if(resolved.module&&!FS_MODULES.has(resolved.module)&&!PROCESS_MODULES.has(resolved.module)&&!resolved.module.includes("/")&&namespaces.has(resolved.module)) {
          const dep=resolveLocalModule(rootDir,file,namespaces.get(resolved.module)); if(dep)target.edges.push({module:dep,exportName:resolved.name,line});
        }
      }
      if(node.callee.type==="Identifier"&&node.callee.name==="require"&&!requireTarget(node))unknown.push({line:node.loc.start.line,reason:"dynamic require"});
    }
    for(const child of children(node))secondPass(child,node,next);
  }
  secondPass(ast);
  // Fold every local function into the module capability surface; exported or otherwise callable code makes the module capable.
  for(const {node} of functionNodes) {
    const st=node.__auditState; if(!st)continue;
    for(const [cap,hits] of st.capabilities)for(const hit of hits)addCapability(moduleState,cap,hit.line,hit.reason);
    moduleState.edges.push(...st.edges); moduleState.calls.push(...st.calls); moduleState.literalMutationPaths.push(...st.literalMutationPaths);
  }
  // Calls on namespace imports of local modules may have been recorded with the request string.
  for(const call of [...moduleState.edges]) call.module=resolveLocalModule(rootDir,file,call.module)||call.module;
  return moduleState;
}
function helperFlags(source){return{noNewPrivileges:/PR_SET_NO_NEW_PRIVS/.test(source),seccompFilter:/SECCOMP_SET_MODE_FILTER/.test(source),locksPrivileges:/lock_privileges\s*\(/.test(source),blocksMount:/__NR_mount/.test(source)&&/__NR_umount2/.test(source),blocksNamespaceEntry:/__NR_unshare/.test(source)&&/__NR_setns/.test(source),blocksRootEscape:/__NR_pivot_root/.test(source)&&/__NR_chroot/.test(source),blocksModernMountApi:/__NR_open_tree|__NR_move_mount|__NR_fsopen|__NR_mount_setattr/.test(source),restrictsNamespaceClone:/CLONE_NEWUSER/.test(source)&&/CLONE_NEWNS/.test(source),workspaceCwd:/chdir\("\/workspace"\)/.test(source),closesInheritedFds:/close_extra_fds\s*\(/.test(source)};}
function loadConfig(configPath){const config=JSON.parse(fs.readFileSync(configPath,"utf8"));return{config,map:new Map((config.classifications||[]).map((entry)=>[entry.path,entry]))};}
function capabilityObject(set){return Object.fromEntries(CAPABILITIES.map((cap)=>[cap,set.has(cap)]));}
function behavioralViolations(result,entry,config) {
  const source=result.source,file=result.file,violations=[];
  const caps=result.allCapabilities;
  if(file==="kernel/runtime/run.js"){
    if(caps.has("processExecution"))violations.push("Legacy runtime contains a process-execution path.");
    if(caps.has("filesystemMutation"))violations.push("Legacy runtime contains a filesystem mutation path.");
    if(/legacy-uncontrolled-ack|uncontrolled.*ack/i.test(source))violations.push("Legacy uncontrolled execution override flag is present.");
    if(!/legacy active execution is permanently disabled|Active legacy execution is permanently disabled/.test(source))violations.push("Legacy runtime lacks an explicit permanent active-execution prohibition.");
  }
  if(file.startsWith("kernel/runtime/")&&result.directCapabilities.has("processExecution")&&file!==APPROVED_AGENT_EXECUTION_ADAPTER)violations.push("Runtime process execution occurs outside the approved isolation adapter.");
  if(file.startsWith("kernel/runtime/")&&caps.has("processExecution")&&!result.directCapabilities.has("processExecution")&&file!=="kernel/runtime/transactional-runtime.js"&&file!=="kernel/runtime/run-transactional.js") violations.push("Runtime has an indirect process-execution capability not routed through the approved transactional adapter.");
  if(file==="kernel/runtime/transactional-runtime.js"){
    if(/(?:agent|options)\.fn\b|typeof\s+(?:agent|options)\.fn/.test(source))violations.push("Production transactional runtime accepts an in-process function agent.");
    if(/approvalProvider\s*\(/.test(source))violations.push("Production transactional runtime executes a caller approval callback.");
    if(/onStep\s*\(/.test(source))violations.push("Production transactional runtime executes a caller fault callback.");
    if(/sentinelPaths|snapshotGovernedSentinels/.test(source))violations.push("Caller-controlled sentinel protection is present.");
    if(/disableIsolation|skipIsolation|bypassIsolation|unsafeFallback|allowUnisolated/i.test(source))violations.push("Caller-controlled isolation-disable or unsafe fallback surface is present.");
    if(!/runExternalAgentIsolated/.test(source))violations.push("Transactional runtime is not bound to the approved external isolation adapter.");
    if(!/resolveRegisteredAgent/.test(source))violations.push("Transactional runtime does not resolve an authoritative registered agent identity.");
    if(!/snapshotGovernedTree/.test(source))violations.push("Transactional runtime lacks the always-on governed-tree guard.");
    if(!/executeApprovedTransaction/.test(source))violations.push("Transactional runtime does not route approved mutation through executeApprovedTransaction.");
  }
  if(file===APPROVED_AGENT_EXECUTION_ADAPTER){
    if(!caps.has("processExecution"))violations.push("Approved isolation adapter has no process-execution implementation.");
    for(const [label,re] of [["capability probe",/probeIsolationCapability/],["chrooted sandbox",/\bchroot\b/],["sandbox launcher",/sandbox-exec/],["seccomp",/seccomp\s*:\s*true|SECCOMP_SET_MODE_FILTER/],["live root exclusion",/liveRootExposed\s*:\s*false/],["namespace isolation",/--user["']?\s*,|--mount["']?\s*,|--pid["']?\s*,/],["fail-closed behavior",/ISOLATION_UNAVAILABLE/],["full helper digest",/binaryHash|verifyHelperFile/]])if(!re.test(source))violations.push(`Isolation adapter lacks required ${label}.`);
    if(/disableIsolation|skipIsolation|bypassIsolation|unsafeFallback|allowUnisolated/i.test(source))violations.push("Isolation adapter contains an unsafe fallback or disable surface.");
  }
  if(file===SANDBOX_HELPER)for(const [field,present]of Object.entries(helperFlags(source)))if(!present)violations.push(`Sandbox launcher is missing required control: ${field}.`);
  if(entry&&entry.category===3){
    for(const mutation of result.literalMutationPaths||[]){
      const normalized=posix(path.normalize(mutation.path)).replace(/^\.\//,"");
      if((config.governedRecordPrefixes||[]).some((prefix)=>normalized===prefix.replace(/\/$/,"")||normalized.startsWith(prefix))) {
        violations.push(`Generated-output owner contains a direct governed-prefix mutation at line ${mutation.line}: ${normalized}.`);
      }
    }
  }
  if(entry&&entry.category===4&&!file.startsWith("tests/"))violations.push("Production file is falsely classified as test-only.");
  if(entry&&entry.category===6)violations.push("File is explicitly classified as an unacceptable bypass.");
  if(result.unknown.length)for(const unknown of result.unknown) {
    if (unknown.reason === "dynamic require" && entry && entry.reviewedDynamicRequire === true) continue;
    violations.push(`Unknown capability at line ${unknown.line}: ${unknown.reason}.`);
  }
  const owned=new Set((entry&&entry.capabilities)||[]);
  for(const cap of caps)if(!owned.has(cap))violations.push(`Discovered capability is not owned by classification: ${cap}.`);
  for(const cap of owned)if(!CAPABILITIES.includes(cap))violations.push(`Classification declares unknown capability: ${cap}.`);
  return violations;
}
function run(options={}) {
  const rootDir=path.resolve(options.rootDir||repositoryRoot);
  const configPath=path.resolve(options.configPath||(rootDir===repositoryRoot?defaultConfigPath:path.join(rootDir,"scripts","bypass-audit-config.json")));
  const {config,map}=loadConfig(configPath);
  const scanned=[];
  for(const filePath of walk(rootDir)) {
    const file=posix(path.relative(rootDir,filePath)),source=fs.readFileSync(filePath,"utf8");
    if(file.endsWith(".c")){scanned.push({file,source,directCapabilities:new Set(),allCapabilities:new Set(),edges:[],unknown:[],literalMutationPaths:[]});continue;}
    const analysis=analyzeJs(rootDir,file,source); const directCapabilities=new Set(analysis.capabilities.keys());
    scanned.push({file,source,directCapabilities,allCapabilities:new Set(directCapabilities),edges:analysis.edges,unknown:analysis.unknown,literalMutationPaths:analysis.literalMutationPaths,directEvidence:Object.fromEntries([...analysis.capabilities])});
  }
  const byPath=new Map(scanned.map((r)=>[r.file,r]));
  let changed=true;
  while(changed){changed=false;for(const result of scanned)for(const edge of result.edges){const target=byPath.get(edge.module);if(!target)continue;for(const cap of target.allCapabilities)if(!result.allCapabilities.has(cap)){result.allCapabilities.add(cap);changed=true;}}}
  const capable=scanned.filter((r)=>r.allCapabilities.size||r.unknown.length);
  const classified=[],unexplained=[],violations=[];
  for(const result of capable){const entry=map.get(result.file);if(!entry){unexplained.push({file:result.file,capabilities:[...result.allCapabilities].sort(),unknown:result.unknown});continue;}const v=behavioralViolations(result,entry,config);classified.push({file:result.file,category:entry.category,justification:entry.justification,declaredCapabilities:[...(entry.capabilities||[])].sort(),directCapabilities:[...result.directCapabilities].sort(),transitiveCapabilities:[...result.allCapabilities].filter((c)=>!result.directCapabilities.has(c)).sort(),detectedCapabilities:capabilityObject(result.allCapabilities),capabilityEdges:result.edges,sourceBehaviorChecks:v.length?"failed":"passed",violations:v});for(const x of v)violations.push({file:result.file,violation:x});}
  for(const file of REQUIRED_SECURITY_FILES){const r=byPath.get(file);if(!r)violations.push({file,violation:"Required runtime security file was not scanned or is missing."});else{const e=map.get(file);if(!e)violations.push({file,violation:"Required runtime security file has no classification."});for(const x of behavioralViolations(r,e,config))violations.push({file,violation:x});}}
  const semanticPaths=new Set(REQUIRED_SECURITY_FILES); const capablePaths=new Set(capable.map((r)=>r.file));
  const stale=[...map.keys()].filter((f)=>!capablePaths.has(f)&&!semanticPaths.has(f)).sort();
  const dedup=[...new Map(violations.map((v)=>[`${v.file}\0${v.violation}`,v])).values()]; const unacceptable=classified.filter((r)=>r.category===6);
  const pass=!unexplained.length&&!unacceptable.length&&!dedup.length;
  return {generatedAt:options.now||new Date().toISOString(),configVersion:config.version,categories:config.categories,governedRecordPrefixes:config.governedRecordPrefixes,approvedAgentExecutionAdapter:APPROVED_AGENT_EXECUTION_ADAPTER,sandboxHelper:SANDBOX_HELPER,assuranceStatement:"AST/import analysis inventories discovered direct and transitive mutation capabilities; unknown or unowned capability fails closed. This is an enforceable inventory, not a claim that textual search proves absence of every bypass.",summary:{mutationCapableFiles:capable.length,classified:classified.length,securityChecks:REQUIRED_SECURITY_FILES.length,unexplained:unexplained.length,unacceptable:unacceptable.length,behavioralViolations:dedup.length,staleClassifications:stale.length,pass},classified:classified.sort((a,b)=>a.file.localeCompare(b.file)),securityChecks:REQUIRED_SECURITY_FILES.map((file)=>({file,status:dedup.some((v)=>v.file===file)?"failed":"passed",detectedCapabilities:byPath.has(file)?capabilityObject(byPath.get(file).allCapabilities):{}})),unexplained:unexplained.sort((a,b)=>a.file.localeCompare(b.file)),unacceptable,behavioralViolations:dedup.sort((a,b)=>a.file.localeCompare(b.file)||a.violation.localeCompare(b.violation)),staleClassifications:stale};
}
module.exports={APPROVED_AGENT_EXECUTION_ADAPTER,CAPABILITIES,REQUIRED_SECURITY_FILES,SANDBOX_HELPER,analyzeJs,run};
if(require.main===module){const report=run();fs.mkdirSync(path.dirname(defaultReportPath),{recursive:true});fs.writeFileSync(defaultReportPath,`${JSON.stringify(report,null,2)}\n`,`utf8`);console.log(`Capability audit: ${report.summary.mutationCapableFiles} capable files, ${report.summary.classified} owned, ${report.summary.unexplained} unexplained, ${report.summary.behavioralViolations} violations.`);if(!report.summary.pass){for(const x of report.unexplained)console.error(`Unexplained: ${x.file}`);for(const x of report.behavioralViolations)console.error(`Violation: ${x.file}: ${x.violation}`);process.exit(1);}console.log("Capability audit passed: every discovered direct or transitive capability is classified, owned, and traced to reviewed primitives.");}
