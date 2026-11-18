import {routeDigest} from './skill-routing.mjs';
import {GENERAL_MODE,GENERAL_POLICY_HASH,GENERAL_INSTRUCTION} from './general-conversation-policy.mjs';
import {runOpenCodeSynthesis} from './opencode-synthesis.mjs';
const fail=()=>{throw Error('HUB_GENERAL_CONTEXT_CHANGED');};
const signed=data=>({...data,hash:routeDigest(data)});
const check=value=>{if(!value||value.schema!=='hub-general-context.v1')fail();const{hash,...data}=value;if(hash!==routeDigest(data)||data.policyHash!==GENERAL_POLICY_HASH)fail();return value;};
export function createGeneralConversation({root,tenantId,routing,transaction,runSynthesis=runOpenCodeSynthesis}){
 const owned=(user,sid)=>({tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId:sid});
 async function jobInTx(tx,turn){
  if(turn.user.tenantId!==tenantId||turn.skillRoute.decision.mode!==GENERAL_MODE)fail();
  await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);
  const j=await tx.knowledgeChatJob.findFirst({where:{...owned(turn.user,turn.sessionId),id:turn.jobId,status:'processing'}});if(!j)fail();return j;
 }
 async function historyTurn(tx,user,sid,j){
  await routing.validateInTx(tx,user,sid,j.id,j.payload?.hubSkillRoute,true);
  const m=await tx.message.findFirst({where:{id:j.assistantMessageId,tenantId,sessionId:sid,role:'assistant'}}),p=m?.meta?.provenance;
  if(!m||p?.generalConversation?.policyHash!==GENERAL_POLICY_HASH||p.generalConversation.textHash!==routeDigest(m.content)||p.generalConversation.routeHash!==j.payload.hubSkillRoute.snapshotHash||p.generalRuntime?.runtime!=='hub-opencode')fail();
  return{jobId:j.id,question:j.text,answer:m.content};
 }
 async function validateInTx(tx,turn){
  const j=await jobInTx(tx,turn),stored=check(j.payload?.hubGeneralContext),expected=check(turn.general);
  if(stored.hash!==expected.hash||stored.routeHash!==turn.skillRoute.snapshotHash)fail();
  for(const h of stored.history){
   const prior=await tx.knowledgeChatJob.findFirst({where:{...owned(turn.user,turn.sessionId),id:h.jobId,status:'completed',payload:{path:['hubSkillRoute','decision','mode'],equals:GENERAL_MODE}}});
   if(!prior||routeDigest(await historyTurn(tx,turn.user,turn.sessionId,prior))!==routeDigest(h))fail();
  }
 }
 const validate=turn=>transaction(tx=>validateInTx(tx,turn),turn.user);
 return{
  async prepare(turn){return transaction(async tx=>{
   const j=await jobInTx(tx,turn);if(j.payload?.hubGeneralContext){const saved=check(j.payload.hubGeneralContext);await validateInTx(tx,{...turn,general:saved});return saved;}
   const prior=await tx.knowledgeChatJob.findMany({where:{...owned(turn.user,turn.sessionId),status:'completed',payload:{path:['hubSkillRoute','decision','mode'],equals:GENERAL_MODE},createdAt:{lte:j.createdAt},NOT:{id:j.id}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:6});
   const history=[];for(const old of prior.reverse())history.push(await historyTurn(tx,turn.user,turn.sessionId,old));
   const snapshot=signed({schema:'hub-general-context.v1',policyHash:GENERAL_POLICY_HASH,routeHash:turn.skillRoute.snapshotHash,history});
   const changed=await tx.knowledgeChatJob.updateMany({where:{...owned(turn.user,turn.sessionId),id:j.id,status:'processing',payload:{equals:j.payload}},data:{payload:{...j.payload,hubGeneralContext:snapshot}}});if(changed.count!==1)fail();return snapshot;
  },turn.user);},validate,validateInTx,
  async synthesize(turn,providerCall){
   await validate(turn);
   const result=await runSynthesis({root,tenantId,instruction:GENERAL_INSTRUCTION,text:JSON.stringify({question:turn.query,history:turn.general.history.map(({question,answer})=>({question,answer})),evidence:[],toolsExecuted:[]}),signal:turn.signal,authorize:async()=>{await validate(turn);turn.signal?.throwIfAborted();return true;},providerCall});
   turn.generalRuntime=result.runtimeEvidence;return result;
  },
  provenance(turn,text){return{answerScope:'general-conversation',hubSources:[],hubTools:[],generalRuntime:turn.generalRuntime,generalConversation:{policyHash:GENERAL_POLICY_HASH,routeHash:turn.skillRoute.snapshotHash,contextHash:turn.general.hash,textHash:routeDigest(text)}};},
  async project(user,session,messages){return Promise.all(messages.map(async m=>{
   if(!m.meta?.provenance?.generalConversation)return m;
   try{
    await transaction(async tx=>{
     const j=await tx.knowledgeChatJob.findFirst({where:{...owned(user,session.id),assistantMessageId:m.id,status:'completed',payload:{path:['hubSkillRoute','decision','mode'],equals:GENERAL_MODE}}});
     if(!j||check(j.payload?.hubGeneralContext).hash!==m.meta.provenance.generalConversation.contextHash)fail();await historyTurn(tx,user,session.id,j);
    },user);return{...m,meta:{...m.meta,sourceStatus:'not-applicable'}};
   }catch{return{...m,content:'此回答的访问授权或对话记录已变化，当前无法交付。',meta:{sourceStatus:'restricted'}};}
  }));},
 };
}
