import test from'node:test';import assert from'node:assert/strict';import{sessionMediaRequestAllowed}from'../src/session-media-session.js';
import{createKnowledgeClient}from'../src/knowledge-session.js';
const api=await import('../src/session-media-ingests.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('video registration writes use the existing narrow same-origin marker contract',()=>{
 for(const path of ['/sessions/session/media/media/ingests','/sessions/session/media/media/ingests/operation/confirm'])assert.equal(sessionMediaRequestAllowed('POST',path),true);
 for(const path of ['/sessions/session/media/media/ingests/operation/delete','/sessions/session/media/media/ingests?admin=true','/sessions/session/media/../other/ingests'])assert.equal(sessionMediaRequestAllowed('POST',path),false);
});
test('real knowledge client admits only explicit registration reads and sends its scoped request',async()=>{
 const calls=[],client=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'project'}),fetchImpl:async(url,init)=>{calls.push({url,init});return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
 for(const path of ['/sessions/session/media/media/ingest-targets','/sessions/session/media/media/ingests/operation','/sessions/session/media/media/ingest-receipts/key']){assert.equal(sessionMediaRequestAllowed('GET',path),true);await client.get(path);}
 assert.equal(calls.length,3);assert.equal(calls[0].init.headers['X-Study-Group-Id'],'group');assert.equal(sessionMediaRequestAllowed('GET','/sessions/session/media/media/ingest-targets?admin=true'),false);
});
test('registration pending record contains only scoped IDs and intent; unknown preparation preserves the same request key',()=>{
 assert(api,'media ingest client missing');const value={schema:'hub-media-ingest-pending.v1',requestKey:'key',body:{requestKey:'key',studyId:'study',subjectId:'subject',subjectVisitId:null,collectedAt:null}};
 assert.deepEqual(api.readMediaIngestPending(JSON.stringify(value)),value);
 for(const v of [{...value,body:{...value.body,filename:'personal.mp4'}},{...value,requestKey:'../bad'},{...value,body:{...value.body,requestKey:'different'}}])assert.equal(api.readMediaIngestPending(JSON.stringify(v)),null);
});
test('acquisition target lookup accepts one explicit Study filter only',async()=>{
 assert.equal(sessionMediaRequestAllowed('GET','/sessions/session/media/media/ingest-targets?studyId=study'),true);
 for(const q of ['studyId=study&studyId=other','studyId=study&admin=true','studyId=../other','studyId=','subjectId=subject'])assert.equal(sessionMediaRequestAllowed('GET','/sessions/session/media/media/ingest-targets?'+q),false,q);
 const client=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'project'}),fetchImpl:async()=>new Response('{}',{headers:{'Content-Type':'application/json'}})});
 await client.get('/sessions/session/media/media/ingest-targets?studyId=study');
});
test('untrusted receipt cannot introduce another media, subject or a foreign content URL',()=>{
 assert(api,'media ingest client missing');assert.throws(()=>api.assertMediaIngest({state:'committed'},'media'),/MEDIA_INGEST_RESPONSE/);
 assert.equal(api.mediaIngestSubjectHref({study:{id:'study'},subject:{id:'subject'}}),'/pages/s04/?formalSubjects=1&studyId=study&subjectId=subject');
});
