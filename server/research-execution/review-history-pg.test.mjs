import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {loadFixtureInput}from'../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction}from'../../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies}from'../research-runtime/dependencies.mjs';
import {createLocalResearchPrisma}from'../../scripts/research-creation-local-integration.mjs';
import {createResearchStudiesService}from'../research-studies/commands.mjs';
import {createProtocolDecisionHistory}from'./review-history.mjs';
import {createProtocolReleaseService}from'./protocol-release.mjs';

test('actual app/RLS P3 records and own read-only receipt preserve exact source and current authorization',async()=>{
 const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json')),f=JSON.parse(readFileSync('../.tmp/researchhub-p3/fixture.json'));
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal(f.tenantId,ids.tenant);assert.equal(f.prepared,true);
 const {load}=runtimeDependencies(),prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:cb=>withFixtureTransaction(env,'app',cb)}),studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('READ_ONLY_PROBE');}}),history=createProtocolDecisionHistory({studies}),release=createProtocolReleaseService({studies,core:{}});
 const admin=await withFixtureTransaction(env,'direct',tx=>tx.account.findUnique({where:{id:ids.admin},select:{authVersion:true}}),{readOnly:true}),user={tenantId:ids.tenant,accountId:ids.admin,authVersion:admin.authVersion};
 const source=await withFixtureTransaction(env,'direct',async tx=>({events:await tx.auditLog.findMany({where:{tenantId:ids.tenant,researchProjectId:f.study.executionProjectId,target:f.protocols[0].id,action:{in:['study_protocol_transition','study_protocol_approve','study_protocol_activate']}},select:{id:true,action:true,createdAt:true,meta:true}}),receipt:(await tx.$queryRaw`SELECT request_key FROM rh_research.operation WHERE tenant_id=${ids.tenant} AND actor_id=${ids.admin} AND target_id=${f.protocols[0].id} AND action='protocol.approve'`)[0],protocols:await tx.studyProtocolVersion.count({where:{tenantId:ids.tenant,researchProjectId:f.study.executionProjectId}})}),{readOnly:true});assert.equal(source.protocols,2);
 const actual=[];let cursor;for(let i=0;i<40;i++){const value=await history.list(user,{limit:'1',...(cursor?{cursor}:{})});actual.push(...value.items.filter(x=>x.studyId===f.study.id&&x.protocol.id===f.protocols[0].id));cursor=value.nextCursor;if(actual.length===3||!cursor)break;}
 assert.deepEqual(actual.map(x=>x.decision.kind).sort(),['activated','approved','returned']);assert.equal(new Set(actual.map(x=>x.decision.id)).size,3);
 for(const row of actual){const original=source.events.find(e=>e.id===row.decision.id);assert(original);assert.equal(row.decision.createdAt,original.createdAt.toISOString());assert.equal(row.protocol.status,'executing');assert(row.decision.actorName);}
 const receipt=await release.receipt(user,f.study.id,f.protocols[0].id,source.receipt.request_key,{action:'approve'});assert.equal(receipt.found,true);assert.equal(receipt.result.protocol.status,'approved');assert.equal(actual[0].protocol.status,'executing'); // historical receipt stays approved, current protocol is executing
 await assert.rejects(release.receipt(user,f.study.id,f.protocols[0].id,source.receipt.request_key,{action:'activate'}),e=>e.status===404);
 await assert.rejects(history.list({...user,authVersion:user.authVersion+1},{}),e=>e.status===401);
 const page=await history.list(user,{limit:'1'});if(page.nextCursor)await assert.rejects(history.list({...user,accountId:ids.owner},{cursor:page.nextCursor}),e=>e.status===400);
});

test('real current Study manager removal hides old decisions without changing the account or authVersion; whole probe rolls back',async()=>{
 const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json')),f=JSON.parse(readFileSync('../.tmp/researchhub-p3/fixture.json'));
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal(f.tenantId,ids.tenant);const rollback=Error('P3_NEW_MEMBERSHIP_PROBE_ROLLBACK');
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const member=await tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:f.groupId,researchProjectId:f.study.executionProjectId,accountId:ids.owner,status:'active',roleKey:'project_manager'}});assert(member);
  const account=await tx.account.findUnique({where:{id:ids.owner},select:{authVersion:true,status:true}});assert.equal(account.status,'active');
  await tx.researchProjectMembership.update({where:{id:member.id},data:{status:'disabled'}});
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const {load}=runtimeDependencies(),prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:cb=>cb(tx)}),studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('READ_ONLY_PROBE');}}),history=createProtocolDecisionHistory({studies}),user={tenantId:ids.tenant,accountId:ids.owner,authVersion:account.authVersion};
  const rows=[];let cursor;for(let i=0;i<30;i++){const page=await history.list(user,{limit:'100',...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.nextCursor;if(!cursor)break;}assert.equal(cursor,null);assert(!rows.some(x=>x.studyId===f.study.id));
  const release=createProtocolReleaseService({studies,core:{}});await assert.rejects(release.receipt(user,f.study.id,f.protocols[0].id,'missing-key',{action:'approve'}),e=>[403,404].includes(e.status));
  throw rollback;
 }),e=>e===rollback);
 const restored=await withFixtureTransaction(env,'direct',tx=>tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,researchProjectId:f.study.executionProjectId,accountId:ids.owner}}),{readOnly:true});assert.equal(restored.status,'active');assert.equal(restored.roleKey,'project_manager');
});
