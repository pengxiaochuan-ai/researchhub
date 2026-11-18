// Synthetic T05 draft verification. Requires the separately reviewed policy migration; never applies DDL.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fixtureEnvironment,createCreationFixture,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createProtocolConfigurationService} from '../server/research-execution/protocols.mjs';
import {createPolicyDraftService} from '../server/research-execution/policy-drafts.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
await withFixtureTransaction(env,'direct',async tx=>{const [r]=await tx.$queryRaw`SELECT to_regclass('public.study_execution_policy_version') IS NOT NULL AS present`;assert.equal(r.present,true,'POLICY_MIGRATION_NOT_APPLIED');},{readOnly:true});
const {ids,accounts,runId}=await createCreationFixture(env);let prisma;const checks=[];
try{
 process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
 const {load}=runtimeDependencies();prisma=new(load('prisma/prisma.service','PrismaService'))();
 const group=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma),core=new(load('study-operations/study-operations.service','StudyOperationsService'))(prisma);
 const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:(tx,user,g,input)=>group.createResearchProjectInTransaction(tx,user,g,input)});
 const configs=createProtocolConfigurationService({studies,core}),policies=createPolicyDraftService({studies});const admin={accountId:accounts.admin,tenantId:ids.tenant,authVersion:0};const key=()=>`t05-${randomUUID()}`;
 const intent=await studies.create(admin,{requestKey:key(),title:'T05 合成测试',hubKey:ids.hub});const study=(await studies.createStudy(admin,intent.item.id,{requestKey:key(),expectedVersion:intent.item.version,studyGroupId:ids.group})).item.study;
 const created=await configs.create(admin,study.id,{requestKey:key(),title:'合成方案',purpose:'合成用途',primaryOutcomes:[],visitPlans:[]});const id=created.protocol.id;
 const body={requestKey:key(),expectedPolicyId:null,sections:{ethics:{status:'not_applicable',source:'合成软件测试',reason:'不涉及真实受试者'}}};
 const first=await policies.save(admin,study.id,id,body);assert.deepEqual(await policies.save(admin,study.id,id,body),first);checks.push('idempotent_draft_save');
 const read=await policies.get(admin,study.id,id);assert.equal(read.policy.id,first.policy.id);assert.equal(read.policy.sections.ethics.decidedBy,admin.accountId);assert.equal(read.policy.sections.site.status,'missing');checks.push('draft_readback_and_missing_defaults');
 await assert.rejects(policies.save(admin,study.id,id,{...body,requestKey:key()}),e=>e.code==='RESEARCH_VERSION_CONFLICT');checks.push('stale_policy_rejected');
 await assert.rejects(policies.save({tenantId:ids.foreignTenant,accountId:accounts.foreign,authVersion:0},study.id,id,{...body,requestKey:key()}));checks.push('foreign_tenant_denied');
 const result={passed:true,syntheticOnly:true,runId,studyId:study.id,protocolId:id,checks,at:new Date().toISOString(),scope:'policy-draft-only',actualHttp:false,browserAcceptance:false};const directory=workspaceRoot+'researchhub/docs/testing/evidence/research-t05-2026-11-11/';mkdirSync(directory,{recursive:true});writeFileSync(directory+'policy-draft-pg.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){console.error(JSON.stringify({passed:false,syntheticOnly:true,runId,checks,error:{code:e.code,status:e.status,message:String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(-1200)}}));process.exitCode=1;}
finally{await prisma?.app.$disconnect();await prisma?.elevated.$disconnect();}
