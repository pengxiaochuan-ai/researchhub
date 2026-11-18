// Explicitly invoked, guarded PostgreSQL verification; never imported by production runtime.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixtureEnvironment,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {setContext} from '../server/research-studies/repository.mjs';

assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--fixture');
const fixturePath=resolve(process.argv[3]);
assert(fixturePath.startsWith(workspaceRoot+'.tmp/researchhub-creation/'));
const f=JSON.parse(readFileSync(fixturePath));
assert.match(f.runId,/^rh-create-[a-f0-9]{8}$/);
assert.equal(fixturePath,f.privateDirectory+'fixture.json');
for(const value of [...Object.values(f.ids),...Object.values(f.accounts)])assert(value.startsWith(f.runId));
const env=fixtureEnvironment();await assertFixtureTarget(env);
const [registered]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`,{readOnly:true});
assert.equal(registered?.manifest?.purpose,'ResearchHub-creation-20261111');assert.equal(registered.manifest.syntheticOnly,true);
assert.deepEqual(registered.manifest.ids,f.ids);assert.deepEqual(registered.manifest.accounts,f.accounts);
const accepted=JSON.parse(readFileSync(f.privateDirectory+'accepted.json'));
const project=accepted.project;assert(project?.study?.id&&project.study.executionProjectId);
const [{count:acceptedCount}]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT count(*)::int AS count FROM rh_research.project_intent i JOIN rh_research.study_binding b ON b.project_intent_id=i.id AND b.tenant_id=i.tenant_id WHERE i.id=${project.id} AND i.tenant_id=${f.ids.tenant} AND b.id=${project.study.id} AND b.execution_project_id=${project.study.executionProjectId}`,{readOnly:true});assert.equal(acceptedCount,1);

const probe='pg-'+randomUUID(),out=workspaceRoot+'researchhub/docs/testing/evidence/research-creation-2026-11-11/'+f.runId+'/'+probe+'/';mkdirSync(out,{recursive:true});
const checks=[],sqlStates=[],artifacts={};let prisma;
const sqlState=error=>error.meta?.code??error.meta?.database_error?.match(/\b(?:23514|42501)\b/)?.[0]??String(error.message).match(/code: "(\d{5})"/)?.[1]??String(error.message).match(/\b(23514|42501)\b/)?.[1];
async function rejected(name,operation,allowed){let caught;try{await operation();}catch(error){caught=error;}assert(caught,name+' must reject');const state=sqlState(caught);assert(allowed.includes(state),name+' returned '+String(state));sqlStates.push({name,state});return state;}
const app=(callback,{off=false}={})=>withFixtureTransaction(env,'app',async db=>{
 await setContext(db,{tenantId:f.ids.tenant,accountId:f.accounts.admin,authVersion:0},f.ids.group,project.study.executionProjectId);
 if(off)await db.$executeRawUnsafe('SET LOCAL row_security=off');
 return callback(db);
});
try{
 const policies=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT c.relname AS name,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_research' AND c.relkind='r' ORDER BY c.relname`,{readOnly:true});
 assert.deepEqual(policies.map(p=>p.name),['hub_role','operation','project_intent','study_binding']);assert(policies.every(p=>p.enabled&&p.forced));artifacts.policies=policies;
 const [auditFunction]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT p.prosecdef AS "securityDefiner",p.proconfig AS configuration,has_function_privilege('aisci_app',p.oid,'EXECUTE') AS "appCanExecute" FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rh_research' AND p.proname='check_operation_audit'`,{readOnly:true});
 assert.equal(auditFunction.securityDefiner,true);assert(auditFunction.configuration.includes('search_path=pg_catalog'));assert.equal(auditFunction.appCanExecute,false);artifacts.auditFunction=auditFunction;
 checks.push('four_tables_force_rls_and_narrow_audit_trigger_has_no_app_execute_privilege');

 const hidden=await app(async db=>{
  await setContext(db,{tenantId:f.ids.foreignTenant,accountId:f.accounts.foreign,authVersion:0},f.ids.foreignGroup);
  return db.$queryRaw`SELECT 'project_intent' AS name,count(*)::int AS count FROM rh_research.project_intent WHERE tenant_id=${f.ids.tenant} UNION ALL SELECT 'study_binding',count(*)::int FROM rh_research.study_binding WHERE tenant_id=${f.ids.tenant} UNION ALL SELECT 'hub_role',count(*)::int FROM rh_research.hub_role WHERE tenant_id=${f.ids.tenant} UNION ALL SELECT 'operation',count(*)::int FROM rh_research.operation WHERE tenant_id=${f.ids.tenant}`;
 });assert.equal(hidden.length,4);assert(hidden.every(row=>row.count===0));artifacts.crossTenantSelect=hidden;
 await rejected('cross_tenant_insert_parent_or_rls',()=>app(db=>db.$executeRaw`INSERT INTO rh_research.project_intent(id,tenant_id,owner_id,title) VALUES (${f.runId+'__'+probe+'-foreign-attempt'},${f.ids.foreignTenant},${f.accounts.foreign},'合成跨租户拒绝验证')`),['23514','42501']);
 await rejected('forced_rls_cannot_be_disabled_by_app',()=>app(db=>db.$queryRaw`SELECT id FROM rh_research.project_intent WHERE tenant_id=${f.ids.foreignTenant}`,{off:true}),['42501']);
 checks.push('app_cross_tenant_reads_zero_insert_denied_and_row_security_off_cannot_bypass');

 await rejected('wrong_study_group_parent_chain',()=>app(db=>db.$executeRaw`INSERT INTO rh_research.study_binding(id,tenant_id,project_intent_id,execution_project_id,study_group_id,hub_key,is_default) VALUES (${f.runId+'__'+probe+'-wrong-parent'},${f.ids.tenant},${project.id},${project.study.executionProjectId},${f.ids.otherGroup},${project.hubKey},false)`),['23514']);
 checks.push('database_rejects_real_execution_project_with_wrong_study_group_parent');

 const foreignAuditId=f.runId+'__'+probe+'-foreign-audit';
 await withFixtureTransaction(env,'direct',db=>db.auditLog.createMany({data:{id:foreignAuditId,tenantId:f.ids.foreignTenant,studyGroupId:f.ids.foreignGroup,accountId:f.accounts.foreign,action:'researchhub.pg_verification',target:probe,meta:{syntheticOnly:true,runId:f.runId}}}));
 await rejected('foreign_audit_parent_chain',()=>app(db=>db.$executeRaw`INSERT INTO rh_research.operation(id,tenant_id,actor_id,request_key,request_hash,action,target_id,result,audit_id) VALUES (${f.runId+'__'+probe+'-operation'},${f.ids.tenant},${f.accounts.admin},${probe+'-audit'},${'0'.repeat(64)},'pg.verify',${project.id},'{}'::jsonb,${foreignAuditId})`),['23514']);
 artifacts.foreignAudit={id:foreignAuditId,tenantId:f.ids.foreignTenant};checks.push('existing_foreign_tenant_audit_cannot_be_linked_to_local_operation');

 process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
 const {load}=runtimeDependencies();prisma=new(load('prisma/prisma.service','PrismaService'))();
 const core=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma),scope={product:'researchhub',allowedTenantIds:[f.ids.tenant]},lockAuthorization=load('common/worker-publication','lockAuthorizationMutation');
 const admin=await prisma.withTenantTransaction(f.ids.tenant,undefined,undefined,async tx=>{const a=await tx.account.findFirst({where:{id:f.accounts.admin,tenantId:f.ids.tenant},select:{id:true,tenantId:true,authVersion:true}});assert(a);return{accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion};});
 const createCore=(tx,user,group,input)=>core.createResearchProjectInTransaction(tx,user,group,input);
 const service=createResearchStudiesService({prisma,scope,lockAuthorization,createResearchProject:createCore});
 const context=await service.resolveResearchStudy(admin,project.study.id);
 assert.deepEqual({tenantId:context.tenantId,studyGroupId:context.studyGroupId,executionProjectId:context.executionProjectId,projectIntentId:context.projectIntentId,studyId:context.studyId},{tenantId:f.ids.tenant,studyGroupId:project.study.studyGroupId,executionProjectId:project.study.executionProjectId,projectIntentId:project.id,studyId:project.study.id});assert.equal(context.capabilities.canConfigure,true);
 const handoff=await service.withResearchStudyTransaction(admin,project.study.id,'configure',async(tx,c)=>{const rows=await tx.$queryRaw`SELECT current_setting('app.tenant_id') AS tenant,current_setting('app.study_group_id') AS "group",current_setting('app.research_project_id') AS project,current_setting('app.account_id') AS actor`;const execution=await tx.researchProject.findFirst({where:{id:c.executionProjectId,tenantId:c.tenantId,studyGroupId:c.studyGroupId},select:{id:true}});return{installed:rows[0],executionId:execution?.id};});
 assert.deepEqual(handoff.installed,{tenant:f.ids.tenant,group:project.study.studyGroupId,project:project.study.executionProjectId,actor:f.accounts.admin});assert.equal(handoff.executionId,project.study.executionProjectId);artifacts.context=context;artifacts.transactionHandoff=handoff;
 await assert.rejects(service.resolveResearchStudy(admin,project.study.id,{operation:'collect'}),e=>e.status===403&&e.code==='RESEARCH_OPERATION_UNAVAILABLE');
 await assert.rejects(service.resolveResearchStudy(admin,project.study.id,{siteId:'unconfigured-site'}),e=>e.status===403&&e.code==='RESEARCH_SITE_UNAVAILABLE');
 await assert.rejects(service.withResearchStudyTransaction(admin,project.study.id,'read',()=>service.context(admin)),e=>e.code==='RESEARCH_NESTED_TRANSACTION');
 checks.push('real_resolve_and_transaction_handoff_install_exact_context_clinical_site_and_nested_ops_denied');

 const draft=await service.create(admin,{requestKey:probe+'-draft',title:'合成事务中断验证 '+probe,hubKey:f.ids.hub});
 let insertedExecutionId;const injected=new Error('PG_VERIFICATION_INJECTED_AFTER_CORE');
 const failing=createResearchStudiesService({prisma,scope,lockAuthorization,createResearchProject:async(...args)=>{const execution=await createCore(...args);insertedExecutionId=execution.id;throw injected;}});
 const failedRequest=probe+'-rollback';await assert.rejects(failing.createStudy(admin,draft.item.id,{requestKey:failedRequest,expectedVersion:draft.item.version,studyGroupId:f.ids.group}),e=>e===injected);assert(insertedExecutionId);
 const rollback=await withFixtureTransaction(env,'direct',async db=>{
  const [intent]=await db.$queryRaw`SELECT version,status FROM rh_research.project_intent WHERE tenant_id=${f.ids.tenant} AND id=${draft.item.id}`;
  const [counts]=await db.$queryRaw`SELECT (SELECT count(*)::int FROM public.research_project WHERE "tenantId"=${f.ids.tenant} AND id=${insertedExecutionId}) AS projects,(SELECT count(*)::int FROM public.research_project_membership WHERE "tenantId"=${f.ids.tenant} AND "researchProjectId"=${insertedExecutionId}) AS members,(SELECT count(*)::int FROM rh_research.study_binding WHERE tenant_id=${f.ids.tenant} AND project_intent_id=${draft.item.id}) AS bindings,(SELECT count(*)::int FROM public.audit_log WHERE "tenantId"=${f.ids.tenant} AND target=${insertedExecutionId}) AS audits,(SELECT count(*)::int FROM rh_research.operation WHERE tenant_id=${f.ids.tenant} AND actor_id=${f.accounts.admin} AND request_key=${failedRequest}) AS receipts`;
  return{intent,counts};
 },{readOnly:true});assert.deepEqual(rollback.intent,{version:1,status:'draft'});assert.deepEqual(rollback.counts,{projects:0,members:0,bindings:0,audits:0,receipts:0});artifacts.rollback={intentId:draft.item.id,attemptedExecutionId:insertedExecutionId,...rollback};
 checks.push('failure_after_real_shared_creation_core_rolls_back_project_member_audit_binding_receipt_and_preserves_draft_version');
 const result={passed:true,at:new Date().toISOString(),syntheticOnly:true,runId:f.runId,checks,sqlStates,artifacts,modelCalls:0,production:false,professionalAcceptance:false};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,checks,sqlStates,evidence:out+'result.json'}));
}catch(error){const result={passed:false,at:new Date().toISOString(),syntheticOnly:true,runId:f.runId,checks,sqlStates,error:{type:error.constructor.name,code:error.code,sqlState:sqlState(error),message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(-1400)}};writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.error(JSON.stringify({passed:false,checks,error:result.error,evidence:out+'result.json'}));process.exitCode=1;}
finally{await prisma?.app.$disconnect();await prisma?.elevated.$disconnect();}
