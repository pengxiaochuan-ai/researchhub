import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupCommittedTestSessions} from './fixtures/committed-session-cleanup.mjs';
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'actor'};
function fixture({foreign=false,reserved=false,executed=false,extraChild=false,foreignMessage=false,extraAudit=false}={}){
 const writes=[],ids=new Set(['rh-aiq-created-now']);
 const tx={$executeRawUnsafe:async()=>{},$queryRawUnsafe:async()=>[],session:{findMany:async({where})=>{assert.deepEqual(where.id.in,[...ids]);return[{id:[...ids][0],...scope,...foreign&&{accountId:'other'}}];},deleteMany:async args=>{writes.push(args);return{count:1};}},message:{findMany:async()=>[{id:'new-message',tenantId:foreignMessage?'other':'tenant',role:'user'}]},knowledgeChatJob:{findMany:async()=>[{id:'new-job',sessionId:[...ids][0],requestKey:'new-request',...scope,attempts:executed?1:0}]},tokenQuotaReservation:{count:async()=>reserved?1:0},auditLog:{findMany:async()=>[{id:'audit',action:extraAudit?'real-business-event':'hub_command_enqueue'}],deleteMany:async args=>writes.push(args)}};
 for(const name of ['artifact','structuredInteraction','researchAgentRun','researchMethodRun','dataAnalysisQuery'])tx[name]={count:async()=>extraChild?1:0};
 return{ids,writes,db:{$transaction:fn=>fn(tx)}};
}
test('cleans only this test run IDs with exact owner scope; never a prefix or historical sweep',async()=>{
 const h=fixture();assert.deepEqual(await cleanupCommittedTestSessions({db:h.db,scope,sessionIds:h.ids}),{sessions:1});
 assert.equal(h.writes.length,2);for(const w of h.writes){assert.equal(w.where.tenantId,'tenant');assert.equal(w.where.accountId,'actor');assert(!JSON.stringify(w).includes('startsWith'));}
});
for(const options of [{foreign:true},{reserved:true},{executed:true},{extraChild:true},{foreignMessage:true},{extraAudit:true}])test('unexpected owner or real billing evidence prevents all deletion '+JSON.stringify(options),async()=>{
 const h=fixture(options);await assert.rejects(cleanupCommittedTestSessions({db:h.db,scope,sessionIds:h.ids}));assert.equal(h.writes.length,0);
});
test('empty run does not connect or touch existing fixtures',async()=>assert.deepEqual(await cleanupCommittedTestSessions({db:{},scope,sessionIds:new Set()}),{sessions:0}));
