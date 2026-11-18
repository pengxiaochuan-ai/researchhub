import test from 'node:test';
import assert from 'node:assert/strict';
import {createCorrectionImpactService} from './correction-impact.mjs';
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},user={tenantId:'tenant',accountId:'actor',authVersion:0},ref={assignmentId:'assignment',responseId:'response',revisionNo:2,contentHash:'a'.repeat(64)};
function fixture({admin=true,permissions=[],rows=[],mutateDuringList=false}={}){
 const calls=[],state={version:4},tx={studyGroupMembership:{findFirst:async()=>({role:{menuPermissions:['artifacts'],buttonPermissions:permissions}})}};
 const core={authorize:async()=>{calls.push('authorize');return{...user,role:admin?'tenant_admin':'researcher',isTenantAdmin:admin};},readAssignment:async()=>{calls.push('read');return{assignment:{id:'assignment',subjectVisitId:'visit'},response:{ref,version:state.version,locked:false,review:null}};},readVisit:async()=>({id:'visit',status:'completed',completionIntegrity:'requires_review',capabilities:{canReverify:true}})};
 const studies={withResearchStudyTransaction:async(u,id,action,fn)=>{assert.equal(id,'study');assert.equal(action,'read');return fn(tx,{...scope,executionProjectId:scope.researchProjectId});}};
 const repository={list:async(_tx,s,input)=>{assert.deepEqual(s,scope);calls.push(input);if(mutateDuringList)state.version++;return rows;}};
 return{api:createCorrectionImpactService({studies,core,repository,cursorSecret:'test-correction-impact'}),calls,state};
}
const old={ref:{...ref,revisionNo:1,contentHash:'b'.repeat(64)},responseVersion:3};
test('impact lists ordinary/full root metadata, retains old dates and detects revision/version drift without answers',async()=>{
 const f=fixture({rows:[{id:'snapshot-a',planId:'plan-a',schemaVersion:'t15-formal-projection-v1',createdAt:new Date('2026-01-02T00:00:00Z'),sources:[old],runCount:1},{id:'snapshot-b',planId:'plan-b',schemaVersion:'full-study-simulation-root-v2',createdAt:new Date('2026-02-02T00:00:00Z'),sources:[{ref,responseVersion:4}],runCount:39}]});
 const v=await f.api.read(user,'study','assignment',{kind:'analysis'});assert.equal(v.items.length,2);assert.deepEqual(v.items.map(i=>[i.branch,i.sourceChanged,i.runCount]),[['ordinary',true,1],['full',false,39]]);assert.equal(v.items[0].createdAt,'2026-01-02T00:00:00.000Z');assert.equal(v.visit.completionIntegrity,'requires_review');assert.equal(v.ref.revisionNo,2);assert(!JSON.stringify(v).includes('answers'));assert(!JSON.stringify(v).includes('manifest'));assert.deepEqual(f.calls.slice(0,2),['authorize','read']);
});
test('report permission does not imply analysis permission or leak analysis counts and titles',async()=>{
 const f=fixture({admin:false,permissions:['artifact.read']});const v=await f.api.read(user,'study','assignment',{kind:'analysis'});assert.equal(v.restricted,true);assert.deepEqual(v.items,[]);assert.equal(v.nextCursor,null);assert.equal(f.calls.length,2);assert.equal(v.capabilities.canReadReports,true);
 const g=fixture({admin:false,permissions:['data.analyze']});assert.equal((await g.api.read(user,'study','assignment',{kind:'report'})).restricted,true);assert.equal(g.calls.length,2);
});
test('pagination binds actor, auth version including zero, Study, assignment and current response version',async()=>{
 const row=n=>({id:'snapshot-'+n,planId:'plan',schemaVersion:'t15-formal-projection-v1',createdAt:new Date('2026-01-02'),sources:[old],runCount:0}),f=fixture({rows:[row(1),row(2)]});
 const a=await f.api.read(user,'study','assignment',{kind:'analysis',limit:1});assert(a.nextCursor);await f.api.read(user,'study','assignment',{kind:'analysis',limit:1,cursor:a.nextCursor});assert.equal(f.calls.filter(x=>typeof x==='object').at(-1).after,'snapshot-1');
 for(const u of [{...user,accountId:'other'},{...user,authVersion:1}])await assert.rejects(f.api.read(u,'study','assignment',{kind:'analysis',cursor:a.nextCursor}),e=>e.status===400);
 f.state.version++;await assert.rejects(f.api.read(user,'study','assignment',{kind:'analysis',cursor:a.nextCursor}),e=>e.status===400);
});
test('unknown parameters and invalid pagination are rejected before transaction reads',async()=>{
 const f=fixture();for(const q of [{kind:'other'},{kind:'report',limit:101},{kind:'analysis',extra:true}])await assert.rejects(async()=>f.api.read(user,'study','assignment',q),e=>e.status===400);assert.deepEqual(f.calls,[]);
});
test('malformed role permission strings never grant metadata access',async()=>{const f=fixture({admin:false,permissions:'data.analyze artifact.read'});assert.equal((await f.api.read(user,'study','assignment',{kind:'analysis'})).restricted,true);assert.equal((await f.api.read(user,'study','assignment',{kind:'report'})).restricted,true);});
test('a concurrent correction during metadata SQL rejects the assembled list',async()=>{const f=fixture({mutateDuringList:true});await assert.rejects(f.api.read(user,'study','assignment',{kind:'analysis'}),e=>e.code==='CORRECTION_IMPACT_CHANGED');});
