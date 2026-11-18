import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSkillCatalog} from './skill-catalog.mjs';
import {createSessionSkillRouting} from './session-skill-routing.mjs';
import {bindSkillRoute,routeDigest,routeSkillTask} from './skill-routing.mjs';
const catalog=await loadSkillCatalog(new URL('../../',import.meta.url));
const user={tenantId:'t',accountId:'a',authVersion:0,studyGroupId:'g',researchProjectId:'p'};
function fixture(features={}){
 const session={id:'s',tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p',agentId:'agent',contextKey:'hub:lingshu-xinyu',status:'active',deletedAt:null};
 let jobs=[],equipped=true,sourceValid=true;
 const descriptors=catalog.skills.map((s,i)=>({id:'skill-'+i,key:s.key,version:1}));
 const matches=(row,w)=>Object.entries(w).every(([k,v])=>v&&typeof v==='object'&&'in'in v?v.in.includes(row[k]):row[k]===v);
 const tx={session:{findFirst:async({where})=>matches(session,where)?session:null},knowledgeChatJob:{findFirst:async({where})=>jobs.find(j=>matches(j,where))??null}};
 const service=createSessionSkillRouting({tenantId:'t',agentId:'agent',catalog,contextOf:s=>({kind:s.contextKey==='hub:lingshu-xinyu'?'hub':'article'}),
  transaction:fn=>fn(tx),effectiveInTx:async(_tx,u)=>{if(u.accountId!=='a'||u.tenantId!=='t')throw Error('denied');return{items:equipped?descriptors:[]};},verifySource:async()=>sourceValid,...features,
 });
 const enqueue=async(text,networkIntent)=>service.withRequest(user,session,{text,requestKey:'test-key-123',...(networkIntent?{networkIntent}:{})},()=>service.onJobCreate(tx,{data:{id:'job',tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p',sessionId:'s',requestKey:'test-key-123',text,payload:{kbIds:[]}}},async args=>{const j={...args.data,status:'processing'};jobs.push(j);return j;}));
 return{service,enqueue,session,jobs,revoke:()=>{equipped=false;},invalidate:()=>{sourceValid=false;}};
}
test('historical bound single-nonBMP general input stays readable without permitting new one-character commands',async()=>{
 const f=fixture(),text='🧪',decision={...routeSkillTask({text:'你好',context:{kind:'hub'}}),anchorQuestion:text};
 const route=bindSkillRoute({user,session:f.session,text,decision,skill:null,sourceBinding:routeDigest({contextKey:f.session.contextKey,packHash:null})});
 const job={id:'legacy-emoji',...user,sessionId:'s',text,status:'completed',payload:{hubSkillRoute:route}};f.jobs.push(job);
 const tx={session:{findFirst:async()=>f.session},knowledgeChatJob:{findFirst:async()=>job}};
 assert.equal((await f.service.validateInTx(tx,user,'s',job.id,undefined,true)).snapshotHash,route.snapshotHash);
 await assert.rejects(f.enqueue(text),/HUB_SKILL_INPUT_INVALID/);
 job.text='另一个问题';await assert.rejects(f.service.validateInTx(tx,user,'s',job.id,undefined,true),/HUB_SKILL_ROUTE_CHANGED/);
});
test('enabled Hub assembly defaults new direct/queue requests OFF, binds ON and checks it again before external dispatch',async()=>{
 const options={literatureEnabled:true,naturalPlanningEnabled:true,smartSearchEnabled:true};
 const off=fixture(options),local=await off.enqueue('检索针灸治疗抑郁资料');assert.equal(local.payload.networkIntent.enabled,false);assert.equal(local.payload.hubSkillRoute.schema,'hub-medical-router.v2');
 await assert.rejects(off.service.assertNetwork(user,'s','job'),/HUB_NETWORK_DISABLED/);
 const f=fixture(options),job=await f.enqueue('查询公开针灸指南',{schema:'hub-network-intent.v1',enabled:true});
 assert.equal(job.payload.hubSkillRoute.decision.mode,'hub-smart-search');assert.equal(await f.service.assertNetwork(user,'s','job'),true);
 job.payload.networkIntent.enabled=false;await assert.rejects(f.service.prepare(user,'s','job'),/HUB_SKILL_ROUTE_CHANGED/);
 const legacy=fixture({literatureEnabled:true}),old=await legacy.enqueue('检索针灸治疗失眠论文'),next=fixture(options);next.jobs.push(old);assert.equal((await next.service.prepare(user,'s','job')).schema,'hub-medical-router.v1');
});
test('real service persists routing before a job can run and rechecks its dependency/equipment',async()=>{
 const f=fixture(),job=await f.enqueue('已审核资料对针灸治疗失眠有哪些观察？');
 assert.equal(job.payload.hubSkillRoute.decision.mode,'existing-reviewed-hub');
 const receipt=await f.service.prepare(user,'s','job');assert.equal(receipt.skill.key,'doubao-medical-literature-search');
 f.revoke();await assert.rejects(()=>f.service.prepare(user,'s','job'),/HUB_SKILL_NOT_EQUIPPED/);
});
test('ordinary chat binds a builtin policy without inventing a Skill and rechecks owner and input',async()=>{
 const f=fixture(),job=await f.enqueue('介绍下你自己');
 const route=await f.service.prepare(user,'s','job');assert.equal(route.decision.mode,'hub-general-conversation');assert.equal(route.skill,null);
 assert.deepEqual(route.decision.requiredTools,[]);assert.equal(typeof route.conversationPolicyHash,'string');
 job.text='另一个普通问题';await assert.rejects(f.service.prepare(user,'s','job'),/HUB_SKILL_ROUTE_CHANGED/);
 await assert.rejects(f.service.prepare({...user,accountId:'other'},'s','job'));
});
test('unavailable and ambiguous tasks never reach job creation',async()=>{
 const f=fixture();await assert.rejects(()=>f.enqueue('订阅最新针灸研究进展'),/HUB_SKILL_RUNTIME_UNAVAILABLE/);
 assert.equal(f.jobs.length,0);await assert.rejects(()=>f.enqueue('解读报告'),/HUB_SKILL_CLARIFICATION/);assert.equal(f.jobs.length,0);
});
test('waiting command binds routing at dispatch, not at initial entry',async()=>{
 const f=fixture();assert.equal(typeof f.service.stagePendingInTx,'function');
 const job={sessionId:'s',text:'已审核资料有哪些局限？',payload:{kbIds:[]}};
 const tx={session:{findFirst:async()=>f.session},knowledgeChatJob:{findFirst:async()=>null}};
 const payload=await f.service.stagePendingInTx(tx,user,job);assert.equal(payload.hubSkillRoute.decision.mode,'existing-reviewed-hub');
 f.revoke();await assert.rejects(f.service.stagePendingInTx(tx,user,job),/HUB_SKILL_NOT_EQUIPPED/);
});
test('private material branch uses the actually equipped interpretation Skill and fixed pack, never public search',async()=>{
 const f=fixture({privateMaterialsEnabled:true,smartSearchEnabled:true}),tx={session:{findFirst:async()=>f.session},knowledgeChatJob:{findFirst:async()=>null}};
 const job={sessionId:'s',text:'汇总上传资料，说明局限与原文依据',payload:{networkIntent:{schema:'hub-network-intent.v1',enabled:false},hubPrivateEvidence:{schema:'hub-private-material-pack.v1',packHash:'a'.repeat(64)}}};
 const payload=await f.service.stagePendingInTx(tx,user,job);assert.equal(payload.hubSkillRoute.decision.mode,'hub-private-materials');assert.equal(payload.hubSkillRoute.skill.key,'doubao-medical-literature-interpretation');assert.deepEqual(payload.hubSkillRoute.decision.requiredTools,['private_material_read']);
 const j={id:'private-job',...user,sessionId:'s',text:job.text,payload,status:'processing'};f.jobs.push(j);
 assert.equal((await f.service.prepare(user,'s',j.id)).snapshotHash,payload.hubSkillRoute.snapshotHash);
 j.payload={...payload,hubPrivateEvidence:{...payload.hubPrivateEvidence,packHash:'b'.repeat(64)}};await assert.rejects(f.service.prepare(user,'s',j.id),/HUB_SKILL_ROUTE_CHANGED/);
 await assert.rejects(f.service.stagePendingInTx(tx,user,{...job,payload:{...job.payload,networkIntent:{schema:'hub-network-intent.v1',enabled:true}}}),/HUB_SKILL_CLARIFICATION/);
 f.revoke();await assert.rejects(f.service.stagePendingInTx(tx,user,job),/HUB_SKILL_NOT_EQUIPPED/);
 const unavailable=fixture();await assert.rejects(unavailable.service.stagePendingInTx(tx,user,job),/HUB_SKILL_RUNTIME_UNAVAILABLE/);
});
test('fixed research results bind their own policy and pack without misclassifying data as a medical report',async()=>{
 const f=fixture({researchDataEnabled:true,smartSearchEnabled:true}),tx={session:{findFirst:async()=>f.session},knowledgeChatJob:{findFirst:async()=>null}},job={sessionId:'s',text:'解释本批数据的缺失和质控局限',payload:{networkIntent:{schema:'hub-network-intent.v1',enabled:false},hubResearchDataEvidence:{schema:'hub-data-overview.v1',packHash:'a'.repeat(64)}}};
 const payload=await f.service.stagePendingInTx(tx,user,job);assert.equal(payload.hubSkillRoute.decision.mode,'hub-research-data');assert.equal(payload.hubSkillRoute.skill,null);assert.match(payload.hubSkillRoute.dataPolicyHash,/^[a-f0-9]{64}$/);
 const j={id:'data-job',...user,sessionId:'s',text:job.text,payload,status:'processing'};f.jobs.push(j);assert.equal((await f.service.prepare(user,'s',j.id)).snapshotHash,payload.hubSkillRoute.snapshotHash);
 j.payload={...payload,hubResearchDataEvidence:{...payload.hubResearchDataEvidence,packHash:'b'.repeat(64)}};await assert.rejects(f.service.prepare(user,'s',j.id),/HUB_SKILL_ROUTE_CHANGED/);
 await assert.rejects(f.service.stagePendingInTx(tx,user,{...job,payload:{...job.payload,networkIntent:{schema:'hub-network-intent.v1',enabled:true}}}),/HUB_SKILL_CLARIFICATION/);
 const off=fixture();await assert.rejects(off.service.stagePendingInTx(tx,user,job),/HUB_SKILL_ROUTE_CHANGED/);
});
test('changed source, question, parent or route receipt cannot execute',async()=>{
 const f=fixture(),j=await f.enqueue('已审核资料有哪些局限？');
 f.invalidate();await assert.rejects(()=>f.service.prepare(user,'s','job'),/HUB_SKILL_SOURCE_CHANGED/);
 const g=fixture(),k=await g.enqueue('已审核资料有哪些局限？');k.text='另一个问题';await assert.rejects(()=>g.service.prepare(user,'s','job'),/HUB_SKILL_ROUTE_CHANGED/);
 const h=fixture(),l=await h.enqueue('已审核资料有哪些局限？');l.payload.hubSkillRoute.decision.requiredTools=[];await assert.rejects(()=>h.service.prepare(user,'s','job'),/HUB_SKILL_ROUTE_CHANGED/);
 await assert.rejects(()=>h.service.prepare({...user,accountId:'other'},'s','job'));
});
test('new semantic requests and legacy deterministic task snapshots survive the same enabled runtime',async()=>{
 const old=fixture({literatureEnabled:true}),job=await old.enqueue('检索针灸治疗失眠的论文'),next=fixture({literatureEnabled:true,naturalPlanningEnabled:true});next.jobs.push(job);
 assert.equal((await next.service.prepare(user,'s','job')).decision.taskPlan.schema,'hub-literature-query.v1');
 const newer=fixture({literatureEnabled:true,naturalPlanningEnabled:true}),created=await newer.enqueue('查询近1年针灸治疗情志病的研究报告，并总结研究方向');
 assert.equal(created.payload.hubSkillRoute.decision.taskPlan.schema,'hub-literature-request.v2');assert.equal((await newer.service.prepare(user,'s','job')).snapshotHash,created.payload.hubSkillRoute.snapshotHash);
});
