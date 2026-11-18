import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtocolDecisionHistory,presentProtocolDecision} from './review-history.mjs';
const user={accountId:'admin',tenantId:'tenant',authVersion:5};
const protocol={id:'p',title:'真实方案',versionNumber:2,status:'draft'};
const event=(id,action='study_protocol_approve',meta={policyVersionId:'policy',policyHash:'a'.repeat(64)})=>({id,action,target:'p',accountId:'reviewer',createdAt:new Date('2026-11-13T05:00:00.000Z'),meta});
function fixture({admin=true,denied=[],events={s1:[event('e3'),event('e2','study_protocol_transition',{to:'draft',from:'pending_review',reason:'补充访视'}),event('e1','study_protocol_activate')]},studies=['s1'],feature=true}={}){
 const reads=[];
 const svc={directory:async(_u,q)=>{const i=q.cursor?Number(q.cursor):0;return{items:studies[i]?[{studyId:studies[i]}]:[],nextCursor:i+1<studies.length?String(i+1):null};},withResearchStudyTransaction:async(_u,id,_op,fn)=>{
  if(denied.includes(id))throw Object.assign(Error('hidden'),{status:404});
  const tx={tenantFeatureEntitlement:{findFirst:async()=>feature?{}:null},account:{findFirst:async()=>({tenantId:'tenant',role:admin?'tenant_admin':'researcher',isTenantAdmin:admin}),findMany:async()=>[{id:'reviewer',displayName:'核对人'}]},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null},researchProject:{findFirst:async()=>({name:'研究'+id})},studyProtocolVersion:{findMany:async()=>[protocol]},auditLog:{findMany:async q=>{reads.push(q);return(events[id]??[]).filter(x=>!q.where.AND||x.id<q.where.AND[0].OR[1].id.lt).slice(0,q.take);}}};
  return fn(tx,{tenantId:'tenant',studyGroupId:'group',executionProjectId:'exec-'+id});
 }};
 return {history:createProtocolDecisionHistory({studies:svc}),reads};
}
test('actual decisions preserve repeated versions and exact reason/time, never infer from current status',async()=>{
 const f=fixture(),p=await f.history.list(user,{limit:'2'}),q=await f.history.list(user,{limit:'2',cursor:p.nextCursor});
 assert.deepEqual([...p.items,...q.items].map(x=>x.decision.kind),['approved','returned','activated']);
 assert.equal(p.items[1].decision.reason,'补充访视');assert.equal(p.items[0].decision.createdAt,'2026-11-13T05:00:00.000Z');
 assert.equal(p.items[0].protocol.status,'draft');assert.equal(p.items[0].decision.actorName,'核对人');assert.equal(q.nextCursor,null);
 const where=f.reads[0].where??f.reads[0];assert.equal(where.tenantId,'tenant');assert.equal(where.researchProjectId,'exec-s1');assert.equal(where.studyGroupId,'group');
 assert.deepEqual(where.target,{in:['p']});assert(!JSON.stringify(p).includes('policyHash'));
});
test('metadata not recognized as a real decision never invents success or leaks raw fields',()=>{
 assert.equal(presentProtocolDecision(event('x','researchhub.protocol.approve',{secret:'hidden'}),protocol,new Map()),null);
 assert.equal(presentProtocolDecision(event('x','study_protocol_transition',{to:'pending_review'}),protocol,new Map()),null);
 const value=presentProtocolDecision(event('x','study_protocol_transition',{to:'draft',reason:'  需补充  ',secret:'hidden'}),protocol,new Map());
 assert.equal(value.reason,'需补充');assert.equal(value.actorName,null);assert(!JSON.stringify(value).includes('secret'));
 assert.throws(()=>presentProtocolDecision({...event('x'),createdAt:null},protocol,new Map()),e=>e.status===503);
});
test('current authorization and feature gates are rechecked on every page',async()=>{
 const denied=[],f=fixture({denied});const first=await f.history.list(user,{limit:'1'});denied.push('s1');assert.deepEqual(await f.history.list(user,{cursor:first.nextCursor}),{items:[],nextCursor:null});
 assert.deepEqual(await fixture({admin:false}).history.list(user,{}),{items:[],nextCursor:null});
 await assert.rejects(fixture({feature:false}).history.list(user,{}),e=>e.status===403);
});
test('cursor is bound to tenant actor session and query kind; invalid input is explicit',async()=>{
 const f=fixture(),p=await f.history.list(user,{limit:'1'});
 for(const u of [{...user,tenantId:'foreign'},{...user,accountId:'other'},{...user,authVersion:6}])await assert.rejects(f.history.list(u,{cursor:p.nextCursor}),e=>e.status===400);
 for(const q of [{status:'approved'},{limit:'0'},{limit:'101'},{cursor:Buffer.from(JSON.stringify({v:1,actor:'admin'})).toString('base64url')},{q:'all'}])await assert.rejects(f.history.list(user,q),e=>e.status===400);
});
test('bounded scanning keeps continuation and read failures cannot become zero records',async()=>{
 const studies=Array.from({length:26},(_,i)=>'s'+i),f=fixture({studies,events:{s25:[event('last')]}}),p=await f.history.list(user,{});
 assert.deepEqual(p.items,[]);assert(p.nextCursor);assert.equal((await f.history.list(user,{cursor:p.nextCursor})).items[0].decision.id,'last');
 const h=createProtocolDecisionHistory({studies:{directory:async()=>{throw Error('network');}}});await assert.rejects(h.list(user,{}),/network/);
});
