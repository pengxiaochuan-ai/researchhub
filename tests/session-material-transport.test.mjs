import test from 'node:test';import assert from 'node:assert/strict';
import {createKnowledgeClient} from '../src/knowledge-session.js';
const scope=()=>({studyGroupId:'group',researchProjectId:'project'});
test('session material state and receipts use scoped backend reads, never a submission fallback',async()=>{
  const calls=[],client=createKnowledgeClient({scope,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({items:[],nextCursor:null}),{headers:{'Content-Type':'application/json'}});}});
  assert.deepEqual(await client.get('/sessions/session-1/materials?limit=20'),{items:[],nextCursor:null});
  await client.get('/sessions/session-1/materials/receipts/request-1');
  assert.equal(calls.length,2);assert(calls.every(c=>c.init.method==='GET'&&c.init.headers['X-Study-Group-Id']==='group'&&c.init.credentials==='same-origin'));
  await assert.rejects(client.post('/sessions/session-1/materials/receipts/request-1',{}));
  assert.equal(calls.length,2);
});
