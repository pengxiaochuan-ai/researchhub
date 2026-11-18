// Queue and fixed-reference integration only, with fresh owned synthetic records.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fixtureEnvironment,createCreationFixture,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createProtocolConfigurationService} from '../server/research-execution/protocols.mjs';
import {createProtocolReviewQueue} from '../server/research-execution/review-queue.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const fixture=await createCreationFixture(env),{ids,accounts,runId}=fixture,key=()=>randomUUID(),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t05-2026-11-11/';mkdirSync(out,{recursive:true});
const checks=[];let prisma;
const direct=fn=>withFixtureTransaction(env,'direct',fn);
try{
 process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
 const {load}=runtimeDependencies();prisma=new(load('prisma/prisma.service','PrismaService'))();
 const groups=new(load('study-groups/study-groups.service','StudyGroupsService'))(prisma),core=new(load('study-operations/study-operations.service','StudyOperationsService'))(prisma),checkRefs=load('study-operations/protocol-fixed-references','checkProtocolFixedReferences');
 const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:(...args)=>groups.createResearchProjectInTransaction(...args)}),config=createProtocolConfigurationService({studies,core}),queue=createProtocolReviewQueue({studies});
 const admin={accountId:accounts.admin,tenantId:ids.tenant,authVersion:0},member={...admin,accountId:accounts.member},owner={...admin,accountId:accounts.owner};
 async function study(title){const intent=await studies.create(admin,{requestKey:key(),title,hubKey:ids.hub});return (await studies.createStudy(admin,intent.item.id,{requestKey:key(),expectedVersion:intent.item.version,studyGroupId:ids.group})).item.study;}
 const a=await study('T05 queue synthetic A'),b=await study('T05 queue synthetic B');
 async function prepare(s){const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:s.executionProjectId};const refs=await direct(async tx=>{const template=await tx.formTemplate.create({data:{...scope,key:'generic',name:'合成表单'}}),form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'观察值',type:'number'}]}}}),outcome=await tx.outcomeDefinition.create({data:{...scope,key:'generic',versionNumber:1,name:'合成观察值',role:'primary',sourceType:'data_field',dataFieldKey:'value',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:accounts.admin}});return {form:form.id,outcome:outcome.id};});return {scope,refs};}
 const x=await prepare(a),y=await prepare(b);
 async function protocol(s,f,name){return (await config.create(admin,s.id,{requestKey:key(),title:name,purpose:'合成排队与引用读取验证',primaryOutcomes:[{outcomeDefinitionId:f.refs.outcome,versionNumber:1}],secondaryOutcomes:[],visitPlans:[{code:'BASELINE',name:'基线',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,requirements:[{kind:'form_response',code:'F',name:'合成表单',required:true,config:{formVersionId:f.refs.form}}]}]})).protocol;}
 const p1=await protocol(a,x,'one'),p2=await protocol(a,x,'two'),p3=await protocol(b,y,'three');
 const actual=await studies.withResearchStudyTransaction(admin,a.id,'read',async(tx,ctx)=>{const role=(await tx.$queryRaw`SELECT current_user AS role`)[0].role;const p=await tx.studyProtocolVersion.findFirst({where:{id:p1.id,...x.scope},include:{visitPlans:{include:{requirements:true}}}});return {role,result:await checkRefs(tx,x.scope,p)};});assert.equal(actual.role,'aisci_app');assert.equal(actual.result.ready,true);checks.push('restricted_app_actual_sql_fixed_published_form_outcome_share_locks');
 // This is a queue fixture, not proof of submit/approve: only these new protocols are marked pending.
 await direct(async tx=>{await tx.studyProtocolVersion.updateMany({where:{tenantId:ids.tenant,id:{in:[p1.id,p2.id,p3.id]}},data:{status:'pending_review'}});await tx.researchProjectMembership.create({data:{...x.scope,accountId:accounts.member,roleKey:'project_manager',status:'active'}});});
 const all=[];let cursor;for(let n=0;n<20;n++){const page=await queue.list(admin,{limit:'1',...(cursor?{cursor}:{})});all.push(...page.items);cursor=page.nextCursor;if(!cursor)break;}assert.equal(cursor,null);assert.deepEqual(new Set(all.map(x=>x.protocol.id)),new Set([p1.id,p2.id,p3.id]));assert.equal(all.length,3);checks.push('actual_rls_queue_pages_all_versions_without_duplicate_or_drop');
 assert.equal((await queue.list(owner,{})).items.length,0);checks.push('actual_hub_owner_without_current_project_manager_cannot_review');
 const first=await queue.list(member,{limit:'1'});assert.equal(first.items.length,1);assert.equal(first.items[0].studyId,a.id);assert(first.nextCursor);
 await direct(tx=>tx.researchProjectMembership.updateMany({where:{...x.scope,accountId:accounts.member},data:{status:'disabled'}}));const revoked=await queue.list(member,{limit:'1',cursor:first.nextCursor});assert.equal(revoked.items.length,0);checks.push('actual_current_membership_revocation_rechecked_between_pages');
 const badProtocol={...p1,primaryOutcomes:[{outcomeDefinitionId:y.refs.outcome,versionNumber:1}]};const unavailable=await studies.withResearchStudyTransaction(admin,a.id,'read',tx=>checkRefs(tx,x.scope,badProtocol));assert.equal(unavailable.ready,false);assert(unavailable.issues.some(x=>x.code==='OUTCOME_VERSION_UNAVAILABLE'));checks.push('actual_foreign_project_outcome_not_exposed_or_accepted');
 const empty=await direct(async tx=>tx.formVersion.create({data:{...x.scope,templateId:(await tx.formVersion.findUnique({where:{id:x.refs.form}})).templateId,versionNumber:2,status:'published',lockedAt:new Date(),schema:{fields:[]}}}));
 const emptyRef=structuredClone(p1);emptyRef.visitPlans[0].requirements[0].config={formVersionId:empty.id};const invalid=await studies.withResearchStudyTransaction(admin,a.id,'read',tx=>checkRefs(tx,x.scope,emptyRef));assert.equal(invalid.ready,false);assert(invalid.issues.some(x=>x.code==='FORM_SCHEMA_UNUSABLE'));checks.push('actual_published_empty_form_cannot_qualify_for_release');
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,checks,studyIds:[a.id,b.id],protocolIds:[p1.id,p2.id,p3.id],scope:'T05 queue/reference subcontracts only; pending statuses seeded as fixture, no approval or activation acceptance',modelCalls:0};
 await direct(tx=>tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId+'-t05-queue'},${JSON.stringify(result)}::jsonb)`);writeFileSync(out+'queue-references-pg.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){const result={passed:false,at:new Date().toISOString(),runId,checks,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,1600)};writeFileSync(out+'queue-references-pg-failure.json',JSON.stringify(result,null,2));console.error(JSON.stringify(result));process.exitCode=1;}finally{await prisma?.app.$disconnect();await prisma?.elevated.$disconnect();}
