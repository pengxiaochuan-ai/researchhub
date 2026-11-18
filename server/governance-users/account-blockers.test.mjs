import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAccountBlockers} from './account-blockers.mjs';
function fixture(){
 let project='';const seen=[];const empty={findFirst:async()=>null};
 const db={$executeRaw:async(strings,...values)=>{project=values.at(-1);},tokenQuotaReservation:empty,studyGroup:{findMany:async()=>[{id:'g',status:'active'}]},researchProject:{findMany:async()=>[{id:'first',status:'active'},{id:'other',status:'disabled'}]},researchProjectMembership:{findFirst:async()=>null,count:async()=>1}};
 for(const model of ['knowledgeChatJob','researchAgentRun','researchEvidenceRun','researchMethodRun','researchArtifactExportJob','processingTask','remediationAttempt','dataAnalysisQuery','knowledgeImportTask'])db[model]={findFirst:async({where})=>{seen.push({model,where,project});return null;}};
 return{db,seen};
}
const principal={tenantId:'t',accountId:'admin',authVersion:5},target={id:'member'};
test('scans other and disabled projects with exact target and project scope, not only current Study',async()=>{
 const f=fixture();assert.deepEqual(await inspectAccountBlockers(f.db,principal,target),[]);assert.equal(f.seen.length,18);
 assert(f.seen.some(x=>x.where.researchProjectId==='other'));assert(f.seen.every(x=>[x.where.accountId,x.where.createdBy,x.where.requestedBy].includes('member')));
});
test('unresolved accounting and actual tasks block, query failure never becomes an empty result',async()=>{
 const f=fixture();f.db.tokenQuotaReservation={findFirst:async()=>({id:'expired-but-unresolved'})};f.db.processingTask={findFirst:async()=>({id:'running'})};
 assert.equal((await inspectAccountBlockers(f.db,principal,target)).length,2);
 f.db.processingTask={findFirst:async()=>{throw Error('db-failure');}};await assert.rejects(inspectAccountBlockers(f.db,principal,target),/db-failure/);
});
test('active membership with no other active account manager blocks disabling',async()=>{
 const f=fixture();f.db.researchProjectMembership={findFirst:async()=>({id:'sole'}),count:async()=>0};assert.equal((await inspectAccountBlockers(f.db,principal,target)).length,1);
});
test('completed legacy knowledge imports use complete, not the chat-job terminal spelling',async()=>{
 const f=fixture();await inspectAccountBlockers(f.db,principal,target);assert(f.seen.find(x=>x.model==='knowledgeImportTask').where.status.notIn.includes('complete'));
});
test('ready exports and succeeded queries are finished history, while unknown states still block',async()=>{
 const f=fixture();await inspectAccountBlockers(f.db,principal,target);
 assert(f.seen.find(x=>x.model==='researchArtifactExportJob').where.status.notIn.includes('ready'));
 assert(f.seen.find(x=>x.model==='dataAnalysisQuery').where.status.notIn.includes('succeeded'));
 assert(!f.seen.find(x=>x.model==='dataAnalysisQuery').where.status.notIn.includes('unknown'));
});
