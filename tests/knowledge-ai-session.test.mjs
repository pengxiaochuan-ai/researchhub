import{test}from'node:test';
import assert from'node:assert/strict';
import{createKnowledgeClient,canUseKnowledgeAi}from'../src/knowledge-session.js';
const scope={studyGroupId:'group',researchProjectId:'project'};
test('AI permission requires the actual group/project and original chat gate',()=>{
 const user={studyGroups:[{id:'group',role:{menuPermissions:['knowledge','workbench'],buttonPermissions:['knowledge.edit','chat.use']},researchProjects:[{id:'project'}]}]};
 assert.equal(canUseKnowledgeAi(user,scope),true);assert.equal(canUseKnowledgeAi(user,{...scope,researchProjectId:'foreign'}),false);
 assert.equal(canUseKnowledgeAi({...user,studyGroups:[{...user.studyGroups[0],role:{menuPermissions:['knowledge'],buttonPermissions:['knowledge.edit']}}]},scope),false);
});
test('only the bounded old knowledge-session routes are added; no generic sessions/admin transport',async()=>{
 const calls=[];const client=createKnowledgeClient({scope:()=>scope,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});}});
 await client.get('/agents');await client.post('/sessions/knowledge',{agentId:'agent',kbId:'kb'});await client.get('/sessions/session/knowledge-state?limit=60');await client.post('/sessions/session/knowledge-messages',{text:'合成问题',requestKey:'request-0001',kbIds:['kb']});await client.get('/sessions/session/knowledge-sources/message/1');
 assert.equal(calls.length,5);assert.ok(calls.every(c=>c.init.credentials==='same-origin'&&c.init.headers['X-Research-Project-Id']==='project'));
 for(const path of ['/sessions','/sessions/session/messages','/agents/agent/configs','/sessions/../knowledge-state'])await assert.rejects(client.get(path));
 await assert.rejects(client.patch('/agents',{}));assert.equal(calls.length,5);
});
test('Hub source conversation uses only the bounded session route and empty Study KB scope',async()=>{
 const calls=[];const client=createKnowledgeClient({scope:()=>scope,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});}});
 await client.post('/sessions/hub-source',{agentId:'agent',hubKey:'lingshu-xinyu'});
 await client.post('/sessions/session/knowledge-messages',{text:'合成问题',requestKey:'hub-request-0001',kbIds:[]});
 assert.equal(calls[0].url,'/api/sessions/hub-source');
 assert.deepEqual(JSON.parse(calls[1].init.body).kbIds,[]);
 await assert.rejects(client.post('/sessions/hub-source/other',{}));
});
