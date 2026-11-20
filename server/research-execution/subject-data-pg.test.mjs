import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createResearchStudiesService} from '../research-studies/commands.mjs';
import {setContext} from '../research-studies/repository.mjs';
import {createSubjectDataService} from './subject-data.mjs';
import {HUB_KEY} from '../admission/policy.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');

test('guarded existing synthetic PG rows use actual Study/RLS reads in READ ONLY with no fixture or business mutation',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const [row]=await tx.$queryRawUnsafe(`SELECT b.id AS "studyId",s.id AS "subjectId",a.id AS "accountId",a."tenantId",a."authVersion",b.study_group_id AS "studyGroupId",b.execution_project_id AS "researchProjectId"
   FROM rh_research.study_binding b JOIN public.subject s ON s."tenantId"=b.tenant_id AND s."studyGroupId"=b.study_group_id AND s."researchProjectId"=b.execution_project_id
   JOIN public.account a ON a."tenantId"=b.tenant_id AND a.role='tenant_admin' AND a."isTenantAdmin"=true AND a.status='active'
   JOIN rh_admission.application ad ON ad.tenant_id=a."tenantId" AND ad.account_id=a.id AND ad.status='approved' AND ad.hub_key=$1
   WHERE s."deletedAt" IS NULL AND s."acceptanceFixture"=false
   ORDER BY EXISTS(SELECT 1 FROM public.modality_file f WHERE f."tenantId"=s."tenantId" AND f."subjectId"=s.id AND f."subjectVisitId" IS NULL AND f."deletedAt" IS NULL) DESC,b.id,s.id,a.id LIMIT 1`,HUB_KEY);
  assert(row,'existing approved synthetic Study/subject required; test does not create any');
  const user={tenantId:row.tenantId,accountId:row.accountId,authVersion:row.authVersion,role:'tenant_admin',isTenantAdmin:true};
  await setContext(tx,user,row.studyGroupId,row.researchProjectId);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const studies=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,run)=>run(tx)},scope:{product:'researchhub',allowedTenantIds:[row.tenantId]},lockAuthorization:lockAuthorizationMutation,createResearchProject:()=>assert.fail('no create')});
  const service=createSubjectDataService({studies,cursorSecret:'subject-data-readonly-pg'}),result=await service.read(user,row.studyId,row.subjectId,{limit:'1'});
  assert.equal(result.subject.id,row.subjectId);assert.equal(result.capabilities.canReadClinicalData,true);assert.equal(result.data.section,'files');assert.equal(result.data.status,'available');
  assert(!JSON.stringify(result).includes('storageKey'));assert(!JSON.stringify(result).includes('passwordHash'));
  if(result.data.nextCursor){const next=await service.read(user,row.studyId,row.subjectId,{limit:'1',cursor:result.data.nextCursor});assert.notEqual(next.data.items[0].id,result.data.items[0].id);}
  assert(result.data.items.length,'existing unassigned synthetic file required');
  const file=result.data.items[0],tasks=await service.read(user,row.studyId,row.subjectId,{section:'tasks',fileId:file.id,limit:'1'});assert.equal(tasks.data.fileId,file.id);
  if(tasks.data.items.length){const features=await service.read(user,row.studyId,row.subjectId,{section:'features',fileId:file.id,taskId:tasks.data.items[0].id,limit:'1'});assert(features.data.items.every(x=>!('value'in x)&&!('unit'in x)));}
  await assert.rejects(service.read({...user,authVersion:user.authVersion+1},row.studyId,row.subjectId),e=>e.status===401);
  await assert.rejects(service.read(user,row.studyId,'unavailable-subject'),e=>e.status===404);
  throw Error('SUBJECT_DATA_READONLY_ROLLBACK');
 },{readOnly:true}),/SUBJECT_DATA_READONLY_ROLLBACK/);
});
