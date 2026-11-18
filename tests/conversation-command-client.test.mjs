import test from 'node:test';import assert from 'node:assert/strict';
import {conversationCommandRequestAllowed,createKnowledgeClient} from '../src/knowledge-session.js';
test('command transport is narrow, scoped and supports versioned editing and soft cancellation',async()=>{
 for(const[m,p]of [['GET','/sessions/s/commands'],['POST','/sessions/s/commands'],['PATCH','/sessions/s/commands/c'],['POST','/sessions/s/commands/c/cancellation'],['POST','/sessions/s/commands/resumption']])assert(conversationCommandRequestAllowed(m,p));
 for(const[m,p]of [['DELETE','/sessions/s/commands/c'],['PATCH','/sessions/s/commands'],['POST','/sessions/s/commands/c'],['GET','https://evil/commands'],['POST','/sessions/s/commands/c/cancellation/extra']])assert(!conversationCommandRequestAllowed(m,p));
 let seen;const client=createKnowledgeClient({scope:()=>({studyGroupId:'g',researchProjectId:'p'}),fetchImpl:async(url,init)=>{seen={url,init};return new Response('{}',{headers:{'content-type':'application/json'}});}});
 await client.patch('/sessions/s/commands/c',{text:'编辑',version:2});assert.equal(seen.init.headers['X-Study-Group-Id'],'g');assert.equal(seen.init.method,'PATCH');assert.equal(JSON.parse(seen.init.body).version,2);
});
