import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import * as controller from './controller.mjs';
import {createDirectoryService} from './commands.mjs';
import {directoryRollback} from './test-support.mjs';

test('local controller retains entity budgets without fixed assertion or decision counts',()=>{
 assert.deepEqual(controller.localDirectoryBudget,{organization:3,team:3,researcher:4});
});

test('actual local budget permits decision 21 while current admin and valid sources remain required',async()=>directoryRollback(async({db,ctx,provenance,direct,sourceId,rowId})=>{
 assert(controller.localDirectoryBudget,'test must use the same budget installed by the controller');
 const service=createDirectoryService({db:{...db,budget:controller.localDirectoryBudget}}),admin=ctx('admin'),id='rhde-19ccf8f5caa84034b0dea6a897a0b43b';
 const entity=await service.adminEntity(admin,id),head=entity.facts.find(x=>x.kind==='profile');
 const fact=await service.appendAssertion(admin,id,{assertionKey:'profile',kind:'profile',expectedRevision:head.revision,payload:head.payload,provenance,requestKey:randomUUID()});
 const [before]=await direct(tx=>tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.decision WHERE tenant_id=${db.tenantId} AND hub_key=${db.hubKey}`);
 let version=0;
 const command=()=>({expectedDecisionVersion:version,assertionHash:fact.hash,decision:'approve',audience:'public',reason:'仅合成PG回滚：第21条仍须合法授权及来源',requestKey:randomUUID()});
 for(let n=0;n<Math.max(1,21-before.n);n++){const r=await service.decide(admin,fact.id,command());version=r.decisionVersion;}
 const [after]=await direct(tx=>tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.decision WHERE tenant_id=${db.tenantId} AND hub_key=${db.hubKey}`);assert(after.n>=21);
 await assert.rejects(()=>service.decide(ctx('owner'),fact.id,command()),{status:403});
 await direct(tx=>tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${db.tenantId},${db.hubKey},${sourceId},${rowId},'abstract','display','public','revoke','evidence://review-limit-rollback',${admin.user.accountId},1)`);
 await assert.rejects(()=>service.decide(admin,fact.id,command()),{status:409,code:'DIRECTORY_SOURCE_CHANGED'});
}));
test('actual local budget permits fact 41, preserves history and still rejects unauthorized, stale and changed-source writes',async()=>directoryRollback(async({db,ctx,provenance,direct})=>{
 const s=createDirectoryService({db:{...db,budget:controller.localDirectoryBudget}}),admin=ctx('admin'),id='rhde-19ccf8f5caa84034b0dea6a897a0b43b';
 const before=await direct(tx=>tx.$queryRaw`SELECT id,content_sha256 AS hash FROM rh_directory.assertion WHERE tenant_id=${db.tenantId} AND hub_key=${db.hubKey} ORDER BY id`),ids=new Set(before.map(x=>x.id));
 let head=(await s.adminEntity(admin,id)).facts.find(x=>x.kind==='profile');
 const body=()=>({kind:'profile',assertionKey:'profile',expectedRevision:head.revision,payload:head.payload,provenance,requestKey:randomUUID()});
 for(let n=0;n<Math.max(1,41-before.length);n++){await s.appendAssertion(admin,id,body());head=(await s.adminEntity(admin,id)).facts.find(x=>x.kind==='profile');}
 const after=await direct(tx=>tx.$queryRaw`SELECT id,content_sha256 AS hash FROM rh_directory.assertion WHERE tenant_id=${db.tenantId} AND hub_key=${db.hubKey} ORDER BY id`);assert(after.length>40);assert.deepEqual(after.filter(x=>ids.has(x.id)),before);
 await assert.rejects(()=>s.appendAssertion(ctx('owner'),id,body()),{status:403});
 await assert.rejects(()=>s.appendAssertion(admin,id,{...body(),expectedRevision:0}),{code:'DIRECTORY_VERSION_CONFLICT'});
 await assert.rejects(()=>s.appendAssertion(admin,id,{...body(),provenance:[{...provenance[0],sourceHash:'f'.repeat(64)}]}),{code:'DIRECTORY_SOURCE_CHANGED'});
 await assert.rejects(()=>s.createEntity(admin,{kind:'organization',stableKey:'cap-'+randomUUID(),requestKey:randomUUID()}),{code:'DIRECTORY_FIXTURE_BUDGET'});
 const [teams]=await direct(tx=>tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.entity WHERE tenant_id=${db.tenantId} AND kind='team'`);
 for(let n=teams.n;n<3;n++)await s.createEntity(admin,{kind:'team',stableKey:'cap-'+randomUUID(),requestKey:randomUUID()});
 await assert.rejects(()=>s.createEntity(admin,{kind:'team',stableKey:'cap-'+randomUUID(),requestKey:randomUUID()}),{code:'DIRECTORY_FIXTURE_BUDGET'});
}));
