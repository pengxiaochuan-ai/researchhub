// Must be awaited INSIDE the DB transaction. A missed injection is still a rollback.
export async function abortFaultTransaction(callback){
 await callback();
 throw Error('FAULT_INJECTION_NOT_TRIGGERED_ABORT_TRANSACTION');
}
