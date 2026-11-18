// Free, read-only replay of the two named prior synthetic tasks. No model call,
// mutation, billing reconciliation, or reinterpretation of stored chat history.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {routeDigest} from '../server/ai-agent/skill-routing.mjs';
import {assertLiteratureEvidence} from '../server/ai-agent/literature-session.mjs';
import {acceptLiteratureOutput} from '../server/ai-agent/literature-output.mjs';
const root='/Users/mac/aisciencesys/',out='.tmp/ai-direction-consistency-2026-11-11',traceDir=root+'.tmp/researchhub-knowledge-local/ai-traces/';
const state=JSON.parse(readFileSync('.tmp/ai-natural-task-2026-11-11/final/live-state.json'));
assert.deepEqual(state.cases.map(c=>c.jobId),['cmwbxgv8g0008lu1uvkfvyqwg','cmwbxhsvf000qlu1u9kpyjlve']);
const live=JSON.parse(readFileSync(out+'/live/live-state.json'));assert(live.passed);assert.deepEqual(live.cases.map(c=>c.jobId),['cmwc111wc0008lu28np51h0x7','cmwc1216g0018lu287tsst533']);
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const db=fixtureClient(env.WP01_TEST_DIRECT_URL),results=[];
const digest=v=>routeDigest(JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x)));
try{for(const c of [...state.cases.map(c=>({...c,stage:'prior'})),...live.cases.map(c=>({...c,stage:'live'}))]){
 const load=async()=>({job:await db.knowledgeChatJob.findFirst({where:{id:c.jobId,tenantId:ids.tenant,accountId:ids[c.role],sessionId:c.sessionId}}),usage:await db.usageRecord.findMany({where:{tenantId:ids.tenant,sessionId:c.sessionId}}),message:await db.message.findUnique({where:{id:(await db.knowledgeChatJob.findUnique({where:{id:c.jobId}})).assistantMessageId}})});
 const before=await load();assert(before.job?.status==='completed');const evidence=assertLiteratureEvidence(before.job.payload.hubLiteratureEvidence);
 const trace=readdirSync(traceDir).filter(f=>f.endsWith('.json')&&!f.endsWith('-runtime.json')).map(f=>JSON.parse(readFileSync(traceDir+f))).find(t=>t.jobId===c.jobId&&t.request?.messages?.some(m=>m.role==='user'&&JSON.parse(m.content).sources));assert(trace);
 const original=JSON.parse(trace.request.messages.find(m=>m.role==='user').content);assert.deepEqual(original.sources,evidence.selected.map(({id,title,text,coverage})=>({id,title,text,coverage})));
 const replay=acceptLiteratureOutput(trace.response[0].message.content,evidence),again=acceptLiteratureOutput(trace.response[0].message.content,structuredClone(evidence));assert.deepEqual(replay,again);
 const issues=replay.validation.directions.flatMap(d=>Object.values(d.consistency).flatMap(c=>c.issues));assert(issues.length>0,'The known prior overgeneralization must be detected');
 if(c.role==='admin'&&c.stage==='prior'){
  assert(issues.some(i=>i.code==='DESIGN_EXCLUSIVITY_CONTRADICTION'));assert(issues.some(i=>i.code==='FOLLOW_UP_OVERGENERALIZED'));
  assert.equal(replay.validation.directionFacts.sources.find(s=>s.id==='P3').design.kind,'randomized-trial');assert.equal(replay.validation.directionFacts.sources.find(s=>s.id==='P1').followUp.state,'reported');
 }
 if(c.stage==='live'&&c.role==='owner'){
  assert.equal(replay.validation.directionFacts.sources.find(s=>s.id==='P4').followUp.state,'reported');
  assert(!replay.validation.items.find(i=>i.id==='P2').consistency.issues.length,'Accurate missing-duration reporting must survive');
  assert(issues.some(i=>i.code==='FOLLOW_UP_DURATION_UNQUALIFIED'));assert(!replay.text.includes('现有研究随访时间短'));assert(!replay.text.includes('未系统比较不同方案组合的长期效果'));
 }
 if(c.stage==='live'&&c.role==='admin')assert(!replay.text.includes('当前材料未同时测量生理和主观结局并分析关联'));
 assert.equal(digest(await load()),digest(before),'Old message, payload, or usage changed');
 const prefix=c.stage==='live'?'live-':'';
 writeFileSync(out+'/'+prefix+c.role+'-replayed-answer.md',replay.text);writeFileSync(out+'/'+prefix+c.role+'-replay-validation.json',JSON.stringify(replay.validation,null,2));
 results.push({stage:c.stage,role:c.role,jobId:c.jobId,evidenceHash:evidence.hash,originalMessageHash:digest(before.message),historyAndUsageUnchanged:true,deterministic:true,issues:issues.map(({code,checkedSourceIds})=>({code,checkedSourceIds}))});
}}finally{await db.$disconnect();}
mkdirSync(out,{recursive:true});writeFileSync(out+'/replay.json',JSON.stringify({passed:true,modelCalls:0,results},null,2));console.log(JSON.stringify({passed:true,modelCalls:0,results}));
