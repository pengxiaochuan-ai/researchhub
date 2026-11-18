import test from 'node:test';import assert from 'node:assert/strict';
import {memoizeFullStudyAuthorizationReads} from './full-study-authorization-reads.mjs';
test('only six authorization models and exact read methods reuse queries, and returned data is isolated',async()=>{
 let auth=0,source=0,raw=0;const tx={account:{findFirst:async args=>{auth++;return{id:args.where.id,tenant:{status:'active'},createdAt:new Date('2026-11-13')};}},formAssignment:{findFirst:async()=>{source++;return{};}},$queryRaw:async()=>{raw++;return[];}};
 const view=memoizeFullStudyAuthorizationReads(tx),a=await view.account.findFirst({where:{id:'actor'},include:{tenant:true}});a.tenant.status='corrupted';a.createdAt.setFullYear(2000);
 const b=await view.account.findFirst({include:{tenant:true},where:{id:'actor'}});assert.equal(auth,1);assert.equal(b.tenant.status,'active');assert.equal(b.createdAt.getUTCFullYear(),2026);
 await view.account.findFirst({where:{id:'other'},include:{tenant:true}});assert.equal(auth,2);
 await view.formAssignment.findFirst({where:{id:'source'}});await view.formAssignment.findFirst({where:{id:'source'}});assert.equal(source,2);
 await view.$queryRaw`SELECT 1`;await view.$queryRaw`SELECT 1`;assert.equal(raw,2);
});
test('parallel equivalent reads share one pending query, rejection is not cached, and a new proxy has no cache',async()=>{
 let calls=0,fail=true;const tx={researchProject:{findUnique:async()=>{calls++;if(fail)throw Error('transient');return{id:'project'};}}},view=memoizeFullStudyAuthorizationReads(tx);
 await assert.rejects(view.researchProject.findUnique({where:{id:'project'}}),/transient/);fail=false;
 await Promise.all([view.researchProject.findUnique({where:{id:'project'}}),view.researchProject.findUnique({where:{id:'project'}})]);assert.equal(calls,2);
 await memoizeFullStudyAuthorizationReads(tx).researchProject.findUnique({where:{id:'project'}});assert.equal(calls,3);
});
test('any authorization-model mutation invalidates cached authorization projections',async()=>{
 let calls=0,status='active';const tx={account:{findMany:async()=>{calls++;return[{status}];}},studyGroupMembership:{update:async()=>{status='disabled';return{};}}},view=memoizeFullStudyAuthorizationReads(tx);
 await view.account.findMany({});await view.account.findMany({});assert.equal(calls,1);
 await view.studyGroupMembership.update({where:{id:'membership'},data:{status:'disabled'}});assert.equal((await view.account.findMany({}))[0].status,'disabled');assert.equal(calls,2);
});
test('the complete allowlist reuses its three read methods while policy/form/source reads never memoize',async()=>{
 const names=['account','researchProjectMembership','tenantFeatureEntitlement','studyGroup','researchProject','studyGroupMembership'],counts=new Map(),tx={};
 for(const model of [...names,'studyProtocolVersion','formVersion','formResponseRevision'])tx[model]=Object.fromEntries(['findFirst','findUnique','findMany'].map(method=>[method,async()=>{const k=model+'.'+method;counts.set(k,(counts.get(k)??0)+1);return{model,method};}]));
 const view=memoizeFullStudyAuthorizationReads(tx);
 for(const model of Object.keys(tx))for(const method of ['findFirst','findUnique','findMany']){await view[model][method]({where:{id:'same'}});await view[model][method]({where:{id:'same'}});assert.equal(counts.get(model+'.'+method),names.includes(model)?1:2);}
});
