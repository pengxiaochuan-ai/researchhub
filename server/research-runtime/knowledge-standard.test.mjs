import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeKnowledge} from './knowledge-runtime.mjs';

test('standard knowledge uses native visibility and a real scoped session without fixture IDs or an acceptance ledger',async()=>{
 const user={tenantId:'tenant',accountId:'new-member',studyGroupId:'new-study',researchProjectId:'new-project',authVersion:1};
 const kb={id:'new-kb',tenantId:'tenant',studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,name:'本人文献'};
 let visible=true,session;
 const tx={$executeRawUnsafe:async()=>{},$queryRaw:async()=>[{tenant:'tenant'}],$queryRawUnsafe:async(sql)=>sql.startsWith('SELECT status')?[{status:'approved'}]:[],account:{findFirst:async()=>({id:user.accountId})},agentAccess:{findFirst:async()=>({id:'access'})},knowledgeBase:{findUnique:async()=>kb},session:{findFirst:async()=>session}};
 class Sessions{async ensureKnowledgeSession(actor,agentId,contextKey){session={id:'real-session',...actor,agentId,contextKey,channel:'knowledge'};return{id:session.id};}}
 class Orchestrator{}
 const load=(_path,name)=>({withCurrentKnowledgeRead:async(_db,_user,fn)=>fn(tx),SessionsService:Sessions,OrchestratorService:Orchestrator,withAuthorizationMutation:async(_db,_tenant,fn)=>fn(tx),effectiveRuntimeToolKeys:()=>[],hubChatAdminToolPermissions:()=>({})})[name];
 const runtime=createRuntimeKnowledge({prisma:{app:{},elevated:{}},load,agentId:'tenant-kb-research',config:{executionProfile:'standard',scope:{defaultTenantId:'tenant'}},services:{modelExecution:async(_proof,fn)=>fn(),knowledge:{search:async()=>[]},retrieval:{accessibleKbIds:async()=>visible?[kb.id]:[]}}});
 assert(runtime);assert.deepEqual(runtime.quota(user,kb.id),{blocked:false});
 assert.deepEqual(await runtime.ensure(user,kb.id),{id:'real-session'});assert.equal(session.contextKey,'kb:new-kb');
 visible=false;await assert.rejects(runtime.ensure(user,kb.id),e=>e.code==='KNOWLEDGE_SOURCE_RESTRICTED');
 assert.throws(()=>runtime.quota({...user,tenantId:'other'},kb.id));
});
