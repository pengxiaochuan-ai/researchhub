import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFullStudyMethodsFacade} from './full-study-methods-facade.mjs';

function fixture(){
 const calls=[],user={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'actor',authVersion:2},row={id:'run',skillKey:'descriptive-statistics'};
 const native={review:async(...args)=>{calls.push(['native.review',...args]);return row;},reviewReceipt:async(...args)=>{calls.push(['native.receipt',...args]);return{receipt:'original'};}};
 const methods={mustFindRun:async function(...args){assert.equal(this,methods);calls.push(['find',...args]);return row;},descriptiveRuns(){assert.equal(this,methods);return native;},present(value,options){return{value,options};},review(){throw Error('public preliminary read');},getDescriptiveReviewReceipt(){throw Error('public preliminary read');},getDescriptiveCapabilities(){assert.equal(this,methods);return{unchanged:true};}};
 return{calls,user,row,native,methods,facade:createFullStudyMethodsFacade(methods)};
}
test('v2 review reads a fresh scoped row without preliminary projection and delegates the exact command to native review',async()=>{
 const f=fixture(),body={requestKey:'original-key',conclusion:'confirmed',comment:'original comment'},result=await f.facade.review(f.user,'run',body);
 assert.deepEqual(f.calls,[['find',f.user,'run',false],['native.review',f.user,f.row,body]]);
 assert.equal(result.value,f.row);assert.deepEqual(result.options,{idempotent:false});
 assert.deepEqual(f.facade.getDescriptiveCapabilities(),{unchanged:true});assert.throws(()=>f.methods.review(),/public preliminary/);
});
test('v2 receipt preserves its original key and native current authority/source checks on every invocation',async()=>{
 const f=fixture();assert.deepEqual(await f.facade.getDescriptiveReviewReceipt(f.user,'run','original-key'),{receipt:'original'});
 assert.deepEqual(f.calls,[['find',f.user,'run',false],['native.receipt',f.user,f.row,'original-key']]);
 for(const code of ['METHOD_AUTHORIZATION_REVOKED','ANALYSIS_BASIS_STALE','METHOD_RUN_CHANGED']){
  const error=Object.assign(Error(code),{code});f.native.reviewReceipt=async()=>{throw error;};f.native.review=async()=>{throw error;};
  await assert.rejects(f.facade.getDescriptiveReviewReceipt(f.user,'run','original-key'),e=>e===error);
  await assert.rejects(f.facade.review(f.user,'run',{}),e=>e===error);
 }
 assert.equal(f.calls.filter(x=>x[0]==='find').length,7);
});
test('missing or non-descriptive scoped runs never reach native mutation or receipt',async()=>{
 const f=fixture(),error=Object.assign(Error('not found'),{status:404});f.methods.mustFindRun=async()=>{throw error;};
 await assert.rejects(f.facade.review(f.user,'foreign',{}),e=>e===error);assert.equal(f.calls.length,0);
 f.methods.mustFindRun=async()=>({...f.row,skillKey:'other'});
 await assert.rejects(f.facade.review(f.user,'other',{}),e=>e.status===404);
 await assert.rejects(f.facade.getDescriptiveReviewReceipt(f.user,'other','original-key'),e=>e.status===404);
 assert.equal(f.calls.length,0);
});
test('facade is wired only into v2 composition and native review/receipt still call live inside their authorization transactions',()=>{
 const composition=readFileSync(new URL('./local-full-study-simulation.mjs',import.meta.url),'utf8');
 assert.match(composition,/methods:createFullStudyMethodsFacade\(methods,/);
 assert.doesNotMatch(readFileSync(new URL('./local-research-analysis.mjs',import.meta.url),'utf8'),/createFullStudyMethodsFacade/);
 const native=readFileSync(new URL('../../app/server/src/research-methods/formal-descriptive-runs.ts',import.meta.url),'utf8');
 assert.match(native,/return this\.transaction\(user,async tx=>\{const \{row,auth\}=await this\.live\(tx,user,snapshot,'publish'\);/);
 assert.match(native,/return this\.transaction\(user,async tx=>\{const \{row,auth\}=await this\.live\(tx,user,snapshot,'snapshot'\);await this\.reviewRole/);
});
test('operation authority delegates native live without a second source projection, then checks the current native reviewer role',async()=>{
 const f=fixture(),tx={};const calls=[];
 f.native.live=async(...args)=>{calls.push(args);return{auth:{user:f.user},row:f.row};};f.native.reviewRole=async(...args)=>{calls.push(args);};
 await f.facade.authorizeReviewInTransaction(tx,f.user,f.row);
 assert.deepEqual(calls,[[tx,f.user,f.row,'snapshot',false],[tx,f.user,undefined]]);
 const revoked=Object.assign(Error('revoked'),{code:'METHOD_REVIEW_FORBIDDEN'});f.native.reviewRole=async()=>{throw revoked;};
 await assert.rejects(f.facade.authorizeReviewInTransaction(tx,f.user,f.row),e=>e===revoked);
});
test('compute receipt checks native live authority and exact native input hash plus basis before proving a terminal row',async()=>{
 const f=fixture(),tx={},current={basis:{snapshotId:'snap'}},row={...f.row,inputHash:'verified',dataSources:{analysisBasis:{snapshotId:'snap'}}};
 let called=0;f.native.live=async(...args)=>{assert.deepEqual(args,[tx,f.user,row,'snapshot',false]);called++;return{row};};f.native.hash=()=> 'verified';
 const facade=createFullStudyMethodsFacade(f.methods,{buildDescriptiveInput:c=>{assert.equal(c,current);return{};}});
 assert.equal(await facade.verifyProcessRunInTransaction(tx,f.user,row,current),row);assert.equal(called,1);
 row.inputHash='changed';await assert.rejects(facade.verifyProcessRunInTransaction(tx,f.user,row,current),e=>e.code==='METHOD_RUN_CHANGED');
 row.inputHash='verified';row.dataSources.analysisBasis.snapshotId='different';await assert.rejects(facade.verifyProcessRunInTransaction(tx,f.user,row,current),e=>e.code==='METHOD_RUN_CHANGED');
});
test('Job operator authority delegates the frozen public Native entry with physical tx and fixed expected ref',async()=>{
 const f=fixture(),tx={},expected={agentId:'fixed-agent'},calls=[];f.methods.authorizeDescriptiveJobOperatorInTransaction=async(...args)=>{calls.push(args);return expected;};assert.equal(await f.facade.authorizeJobOperatorInTransaction(tx,f.user,expected),expected);assert.deepEqual(calls,[[tx,f.user,expected]]);
 delete f.methods.authorizeDescriptiveJobOperatorInTransaction;await assert.rejects(f.facade.authorizeJobOperatorInTransaction(tx,f.user,expected),e=>e.code==='ANALYSIS_JOB_BRIDGE_UNAVAILABLE');
});
