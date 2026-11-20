import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createResearchStudiesService} from '../research-studies/commands.mjs';
import {setContext} from '../research-studies/repository.mjs';
import {HUB_KEY} from '../admission/policy.mjs';
import {canReadStudyDataInTx} from '../research-execution/subject-data.mjs';
import {createFileLinksService} from './file-links.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const {readFormalVisitInTransaction}=require('./src/study-operations/formal-response-visits.ts');
const {lockCaptureBinding}=require('./src/study-operations/protocol-migration-lock.ts');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');

// Native parent readers acquire row locks, so use a mandatory ROLLBACK and a
// mutation-denying client instead of PostgreSQL READ ONLY (which forbids locks).
function readsOnly(tx){return new Proxy(tx,{get(object,key){
 const value=object[key];if(typeof key==='string'&&/^\$(?:query|execute)Raw/.test(key))return(...args)=>{const sql=typeof args[0]==='string'?args[0]:Array.from(args[0]).join('?');assert.match(sql.trim(),/^(?:SELECT\b|SET LOCAL ROLE\b)/i);assert(!/\b(?:INSERT INTO|DELETE FROM|UPDATE\s+[A-Za-z_]|CREATE |ALTER |DROP |GRANT |REVOKE )/i.test(sql),'business/schema mutation forbidden');return value.apply(object,args);};
 if(typeof key==='string'&&!key.startsWith('$')&&value&&typeof value==='object')return new Proxy(value,{get(model,method){if(typeof model[method]!=='function')return model[method];assert(['findFirst','findUnique','findMany','count','aggregate','groupBy'].includes(method),'ORM mutation forbidden');return model[method].bind(model);}});
 return typeof value==='function'?value.bind(object):value;
}});}

test('real existing fixed features disclose values only through explicit data capability and native consent/parent checks; full rollback',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 await assert.rejects(withFixtureTransaction(env,'direct',async original=>{
  const tx=readsOnly(original),[row]=await tx.$queryRawUnsafe(`SELECT b.id AS "studyId",v.id AS "visitId",s.id AS "subjectId",f.id AS "fileId",t.id AS "taskId",a.id AS "accountId",a."tenantId",a."authVersion",b.study_group_id AS "studyGroupId",b.execution_project_id AS "researchProjectId"
   FROM rh_research.study_binding b JOIN public.subject s ON s."tenantId"=b.tenant_id AND s."studyGroupId"=b.study_group_id AND s."researchProjectId"=b.execution_project_id
   JOIN public.subject_visit v ON v."subjectId"=s.id AND v."acceptanceFixture"=false JOIN public.study_enrollment e ON e.id=v."enrollmentId" AND e.status='enrolled'
   JOIN public.modality_file f ON f."subjectId"=s.id AND f."subjectVisitId"=v.id AND f."deletedAt" IS NULL AND f.meta->>'sha256'=f.meta->>'storageVerifiedSha256'
   JOIN public.processing_task t ON t."modalityFileId"=f.id AND t."subjectId"=s.id AND t.status='complete'
   JOIN public.account a ON a."tenantId"=b.tenant_id AND a.role='tenant_admin' AND a."isTenantAdmin"=true AND a.status='active'
   JOIN rh_admission.application ad ON ad.tenant_id=a."tenantId" AND ad.account_id=a.id AND ad.status='approved' AND ad.hub_key=$1
   WHERE s."deletedAt" IS NULL AND s."acceptanceFixture"=false AND EXISTS(SELECT 1 FROM public.feature x WHERE x."sourceModalityFileId"=f.id AND x."sourceProcessingTaskId"=t.id)
   ORDER BY f."createdAt" DESC LIMIT 1`,HUB_KEY);
  assert(row,'existing approved fixed synthetic feature required; no fixture is created');
  const user={tenantId:row.tenantId,accountId:row.accountId,authVersion:row.authVersion,role:'tenant_admin',isTenantAdmin:true};
  await setContext(tx,user,row.studyGroupId,row.researchProjectId);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const studies=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,run)=>run(tx)},scope:{product:'researchhub',allowedTenantIds:[row.tenantId]},lockAuthorization:lockAuthorizationMutation,createResearchProject:()=>assert.fail('no create')});
  const base={readVisit:readFormalVisitInTransaction,lockBinding:lockCaptureBinding},api=createFileLinksService({studies,core:{...base,canReadFeatureValues:(connection,u,s)=>canReadStudyDataInTx(connection,u,{...s,executionProjectId:s.researchProjectId})},cursorSecret:'fixed-feature-pg'});
  const result=await api.listFeatures(user,row.studyId,row.visitId,row.fileId,row.taskId,{limit:2});assert.equal(result.capabilities.canReadFeatureValues,true);assert(result.items.length);assert(result.items.every(x=>'value'in x&&'unit'in x&&x.sourceRef));
  const sourceOnly=createFileLinksService({studies,core:base,cursorSecret:'fixed-feature-pg'}),limited=await sourceOnly.listFeatures(user,row.studyId,row.visitId,row.fileId,row.taskId,{limit:2});assert.equal(limited.capabilities.canReadFeatureValues,false);assert(limited.items.every(x=>!('value'in x)&&!('unit'in x)));assert.deepEqual(limited.items.map(x=>x.sourceRef),result.items.map(x=>x.sourceRef));
  await assert.rejects(api.listFeatures(user,row.studyId,row.visitId,row.fileId,'wrong-parent-task'),e=>e.code==='FILE_SOURCE_CHANGED');
  throw Error('FIXED_FEATURE_VALUES_ROLLBACK');
 }),/FIXED_FEATURE_VALUES_ROLLBACK/);
});
