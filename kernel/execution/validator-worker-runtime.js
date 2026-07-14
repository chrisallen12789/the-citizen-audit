const { parentPort, workerData } = require("worker_threads");
const { createCandidateState } = require("./candidate-state");
const { createLiveState } = require("./live-state");

async function executeValidator(data) {
  const { modulePath, validatorId, validatorVersion, phase, rootDir, transaction, plan, governedBaseline } = data;
  const implementation = require(modulePath);
  if (!implementation || implementation.id !== validatorId || implementation.version !== validatorVersion || typeof implementation.validate !== "function") throw new Error("Validator module contract mismatch.");
  const state = phase === "candidate" ? createCandidateState(rootDir, transaction.proposedWrites) : createLiveState(rootDir);
  return implementation.validate({ rootDir, transaction, plan, phase, state, governedBaseline });
}

function runWorker() {
  executeValidator(workerData).then(
    (result) => parentPort.postMessage({ ok: true, result }),
    (error) => parentPort.postMessage({ ok: false, error: { message: error.message } })
  );
}

module.exports = { executeValidator, runWorker };
