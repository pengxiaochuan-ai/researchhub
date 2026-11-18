import test from 'node:test';import assert from 'node:assert/strict';
import {createResearchStudiesService} from './commands.mjs';import {requestHash} from './contract.mjs';
const user={accountId:'actor',tenantId:'tenant',authVersion:1};
function fixture(){
 const body={requestKey:'receipt-key',title:'Synthetic',expectedVersion:1},hash=requestHash(body);
 const row={id:'project',tenant_id:'tenant',owner_id:'actor',title:'Synthetic',question:'',pico:{},research_type:'',hub_key:null,version:2,status:'draft',created_at:new Date(),updated_at:new Date()};
 const receipt={request_hash:hash,action:'intent.update',target_id:'project',result:{item:{id:'project',version:2,study:null},receipt:{requestKey:body.requestKey,action:'intent.update',targetId:'project',requestHash:hash,authVersion:1}}};
 const state={row,receipt,writes:0,account:{id:'actor',tenantId:'tenant',authVersion:1,role:'researcher',isTenantAdmin:false,status:'active',tenant:{status:'active'}}};
 const tx={account:{findFirst:async q=>q.where.id==='other'?{...state.account,id:'other'}:state.account},studyGroup:{findMany:async()=>[]},studyGroupMembership:{findMany:async()=>[]},$queryRaw:async()=>[]};
 const service=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx)},scope:{product:'researchhub',allowedTenantIds:['tenant']},lockAuthorization:async()=>{},createResearchProject:async()=>{state.writes++;throw Error('GET must not create');},repository:{setContext:async()=>{},getReceipt:async(_tx,u)=>u.accountId==='actor'?state.receipt:null,roles:async()=>[],binding:async()=>null,findIntent:async()=>state.row,present:r=>({id:r.id,title:r.title,version:r.version,study:null}),saveReceipt:async()=>{state.writes++;}}});
 return{service,state,hash,read:(query={})=>service.projectReceipt(user,body.requestKey,{action:'intent.update',targetId:'project',requestHash:hash,...query})};
}
test('exact creation receipt GET returns original proof plus current authorized detail without writes',async()=>{const f=fixture();assert.equal(typeof f.service.projectReceipt,'function');f.state.row.version=3;const out=await f.read();assert.equal(out.item.version,2);assert.equal(out.current.item.version,3);assert.equal(out.receipt.requestHash,f.hash);assert.equal(f.state.writes,0);});
test('receipt GET rejects changed source binding, old authVersion, foreign actor, lost permission and missing receipt',async()=>{
 for(const mutate of [f=>{f.state.receipt=null;},f=>{f.state.row.owner_id='other';},f=>{f.state.receipt.result.receipt.authVersion=0;},f=>{delete f.state.receipt.result.receipt.authVersion;},f=>{f.state.receipt.result.receipt.requestHash='0'.repeat(64);},f=>{f.state.account.authVersion=2;}]){const f=fixture();assert.equal(typeof f.service.projectReceipt,'function');mutate(f);await assert.rejects(f.read(),e=>[401,403,404,409].includes(e.status));assert.equal(f.state.writes,0);}
 const f=fixture();assert.equal(typeof f.service.projectReceipt,'function');await assert.rejects(f.read({targetId:'other'}),e=>e.status===409);await assert.rejects(async()=>f.read({action:'hub-role.set'}),e=>e.status===400);await assert.rejects(f.service.projectReceipt({...user,accountId:'other'},'receipt-key',{action:'intent.update',targetId:'project',requestHash:f.hash}),e=>e.status===404);assert.equal(f.state.writes,0);
});
