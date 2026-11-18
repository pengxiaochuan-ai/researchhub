import {materialDigest} from './session-material-contract.mjs';import {assertResearchDataAnalysis,researchDataModelInput} from './research-data-analysis.mjs';
import {DATA_ANALYSIS_INSTRUCTION,acceptResearchDataOutput,verifyResearchDataOutput} from './research-data-output.mjs';import {runOpenCodeSynthesis} from './opencode-synthesis.mjs';
import {privateMaterialReservationMaxTokens} from './private-material-output.mjs';
const scope=['tenantId','accountId','studyGroupId','researchProjectId'];
const fail=(code,message='本批数据、版本或访问权限已变化，请核对原记录后重新发送。')=>{throw Object.assign(Error(code),{code,status:409,publicMessage:message});};
function selection(user,sid,pack){const body={schema:'hub-data-selection.v1',principal:Object.fromEntries(scope.map(k=>[k,user[k]])),sessionId:sid,importId:pack.import.id,importVersion:pack.import.version,packHash:pack.packHash};return{...body,hash:materialDigest(body)};}
function assertSelection(s,user,sid){if(s?.schema!=='hub-data-selection.v1')fail('DATA_ANALYSIS_SELECTION_CHANGED');const{hash,...body}=s;if(hash!==materialDigest(body)||s.sessionId!==sid||!scope.every(k=>s.principal?.[k]===user[k]))fail('DATA_ANALYSIS_SELECTION_CHANGED');return s;}
export function createResearchDataSession({root,tenantId,reader,routing,transaction,executionCurrent,runSynthesis=runOpenCodeSynthesis,filterText=t=>t}){
 if(!reader?.analysisInTransaction||!reader?.currentInTransaction)throw Error('DATA_ANALYSIS_READER_REQUIRED');
 const owner=(u,sid)=>({tenantId,accountId:u.accountId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,sessionId:sid});
 async function prepareInTx(tx,user,sid,s){
  assertSelection(s,user,sid);const p=await reader.analysisInTransaction(tx,user,sid,s.importId);
  if(p.packHash!==s.packHash||p.import.version!==s.importVersion)fail('DATA_ANALYSIS_SOURCE_CHANGED');return assertResearchDataAnalysis(p);
 }
 async function validateInTx(tx,turn,{read=false}={}){
  if(turn.user.tenantId!==tenantId||turn.skillRoute?.decision?.mode!=='hub-research-data')fail('DATA_ANALYSIS_CONTEXT_CHANGED');
  await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute,read);if(!read)await executionCurrent(turn,tx);
  const job=await tx.knowledgeChatJob.findFirst({where:{...owner(turn.user,turn.sessionId),id:turn.jobId,status:read?'completed':'processing'}});if(!job)fail('DATA_ANALYSIS_JOB_CHANGED');
  const p=assertResearchDataAnalysis(job.payload?.hubResearchDataEvidence),s=job.payload?.hubResearchDataSelection;
  if(turn.dataPack&&turn.dataPack.packHash!==p.packHash)fail('DATA_ANALYSIS_PACK_CHANGED');
  const current=await prepareInTx(tx,turn.user,turn.sessionId,s);if(current.packHash!==p.packHash)fail('DATA_ANALYSIS_SOURCE_CHANGED');return p;
 }
 const validate=turn=>transaction(tx=>validateInTx(tx,turn),turn.user);
 async function history(tx,user,session,message){
  const job=await tx.knowledgeChatJob.findFirst({where:{...owner(user,session.id),assistantMessageId:message.id,status:'completed'}}),provenance=message.meta?.provenance;
  if(!job||!provenance?.researchData||provenance.dataRuntime?.runtime!=='hub-opencode'||provenance.dataRuntime.providerCalls!==1)fail('DATA_ANALYSIS_HISTORY_CHANGED');
  const p=await validateInTx(tx,{user,sessionId:session.id,jobId:job.id,skillRoute:job.payload.hubSkillRoute,dataPack:job.payload.hubResearchDataEvidence},{read:true});if(provenance.researchData.packHash!==p.packHash)fail('DATA_ANALYSIS_HISTORY_CHANGED');verifyResearchDataOutput(provenance.researchDataOutput,p,message.content);return p;
 }
 const evidence=p=>({schema:'hub-data-evidence.v1',packHash:p.packHash,resultId:'R1',counts:p.counts,study:p.study,importId:p.import.id,sources:p.sources});
 return{
  async captureInTx(tx,user,sid){
   if(user.tenantId!==tenantId)fail('DATA_ANALYSIS_ACCESS_DENIED');
   // Native conversation transactions initialize tenant/group/project, while
   // these Hub-private tables also require the authenticated account GUC.
   await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,user.accountId);
   const [counts]=await tx.$queryRawUnsafe(`SELECT (SELECT count(*)::integer FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND study_group_id=$4 AND research_project_id=$5) AS uploads,(SELECT count(*)::integer FROM rh_ai.session_materials WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND study_group_id=$4 AND research_project_id=$5 AND deleted_at IS NULL) AS materials`,user.tenantId,user.accountId,sid,user.studyGroupId,user.researchProjectId);
   if(!counts?.uploads)return null;if(counts.materials)fail('DATA_ANALYSIS_SCOPE_AMBIGUOUS','本会话同时有资料与研究数据，请分别在对应会话分析；本次未发送任何内容给模型。');
   const current=await reader.currentInTransaction(tx,user,sid);if(current.item?.state!=='committed')fail('DATA_ANALYSIS_NOT_IMPORTED','请先确认本批数据关联的研究并完成导入，再发送数据问题。');
   const p=await reader.analysisInTransaction(tx,user,sid,current.item.id);return selection(user,sid,p);
  },prepareInTx,validate,validateInTx,
  async prepare(turn){const p=await transaction(tx=>validateInTx(tx,turn),turn.user);turn.dataPack=p;turn.dataInstruction=DATA_ANALYSIS_INSTRUCTION;turn.dataInput=researchDataModelInput(turn.query,p);return p;},
  estimateReservation:(p,q)=>privateMaterialReservationMaxTokens(DATA_ANALYSIS_INSTRUCTION,researchDataModelInput(q,p)),
  reservationMaxTokens:t=>privateMaterialReservationMaxTokens(t.dataInstruction,t.dataInput),
  async synthesize(turn,providerCall){
   await validate(turn);turn.signal?.throwIfAborted();turn.dataTools=[{tool:'research_data_result_read',permission:'file.read',executedBy:'hub-controlled-data-adapter',at:new Date().toISOString(),status:'succeeded',packHash:turn.dataPack.packHash,importId:turn.dataPack.import.id}];
   const r=await runSynthesis({root,tenantId,instruction:turn.dataInstruction,text:turn.dataInput,signal:turn.signal,providerCall,authorize:async()=>{await validate(turn);turn.signal?.throwIfAborted();return true;}});turn.dataRuntime=r.runtimeEvidence;return r;
  },
  accept(turn,r){const accepted=acceptResearchDataOutput(r.text,turn.dataPack,{filterText});r.text=accepted.text;turn.dataOutput=accepted.validation;},
  provenance:t=>({answerScope:'fixed-owner-import-results',hubSources:[],hubTools:t.dataTools,researchData:{schema:'hub-data-provenance.v1',packHash:t.dataPack.packHash},researchDataOutput:t.dataOutput,dataRuntime:t.dataRuntime}),
  async project(user,session,messages){return Promise.all(messages.map(async m=>{if(!m.meta?.provenance?.researchData)return m;try{const p=await transaction(tx=>history(tx,user,session,m),user);return{...m,meta:{...m.meta,sourceStatus:'current',provenance:{...m.meta.provenance,researchDataEvidence:evidence(p)}}};}catch{return{...m,content:'此回答的数据、版本或访问权限已变化，当前不能展示原解释。请核对原记录。',meta:{sourceStatus:'restricted'}};}}));},
 };
}
