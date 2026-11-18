// Explicit local, synthetic-only T04 verification. Never imported by runtime.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fixtureEnvironment,createCreationFixture,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createProtocolConfigurationService} from '../server/research-execution/protocols.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const fixture=await createCreationFixture(env),{ids,accounts,runId}=fixture;
const evidence=workspaceRoot+'researchhub/docs/testing/evidence/research-t04-2026-11-11/';mkdirSync(evidence,{recursive:true});
const checks=[],key=label=>'t04-'+label+'-'+randomUUID(),idsOut={};let prisma;
const record=(name)=>{checks.push(name);console.log('PASS '+name);};
const direct=(fn)=>withFixtureTransaction(env,'direct',fn);
const read=(fn)=>withFixtureTransaction(env,'direct',fn,{readOnly:true});
async function reject(label,fn,predicate){await assert.rejects(fn,predicate,label);record(label);}
try{
 process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
 const {load}=runtimeDependencies();prisma=new(load('prisma/prisma.service','PrismaService'))();
 const groupCore=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma);
 const legacyCore=new(load('study-operations/study-operations.service','StudyOperationsService'))(prisma);
 const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:(tx,user,group,input)=>groupCore.createResearchProjectInTransaction(tx,user,group,input)});
 const configuration=createProtocolConfigurationService({studies,core:legacyCore});
 const admin={accountId:accounts.admin,tenantId:ids.tenant,authVersion:0};
 async function study(name){const intent=await studies.create(admin,{requestKey:key('intent'),title:name,hubKey:ids.hub});return(await studies.createStudy(admin,intent.item.id,{requestKey:key('study'),expectedVersion:intent.item.version,studyGroupId:ids.group})).item.study;}
 const a=await study('T04 合成研究 A'),b=await study('T04 合成研究 B');idsOut.studyA=a.id;idsOut.studyB=b.id;
 const role=await studies.withResearchStudyTransaction(admin,a.id,'read',tx=>tx.$queryRaw`SELECT current_user AS name`);assert.equal(role[0].name,'aisci_app');record('restricted_app_role_and_new_synthetic_scope');
 const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:a.executionProjectId};
 const refs=await direct(async tx=>{
  const template=await tx.formTemplate.create({data:{...scope,key:'synthetic-form',name:'合成表单',createdBy:accounts.admin}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',schema:{version:'form-schema.v1',items:[]},createdBy:accounts.admin,lockedAt:new Date()}});
  const definition=await tx.scaleDefinition.create({data:{tenantId:ids.tenant,code:'SYNTHETIC_T04',name:'合成量表',licenseStatus:'n_a'}});
  const scale=await tx.scaleVersion.create({data:{tenantId:ids.tenant,scaleDefinitionId:definition.id,versionNumber:1,versionLabel:'synthetic-v1',status:'published',licenseStatus:'n_a',publishedAt:new Date(),publishedBy:accounts.admin}});
  const outcome=await tx.outcomeDefinition.create({data:{...scope,key:'synthetic-outcome',versionNumber:1,name:'合成结局',role:'primary',sourceType:'scale',scaleVersionId:scale.id,status:'published',publishedAt:new Date(),publishedBy:accounts.admin}});
  return {form:form.id,scale:scale.id,outcome:outcome.id};
 });idsOut.refs=refs;
 const before=await read(tx=>tx.formTemplate.count({where:scope}));
 const initial=await configuration.get(admin,a.id);const after=await read(tx=>tx.formTemplate.count({where:scope}));assert.equal(before,after);assert(initial.forms.some(x=>x.id===refs.form));assert(initial.scales.some(x=>x.id===refs.scale));assert(initial.outcomes.some(x=>x.id===refs.outcome));record('published_candidates_read_without_builtin_initialization');
 const body={requestKey:key('create'),title:'合成方案',purpose:'',primaryOutcomes:[{outcomeDefinitionId:refs.outcome,versionNumber:1}],secondaryOutcomes:[],visitPlans:[{code:'V1',name:'合成访视',sequence:1,anchor:null,targetDayOffset:null,windowBeforeDays:0,windowAfterDays:null,required:false,allowRepeat:false,requirements:[{kind:'form_response',code:'F',name:'合成表单',required:false,config:{formVersionId:refs.form}},{kind:'scale',code:'SYNTHETIC_T04',name:'合成量表',required:true,config:{scaleVersionId:refs.scale}}]}]};
 const made=await configuration.create(admin,a.id,body);idsOut.protocol=made.protocol.id;
 assert.deepEqual([made.protocol.visitPlans[0].anchor,made.protocol.visitPlans[0].targetDayOffset,made.protocol.visitPlans[0].windowBeforeDays,made.protocol.visitPlans[0].required],[null,null,0,false]);assert.equal(made.protocol.visitPlans[0].requirements.length,2);
 const readback=await configuration.get(admin,a.id);const p=readback.protocols.find(x=>x.id===made.protocol.id);assert.deepEqual(p,made.protocol);record('create_read_fixed_form_scale_outcome_null_zero_false');
 const {id:protocolId,revision,versionNumber,status,...fields}=p;const update={requestKey:key('update'),expectedRevision:revision,...fields,visitPlans:p.visitPlans.map(v=>({...v,windowAfterDays:0,requirements:[...v.requirements.map(q=>({...q})),{kind:'confirmation',code:'EXTRA',name:'合成确认',required:false,config:{}}]}))};
 const saved=await configuration.update(admin,a.id,protocolId,update);assert.equal(saved.protocol.visitPlans[0].windowAfterDays,0);assert.equal(saved.protocol.visitPlans[0].requirements.length,3);assert(saved.protocol.visitPlans[0].requirements.some(q=>q.code==='EXTRA'&&q.required===false));assert.deepEqual((await configuration.get(admin,a.id)).protocols.find(x=>x.id===protocolId),saved.protocol);record('update_requirements_and_complete_roundtrip');
 const retry=await configuration.update(admin,a.id,protocolId,update);assert.deepEqual(retry,saved);record('same_key_retry_returns_original_receipt_after_revision_change');
 const stale={...update,requestKey:key('stale'),title:'stale'};await reject('stale_revision_conflict',()=>configuration.update(admin,a.id,protocolId,stale),e=>e.status===409&&e.code==='RESEARCH_VERSION_CONFLICT');
 const invalidRef={...update,requestKey:key('invalid-ref'),expectedRevision:saved.protocol.revision,visitPlans:update.visitPlans.map(v=>({...v,requirements:v.requirements.map(q=>q.kind==='form_response'?{...q,config:{formVersionId:'not-a-visible-published-form'}}:q)}))};
 await reject('unpublished_or_foreign_reference_denied',()=>configuration.update(admin,a.id,protocolId,invalidRef),e=>e.status===400);
 await reject('foreign_tenant_principal_denied',()=>configuration.get({tenantId:ids.foreignTenant,accountId:accounts.foreign,authVersion:0},a.id),e=>e.status===401||e.status===403||e.status===404);
 const shared={...update,requestKey:key('concurrent'),expectedRevision:saved.protocol.revision,title:'并发重试'};const both=await Promise.all([configuration.update(admin,a.id,protocolId,shared),configuration.update(admin,a.id,protocolId,shared)]);assert.deepEqual(both[0],both[1]);record('concurrent_same_key_exactly_one_receipt');
 const [receiptCount]=await read(tx=>tx.$queryRaw`SELECT count(*)::int AS n FROM rh_research.operation WHERE tenant_id=${ids.tenant} AND actor_id=${accounts.admin} AND request_key=${shared.requestKey}`);assert.equal(receiptCount.n,1);
 const curr=both[0].protocol;const {id:ignore,versionNumber:vn,status:st,revision:rev,...nextFields}=curr;const one={requestKey:key('race-a'),expectedRevision:rev,...nextFields,title:'窗口一'},two={...one,requestKey:key('race-b'),title:'窗口二'};const results=await Promise.allSettled([configuration.update(admin,a.id,protocolId,one),configuration.update(admin,a.id,protocolId,two)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);record('concurrent_different_requests_one_cas_winner');
 await reject('cross_study_receipt_parent_chain_denied',()=>configuration.update(admin,b.id,protocolId,update),e=>e.status===404||e.status===403);
 await direct(async tx=>{for(const executionProjectId of [a.executionProjectId,b.executionProjectId])await tx.researchProjectMembership.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:executionProjectId,accountId:accounts.member,roleKey:'project_manager',status:'active'}});});
 const member={tenantId:ids.tenant,accountId:accounts.member,authVersion:0};
 const memberView=(await configuration.get(member,a.id)).protocols.find(x=>x.id===protocolId);const {id:memberId,versionNumber:memberVersion,status:memberStatus,revision:memberRevision,...memberFields}=memberView;
 const memberBody={requestKey:key('member-receipt'),expectedRevision:memberRevision,...memberFields,title:'合成成员保存'};
 await configuration.update(member,a.id,protocolId,memberBody);
 await direct(tx=>tx.researchProjectMembership.updateMany({where:{...scope,accountId:accounts.member},data:{status:'disabled'}}));
 assert.equal((await configuration.get(member,b.id)).capabilities.canConfigure,true);
 await reject('revoked_a_member_cannot_replay_a_receipt_through_b',()=>configuration.update(member,b.id,protocolId,memberBody),e=>e.status===404||e.status===403);
 await reject('revoked_a_member_cannot_access_a',()=>configuration.get(member,a.id),e=>e.status===404||e.status===403);
 const failKey=key('rollback'),fail=new Error('SYNTHETIC_FAILURE_AFTER_REAL_CORE');const failing=createProtocolConfigurationService({studies,core:{createProtocolVersionInTransaction:async(...args)=>{await legacyCore.createProtocolVersionInTransaction(...args);throw fail;}}});
 const counts=()=>read(async tx=>({protocols:await tx.studyProtocolVersion.count({where:scope}),plans:await tx.visitPlan.count({where:scope}),requirements:await tx.visitRequirement.count({where:scope}),audit:await tx.auditLog.count({where:{...scope,action:{in:['study_protocol_create','researchhub.protocol.create']}}}),receipts:Number((await tx.$queryRaw`SELECT count(*)::int AS n FROM rh_research.operation WHERE tenant_id=${ids.tenant} AND request_key=${failKey}`)[0].n)}));
 const beforeFail=await counts();await reject('injected_failure_after_real_core',()=>failing.create(admin,a.id,{...body,requestKey:failKey}),e=>e===fail);assert.deepEqual(await counts(),beforeFail);record('protocol_plan_requirement_audit_receipt_rollback');
 await direct(tx=>tx.tenantFeatureEntitlement.updateMany({where:{tenantId:ids.tenant,featureKey:'study_operations'},data:{enabled:false}}));await reject('feature_closed_even_admin_denied',()=>configuration.get(admin,a.id),e=>e.code==='FEATURE_NOT_ENABLED');await direct(tx=>tx.tenantFeatureEntitlement.updateMany({where:{tenantId:ids.tenant,featureKey:'study_operations'},data:{enabled:true}}));
 await direct(tx=>tx.studyGroupMembership.updateMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:accounts.member},data:{status:'disabled'}}));await reject('revoked_group_membership_denied',()=>configuration.get(member,b.id),e=>e.status===403||e.status===404);
 const manifest={purpose:'ResearchHub-T04-PG',syntheticOnly:true,runId,studyIds:[a.id,b.id],protocolId,checks,at:new Date().toISOString(),modelCalls:0,patientData:false};
 await direct(tx=>tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId+'-t04'},${JSON.stringify(manifest)}::jsonb)`);
 const result={passed:true,...manifest,refs,actualHttp:false,browserAcceptance:false};writeFileSync(evidence+'pg-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){const result={passed:false,at:new Date().toISOString(),syntheticOnly:true,runId,checks,ids:idsOut,error:{type:error.constructor.name,code:error.code,status:error.status,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(-1800)}};writeFileSync(evidence+'pg-result.json',JSON.stringify(result,null,2));console.error(JSON.stringify(result));process.exitCode=1;}
finally{await prisma?.app.$disconnect();await prisma?.elevated.$disconnect();}
