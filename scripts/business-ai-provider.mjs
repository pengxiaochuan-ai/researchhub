// Local adapter boundary; the old Sessions/Billing implementation owns accounting.
export async function runBusinessProvider(turn,call,{validate,recordRejectedUsage}={}){
 let result;
 try{result=await call();await validate?.(result);return result;}
 catch(reason){
  turn.providerFailure=true;turn.providerError=reason;
  // Native Orchestrator has not received this result, so its accumulator cannot
  // report it. Keep known actual usage in Sessions' existing reconciliation path.
  if(result&&!result.usedMock&&result.usage)recordRejectedUsage?.(result);
  throw reason;
 }
}
export function assertBusinessProviderOutcome(turn){
 if(turn.providerError)throw turn.providerError;
 if(turn.providerFailure)throw Error('QA_MODEL_FAILED');
}
