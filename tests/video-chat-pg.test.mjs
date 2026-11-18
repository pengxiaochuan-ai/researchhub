import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalMaterialAccess} from '../scripts/local-session-materials.mjs';import {createSessionMediaContent} from '../server/ai-agent/session-media-content.mjs';import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createVideoChatReader} from '../server/ai-agent/video-chat-reader.mjs';import {createVideoChatSession} from '../server/ai-agent/video-chat-session.mjs';import {createSessionSkillRouting} from '../server/ai-agent/session-skill-routing.mjs';import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
const root=new URL('../../',import.meta.url).pathname,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),scope=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-media-content-implementation-2026-11-17/scope.json')),configHash=materialDigest(JSON.parse(readFileSync(root+'researchhub/.tmp/ai-media-content-implementation-2026-11-17/executor-config.json')));
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k],rollback=Symbol('video-chat-rollback');
test('real synthetic PG rollback: two current video packs, actual reader audit, route/commit/history, owner isolation and tampered new-job payload rejection',async()=>{
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const studies=createResearchStudiesService({prisma:{withTenantTransaction:()=>{throw Error('nested');}},scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('no study creation');}});
  for(const actor of ['owner','admin']){
   await tx.$executeRawUnsafe('RESET ROLE');const account=await tx.account.findUnique({where:{id:ids[actor]}}),u={tenantId:ids.tenant,accountId:account.id,studyGroupId:ids.group,researchProjectId:ids.project,authVersion:account.authVersion,role:account.role,isTenantAdmin:account.isTenantAdmin};
   const current=scope.actors[actor],sid=current.sessionId,mid=current.mediaId;
   await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,u.accountId);
   const [original]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE id=$1`,mid);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
   const access=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)}),service=createSessionMediaContent({access,configHash,authorizeStudy:studies.resolveResearchStudyInTransaction,storage:{statObject:async()=>({size:Number(original.byte_size),metaData:{'aisci-sha256':original.source_sha256,'aisci-media-id':mid,'aisci-account-id':u.accountId,'aisci-session-id':sid}})}});
   const reader=createVideoChatReader({access,service}),routing=createSessionSkillRouting({tenantId:ids.tenant,agentId:ids.tenant+'-kb-research',contextOf:()=>({kind:'hub'}),catalog:{skills:[]},effectiveInTx:async()=>({items:[]}),verifySource:async()=>true,videoContentEnabled:true,transaction:fn=>fn(tx)});
   const p=await reader.captureInTx(tx,u,sid,{text:'解释本视频的口播与画面，说明哪些不能作为疗效证据'});assert.equal(p.sources.length,4);assert.equal(p.mediaId,mid);assert.equal(p.sourceSha256,original.source_sha256);await reader.verifySource(u,sid,p);
   await assert.rejects(reader.prepareInTx(tx,{...u,accountId:ids[actor==='owner'?'admin':'owner']},sid,p),{code:'VIDEO_PACK_CHANGED'});
   const changed={...p,sourceVersion:p.sourceVersion+1};const{packHash,...body}=changed;changed.packHash=materialDigest(body);await assert.rejects(reader.prepareInTx(tx,u,sid,changed),{code:'VIDEO_SOURCE_CHANGED'});
   const payload=await routing.stagePendingInTx(tx,u,{sessionId:sid,text:'解释本视频的口播与画面，说明哪些不能作为疗效证据',payload:{hubMediaSelection:p,hubMediaEvidence:p}});
   const m=await tx.message.create({data:{tenantId:ids.tenant,sessionId:sid,role:'user',content:'解释本视频的口播与画面，说明哪些不能作为疗效证据'}}),job=await tx.knowledgeChatJob.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,roleSnapshot:u.role,sessionId:sid,requestKey:'video-chat-rollback-'+randomUUID(),text:m.content,userMessageId:m.id,status:'processing',payload}});
   const chat=createVideoChatSession({root:root+'researchhub/',tenantId:ids.tenant,reader,routing,transaction:fn=>fn(tx),executionCurrent:async()=>true,runSynthesis:async args=>{await args.authorize();return{text:JSON.stringify({sections:[{kind:'interpretation',text:'口播为合成研究材料的关注点，不能作为疗效证据。',sourceIds:['V1']}]}),runtimeEvidence:{runtime:'hub-opencode',providerCalls:1}};}});
   const turn={user:u,sessionId:sid,jobId:job.id,query:job.text,skillRoute:payload.hubSkillRoute};await chat.prepare(turn);const result=await chat.synthesize(turn,()=>{throw Error('no paid calls');});chat.accept(turn,result);
   const answer=await tx.message.create({data:{tenantId:ids.tenant,sessionId:sid,role:'assistant',content:result.text,meta:{provenance:chat.provenance(turn)}}});await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'completed',assistantMessageId:answer.id}});
   const messages=await chat.project(u,{id:sid},[answer]);assert.equal(messages[0].meta.sourceStatus,'current');assert.equal(messages[0].meta.provenance.videoEvidence.sources.length,4);
   const audit=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,accountId:u.accountId,action:'hub_media_content_tool_read',target:p.runId},orderBy:{createdAt:'desc'}});assert(audit);
   assert.equal((await reader.captureInTx(tx,u,sid,{text:'继续说明为什么不能作为疗效证据'})).packHash,p.packHash);
   assert.equal(await reader.captureInTx(tx,u,sid,{text:'检索PubMed其他针灸研究'}),null);
   await tx.knowledgeChatJob.update({where:{id:job.id},data:{payload:{...payload,hubMediaEvidence:changed}}});assert.equal((await chat.project(u,{id:sid},[answer]))[0].meta.sourceStatus,'restricted');
  }
  throw rollback;
 }),e=>e===rollback);
});
