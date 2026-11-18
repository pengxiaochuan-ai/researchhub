import test from 'node:test';import assert from 'node:assert/strict';
import {createAcademicContentClient} from '../src/academic-content-client.js';
import {academicHref,readAcademicRoute} from '../src/academic-content-route.js';
import {draftInput} from '../server/academic-content/policy.mjs';
import {mutationHash} from '../server/academic-content/service.mjs';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
import {safeGovernanceReturn} from '../src/governance-overview.js';
test('login preserves only exact academic paths without protecting general public H01',()=>{
 for(const href of [academicHref({id:'one',type:'event',q:'合成'}),academicHref({management:true,id:'one',status:'draft',page:2})])for(const safe of [safeAuthenticatedReturnTo,safeSessionReturn])assert.equal(safe(href),href);
 const manager=academicHref({management:true,id:'one'});assert.equal(safeGovernanceReturn(manager),manager);
 for(const href of ['/pages/h01/','/pages/h01/?section=updates&token=secret','/pages/h01/?section=updates&contentId=a&contentId=b','/pages/g02/?view=academic-content&token=secret'])assert.equal(safeAuthenticatedReturnTo(href),'/pages/p01/');
});
test('content routes preserve exact scope and reject duplicates or credential parameters',()=>{
 const href=academicHref({type:'event',q:'合成活动',id:'one'});assert.equal(readAcademicRoute('h01',href.split('?')[1]).id,'one');
 for(const q of ['section=updates&hubKey=other','section=updates&token=secret','section=updates&contentId=a&contentId=b'])assert.throws(()=>readAcademicRoute('h01',q));
 assert.equal(readAcademicRoute('h01','hubKey=lingshu-xinyu'),null);
});
test('public reads stay fixed public, no-store and never mutate',async()=>{
 const calls=[],client=createAcademicContentClient({fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({items:[],nextCursor:null})};}});
 await client.list('public',{});assert.equal(calls[0].url,'/api/public/hubs/lingshu-xinyu/academic-content');assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.cache,'no-store');
});
test('malformed successful mutations remain unknown instead of discarding input',async()=>{
 const client=createAcademicContentClient({fetchImpl:async()=>({ok:true,json:async()=>({})})});await assert.rejects(client.mutate({action:'create',id:null,body:{requestKey:'original-key',draft:{title:'合成'}}}),e=>e.unknown===true);
});
test('complete create receipts and original proof bind the same normalized draft',async()=>{
 const op={action:'create',id:null,body:{requestKey:'original-key',draft:{title:'合成创建'}}},content={id:'created-one',revision:1,status:'draft',draft:draftInput(op.body.draft)},receipt={contentId:content.id,action:'create',baseRevision:0,requestKey:op.body.requestKey,requestHash:mutationHash(op.action,null,op.body)};let query;
 const client=createAcademicContentClient({fetchImpl:async(url,init)=>{query=new URL(url,'http://example.test').searchParams;return{ok:true,json:async()=>init.method==='POST'?{content,receipt}:{state:'committed',...receipt,result:{content,receipt}}};}});
 assert.equal((await client.mutate(op)).content.id,content.id);assert.equal((await client.operation(op)).state,'committed');assert.equal(query.get('requestHash'),receipt.requestHash);assert.equal(query.get('baseRevision'),'0');
 const mismatch=createAcademicContentClient({fetchImpl:async()=>({ok:true,json:async()=>({state:'committed',...receipt,contentId:'different-created-id',result:{content,receipt}})})});await assert.rejects(mismatch.operation(op));
});
test('unknown read never retries a write and cannot mix another actor receipt or private projection',async()=>{
 const op={action:'publish',id:'one',body:{requestKey:'original-key',baseRevision:1}},calls=[];
 const client=createAcademicContentClient({fetchImpl:async(url,init)=>{calls.push(init.method);return{ok:true,json:async()=>({state:'committed',contentId:'other',action:'publish',baseRevision:1,requestKey:'original-key',requestHash:'0'.repeat(64)})};}});
 await assert.rejects(client.operation(op));assert.deepEqual(calls,['GET']);
 const leaked=createAcademicContentClient({fetchImpl:async()=>({ok:true,json:async()=>({items:[{id:'one',title:'私有',body:'正文',summary:'摘要',audience:'members',resources:[]}],nextCursor:null})})});await assert.rejects(leaked.list('public',{}));
});
