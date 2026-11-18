import test from 'node:test';
import assert from 'node:assert/strict';
import {isSyntheticEdcRoute,readSyntheticEdcLocation,makeSyntheticEdcUrl,syntheticEdcHeader} from '../src/synthetic-edc-session.js';
import {createKnowledgeClient} from '../src/knowledge-session.js';
const scope={studyGroupId:'group',researchProjectId:'study'};
test('explicit EDC routes never fall back to demo or another study',()=>{
 const url=makeSyntheticEdcUrl('s03',scope,'plan');assert(isSyntheticEdcRoute('s03',url.split('?')[1]));assert.deepEqual(readSyntheticEdcLocation('s03',url.split('?')[1]),{scope,planId:'plan',collectionId:null,recordId:null});
 for(const extra of ['&projectId=demo','&syntheticCapture=1','&studyGroupId=other'])assert.throws(()=>readSyntheticEdcLocation('s03',url.split('?')[1]+extra));
 assert.throws(()=>readSyntheticEdcLocation('s04',url.split('?')[1]));
 assert.equal(syntheticEdcHeader({},'s03',url.split('?')[1]).title,'合成采集演练');
});
test('transport scopes only approved collection routes, not formal EDC',async()=>{
 const calls=[],api=createKnowledgeClient({scope:()=>scope,fetchImpl:async(path,init)=>{calls.push({path,init});return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 await api.get('/research-plan-drafts/plan/synthetic-collections?limit=20');await api.post('/research-plan-drafts/plan/synthetic-collections',{});await api.get('/research-plan-drafts/plan/synthetic-collections/packet/versions/1');
 await api.post('/research-plan-drafts/plan/synthetic-collections/packet/records/record/drafts',{});
 await api.post('/research-plan-drafts/plan/synthetic-collections/packet/quality-snapshots',{});
 assert.equal(calls.length,5);assert.equal(calls[0].init.headers['X-Research-Project-Id'],'study');
 for(const path of ['/subjects','/research-plan-drafts/plan/synthetic-collections/packet/approve','/research-plan-drafts/plan/synthetic-collections/../packet'])await assert.rejects(api.post(path,{}));
});
test('quality explanation transport is restricted to the exact synthetic packet endpoint',async()=>{
 const calls=[],api=createKnowledgeClient({scope:()=>scope,fetchImpl:async(path)=>{calls.push(path);return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 await api.post('/research-plan-drafts/plan/synthetic-collections/packet/explanation-jobs',{});assert.equal(calls.length,1);
 for(const suffix of ['explanations','explanation-jobs/execute','approve','export'])await assert.rejects(api.post('/research-plan-drafts/plan/synthetic-collections/packet/'+suffix,{}));
});
test('only own EDC report draft read, history and notes paths enter the scoped transport',async()=>{
 const calls=[],api=createKnowledgeClient({scope:()=>scope,fetchImpl:async(path)=>{calls.push(path);return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 const path='/research-plan-drafts/plan/synthetic-collections/packet/report-drafts';await api.post(path,{});await api.get(path+'/report');await api.get(path+'/report/versions/1');await api.post(path+'/report/notes',{});assert.equal(calls.length,4);
 for(const suffix of ['/report/approve','/report/export','/report/asset-drafts'])await assert.rejects(api.post(path+suffix,{}));
});
