import {materialDigest} from './session-material-contract.mjs';
import {VIDEO_MODE,VIDEO_INSTRUCTION,assertVideoPack,videoModelInput,acceptVideoOutput,verifyVideoOutput,videoDisplaySections,videoFail as fail} from './video-chat-contract.mjs';
import {privateMaterialReservationMaxTokens} from './private-material-output.mjs';
import {runOpenCodeSynthesis} from './opencode-synthesis.mjs';
export function projectVideoCommand(message){
 const c=message.meta?.hubCommand;if(!c)return message;
 const clean=value=>{if(!value||typeof value!=='object')return value;const{hubMediaSelection,...safe}=value;return safe;};
 return{...message,meta:{...message.meta,hubCommand:{...clean(c),...(Array.isArray(c.revisions)?{revisions:c.revisions.map(clean)}:{})}}};
}
export function createVideoChatSession({root,tenantId,reader,routing,transaction,executionCurrent,filterText=t=>t,runSynthesis=runOpenCodeSynthesis}){
 const owner=(u,sid)=>({tenantId,accountId:u.accountId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,sessionId:sid});
 async function validateInTx(tx,turn,{read=false}={}){
  if(turn.user.tenantId!==tenantId||turn.skillRoute?.decision?.mode!==VIDEO_MODE)fail('VIDEO_CONTEXT_CHANGED');
  await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute,read);if(!read)await executionCurrent(turn,tx);
  const job=await tx.knowledgeChatJob.findFirst({where:{...owner(turn.user,turn.sessionId),id:turn.jobId,status:read?'completed':'processing'}});if(!job)fail('VIDEO_JOB_CHANGED');
  const p=assertVideoPack(job.payload?.hubMediaEvidence,turn.user,turn.sessionId),s=assertVideoPack(job.payload?.hubMediaSelection,turn.user,turn.sessionId);
  if(p.packHash!==s.packHash||turn.mediaPack&&turn.mediaPack.packHash!==p.packHash)fail('VIDEO_PACK_CHANGED');
  await reader.prepareInTx(tx,turn.user,turn.sessionId,s);return p;
 }
 async function validate(turn){const p=await transaction(tx=>validateInTx(tx,turn),turn.user);await reader.verifySource(turn.user,turn.sessionId,p);return p;}
 async function history(user,session,message){
  const p=await transaction(async tx=>{
   const job=await tx.knowledgeChatJob.findFirst({where:{...owner(user,session.id),assistantMessageId:message.id,status:'completed'}}),v=message.meta?.provenance;
   if(!job||!v?.videoContent||v.videoRuntime?.runtime!=='hub-opencode'||v.videoRuntime.providerCalls!==1)fail('VIDEO_HISTORY_CHANGED');
   const pack=await validateInTx(tx,{user,sessionId:session.id,jobId:job.id,skillRoute:job.payload.hubSkillRoute,mediaPack:job.payload.hubMediaEvidence},{read:true});
   if(v.videoContent.packHash!==pack.packHash)fail('VIDEO_HISTORY_CHANGED');verifyVideoOutput(v.videoOutput,pack,message.content);return pack;
  },user);await reader.verifySource(user,session.id,p);return p;
 }
 return{captureInTx:reader.captureInTx,prepareInTx:reader.prepareInTx,validateInTx,validate,
  async prepare(turn){const p=await validate(turn);turn.mediaPack=p;turn.videoInstruction=VIDEO_INSTRUCTION;turn.videoInput=videoModelInput(turn.query,p);return p;},
  estimateReservation:(p,q)=>privateMaterialReservationMaxTokens(VIDEO_INSTRUCTION,videoModelInput(q,p)),
  reservationMaxTokens:t=>privateMaterialReservationMaxTokens(t.videoInstruction,t.videoInput),
  async synthesize(turn,providerCall){
   await validate(turn);turn.signal?.throwIfAborted();
   // This is a real controlled PG evidence read, recorded independently of
   // the OpenCode model trace. No raw video/file path reaches the Provider.
   await reader.execute(turn.user,turn.sessionId,turn.mediaPack);
   turn.videoTools=[{tool:'media_content_read',permission:'file.read',executedBy:'hub-controlled-media-adapter',at:new Date().toISOString(),status:'succeeded',packHash:turn.mediaPack.packHash,mediaId:turn.mediaPack.mediaId,runId:turn.mediaPack.runId,evidenceIds:turn.mediaPack.sources.map(s=>s.evidenceId)}];
   const r=await runSynthesis({root,tenantId,instruction:turn.videoInstruction,text:turn.videoInput,signal:turn.signal,providerCall,authorize:async()=>{await validate(turn);turn.signal?.throwIfAborted();return true;}});turn.videoRuntime=r.runtimeEvidence;return r;
  },
  accept(turn,r){const accepted=acceptVideoOutput(r.text,turn.mediaPack,{filterText});r.text=accepted.text;turn.videoOutput=accepted.validation;},
  provenance:t=>({answerScope:'selected-transcript-and-sampled-frames',hubSources:[],hubTools:t.videoTools,videoContent:{schema:'hub-video-provenance.v1',packHash:t.mediaPack.packHash},videoOutput:t.videoOutput,videoRuntime:t.videoRuntime}),
  async project(user,session,messages){return Promise.all(messages.map(projectVideoCommand).map(async m=>{
   if(!m.meta?.provenance?.videoContent)return m;
   try{const p=await history(user,session,m),display=acceptVideoOutput(JSON.stringify({sections:videoDisplaySections(m.meta.provenance.videoOutput.sections)}),p,{filterText});return{...m,content:display.text,meta:{...m.meta,sourceStatus:'current',videoDisplayPolicy:'hub-video-display.v2',provenance:{...m.meta.provenance,videoOutput:display.validation,videoEvidence:p}}};}
   catch(e){if(!e.status||e.status>=500)throw e;return{...m,content:'此回答的视频、版本或访问权限已变化，当前不能展示原解释。请核对原视频。',meta:{sourceStatus:'restricted'}};}
  }));},
 };
}
