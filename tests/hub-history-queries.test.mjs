import test from 'node:test';import assert from 'node:assert/strict';
import * as history from '../scripts/hub-conversation-history.mjs';
import {articleContextKey} from '../server/hub-sources/article-evidence.mjs';
import * as visibility from '../server/hub-sources/visible-repository.mjs';
const auditLog={findMany:async({where})=>{assert.equal(where.action,'hub_session_rename');assert.equal(where.tenantId,'t');assert.equal(where.accountId,'a');return[];}};
const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'};
const hub=(id)=>({id,contextKey:'hub:lingshu-xinyu',title:'old',updatedAt:new Date('2026-11-16'),messages:[{content:'first',meta:{hubCommand:{originalText:'保留完整的首条问题'}}}]});
test('ordinary history does not query unused jobs; pagination sentinel is never projected',async()=>{
 assert.equal(typeof history.projectHubHistoryPage,'function');let calls=0;
 const items=await history.projectHubHistoryPage([hub('one'),hub('sentinel')],user,{auditLog,knowledgeChatJob:{findFirst:async()=>{calls++;}}},1);
 assert.equal(calls,0);assert.equal(items.length,1);assert.equal(items[0].title,'保留完整的首条问题');
});
test('article recovery keeps exact scoped latest-job lookup, including invalid latest hashes',async()=>{
 assert.equal(typeof history.projectHubHistoryPage,'function');const calls=[];
 const row={...hub('article'),contextKey:articleContextKey({recordId:'pmc-PMC13672493',articleVersion:'PMC13672493.1',rawSha256:'b'.repeat(64),reviewVersion:'1'})};
 const db={auditLog,knowledgeChatJob:{findFirst:async args=>{calls.push(args);return{requestKey:'latest',payload:{articleInputHash:'invalid'}};}}};
 const items=await history.projectHubHistoryPage([hub('normal'),row],user,db,20);
 assert.equal(calls.length,1);assert.deepEqual(calls[0].where,{...user,sessionId:'article'});assert.deepEqual(calls[0].orderBy,[{createdAt:'desc'},{id:'desc'}]);assert.equal(items[1].recovery,undefined);
});
test('history authority uses the same current Hub account and explicit Agent checks without a content search',async()=>{
 assert.equal(typeof visibility.assertHubAgent,'function');let active=true,access=true,context='t';const calls=[];
 const db={$queryRawUnsafe:async sql=>sql.startsWith('SELECT status FROM rh_admission')?[{status:'approved'}]:[],$queryRaw:async()=>[{tenant:context}],account:{findFirst:async args=>{calls.push(['account',args]);return active?{id:'a'}:null;}},agentAccess:{findFirst:async args=>{calls.push(['access',args]);return access?{id:'access'}:null;}}};
 const args={db,tenantId:'t',hubKey:'lingshu-xinyu',principal:{...user,authVersion:3}};
 await visibility.assertHubAgent(args);assert.equal(calls.length,3);assert.equal(calls[0][1].where.authVersion,3);assert.deepEqual(calls[0][1].where.tenant,{status:'active'});assert.equal(calls[2][1].where.enabled,true);assert.equal(calls[2][1].where.scopeKey,'a');assert.deepEqual(calls[2][1].where.agent,{status:'active',type:'research'});
 access=false;await assert.rejects(visibility.assertHubAgent(args),/HUB_SOURCE_SCOPE_REJECTED/);access=true;active=false;await assert.rejects(visibility.assertHubAgent(args),/HUB_SOURCE_SCOPE_REJECTED/);active=true;context='other';await assert.rejects(visibility.assertHubAgent(args),/HUB_SOURCE_SCOPE_REJECTED/);await assert.rejects(visibility.assertHubAgent({...args,principal:{...user,tenantId:'other'}}),/HUB_SOURCE_SCOPE_REJECTED/);
});
