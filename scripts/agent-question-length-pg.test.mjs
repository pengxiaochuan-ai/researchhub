import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createConversationCommands} from '../server/ai-agent/conversation-commands.mjs';
import {routeSkillTask,bindSkillRoute,routeExecutionInput} from '../server/ai-agent/skill-routing.mjs';
import {runHubSourceSearch} from '../server/hub-sources/agent-retrieval.mjs';
const root='/Users/mac/aisciencesys/',{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
test('guarded real PG rollback: full long/Unicode commands, edits, CAS, dispatch and over-limit no-write',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const rollback=Error('EXPECTED_LENGTH_TEST_ROLLBACK'),sid='rh-question-length-'+randomUUID();
 await assert.rejects(()=>withFixtureTransaction(env,'direct',async tx=>{
  const account=await tx.account.findUnique({where:{id:ids.owner}}),u={tenantId:ids.tenant,accountId:ids.owner,studyGroupId:ids.group,researchProjectId:ids.project,authVersion:account.authVersion,role:account.role};
  await tx.session.create({data:{id:sid,tenantId:ids.tenant,accountId:ids.owner,studyGroupId:ids.group,researchProjectId:ids.project,agentId:ids.tenant+'-kb-research',contextKey:'hub:lingshu-xinyu:conversation:'+randomUUID(),channel:'knowledge'}});
  const scheduled=[],commands=createConversationCommands({tenantId:ids.tenant,consumerKey:sid,transaction:fn=>fn(tx),authorize:async(_tx,actor,id)=>{assert.equal(actor.accountId,ids.owner);assert.equal(id,sid);return actor;},stage:async(_tx,actor,j)=>{
   const decision=routeSkillTask({text:j.text,context:{kind:'hub'},networkIntent:j.payload.networkIntent,smartSearchEnabled:true}),route=bindSkillRoute({user:actor,session:{id:sid,contextKey:'hub:test'},text:j.text,decision,skill:{key:decision.skillKey},sourceBinding:'length-test',networkIntent:j.payload.networkIntent});assert.equal(routeExecutionInput(route,j.text).query,j.text);return{...j.payload,hubSkillRoute:route};
  },schedule:async(...args)=>scheduled.push(args)});
  const question='查询公开网页并保留完整来源：'+('科研问题\n').repeat(30)+'https://www.who.int/news-room/fact-sheets/detail/anxiety-disorders',body={text:question,kbIds:[],requestKey:'length-'+randomUUID(),networkIntent:{schema:'hub-network-intent.v1',enabled:true}};
  const a=await commands.submit(u,sid,body);assert.equal(a.text,question);assert.equal((await commands.submit(u,sid,body)).id,a.id);
  await assert.rejects(commands.submit(u,sid,{...body,text:question+'不同尾部'}),e=>e.status===409);
  const b=await commands.submit(u,sid,{...body,text:'🧪'.repeat(4000),requestKey:'length-'+randomUUID()});assert.equal([...b.text].length,4000);
  const edited=await commands.edit(u,sid,b.id,{text:question+'尾部限定保持',version:b.version});assert.equal(edited.text,question+'尾部限定保持');
  await assert.rejects(commands.edit(u,sid,b.id,{text:question,version:b.version}),e=>e.status===409);
  const count=await tx.message.count({where:{sessionId:sid}});for(const text of ['x'.repeat(4001),'🧪'.repeat(4001)]){
   await assert.rejects(commands.submit(u,sid,{...body,text,requestKey:'length-'+randomUUID()}),e=>e.status===400);
   await assert.rejects(commands.edit(u,sid,b.id,{text,version:edited.version}),e=>e.status===400);
  }assert.equal(await tx.message.count({where:{sessionId:sid}}),count);
  await commands.tick(u,sid);const j=await tx.knowledgeChatJob.findFirst({where:{sessionId:sid}});assert.equal(j.text,question);assert.equal(j.payload.hubSkillRoute.decision.anchorQuestion,question);assert.equal(scheduled.length,1);assert.equal(j.status,'queued');throw rollback;
 }),e=>e===rollback);
 await withFixtureTransaction(env,'direct',async tx=>{assert.equal(await tx.session.count({where:{id:sid}}),0);assert.equal(await tx.message.count({where:{sessionId:sid}}),0);assert.equal(await tx.knowledgeChatJob.count({where:{sessionId:sid}}),0);},{readOnly:true});
});
test('real authorized Agent Hub search accepts long questions without inventing hits or broadening E01',async()=>{
 await assertFixtureTarget(env);await withFixtureTransaction(env,'app',async db=>{await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;const a=await db.account.findUnique({where:{id:ids.owner}}),query=('未匹配合成问题'+randomUUID()).repeat(8),result=await runHubSourceSearch({db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',principal:{tenantId:ids.tenant,accountId:ids.owner,authVersion:a.authVersion},query});assert.equal(result.mutated,false);assert.deepEqual(result.meta.sources,[]);},{readOnly:true});
});
