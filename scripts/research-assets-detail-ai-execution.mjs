// Shared old Agent/provider/billing are injected by the runtime. This adapter
// cannot claim real execution until that runtime and actual request are tested.
import assert from 'node:assert/strict';
export function createAssetDetailAiExecution({withCurrent,readTool,messages,fee,runAgent,dispatch,accept,publish}){
 const current=(user,id,claim,run)=>withCurrent(user,id,claim,async(tx,job,basis)=>{
  assert(job?.id===id&&job.status==='processing'&&job.accountId===user.accountId&&job.payload?.researchAssetDetail?.basisHash===basis?.basisHash,'ASSET_DETAIL_AI_EXECUTION_CHANGED');
  return run(tx,job,basis);
 });
 return{async run(user,id,claim){
  let frozenHash;
  const live=run=>current(user,id,claim,(tx,job,basis)=>{assert(frozenHash===undefined||frozenHash===basis.basisHash,'ASSET_DETAIL_AI_EXECUTION_CHANGED');return run(tx,job,basis);});
  const initial=await live(async(tx,job,basis)=>({basis,proof:await readTool(tx,user,job,basis)}));
  frozenHash=initial.basis.basisHash;
  assert(initial.proof?.toolExecuted===true&&initial.proof.toolName==='asset.fixed_version_read'&&initial.proof.basisHash===initial.basis.basisHash,'ASSET_DETAIL_AI_TOOL_REQUIRED');
  const input=messages(initial.basis),inputBytes=Buffer.byteLength(JSON.stringify(input));assert(inputBytes<=8192,'ASSET_DETAIL_AI_INPUT_CAPACITY');
  let attempted=false;
  const result=await runAgent(user,async provider=>{
   assert(!attempted,'ASSET_DETAIL_AI_NO_RETRY');attempted=true;
   await live(async()=>{});
   const reservation=fee.reserve(id,{inputBytes,maxTokens:1536});let known=false;
   try{
    const r=await dispatch(()=>provider(input,{jsonMode:true,maxTokens:1536}));
    assert(r?.providerOutcome==='known'&&r.usedMock===false&&r.usage,'ASSET_DETAIL_AI_PROVIDER_UNKNOWN');
    // Usage accounting is independent of later source authorization. A revoked
    // result may not be delivered, but a real provider charge may not disappear.
    known=true;fee.settle(reservation.id,r.usage);return r;
   }catch(e){if(!known)fee.unknown(reservation.id);throw e;}
  },{proof:initial.proof,basis:initial.basis});
  assert(attempted,'ASSET_DETAIL_AI_REAL_EXECUTION_REQUIRED');
  const parsed=await live(async(_tx,_job,basis)=>accept(result,basis,initial.proof));
  return live((tx,job,basis)=>publish(tx,user,job,basis,parsed));
 }};
}
