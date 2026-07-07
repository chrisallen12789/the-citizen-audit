const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { defaultExecutionStateRoot } = require("../execution/exclusive-boundary");
const { ensureDirectory, fsyncDirectory } = require("../execution/durable-io");

const VERSION = "1.0.0";
const ID = /^REC-DEC-[A-Z0-9][A-Z0-9-]{2,63}$/;
function filePath(rootDir, decisionId) { if (!ID.test(decisionId || "")) throw new Error("Invalid recovery decision id."); return path.join(defaultExecutionStateRoot(rootDir), "recovery-decisions", `${decisionId}.json`); }
function authorities(rootDir) {
  const p = path.join(rootDir, "kernel", "authority", "approval-authorities.json"); const st = fs.lstatSync(p); if (st.isSymbolicLink() || !st.isFile()) throw new Error("Approval authority registry is not a regular file.");
  const value = JSON.parse(fs.readFileSync(p, "utf8")); if (!value || !Array.isArray(value.authorities)) throw new Error("Approval authority registry is malformed."); return value.authorities;
}
function verifyAuthority(rootDir, actor, authority) {
  if (!authorities(rootDir).some((e) => e.status === "active" && e.type === actor.type && e.id === actor.id && Array.isArray(e.authorities) && e.authorities.includes(authority))) throw new Error(`Recovery actor lacks authority ${authority}.`);
}
function assertRecord(record) {
  const allowed = new Set(["version","decisionId","operation","barrierHash","recoveryActor","recoveryAuthority","approver","decidedAt","recordHash"]);
  if (!record || typeof record !== "object") throw new Error("Recovery decision is malformed.");
  for (const k of Object.keys(record)) if (!allowed.has(k)) throw new Error(`Recovery decision contains undeclared field: ${k}.`);
  if (record.version !== VERSION || !ID.test(record.decisionId || "") || record.operation !== "clear_runtime_isolation_barrier" || !/^[0-9a-f]{64}$/.test(record.barrierHash || "")) throw new Error("Recovery decision fields are invalid.");
  for (const [label,v] of [["recoveryActor",record.recoveryActor],["approver",record.approver]]) if (!v || typeof v.type !== "string" || typeof v.id !== "string" || !v.type || !v.id) throw new Error(`Recovery decision ${label} is invalid.`);
  if (typeof record.recoveryAuthority !== "string" || !record.recoveryAuthority || Number.isNaN(Date.parse(record.decidedAt)) || new Date(record.decidedAt).toISOString() !== record.decidedAt) throw new Error("Recovery decision authority or timestamp is invalid.");
  const {recordHash,...body}=record; if (sha256(canonicalStringify(body)) !== recordHash) throw new Error("Recovery decision hash verification failed."); return record;
}
function recordRecoveryDecision(rootDir,input) {
  const body={version:VERSION,decisionId:input.decisionId,operation:"clear_runtime_isolation_barrier",barrierHash:input.barrierHash,recoveryActor:{type:input.recoveryActor.type,id:input.recoveryActor.id},recoveryAuthority:input.recoveryAuthority,approver:{type:input.approver.type,id:input.approver.id},decidedAt:input.decidedAt||new Date().toISOString()};
  const record={...body,recordHash:sha256(canonicalStringify(body))}; assertRecord(record); verifyAuthority(rootDir,record.recoveryActor,record.recoveryAuthority); verifyAuthority(rootDir,record.approver,record.recoveryAuthority);
  const p=filePath(rootDir,record.decisionId); ensureDirectory(path.dirname(p),0o700); let fd; try{fd=fs.openSync(p,"wx",0o600);fs.writeFileSync(fd,`${canonicalStringify(record)}\n`);fs.fsyncSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);} fsyncDirectory(path.dirname(p)); return Object.freeze({...record,filePath:p});
}
function loadRecoveryDecision(rootDir,decisionId) { const p=filePath(rootDir,decisionId); const st=fs.lstatSync(p); if(st.isSymbolicLink()||!st.isFile())throw new Error("Recovery decision is not a regular file."); const r=assertRecord(JSON.parse(fs.readFileSync(p,"utf8"))); if(r.decisionId!==decisionId)throw new Error("Recovery decision filename/id mismatch."); verifyAuthority(rootDir,r.recoveryActor,r.recoveryAuthority); verifyAuthority(rootDir,r.approver,r.recoveryAuthority); return Object.freeze({...r,filePath:p}); }
module.exports={loadRecoveryDecision,recordRecoveryDecision};
