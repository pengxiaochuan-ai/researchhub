import {approveNewAnalysisFixtureAccount} from './analysis-admission-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createT15AnalysisCore} from './t15-analysis-core.mjs';
import {createT15AnalysisService} from './t15-analysis-service.mjs';
import {createT15AnalysisFixture} from './t15-analysis-fixture.mjs';
import {createResearchStudiesService} from '../research-studies/commands.mjs';
import {setContext} from '../research-studies/repository.mjs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const load=(path,name)=>require('./src/'+path+'.ts')[name],lockAuthorization=load('common/worker-publication','lockAuthorizationMutation');
const assign=load('study-operations/formal-response-assignment','assignVisitFormInTransaction'),write=load('study-operations/formal-response-commands','writeAnswersInTransaction'),reviewResponse=load('study-operations/formal-response-review','reviewFormalResponseInTransaction');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const code=e=>e.code??e.getResponse?.()?.code;
const allCaps=allowed=>({canSubmitPlan:allowed,canReviewPlan:allowed,canReleaseSnapshot:allowed});
const noData=value=>{if(Array.isArray(value))return value.forEach(noData);if(value&&typeof value==='object')for(const[key,child]of Object.entries(value)){assert(!['answers','rows','cells','manifest','value'].includes(key),'metadata exposes '+key);noData(child);}};
async function fixture(tx,prefix){
 const f=await createT15AnalysisFixture(tx,prefix),roleId=prefix+'_reader_role',readerId=prefix+'_reader',adminId=prefix+'_admin2',otherProjectId=prefix+'_other_project',otherStudyId=prefix+'_other_study';
 await approveNewAnalysisFixtureAccount(tx,f);
 await tx.permissionRole.create({data:{id:roleId,tenantId:f.id.tenant,key:'synthetic-analysis-reader',name:'Synthetic analysis reader',menuPermissions:['workbench'],buttonPermissions:['data.analyze'],dataScope:'group'}});
 for(const [id,role,admin]of [[readerId,'researcher',false],[adminId,'tenant_admin',true]]){
  await tx.account.create({data:{id,tenantId:f.id.tenant,username:id,displayName:'Synthetic metadata test',passwordHash:'synthetic-only',role,isTenantAdmin:admin}});
  await approveNewAnalysisFixtureAccount(tx,f,id);
  await tx.studyGroupMembership.create({data:{tenantId:f.id.tenant,studyGroupId:f.id.group,accountId:id,roleId}});
  await tx.researchProjectMembership.create({data:{...f.scope,accountId:id,roleKey:'project_manager'}});
 }
 await tx.researchProject.create({data:{id:otherProjectId,tenantId:f.id.tenant,studyGroupId:f.id.group,code:'SYNTHETIC-OTHER',name:'Other synthetic metadata scope'}});
 await tx.$executeRaw`INSERT INTO rh_research.project_intent(id,tenant_id,owner_id,title) VALUES (${prefix+'_other_intent'},${f.id.tenant},${f.id.account},'Other synthetic Study')`;
 await tx.$executeRaw`INSERT INTO rh_research.study_binding(id,tenant_id,project_intent_id,execution_project_id,study_group_id) VALUES (${otherStudyId},${f.id.tenant},${prefix+'_other_intent'},${otherProjectId},${f.id.group})`;
 await setContext(tx,f.user,f.id.group,f.id.project);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 const studies=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx)},scope:{product:'researchhub',allowedTenantIds:[f.id.tenant]},lockAuthorization,createResearchProject:()=>{throw Error('unused creation');}});
 const core=createT15AnalysisCore({load,syntheticStudyIds:[f.studyId,otherStudyId]}),api=createT15AnalysisService({studies,core,cursorSecret:'independent-t15-metadata-key'});
 const definition={schemaVersion:'t15-synthetic-plan-v1',dataClassification:'synthetic',purposeKey:'synthetic-research-only',method:'descriptive',statisticalUnit:'subject',protocolVersionId:f.id.protocol,visitCode:'BASELINE',subjectIds:f.subjects.map(s=>s.subjectId),variables:f.schema.fields.map(field=>({key:field.key,fieldKey:field.key,formVersionId:f.id.form,valueType:field.type,unit:null})),sapVersion:'synthetic-sap-v1',variableMapVersion:'synthetic-map-v1',reason:'Independent metadata review'};
 return {...f,api,definition,roleId,otherStudyId,reader:{...f.user,accountId:readerId,role:'researcher',isTenantAdmin:false},admin2:{...f.user,accountId:adminId}};
}
async function submit(f,suffix){return f.api.submitPlan(f.user,f.studyId,{requestKey:'metadata-'+suffix+'-'+randomUUID(),definition:{...f.definition,reason:'Synthetic metadata '+suffix}});}
async function sources(tx,f,prefix){
 await setContext(tx,f.user,f.id.group,f.id.project);
 for(const[i,subject]of f.subjects.entries()){
  const a=await assign(tx,f.user,f.scope,subject.visitId,f.id.form),saved=await write(tx,f.user,f.scope,a.id,{requestKey:prefix+'-submit-'+i,expectedVersion:0,kind:'submit',answers:{value:i,completed:i!==0,optional_value:null}});
  const approved=await reviewResponse(tx,f.user,f.scope,a.id,{requestKey:prefix+'-review-'+i,expectedVersion:saved.version,expectedRef:saved.ref,kind:'review_approved'});
  await reviewResponse(tx,f.user,f.scope,a.id,{requestKey:prefix+'-lock-'+i,expectedVersion:approved.version,expectedRef:saved.ref,kind:'lock'});
 }
}
test('metadata plan/snapshot pagination is complete and parent/actor bound without answers, while current source consent still guards use',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const prefix=validateFixtureConfig(env).runId+'__metapage_'+randomUUID().slice(0,8);
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const f=await fixture(tx,prefix),p1=await submit(f,'one'),p2=await submit(f,'two'),p3=await submit(f,'three');
  const first=await f.api.list(f.user,f.studyId,{limit:1}),plans=[];let cursor;
  do{const page=await f.api.list(f.user,f.studyId,{limit:1,...(cursor?{cursor}:{})});noData(page);assert.deepEqual(page.capabilities,allCaps(true));plans.push(...page.items.map(x=>x.planId));cursor=page.nextCursor;}while(cursor);
  assert.deepEqual(plans,[p1.planId,p2.planId,p3.planId].sort());assert.equal(new Set(plans).size,3);
  assert.equal((await f.api.list(f.user,f.otherStudyId)).items.length,0);
  await assert.rejects(f.api.list(f.user,f.otherStudyId,{cursor:first.nextCursor}),e=>e.status===400);
  await assert.rejects(f.api.list(f.admin2,f.studyId,{cursor:first.nextCursor}),e=>e.status===400);
  await assert.rejects(f.api.readPlan(f.user,f.studyId,p1.planId,{cursor:first.nextCursor}),e=>e.status===400);
  await assert.rejects(f.api.readPlan(f.user,f.otherStudyId,p1.planId),e=>code(e)==='ANALYSIS_PLAN_NOT_FOUND');
  await f.api.reviewPlan(f.user,f.studyId,p1.planId,{requestKey:prefix+'-approve',expectedSequence:0,decision:'approved',reason:'Actual synthetic approval'});
  await sources(tx,f,prefix);const preview=await f.api.preview(f.user,f.studyId,p1.planId);assert.equal(preview.manifest.rows.length,3);
  const snapshots=[];for(let n=0;n<2;n++)snapshots.push(await f.api.release(f.user,f.studyId,p1.planId,{requestKey:prefix+'-release-'+n,previewHash:preview.manifestHash,reason:'Synthetic metadata snapshot '+n}));
  const detail=await f.api.readPlan(f.user,f.studyId,p1.planId,{limit:1});noData(detail);assert.deepEqual(detail.capabilities,allCaps(true));assert.equal(detail.review.decision,'approved');assert(detail.nextSnapshotsCursor);
  const rest=await f.api.readPlan(f.user,f.studyId,p1.planId,{limit:1,cursor:detail.nextSnapshotsCursor});noData(rest);assert.equal(rest.nextSnapshotsCursor,null);assert.deepEqual([detail.snapshots[0].snapshotId,rest.snapshots[0].snapshotId],snapshots.map(x=>x.snapshotId).sort());
  await assert.rejects(f.api.readPlan(f.user,f.studyId,p2.planId,{cursor:detail.nextSnapshotsCursor}),e=>e.status===400);
  await assert.rejects(f.api.readPlan(f.admin2,f.studyId,p1.planId,{cursor:detail.nextSnapshotsCursor}),e=>e.status===400);
  const tag=detail.nextSnapshotsCursor.indexOf('.')+1,broken=detail.nextSnapshotsCursor.slice(0,tag)+(detail.nextSnapshotsCursor[tag]==='A'?'B':'A')+detail.nextSnapshotsCursor.slice(tag+1);await assert.rejects(f.api.readPlan(f.user,f.studyId,p1.planId,{cursor:broken}),e=>e.status===400);
  for(const limit of [0,101,'01'])await assert.rejects(f.api.list(f.user,f.studyId,{limit}),e=>e.status===400);
  await setContext(tx,f.user,f.id.group,f.id.project);
  await tx.$executeRaw`INSERT INTO public.study_participation_event(id,"tenantId","studyGroupId","researchProjectId","subjectId","enrollmentId","protocolVersionId","policyVersionId","policyHash",sequence,kind,decision,evidence,reason,"effectiveAt","recordedBy") SELECT ${prefix+'_withdraw'},${f.id.tenant},${f.id.group},${f.id.project},${f.subjects[0].subjectId},${f.subjects[0].enrollmentId},${f.id.protocol},${f.id.policy},"contentHash",4,'data_use_consent','withdrawn','synthetic','Independent current consent test',now(),${f.id.account} FROM public.study_execution_policy_version WHERE id=${f.id.policy}`;
  noData(await f.api.list(f.user,f.studyId));noData(await f.api.readPlan(f.user,f.studyId,p1.planId));
  await assert.rejects(f.api.preview(f.user,f.studyId,p1.planId),e=>code(e)==='PARTICIPATION_CAPTURE_BLOCKED');
  await assert.rejects(f.api.release(f.user,f.studyId,p1.planId,{requestKey:prefix+'-withdrawn-release',previewHash:preview.manifestHash,reason:'Must not release after withdrawal'}),e=>code(e)==='PARTICIPATION_CAPTURE_BLOCKED');
  await assert.rejects(f.api.readSnapshot(f.user,f.studyId,snapshots[0].snapshotId),e=>code(e)==='PARTICIPATION_CAPTURE_BLOCKED');
  await f.api.reviewPlan(f.user,f.studyId,p1.planId,{requestKey:prefix+'-revoke',expectedSequence:1,decision:'revoked',reason:'Historical governance remains available after source withdrawal'});assert.equal((await f.api.readPlan(f.user,f.studyId,p1.planId)).review.decision,'revoked');
  throw Error('T15_METADATA_PAGE_ALL_ROLLBACK');
 }),/T15_METADATA_PAGE_ALL_ROLLBACK/);
});
test('metadata capabilities equal actual current write authority, not caller claims, and stale/data.analyze-revoked readers cannot read',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const prefix=validateFixtureConfig(env).runId+'__metacap_'+randomUUID().slice(0,8);
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const f=await fixture(tx,prefix),p=await submit(f,'capability'),spoofedReader={...f.reader,role:'tenant_admin',isTenantAdmin:true},claimedOrdinaryAdmin={...f.user,role:'researcher',isTenantAdmin:false};
  assert.deepEqual((await f.api.list(claimedOrdinaryAdmin,f.studyId)).capabilities,allCaps(true));
  for(const user of [f.reader,spoofedReader]){
   const list=await f.api.list(user,f.studyId),detail=await f.api.readPlan(user,f.studyId,p.planId);noData(list);noData(detail);assert.deepEqual(list.capabilities,allCaps(false));assert.deepEqual(detail.capabilities,allCaps(false));
   await assert.rejects(f.api.submitPlan(user,f.studyId,{requestKey:prefix+'-denied-create-'+user.isTenantAdmin,definition:f.definition}),e=>code(e)==='ANALYSIS_ADMIN_REQUIRED');
   await assert.rejects(f.api.reviewPlan(user,f.studyId,p.planId,{requestKey:prefix+'-denied-review-'+user.isTenantAdmin,expectedSequence:0,decision:'approved',reason:'Denied'}),e=>code(e)==='ANALYSIS_ADMIN_REQUIRED');
   await assert.rejects(f.api.release(user,f.studyId,p.planId,{requestKey:prefix+'-denied-release-'+user.isTenantAdmin,previewHash:'0'.repeat(64),reason:'Denied'}),e=>code(e)==='ANALYSIS_ADMIN_REQUIRED');
  }
  await setContext(tx,f.user,f.id.group,f.id.project);await tx.account.update({where:{id:f.admin2.accountId},data:{role:'researcher',isTenantAdmin:false}});
  assert.deepEqual((await f.api.list(f.admin2,f.studyId)).capabilities,allCaps(false));await assert.rejects(f.api.submitPlan(f.admin2,f.studyId,{requestKey:prefix+'-downgraded',definition:f.definition}),e=>code(e)==='ANALYSIS_ADMIN_REQUIRED');
  await setContext(tx,f.user,f.id.group,f.id.project);await tx.permissionRole.update({where:{id:f.roleId},data:{buttonPermissions:[]}});
  for(const read of [()=>f.api.list(f.reader,f.studyId),()=>f.api.readPlan(f.reader,f.studyId,p.planId)])await assert.rejects(read,e=>code(e)==='ANALYSIS_FORBIDDEN');
  await assert.rejects(f.api.list({...f.user,authVersion:f.user.authVersion+1},f.studyId),e=>code(e)==='AUTH_SESSION_EXPIRED');
  assert.equal((await tx.$queryRaw`SELECT count(*)::int AS n FROM rh_analysis.plan_review WHERE tenant_id=${f.id.tenant}`).at(0).n,0);assert.equal((await tx.$queryRaw`SELECT count(*)::int AS n FROM rh_analysis.snapshot WHERE tenant_id=${f.id.tenant}`).at(0).n,0);
  throw Error('T15_METADATA_CAP_ALL_ROLLBACK');
 }),/T15_METADATA_CAP_ALL_ROLLBACK/);
});
