import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createSessionSkillRouting} from './session-skill-routing.mjs';import {routeReceipt} from './session-skill-routing.mjs';
const api=await import('./general-conversation.mjs').catch(()=>({}));
const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/runtime.json'));
test('real PG binds ordinary context to completed own turns, preserves usage and rejects changed history or identity',async()=>{
 assert.equal(typeof api.createGeneralConversation,'function','ordinary conversation execution is missing');
 const rollback=Error('ROLLBACK_GENERAL_CHAT');
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true)",ids.tenant,ids.group,ids.project);
  const account=await tx.account.findUnique({where:{id:ids.admin}}),u={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,authVersion:account.authVersion};
  const sid='rh-aiq-general-'+randomUUID();await tx.session.create({data:{...u,authVersion:undefined,id:sid,agentId:ids.tenant+'-kb-research',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID(),channel:'knowledge'}});
  const routing=createSessionSkillRouting({tenantId:ids.tenant,agentId:ids.tenant+'-kb-research',catalog:{skills:[]},contextOf:()=>({kind:'hub'}),transaction:fn=>fn(tx),effectiveInTx:async(_tx,user)=>{assert.equal(user.accountId,ids.admin);return{items:[]};},verifySource:async()=>true});
  const service=api.createGeneralConversation({tenantId:ids.tenant,root:new URL('../../',import.meta.url),routing,transaction:fn=>fn(tx),runSynthesis:async args=>{assert.equal(await args.authorize(),true);const result=await args.providerCall([{role:'system',content:args.instruction},{role:'user',content:args.text}]);return{...result,runtimeEvidence:{runtime:'hub-opencode',providerCalls:1}};}});
  const make=async text=>{const requestKey='general-'+randomUUID(),m=await tx.message.create({data:{tenantId:ids.tenant,sessionId:sid,role:'user',content:text}}),payload=await routing.stagePendingInTx(tx,u,{sessionId:sid,text,payload:{kbIds:[]}}),j=await tx.knowledgeChatJob.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,roleSnapshot:account.role,sessionId:sid,requestKey,text,userMessageId:m.id,status:'processing',payload}});return{user:u,sessionId:sid,jobId:j.id,query:text,skillRoute:payload.hubSkillRoute};};
  const first=await make('介绍下你自己');first.general=await service.prepare(first);assert.deepEqual(first.general.history,[]);
  const response={text:'我是岐研AI，可以帮助你明确科研问题。',usage:{promptTokens:30,completionTokens:20,totalTokens:50},usedMock:false};
  let calls=0;const generated=await service.synthesize(first,async messages=>{calls++;assert.equal(messages[0].role,'system');assert(messages[1].content.includes('介绍下你自己'));return response;});assert.equal(calls,1);assert.equal(generated.usage.totalTokens,50);
  const provenance=service.provenance(first,generated.text),m=await tx.message.create({data:{tenantId:ids.tenant,sessionId:sid,role:'assistant',content:generated.text,meta:{provenance:{...provenance,hubSkillRoute:routeReceipt(first.skillRoute)}}}});
  await tx.knowledgeChatJob.update({where:{id:first.jobId},data:{status:'completed',assistantMessageId:m.id}});
  const second=await make('继续');second.general=await service.prepare(second);assert.equal(second.general.history.length,1);assert.equal(second.general.history[0].answer,response.text);
  await tx.knowledgeChatJob.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,roleSnapshot:account.role,sessionId:sid,requestKey:'later-'+randomUUID(),text:'后续独立科研任务夹具',userMessageId:(await tx.knowledgeChatJob.findUnique({where:{id:second.jobId}})).userMessageId,status:'completed',createdAt:new Date(Date.now()+1000),payload:{hubSkillRoute:{skill:{key:'doubao-medical-literature-search'},decision:{anchorQuestion:'针灸 抑郁',mode:'existing-reviewed-hub'}}}}});
  await service.validate(second); // Later research must not reclassify the fixed ordinary continuation.
  const session=await tx.session.findUnique({where:{id:sid}});const projected=await service.project(u,session,[m]);assert.equal(projected[0].content,response.text);assert.notEqual(projected[0].meta.sourceStatus,'restricted');
  await assert.rejects(service.validate({...second,user:{...u,accountId:ids.owner}}),/HUB_SKILL_ACCESS_DENIED/);
  await tx.message.update({where:{id:m.id},data:{content:'被另一个请求修改'}});await assert.rejects(service.validate(second),/HUB_GENERAL_/);
  throw rollback;
 }),e=>e===rollback);
});
