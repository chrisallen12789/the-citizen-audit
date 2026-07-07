const { canonicalStringify } = require("../lib/canonical-json");
const { sha256 } = require("../lib/append-only-log");
const { readExecutionLedger, defaultExecutionLedgerPath } = require("../execution/ledger");
const { assertValidExecutionEvent, validateExecutionProjection } = require("./validate");
function eventTypeForEntry(entry) {
  if (entry.recordType === "execution.attempt.created") return "execution.attempt.created";
  if (entry.recordType === "execution.attempt.transitioned") return `execution.attempt.${entry.transition.to}`;
  throw new Error(`Unsupported execution ledger record type: ${entry.recordType}.`);
}
function projectEntry(entry) {
  const isCreated=entry.recordType==="execution.attempt.created";
  const attemptId=isCreated?entry.attempt.id:entry.transition.attemptId;
  const transactionId=isCreated?entry.attempt.transactionId:entry.transition.transactionId;
  const body={id:`EXEC-EVENT-${String(entry.sequence).padStart(8,"0")}`,type:eventTypeForEntry(entry),ledgerSequence:entry.sequence,ledgerHash:entry.hash,attemptId,transactionId,relatedRecords:[transactionId,attemptId],recordedAt:entry.recordedAt,data:isCreated?{writeSetHash:entry.attempt.writeSetHash,actor:entry.attempt.actor}:{from:entry.transition.from,to:entry.transition.to}};
  const event=Object.freeze({...body,eventHash:sha256(canonicalStringify(body))}); assertValidExecutionEvent(event); return event;
}
function projectExecutionEvents(options={}) {
  const ledgerPath=options.ledgerPath||defaultExecutionLedgerPath(options.rootDir);
  const ledger=readExecutionLedger({ledgerPath});
  const events=ledger.entries.map(projectEntry); validateExecutionProjection(events);
  return Object.freeze({events:Object.freeze(events),projectionHash:sha256(canonicalStringify(events.map((e)=>e.eventHash))),count:events.length,ledgerHead:ledger.headHash});
}
function projectionIsDeterministic(options={}){const a=projectExecutionEvents(options);const b=projectExecutionEvents(options);return a.projectionHash===b.projectionHash&&canonicalStringify(a.events)===canonicalStringify(b.events);}
module.exports={projectExecutionEvents,projectionIsDeterministic,projectEntry};
