import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtocolReviewQueue} from './review-queue.mjs';
const user={accountId:'a',tenantId:'t',authVersion:1};
const row=(id)=>({id,title:'方案'+id,versionNumber:1,status:'pending_review',updatedAt:new Date('2026-11-11T00:00:00Z')});
function fixture({admin=true,denied=[],feature=true,protocols={s1:[row('p1'),row('p2')],s2:[row('p3')]},studies=['s1','s2']}={}){
 const reads=[];
 const service={directory:async(_u,q)=>{const index=q.cursor?Number(q.cursor):0;return {items:studies[index]?[{studyId:studies[index]}]:[],nextCursor:index+1<studies.length?String(index+1):null};},withResearchStudyTransaction:async(_u,id,_op,fn)=>{
  if(denied.includes(id))throw Object.assign(Error('invisible'),{status:404});
  const tx={tenantFeatureEntitlement:{findFirst:async()=>feature?{}:null},account:{findFirst:async()=>({tenantId:'t',role:admin?'tenant_admin':'researcher',isTenantAdmin:admin})},researchProjectMembership:{findFirst:async()=>null},studyGroupMembership:{findFirst:async()=>null},researchProject:{findFirst:async()=>({name:'研究'+id})},studyProtocolVersion:{findMany:async q=>{reads.push({id,q});return (protocols[id]??[]).filter(p=>!q.where.id||p.id>q.where.id.gt).slice(0,q.take);}}};
  return fn(tx,{tenantId:'t',studyGroupId:'g',executionProjectId:'e-'+id,studyId:id});
 }};
 return {queue:createProtocolReviewQueue({studies:service}),reads,service};
}
test('review prefetch reads a batch once while v1 cursors resume within a Study and never skip buffered studies',async()=>{
 const f=fixture(),calls=[];f.service.reviewDirectory=async(_u,q)=>{calls.push(q);const index=q.cursor?Number(q.cursor):0,ids=['s1','s2'].slice(index);return{items:ids.map((studyId,i)=>({studyId,reviewCursor:index+i+1<2?String(index+i+1):null})),nextCursor:null};};
 const a=await f.queue.list(user,{limit:'1'}),b=await f.queue.list(user,{limit:'1',cursor:a.nextCursor}),c=await f.queue.list(user,{limit:'1',cursor:b.nextCursor});assert.deepEqual([a,b,c].flatMap(x=>x.items.map(y=>y.protocol.id)),['p1','p2','p3']);assert.equal(c.nextCursor,null);assert.equal(calls[0].limit,'25');assert.equal(calls.length,2);
});
test('prefetched directory uses one discovery for many empty studies, still bounds scans at25 and rechecks visibility',async()=>{
 const ids=Array.from({length:26},(_,i)=>'s'+i),f=fixture({studies:ids,protocols:{s25:[row('last')]}});let calls=0;f.service.directory=()=>{throw Error('PER_STUDY_DIRECTORY_SCAN');};f.service.reviewDirectory=async(_u,q)=>{calls++;const index=Number(q.cursor??0),selected=ids.slice(index,index+Number(q.limit));return{items:selected.map((studyId,i)=>({studyId,reviewCursor:index+i+1<ids.length?String(index+i+1):null})),nextCursor:index+selected.length<ids.length?String(index+selected.length):null};};
 const a=await f.queue.list(user,{});assert.equal(a.items.length,0);assert(a.nextCursor);assert.equal(calls,1);const b=await f.queue.list(user,{cursor:a.nextCursor});assert.equal(b.items[0].protocol.id,'last');assert.equal(b.nextCursor,null);assert.equal(calls,2);
});
test('pending queue paginates within the same Study without dropping remaining versions',async()=>{const f=fixture();const a=await f.queue.list(user,{limit:'1'}),b=await f.queue.list(user,{limit:'1',cursor:a.nextCursor}),c=await f.queue.list(user,{limit:'1',cursor:b.nextCursor});assert.deepEqual([a,b,c].flatMap(x=>x.items.map(y=>y.protocol.id)),['p1','p2','p3']);assert.equal(c.nextCursor,null);assert.equal(a.items[0].href,'/pages/s07/?formalPreparation=1&studyId=s1&protocolId=p1');});
test('Hub owner visibility alone does not yield an approval queue item',async()=>{const f=fixture({admin:false});const result=await f.queue.list(user,{});assert.deepEqual(result,{items:[],nextCursor:null});assert.equal(f.reads.length,0);});
test('an inaccessible Study is skipped while other current authorized work remains',async()=>{const f=fixture({denied:['s1']});const result=await f.queue.list(user,{});assert.deepEqual(result.items.map(x=>x.protocol.id),['p3']);assert.equal(result.nextCursor,null);});
test('cursor cannot move to another account tenant auth version or query',async()=>{const f=fixture();const a=await f.queue.list(user,{limit:'1'});for(const actor of [{...user,accountId:'b'},{...user,tenantId:'u'},{...user,authVersion:2}])await assert.rejects(f.queue.list(actor,{cursor:a.nextCursor}),e=>e.status===400);await assert.rejects(f.queue.list(user,{status:'approved'}),e=>e.status===400);await assert.rejects(f.queue.list(user,{tenantId:'u'}),e=>e.status===400);});
test('feature outage is explicit and is not an empty successful queue',async()=>{const f=fixture({feature:false});await assert.rejects(f.queue.list(user,{}),e=>e.status===403&&e.code==='FEATURE_NOT_ENABLED');});
test('bounded empty scan retains a continuation rather than declaring no work',async()=>{const studies=Array.from({length:26},(_,i)=>'s'+i);const f=fixture({studies,protocols:{s25:[row('last')]}});const a=await f.queue.list(user,{});assert.equal(a.items.length,0);assert(a.nextCursor);const b=await f.queue.list(user,{cursor:a.nextCursor});assert.equal(b.items[0].protocol.id,'last');assert.equal(b.nextCursor,null);});
test('queued access is rechecked after a prior successful page',async()=>{const denied=[];const f=fixture({denied});const a=await f.queue.list(user,{limit:'1'});denied.push('s1');const b=await f.queue.list(user,{limit:'1',cursor:a.nextCursor});assert.deepEqual(b.items.map(x=>x.protocol.id),['p3']);});
