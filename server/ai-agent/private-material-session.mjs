import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {materialDigest} from './session-material-contract.mjs';
import {assertMaterialSelection} from './private-material-selection.mjs';
import {assertPrivateMaterialPack} from './private-materials.mjs';
import {runOpenCodeSynthesis} from './opencode-synthesis.mjs';
import {PRIVATE_MATERIAL_INSTRUCTION,privateMaterialInput,privateMaterialReservationMaxTokens,acceptPrivateMaterialOutput,verifyPrivateMaterialOutput} from './private-material-output.mjs';
const fail=code=>{throw Object.assign(Error(code),{code,status:409,publicMessage:'本次资料、授权或任务状态已变化，未交付回答。请核对资料后再操作。'});};
export function assertPrivateRuntimeTools(ctx,{privateMaterials=false}={}){
 if(!ctx?.kbAgent||ctx.agentKind!=='research'||!Array.isArray(ctx.tools)||!ctx.tools.includes('knowledge.search')||ctx.tools.some(k=>!['knowledge.search','file.read'].includes(k))||privateMaterials&&!ctx.tools.includes('file.read'))fail('HUB_PRIVATE_RUNTIME_TOOLS_CHANGED');
}
export function createPrivateMaterialSession({root,tenantId,routing,reader,transaction,executionCurrent,runSynthesis=runOpenCodeSynthesis,filterText=text=>text}){
 const owner=(u,sid)=>({tenantId,accountId:u.accountId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,sessionId:sid});
 async function instruction(){
  const method=await readFile(join(root,'skill/doubao-medical-literature-interpretation/SKILL.md'),'utf8');
  const core=method.slice(method.indexOf('## 5.'),method.indexOf('## 6.'));
  if(!core.trim())fail('HUB_SKILL_SOURCE_CHANGED');
  return core+'\n【ResearchHub本人资料执行适配，优先于原平台交付要求，不创建外部文档】\n'+PRIVATE_MATERIAL_INSTRUCTION;
 }
 async function validateInTx(tx,turn,{read=false}={}){
  if(turn.user.tenantId!==tenantId||turn.skillRoute?.decision?.mode!=='hub-private-materials')fail('HUB_PRIVATE_CONTEXT_CHANGED');
  await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute,read);
  if(!read)await executionCurrent(turn,tx);
  const job=await tx.knowledgeChatJob.findFirst({where:{...owner(turn.user,turn.sessionId),id:turn.jobId,status:read?'completed':'processing'}});
  if(!job)fail('HUB_PRIVATE_JOB_CHANGED');
  const pack=assertPrivateMaterialPack(job.payload?.hubPrivateEvidence),selection=assertMaterialSelection(job.payload?.hubPrivateSelection,turn.user,turn.sessionId);
  if(pack.packHash!==turn.privateMaterials?.packHash||materialDigest(pack.binding.principal)!==materialDigest(selection.principal)||pack.binding.sessionId!==selection.sessionId||pack.sources.length!==selection.materials.length)fail('HUB_PRIVATE_PACK_CHANGED');
  for(const s of pack.sources){const m=selection.materials.find(m=>m.materialId===s.materialId);if(!m||m.kbId!==s.kbId||m.sourceFileId!==s.sourceFileId||m.sourceSha256!==s.sourceSha256||m.docId&&(m.docId!==s.docId||m.docVersion!==s.docVersion||m.contentSha256!==s.contentSha256))fail('HUB_PRIVATE_PACK_CHANGED');}
  await reader.assertCurrentInTx(tx,turn.user,turn.sessionId,pack);return job;
 }
 const validate=turn=>transaction(tx=>validateInTx(tx,turn),turn.user);
 async function historyInTx(tx,user,session,message){
  const job=await tx.knowledgeChatJob.findFirst({where:{...owner(user,session.id),assistantMessageId:message.id,status:'completed'}});
  const provenance=message.meta?.provenance;
  if(!job||!provenance?.privateMaterials||provenance.privateRuntime?.runtime!=='hub-opencode'||provenance.privateRuntime.providerCalls!==1)fail('HUB_PRIVATE_HISTORY_CHANGED');
  const pack=job.payload?.hubPrivateEvidence;
  const turn={user,sessionId:session.id,jobId:job.id,skillRoute:job.payload?.hubSkillRoute,privateMaterials:pack};
  await validateInTx(tx,turn,{read:true});
  if(provenance.privateMaterials.packHash!==pack.packHash)fail('HUB_PRIVATE_HISTORY_CHANGED');
  verifyPrivateMaterialOutput(provenance.privateMaterialOutput,pack,message.content);return pack;
 }
 return {
  async prepare(turn){
   const pack=await transaction(async tx=>{
    const job=await tx.knowledgeChatJob.findFirst({where:{...owner(turn.user,turn.sessionId),id:turn.jobId,status:'processing'}});
    const pack=job?.payload?.hubPrivateEvidence;await validateInTx(tx,{...turn,privateMaterials:pack});return pack;
   },turn.user);
   turn.privateInstruction=await instruction();
   turn.privateInput=privateMaterialInput(turn.query,pack);turn.privateMaterials=pack;
   await validate(turn);return pack;
  },
  validate,validateInTx,
  estimateReservation:async(pack,question)=>privateMaterialReservationMaxTokens(await instruction(),privateMaterialInput(question,pack)),
  reservationMaxTokens:turn=>privateMaterialReservationMaxTokens(turn.privateInstruction,turn.privateInput),
  async synthesize(turn,providerCall){
   await validate(turn);turn.signal?.throwIfAborted();
   // Actual current PG read, not a fabricated OpenCode builtin-tool event.
   turn.privateTools=[{tool:'private_material_read',permission:'file.read',executedBy:'hub-controlled-evidence-adapter',at:new Date().toISOString(),status:'succeeded',packHash:turn.privateMaterials.packHash,materialIds:turn.privateMaterials.sources.map(s=>s.materialId)}];
   const result=await runSynthesis({root,tenantId,instruction:turn.privateInstruction,text:turn.privateInput,signal:turn.signal,
    authorize:async()=>{await validate(turn);turn.signal?.throwIfAborted();return true;},providerCall});
   turn.privateRuntime=result.runtimeEvidence;return result;
  },
  accept(turn,result){
   const accepted=acceptPrivateMaterialOutput(result.text,turn.privateMaterials);
   // Do not mutate cited text after rendering/receipt; check the same business
   // data boundary first, and reject if it would have changed the model prose.
   for(const section of accepted.validation.response.sections)if(filterText(section.text)!==section.text)fail('HUB_PRIVATE_DATA_BOUNDARY');
   result.text=accepted.text;turn.privateMaterialOutput=accepted.validation;
  },
  provenance:turn=>({answerScope:'fixed-owner-private-materials',hubSources:[],hubTools:turn.privateTools,privateMaterials:{schema:'hub-private-provenance.v1',packHash:turn.privateMaterials.packHash},privateMaterialOutput:turn.privateMaterialOutput,privateRuntime:turn.privateRuntime}),
  async project(user,session,messages){return Promise.all(messages.map(async m=>{
   if(!m.meta?.provenance?.privateMaterials)return m;
   try{const pack=await transaction(tx=>historyInTx(tx,user,session,m),user);
    // Verify the original historical receipt above, then project a current
    // source-checked view. Never rewrite its saved response or usage ledger.
    const current=acceptPrivateMaterialOutput(JSON.stringify(m.meta.provenance.privateMaterialOutput.response),pack);
    return{...m,content:current.text,meta:{...m.meta,sourceStatus:'current',privateMaterialDisplayPolicy:current.validation.policy,provenance:{...m.meta.provenance,privateMaterialEvidence:pack}}};}
   catch{return{...m,content:'此回答的资料或访问授权已变化，当前不能展示原回答。请核对资料后重新提问。',meta:{sourceStatus:'restricted'}};}
  }));},
  async source(user,session,message,index){
   const n=Number(index);if(!Number.isSafeInteger(n)||n<1)fail('HUB_PRIVATE_SOURCE_INVALID');
   const pack=await transaction(tx=>historyInTx(tx,user,session,message),user);if(!pack.sources[n-1])fail('HUB_PRIVATE_SOURCE_INVALID');return{...pack.sources[n-1],index:n,status:'current',packHash:pack.packHash};
  },
 };
}
