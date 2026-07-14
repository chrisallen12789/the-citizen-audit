const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const FIELDS = new Set(["id","type","ledgerSequence","ledgerHash","attemptId","transactionId","relatedRecords","recordedAt","data","eventHash"]);
const HASH = /^[0-9a-f]{64}$/;
function validateExecutionEvent(event) {
  const problems=[];
  if(!event||typeof event!=="object"||Array.isArray(event)) return {valid:false,problems:["Execution event must be an object."]};
  for(const key of Object.keys(event)) if(!FIELDS.has(key)) problems.push(`Execution event contains undeclared field: ${key}.`);
  if(!/^EXEC-EVENT-\d{8}$/.test(event.id||"")) problems.push("Execution event id is invalid.");
  if(!/^execution\.attempt\.[a-z_]+$/.test(event.type||"")) problems.push("Execution event type is invalid.");
  if(!Number.isInteger(event.ledgerSequence)||event.ledgerSequence<1) problems.push("Execution event ledgerSequence is invalid.");
  if(!HASH.test(event.ledgerHash||"")) problems.push("Execution event ledgerHash is invalid.");
  if(!/^ATTEMPT-[A-Z0-9-]+$/.test(event.attemptId||"")) problems.push("Execution event attemptId is invalid.");
  if(!/^TX-[A-Z0-9-]+$/.test(event.transactionId||"")) problems.push("Execution event transactionId is invalid.");
  if(!Array.isArray(event.relatedRecords)||event.relatedRecords.length<2||event.relatedRecords.some((v)=>typeof v!=="string"||!v)||new Set(event.relatedRecords).size!==event.relatedRecords.length) problems.push("Execution event relatedRecords is invalid.");
  if(typeof event.recordedAt!=="string"||Number.isNaN(Date.parse(event.recordedAt))||new Date(event.recordedAt).toISOString()!==event.recordedAt) problems.push("Execution event recordedAt is invalid.");
  if(!event.data||typeof event.data!=="object"||Array.isArray(event.data)) problems.push("Execution event data must be an object.");
  if(!HASH.test(event.eventHash||"")) problems.push("Execution event eventHash is invalid.");
  else { const {eventHash,...body}=event; if(sha256(canonicalStringify(body))!==eventHash) problems.push("Execution event hash verification failed."); }
  return {valid:problems.length===0,problems};
}
function assertValidExecutionEvent(event){const r=validateExecutionEvent(event);if(!r.valid){const e=new Error(`Invalid execution event:\n- ${r.problems.join("\n- ")}`);e.code="INVALID_EXECUTION_EVENT";e.problems=r.problems;throw e;}return r;}
function validateExecutionProjection(events){
  if(!Array.isArray(events)) throw new Error("Execution event projection must be an array.");
  const ids=new Set();
  events.forEach((event,index)=>{assertValidExecutionEvent(event);if(ids.has(event.id))throw new Error(`Duplicate execution event id: ${event.id}.`);ids.add(event.id);if(event.ledgerSequence!==index+1)throw new Error(`Execution event sequence mismatch at ${event.id}.`);if(event.id!==`EXEC-EVENT-${String(event.ledgerSequence).padStart(8,"0")}`)throw new Error(`Execution event id is not derived from ledger sequence: ${event.id}.`);});
  return true;
}
module.exports={assertValidExecutionEvent,validateExecutionEvent,validateExecutionProjection};
