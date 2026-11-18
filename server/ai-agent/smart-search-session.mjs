import {routeDigest} from './skill-routing.mjs';
import {SMART_POLICY_HASH,LEGACY_SMART_POLICY_HASH,webCandidateAnswer} from './smart-search-contract.mjs';
import {assertGroundingReceipt} from './smart-search-grounding.mjs';
import {runSmartSearch} from './smart-search-runtime.mjs';
const fail=()=>{throw Error('HUB_WEB_CONTEXT_CHANGED');},signed=body=>({...body,hash:routeDigest(body)});
function checked(value,schema){if(!value||value.schema!==schema)fail();const {hash,...body}=value;if(hash!==routeDigest(body)||![SMART_POLICY_HASH,LEGACY_SMART_POLICY_HASH].includes(value.policyHash))fail();return value;}
export function assertWebEvidence(value){
 checked(value,'hub-web-evidence.v1');
 if(!Array.isArray(value.sources)||!value.sources.length||new Set(value.sources.map(s=>s.id)).size!==value.sources.length||value.sources.some(s=>!/^W\d+$/.test(s.id)||!s.url?.startsWith('https://')||typeof s.text!=='string'))fail();return value;
}
export function createSmartSearchSession({root,tenantId,transaction,routing,executionCurrent=async()=>{},run=runSmartSearch}){
 const owned=(user,sid)=>({tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId:sid});
 async function jobInTx(tx,turn){
  if(turn.user.tenantId!==tenantId||turn.skillRoute.decision.mode!=='hub-smart-search')fail();
  await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);await executionCurrent(turn,tx);
  const job=await tx.knowledgeChatJob.findFirst({where:{...owned(turn.user,turn.sessionId),id:turn.jobId,status:'processing'}});if(!job)fail();return job;
 }
 async function parentInTx(tx,turn,id){
  const parent=await tx.knowledgeChatJob.findFirst({where:{...owned(turn.user,turn.sessionId),id,status:'completed'}});
  if(!parent?.payload?.hubWebEvidence)fail();await routing.validateInTx(tx,turn.user,turn.sessionId,id,parent.payload.hubSkillRoute,true);
  return assertWebEvidence(parent.payload.hubWebEvidence);
 }
 async function validateInTx(tx,turn){
  const job=await jobInTx(tx,turn),context=checked(job.payload.hubWebContext,'hub-web-context.v1');
  if(context.policyHash!==SMART_POLICY_HASH||context.hash!==turn.web.hash||context.routeHash!==turn.skillRoute.snapshotHash||context.queryHash!==routeDigest(turn.query))fail();
  if(context.parentJobId){const parent=await parentInTx(tx,turn,context.parentJobId);if(parent.hash!==context.parentHash||routeDigest(parent.sources)!==routeDigest(context.sources))fail();}
  if(turn.webEvidence&&assertWebEvidence(job.payload.hubWebEvidence).hash!==turn.webEvidence.hash)fail();return job;
 }
 const validate=turn=>transaction(tx=>validateInTx(tx,turn),turn.user);
 return{
  async prepare(turn){return transaction(async tx=>{
   const job=await jobInTx(tx,turn);if(job.payload.hubWebContext){const saved=checked(job.payload.hubWebContext,'hub-web-context.v1');await validateInTx(tx,{...turn,web:saved});return saved;}
   const frozen=turn.skillRoute.decision.scope==='fixed-web-snapshot',parent=frozen?await parentInTx(tx,turn,turn.skillRoute.decision.previousJobId):null;
   const context=signed({schema:'hub-web-context.v1',policyHash:SMART_POLICY_HASH,routeHash:turn.skillRoute.snapshotHash,queryHash:routeDigest(turn.query),networkEnabled:!frozen,sources:parent?.sources??[],...(parent?{parentJobId:turn.skillRoute.decision.previousJobId,parentHash:parent.hash}:{})});
   const changed=await tx.knowledgeChatJob.updateMany({where:{...owned(turn.user,turn.sessionId),id:turn.jobId,status:'processing',payload:{equals:job.payload}},data:{payload:{...job.payload,hubWebContext:context}}});if(changed.count!==1)fail();return context;
  },turn.user);},validate,validateInTx,
  async execute(turn,options){
   await validate(turn);
   const result=await run({root,tenantId,query:turn.query,sources:turn.web.sources,networkEnabled:turn.web.networkEnabled,...options,signal:turn.signal,authorize:async()=>{await validate(turn);await executionCurrent(turn);return true;},authorizeNetwork:()=>routing.assertNetwork(turn.user,turn.sessionId,turn.jobId)});
   const evidence=signed({schema:'hub-web-evidence.v1',policyHash:SMART_POLICY_HASH,contextHash:turn.web.hash,routeHash:turn.skillRoute.snapshotHash,sources:result.sources,tools:result.tools,runtime:result.runtimeEvidence,createdAt:new Date().toISOString()});assertWebEvidence(evidence);
   await transaction(async tx=>{const job=await validateInTx(tx,turn);if(job.payload.hubWebEvidence)fail();const changed=await tx.knowledgeChatJob.updateMany({where:{...owned(turn.user,turn.sessionId),id:turn.jobId,status:'processing',payload:{equals:job.payload}},data:{payload:{...job.payload,hubWebEvidence:evidence}}});if(changed.count!==1)fail();},turn.user);
   turn.webEvidence=evidence;turn.webOutput=result.validation;return result;
  },
  provenance(turn,text){return{answerScope:'public-web-snapshot',hubSources:[],hubTools:turn.webEvidence.tools,webEvidence:turn.webEvidence,webOutput:{...turn.webOutput,textHash:routeDigest(text)}};},
  async project(user,session,messages){return Promise.all(messages.map(async message=>{
   const p=message.meta?.provenance;if(!p?.webEvidence)return message;
   try{await transaction(async tx=>{
    const job=await tx.knowledgeChatJob.findFirst({where:{...owned(user,session.id),assistantMessageId:message.id,status:'completed'}});if(!job)fail();
    await routing.validateInTx(tx,user,session.id,job.id,job.payload.hubSkillRoute,true);
    const e=assertWebEvidence(job.payload.hubWebEvidence),context=checked(job.payload.hubWebContext,'hub-web-context.v1');
    if(e.hash!==assertWebEvidence(p.webEvidence).hash||e.contextHash!==context.hash||e.runtime.runtime!=='hub-opencode'||e.policyHash!==context.policyHash||p.webOutput?.policyHash!==e.policyHash||p.webOutput.sourcesHash!==routeDigest(e.sources)||p.webOutput.textHash!==routeDigest(message.content))fail();
    if(context.policyHash===SMART_POLICY_HASH){
     if(p.webOutput.status==='candidate-only'){if(p.webOutput.textHash!==webCandidateAnswer(e.sources).validation.textHash)fail();}
     else assertGroundingReceipt(p.webOutput,e.sources);
    }
    if(context.parentJobId){const parent=await parentInTx(tx,{user,sessionId:session.id},context.parentJobId);if(parent.hash!==context.parentHash)fail();}
   },user);return{...message,meta:{...message.meta,sourceStatus:'snapshot'}};
   }catch{return{...message,content:'此回答的访问授权或网页证据快照已变化，当前无法交付。',meta:{sourceStatus:'restricted'}};}
  }));},
 };
}
