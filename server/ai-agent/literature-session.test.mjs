import test from 'node:test';import assert from 'node:assert/strict';import * as literature from './literature-session.mjs';import {planLiteratureQuery} from './literature-query.mjs';
import {createLiteratureRequest} from './natural-literature-plan.mjs';
import {routeDigest} from './skill-routing.mjs';
function fixture(sourceCount=1){
 const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},route={snapshotHash:'bound',decision:{taskPlan:planLiteratureQuery('仅依据已审核资料，针灸治疗失眠研究有哪些局限？')}};
 let current=true,job={id:'job',tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p',sessionId:'s',status:'processing',payload:{hubSkillRoute:route}};
 const tx={knowledgeChatJob:{findFirst:async()=>job,updateMany:async({data})=>{job={...job,...data};return{count:1};}}};
 let secondRevoked=false;
 const sources=[{index:1,pmcRecordId:'pmc-PMC123',title:'Public title'},{index:2,pmcRecordId:'pmc-PMC456',title:'Second title'}].slice(0,sourceCount),texts=['FIRST_ONLY','SECOND_ONLY'].slice(0,sourceCount);
 const service=literature.createLiteratureSession({root:new URL('../../',import.meta.url),tenantId:'t',transaction:fn=>fn(tx),routing:{validate:async()=>{if(!current)throw Error('revoked');},validateInTx:async()=>{if(!current)throw Error('revoked');}},hubSearch:async()=>({meta:{sources,sourceTexts:texts},result:texts.map((t,i)=>'['+(i+1)+'] '+t).join('\n')}),hubCurrent:async(_u,sources)=>{if(secondRevoked&&sources.some(s=>s.pmcRecordId==='pmc-PMC456'))throw Error('second-revoked');},createMcp:async()=>{throw Error('MCP_MUST_NOT_START');}});
 return{service,user,route,get job(){return job;},revoke:()=>{current=false;},revokeSecond:()=>{secondRevoked=true;}};
}
test('local-only compiled task persists a fixed evidence snapshot and rejects changes or current revocation',async()=>{
 const f=fixture(),turn={user:f.user,sessionId:'s',jobId:'job',skillRoute:f.route};const result=await f.service.prepare(turn);assert.equal(result.selected[0].title,'Public title');assert.equal(f.job.payload.hubLiteratureEvidence.hash,result.hash);await f.service.validate(turn,result);f.job.payload.hubLiteratureEvidence.selected[0].title='forged';await assert.rejects(()=>f.service.validate(turn,result));f.revoke();await assert.rejects(()=>f.service.prepare(turn),/revoked/);
});
test('each visible Hub source owns its exact text and second-source revocation stops delivery',async()=>{
 const f=fixture(2),turn={user:f.user,sessionId:'s',jobId:'job',skillRoute:f.route};const e=await f.service.prepare(turn);assert.equal(e.selected.length,2);assert.equal(e.selected[0].text,'FIRST_ONLY');assert.equal(e.selected[1].text,'SECOND_ONLY');f.revokeSecond();await assert.rejects(()=>f.service.validate(turn,e),/second-revoked/);
});
test('history preserves stored legacy and direction-policy results without reclassifying, but rejects stale sources and changed evidence',async()=>{
 const f=fixture(2),turn={user:f.user,sessionId:'s',jobId:'job',skillRoute:f.route},e=await f.service.prepare(turn),content='原始历史回答：仅一篇随机试验。';
 const message=policy=>({id:'m',content,meta:{provenance:{literatureEvidence:e,literatureOutput:{evidenceHash:e.hash,textHash:routeDigest(content),...(policy?{directionPolicyVersion:policy}:{})},literatureRuntime:{runtime:'hub-opencode'}}}});
 for(const policy of [null,'hub-direction-consistency.v1','hub-direction-consistency.v2','hub-direction-consistency.v3'])assert.equal((await f.service.project(f.user,{id:'s'},[message(policy)]))[0].content,content);
 const changed=structuredClone(message('hub-direction-consistency.v2'));changed.meta.provenance.literatureEvidence.selected[0].text='changed';assert.equal((await f.service.project(f.user,{id:'s'},[changed]))[0].meta.sourceStatus,'restricted');
 f.revokeSecond();assert.equal((await f.service.project(f.user,{id:'s'},[message(null)]))[0].meta.sourceStatus,'restricted');
});
test('continuation objective is present in the actual fixed synthesis input without treating history as evidence',()=>{
 const first=literature.literatureSynthesisInput({query:'针灸 抑郁',literature:{plan:{},selected:[]}}),continued=literature.literatureSynthesisInput({query:'针灸 抑郁',continuationInstruction:'本轮继续展开原用户任务，不把历史AI回答当成证据。',literature:{plan:{},selected:[]}});
 assert.notEqual(first,continued);assert(continued.includes('继续展开'));assert(!continued.includes('historicalAnswer'));
});
function plannedFixture({invalid=false,cas=false,revokeAfter=false,claimLost=false}={}){
 const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},request=createLiteratureRequest('只用Hub检索针灸论文并总结研究方向',{today:'2026-11-11'}),route={snapshotHash:'route',decision:{taskPlan:request}};
 let job={id:'job',payload:{hubSkillRoute:route}},calls=0,current=true,searches=0,claim=true;
 const tx={knowledgeChatJob:{findFirst:async()=>job,updateMany:async({data})=>{if(cas)return{count:0};job={...job,...data};return{count:1};}}},check=()=>{if(!current)throw Error('revoked');};
 const service=literature.createLiteratureSession({root:new URL('../../',import.meta.url),tenantId:'t',transaction:fn=>fn(tx),routing:{validate:check,validateInTx:check},hubCurrent:async()=>{},hubSearch:async()=>{searches++;return{meta:{sources:[{pmcRecordId:'x',title:'title'}],sourceTexts:['real source']}};},
  executionCurrent:async()=>{if(!claim)throw Error('WORKER_CLAIM_LOST');},runSynthesis:async opts=>{calls++;await opts.authorize();const result=await opts.providerCall([]);if(revokeAfter)current=false;if(claimLost)claim=false;return{...result,runtimeEvidence:{runtime:'hub-opencode',sessionId:'private'}};}});
 const result={text:invalid?'bad-json':JSON.stringify({status:'ready',concepts:[{seedId:40,label:'针灸',terms:[]}],date:null,design:'any',maxResults:6,scope:'hub-only',outputs:['summary','directions'],unsupported:[],clarification:null}),usage:{totalTokens:42},usedMock:false};
 return{service,turn:{user,sessionId:'s',jobId:'job',skillRoute:route},result,get calls(){return calls;},get searches(){return searches;},get job(){return job;},revoke:()=>{current=false;}};
}
test('semantic plan persists separately from immutable route, reuses without a new provider call, then binds evidence',async()=>{
 const f=plannedFixture(),usage=[];await f.service.plan(f.turn,async()=>f.result,r=>usage.push(r.usage.totalTokens));
 assert.equal(f.job.payload.hubNaturalPlan.plan.requestHash,f.turn.skillRoute.decision.taskPlan.hash);assert.equal(f.calls,1);assert.deepEqual(usage,[42]);
 await f.service.plan(f.turn,async()=>{throw Error('duplicate-call');},()=>assert.fail('duplicate-charge'));
 assert.equal(f.calls,1);const e=await f.service.prepare(f.turn);assert.equal(e.plan.schema,'hub-literature-query.v2');assert.equal(f.searches,1);await f.service.validate(f.turn,e);
 f.job.payload.hubNaturalPlan.plan.maxResults=9;await assert.rejects(f.service.validate(f.turn,e));
});
test('invalid model plans, CAS loss and in-flight revocation retain known usage but cannot search',async()=>{
 for(const options of [{invalid:true},{cas:true},{revokeAfter:true},{claimLost:true}]){
  const f=plannedFixture(options),usage=[];await assert.rejects(f.service.plan(f.turn,async()=>f.result,r=>usage.push(r.usage.totalTokens)));
  assert.deepEqual(usage,[42]);assert.equal(f.searches,0);assert(!f.job.payload.hubNaturalPlan);
 }
 const f=plannedFixture();f.revoke();await assert.rejects(f.service.plan(f.turn,()=>assert.fail('must not call'),()=>assert.fail('must not charge')));assert.equal(f.calls,0);
});
test('planning harness failure accounts known provider usage once and never invents unknown usage',async()=>{
 const f=plannedFixture(),usage=[],known=Object.assign(Error('harness failed'),{knownProviderResult:f.result});
 await assert.rejects(f.service.plan(f.turn,async()=>{throw known;},r=>usage.push(r.usage.totalTokens)),/harness failed/);assert.deepEqual(usage,[42]);assert(!f.job.payload.hubNaturalPlan);
 const g=plannedFixture(),unknown=[];await assert.rejects(g.service.plan(g.turn,async()=>{throw Error('unknown provider outcome');},r=>unknown.push(r)),/unknown provider/);assert.deepEqual(unknown,[]);assert(!g.job.payload.hubNaturalPlan);assert.equal(g.searches,0);
});
