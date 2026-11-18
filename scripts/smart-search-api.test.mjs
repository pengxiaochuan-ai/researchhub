// Free real HTTP + dedicated synthetic PostgreSQL. Never submits an ON task.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
test('real OFF commands and legacy direct messages cannot create external jobs; conflicting/malformed/foreign input is rejected',{timeout:30000},async()=>{
 const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
 const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=await(pw.request??pw.default.request).newContext(),other=await(pw.request??pw.default.request).newContext(),headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const post=(path,data)=>request.post(base+'/api'+path,{headers,data});
 try{
  for(const [ctx,role]of [[request,'owner'],[other,'admin']])assert.equal((await ctx.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  const session=await(await post('/sessions/hub-source',{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:randomUUID()})).json();assert(session.id);
  const input={text:'通过PubMed实时检索针灸失眠论文',requestKey:'smart-free-'+randomUUID(),kbIds:[]};const created=await(await post(`/sessions/${session.id}/commands`,input)).json();assert.equal(created.networkIntent.enabled,false);
  assert.equal((await post(`/sessions/${session.id}/commands`,{...input,networkIntent:{schema:'hub-network-intent.v1',enabled:true}})).status(),409);
  assert.equal((await post(`/sessions/${session.id}/commands`,{...input,requestKey:randomUUID(),networkIntent:{schema:'hub-network-intent.v1',enabled:'true'}})).status(),400);
  const foreign=await other.get(base+`/api/sessions/${session.id}/commands`,{headers});assert([403,404].includes(foreign.status()));
  let item;for(let n=0;n<12;n++){const state=await(await request.get(base+`/api/sessions/${session.id}/commands`,{headers})).json();item=state.items.find(i=>i.id===created.id);if(item?.status==='paused')break;await new Promise(r=>setTimeout(r,500));}
  assert.equal(item?.pauseCode,'HUB_SKILL_CLARIFICATION');assert.match(item.errorMessage,/智能搜索/);
  const direct=await post(`/sessions/${session.id}/knowledge-messages`,{...input,requestKey:'smart-direct-'+randomUUID()});assert.equal(direct.status(),422);
  assert.equal(await db.knowledgeChatJob.count({where:{tenantId:ids.tenant,sessionId:session.id}}),0);assert.equal(await db.usageRecord.count({where:{tenantId:ids.tenant,sessionId:session.id}}),0);
  await post(`/sessions/${session.id}/commands/${created.id}/cancellation`,{version:item.version});
  writeFileSync('.tmp/smart-search-2026-11-12/s03-off-api.json',JSON.stringify({at:new Date().toISOString(),sessionId:session.id,commandId:created.id,offExternalJobs:0,modelCalls:0,usageRows:0,networkSnapshot:item.networkIntent,pauseCode:item.pauseCode,directStatus:direct.status(),foreignStatus:foreign.status(),passed:true},null,2));
 }finally{await request.dispose();await other.dispose();await db.$disconnect();}
});
