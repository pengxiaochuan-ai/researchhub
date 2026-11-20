import {randomUUID} from 'node:crypto';
import {protectAttempt} from './attempt-protection.mjs';
import {finishAttempt,sealExecution,blockExecution} from './attempts.mjs';

// Hub instance adapter only. Native Sessions owns the successful publication
// transaction; only its exception callbacks may settle an undelivered result.
export function createAccountedRuntime({native,service,context,transaction,authorize,reservationMaxTokens,ledger={protect:protectAttempt,finish:finishAttempt,seal:sealExecution,block:blockExecution}}){
 function state(user,id){
  const turn=context.getStore(),s=turn?.tokenExecution;
  if(!s||s.binding.accountId!==user?.accountId||s.binding.tenantId!==user?.tenantId||s.binding.reservationId!==id)throw Error('HUB_TOKEN_CONTEXT_REQUIRED');
  return s;
 }
 async function failed(user,id,input){
  const s=state(user,id);
  if(!s.started)return input?native.holdTokenQuotaForReconciliation(user,id,input):native.releaseTokenQuota(user,id);
  // A receipt write/settlement fault must never fall back to a zero-use release.
  try{
   await transaction(async tx=>{if(s.inconsistent)await ledger.block(tx,s.binding);return ledger.seal(tx,s.binding);});
   if(!s.inconsistent){const settled=await service.settleFailure(user,id);if(settled)return settled;}
  }catch{ /* Durable protection remains; native hold keeps it visible. */ }
  return native.holdTokenQuotaForReconciliation(user,id,input??{reason:'模型调用结果需核验',source:'hub-durable-attempt',target:s.binding.sessionId});
 }
 const billing=new Proxy(native,{get(target,key){
  if(key==='reserveTokenQuota')return async(user,...args)=>{
   const turn=context.getStore();
   if(!turn?.execution?.claim||turn.user?.accountId!==user.accountId||turn.user?.tenantId!==user.tenantId)throw Error('HUB_TOKEN_CONTEXT_REQUIRED');
   if(reservationMaxTokens){const requestedMaxTokens=args[0],bounded=await reservationMaxTokens({turn,requestedMaxTokens});if(!Number.isSafeInteger(bounded)||bounded<requestedMaxTokens)throw Error('HUB_TOKEN_RESERVATION_INPUT');args[0]=bounded;}
   const r=await target.reserveTokenQuota(user,...args);
   const claim=turn.execution.claim;
   turn.tokenExecution={started:false,reservedTokens:r.reservedTokens,binding:{tenantId:user.tenantId,accountId:user.accountId,reservationId:r.id,jobId:turn.jobId,sessionId:turn.sessionId,executionToken:claim.executionToken,workerOwner:claim.workerOwner}};
   return r;
  };
  if(key==='releaseTokenQuota')return(user,id)=>failed(user,id);
  if(key==='holdTokenQuotaForReconciliation')return(user,id,input)=>failed(user,id,input);
  if(key==='settleTokenQuotaInTransaction')return async(tx,user,id,actual,mock)=>{
   const s=state(user,id);
   if(s.started){
    const sealed=await ledger.seal(tx,s.binding);
    const u=sealed.usage,expected=s.resultUsage;
    const models=u?Object.keys(u.byModel).sort():[],nativeModels=expected?.byModel?Object.keys(expected.byModel).sort():[];
    const matching=!!(u&&!mock&&u.totalTokens===actual&&['promptTokens','completionTokens','totalTokens','callCount'].every(k=>expected?.[k]===u[k])&&expected.primaryModel===u.model&&JSON.stringify(models)===JSON.stringify(nativeModels)&&models.every(m=>['prompt','completion','total','calls'].every(k=>u.byModel[m][k]===expected.byModel[m]?.[k])));
    if(!matching){s.inconsistent=true;throw Error('HUB_TOKEN_USAGE_MISMATCH');}
   }
   return target.settleTokenQuotaInTransaction(tx,user,id,actual,mock);
  };
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 async function dispatch(send,model='deepseek-v4-pro'){
  const turn=context.getStore(),s=turn?.tokenExecution;
  if(!s||!turn.execution?.claim)throw Error('HUB_TOKEN_CONTEXT_REQUIRED');
  const binding={...s.binding,attemptId:randomUUID(),model};
  let callbackCompleted=false;
  try{await transaction(async tx=>{
    await authorize(tx,turn);
    await ledger.protect(tx,{user:turn.user,...binding,claim:turn.execution.claim});
    callbackCompleted=true;
   });s.started=true;
  }catch(e){
   // No HTTP is sent before commit. A rejected callback cannot have committed;
   // a lost commit acknowledgement may have, so retain protection in that case.
   if(callbackCompleted)s.started=true;
   throw e;
  }
  let response,raw;
  try{response=await send();raw=await response.clone().json();}
  catch(reason){await transaction(tx=>ledger.finish(tx,binding,{}));throw reason;}
  const u=raw?.usage;
  await transaction(tx=>ledger.finish(tx,binding,{httpStatus:response.status,usage:u?{promptTokens:u.prompt_tokens,completionTokens:u.completion_tokens,totalTokens:u.total_tokens}:undefined}));
  return response;
 }
 return{billing,dispatch};
}
