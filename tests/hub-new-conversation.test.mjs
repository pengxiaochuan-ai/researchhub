import test from 'node:test';
import assert from 'node:assert/strict';
import {isHubSession} from '../scripts/hub-agent-contract.mjs';
import {hubHistoryQuery,projectHubHistory} from '../scripts/hub-conversation-history.mjs';

const sessionModule=await import('../scripts/hub-conversation-session.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const first='b15ec388-88dc-4dbb-8fd5-c43416f2c183',second='06251b53-52cb-4fcf-9984-918806916b41';
const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'};

test('new conversations have distinct contexts, while replaying the same creation keeps its identity',async()=>{
 assert.equal(typeof sessionModule.ensureHubConversation,'function');
 const rows=new Map(),calls=[];
 const sessions={async ensureKnowledgeSession(principal,agent,context,title){calls.push({principal,agent,context});if(!rows.has(context))rows.set(context,{id:'s'+rows.size,contextKey:context,title});return rows.get(context);}};
 const create=conversationKey=>sessionModule.ensureHubConversation({sessions,authorize:async()=>{},user,agentId:'agent',conversationKey});
 const a=await create(first),b=await create(second),again=await create(first);
 assert.notEqual(a.id,b.id);assert.equal(a.id,again.id);
 assert.equal(a.contextKey,'hub:lingshu-xinyu:conversation:'+first);
 assert.deepEqual(calls[0].principal,user);assert.equal(calls[0].agent,'agent');
 assert.equal((await create()).contextKey,'hub:lingshu-xinyu');
});

test('invalid creation key and revoked access cannot reach the legacy session writer',async()=>{
 assert.equal(typeof sessionModule.ensureHubConversation,'function');
 let writes=0;const sessions={async ensureKnowledgeSession(){writes++;}};
 for(const conversationKey of ['',null,'../../other','hub:private','not-a-uuid'])await assert.rejects(sessionModule.ensureHubConversation({sessions,authorize:async()=>{},user,agentId:'agent',conversationKey}));
 await assert.rejects(sessionModule.ensureHubConversation({sessions,authorize:async()=>{throw Error('revoked');},user,agentId:'agent',conversationKey:first}),/revoked/);
 assert.equal(writes,0);
});

test('new Hub context is recognized and projected without exposing its internal key',()=>{
 const contextKey='hub:lingshu-xinyu:conversation:'+first;
 assert.equal(isHubSession({contextKey}),true);
 assert.deepEqual(projectHubHistory({id:'new',title:'新对话',updatedAt:'now',contextKey}),{id:'new',title:'新对话',updatedAt:'now',hasPrompt:false,kind:'hub'});
 assert.equal(isHubSession({contextKey:'hub:lingshu-xinyu:conversation:forged'}),false);
 const q=hubHistoryQuery(user,'agent');
 assert(q.where.OR.some(row=>row.contextKey?.startsWith==='hub:lingshu-xinyu:conversation:'));
 assert.equal(q.where.accountId,'a');assert.equal(q.where.tenantId,'t');
});
