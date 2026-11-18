import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeClient} from '../src/knowledge-session.js';
const api=await import('../src/guidance-plan-citation.js').catch(()=>({}));
test('only bounded scoped citation reads and writes reach the same-origin transport',async()=>{
 const calls=[],client=createKnowledgeClient({scope:()=>({studyGroupId:'g',researchProjectId:'p'}),fetchImpl:async(url,init)=>{calls.push([url,init.method,init.headers]);return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 await client.get('/research-plan-drafts/own/guidance-citations');await client.get('/research-plan-drafts/own/guidance-citations?versionNo=12');await client.post('/research-plan-drafts/own/guidance-citations',{});
 for(const path of ['/research-plan-drafts/own/guidance-citations?versionNo=0','/research-plan-drafts/own/guidance-citations?versionNo=01','/research-plan-drafts/own/guidance-citations?versionNo=2&accountId=other','/research-plan-drafts/own/guidance-citations/approve'])await assert.rejects(client.get(path));
 await assert.rejects(client.post('/research-plan-drafts/own/guidance-citations?versionNo=2',{}));assert.equal(calls.length,3);assert.equal(calls[0][2]['X-Study-Group-Id'],'g');
});
test('explicit human add submits server-owned paragraph/source coordinates, never page, quote or account overrides',()=>{
 assert.equal(typeof api.buildGuidanceCitationAdd,'function');
 const source={documentId:'doc',clauseDetails:{extractionId:'extract',sourceSha256:'source-hash',payloadSha256:'payload-hash',clauses:[{id:'clause-1',quote:'原文不可进入输入',pdfPage:8}]}};
 const data={version:3,currentVersion:3,canEdit:true,readOnly:false,sourceStatus:'current',paragraphs:[{start:0,end:4,text:'方案原文',sha256:'target-hash'}],sources:[source]};
 const selection={paragraph:'0',documentId:'doc',clauseId:'clause-1',purpose:'design_check',confirmed:true};
 assert.deepEqual(api.buildGuidanceCitationAdd(data,selection),{action:'add',target:{start:0,end:4,sha256:'target-hash'},source:{documentId:'doc',extractionId:'extract',sourceSha256:'source-hash',payloadSha256:'payload-hash'},clauseId:'clause-1',purpose:'design_check',confirmed:true});
 for(const changed of [{...selection,confirmed:false},{...selection,paragraph:''},{...selection,documentId:'foreign'},{...selection,clauseId:'missing'}])assert.throws(()=>api.buildGuidanceCitationAdd(data,changed));
 for(const changed of [{...data,canEdit:false},{...data,readOnly:true},{...data,sourceStatus:'stale'}])assert.throws(()=>api.buildGuidanceCitationAdd(changed,selection));
});
test('empty/reset choices are clean and real choices participate in leave protection',()=>{
 assert.equal(typeof api.citationSelectionDirty,'function');
 assert.equal(api.citationSelectionDirty({paragraph:'',documentId:'',clauseId:'',purpose:'design_check',confirmed:false}),false);
 assert.equal(api.citationSelectionDirty({paragraph:'0',documentId:'',clauseId:'',purpose:'design_check',confirmed:false}),true);
 assert.equal(api.citationSelectionDirty({paragraph:'',documentId:'',clauseId:'',purpose:'background',confirmed:false}),true);
});
