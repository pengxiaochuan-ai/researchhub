import test from 'node:test';import assert from 'node:assert/strict';import {createKnowledgeClient} from './knowledge-session.js';
test('real data upload and confirmation request same-origin transport; unknown upload never retries',async()=>{
 const calls=[],client=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'project'}),fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});}});
 const form=new FormData();form.append('requestKey','same-key');form.append('file',new Blob(['synthetic']), 'synthetic.xlsx');await client.upload('/sessions/s/research-data',form);await client.post('/sessions/s/profile-imports/p/confirmations',{version:1,hash:'a'.repeat(64)});
 for(const call of calls){assert.equal(call.init.mode,'same-origin');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.headers['X-ResearchHub-Request'],'research-data-v1');}assert.equal(calls[0].init.body,form);assert.equal(calls[0].init.headers['Content-Type'],undefined);
 let count=0;const failed=createKnowledgeClient({scope:()=>({studyGroupId:'group',researchProjectId:'project'}),fetchImpl:async()=>{count++;throw Error('network lost');}});await assert.rejects(failed.upload('/sessions/s/research-data',form),/未确认/);assert.equal(count,1);
});
