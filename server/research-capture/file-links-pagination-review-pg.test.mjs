import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createFileLinksService} from './file-links.mjs';
import {createSyntheticCaptureFixture} from './synthetic-capture-fixture.mjs';
import {createResearchStudiesService} from '../research-studies/commands.mjs';
import {setContext} from '../research-studies/repository.mjs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const load=(path,name)=>require('./src/'+path+'.ts')[name];
const readVisit=load('study-operations/formal-response-visits','readFormalVisitInTransaction'),lockBinding=load('study-operations/protocol-migration-lock','lockCaptureBinding'),lockAuthorization=load('common/worker-publication','lockAuthorizationMutation');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const code=e=>e.code??e.getResponse?.()?.code;
function assertMetadataOnly(value){
 if(Array.isArray(value)){value.forEach(assertMetadataOnly);return;}
 if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){assert(!['value','storageKey','meta','result','answers','address','email'].includes(key),'unexpected private field '+key);assertMetadataOnly(child);}
}
async function fixture(tx,prefix){
 const f=await createSyntheticCaptureFixture(tx,prefix,2),studyId=prefix+'_study',otherAdminId=prefix+'_other_admin';
 await tx.account.create({data:{id:otherAdminId,tenantId:f.id.tenant,username:'other-admin',displayName:'Independent synthetic admin',passwordHash:'synthetic-test-only',role:'tenant_admin',isTenantAdmin:true}});
 await tx.$executeRaw`INSERT INTO rh_research.project_intent(id,tenant_id,owner_id,title,status) VALUES (${prefix+'_intent'},${f.id.tenant},${f.id.account},'Independent synthetic pagination','study_created')`;
 await tx.$executeRaw`INSERT INTO rh_research.study_binding(id,tenant_id,project_intent_id,execution_project_id,study_group_id) VALUES (${studyId},${f.id.tenant},${prefix+'_intent'},${f.id.project},${f.id.group})`;
 const files=[];
 for(const [suffix,subject]of [['a',f.subjects[0]],['b',f.subjects[0]],['c',f.subjects[1]]]){
  const fileId=prefix+'_file_'+suffix,taskId=prefix+'_task_'+suffix;
  await tx.modalityFile.create({data:{id:fileId,tenantId:f.id.tenant,subjectId:subject.subjectId,subjectVisitId:subject.visitId,modality:'eye',kind:'preprocessed',storageKey:'private-test-key-'+suffix,filename:'synthetic.csv',status:'ingested',meta:{sha256:'a'.repeat(64),storageVerifiedSha256:'a'.repeat(64)}}});
  await tx.processingTask.create({data:{...f.scope,id:taskId,subjectId:subject.subjectId,modalityFileId:fileId,status:'complete',skillKey:'synthetic',idempotencyKey:prefix+'-'+suffix,createdBy:f.id.account}});
  files.push({fileId,taskId,subject});
 }
 await setContext(tx,f.user,f.id.group,f.id.project);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 const studies=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx)},scope:{product:'researchhub',allowedTenantIds:[f.id.tenant]},lockAuthorization,createResearchProject:()=>{throw Error('unused creation');}});
 const api=createFileLinksService({studies,core:{readVisit,lockBinding},cursorSecret:'independent-pagination-fixed-test-key'});
 return {...f,studyId,files,otherAdmin:{...f.user,accountId:otherAdminId},api};
}
test('independent actual Study/aisci_app pages preserve complete 501/1000 feature coverage, parent counts and identical refs',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const prefix=validateFixtureConfig(env).runId+'__indpage_'+randomUUID().slice(0,8);
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const f=await fixture(tx,prefix),{api,studyId}=f,{fileId,taskId,subject}=f.files[0];
  const insert=(from,to)=>tx.feature.createMany({data:Array.from({length:to-from},(_,n)=>({id:prefix+'_feature_'+String(from+n).padStart(4,'0'),tenantId:f.id.tenant,subjectId:subject.subjectId,modality:'eye',featureKey:'synthetic.metric',value:n,sourceModalityFileId:fileId,sourceProcessingTaskId:taskId}))});
  await insert(0,501);
  for(const count of [501,1000]){
   if(count===1000)await insert(501,1000);
   const list=await api.list(f.user,studyId,subject.visitId,{limit:1});assert.equal(list.items[0].id,fileId);assert.equal(list.items[0].taskCount,1);assert.equal(list.items[0].tasks[0].featureCount,count);assert.equal(list.items[0].tasks[0].features.length,20);assertMetadataOnly(list);
   const embedded=list.items[0].tasks[0],tasks=await api.listTasks(f.user,studyId,subject.visitId,fileId,{limit:1});assert.deepEqual(tasks.items[0].sourceRef,embedded.sourceRef);assert.equal(tasks.total,1);
   const firstPage=await api.listFeatures(f.user,studyId,subject.visitId,fileId,taskId,{limit:20});assert.deepEqual(firstPage.items,embedded.features);assert.equal(firstPage.nextCursor,embedded.featuresNextCursor);
   const seen=[];let cursor;
   do{const page=await api.listFeatures(f.user,studyId,subject.visitId,fileId,taskId,{limit:100,...(cursor?{cursor}:{})});assert.equal(page.total,count);assertMetadataOnly(page);seen.push(...page.items.map(x=>x.id));cursor=page.nextCursor;}while(cursor);
   assert.deepEqual(seen,Array.from({length:count},(_,n)=>prefix+'_feature_'+String(n).padStart(4,'0')));assert.equal(new Set(seen).size,count);
  }
  await tx.processingTask.createMany({data:Array.from({length:25},(_,n)=>({...f.scope,id:prefix+'_task_extra_'+String(n).padStart(2,'0'),subjectId:subject.subjectId,modalityFileId:fileId,status:'complete',skillKey:'synthetic',idempotencyKey:prefix+'-extra-'+n,createdBy:f.id.account}))});
  const list=await api.list(f.user,studyId,subject.visitId,{limit:1});assert.equal(list.items[0].taskCount,26);assert.equal(list.items[0].tasks.length,20);assert(list.items[0].tasksNextCursor);
  const seenTasks=list.items[0].tasks.map(x=>x.id);let cursor=list.items[0].tasksNextCursor;
  while(cursor){const page=await api.listTasks(f.user,studyId,subject.visitId,fileId,{limit:7,cursor});assert.equal(page.total,26);seenTasks.push(...page.items.map(x=>x.id));cursor=page.nextCursor;}
  assert.equal(seenTasks.length,26);assert.equal(new Set(seenTasks).size,26);assert.deepEqual(seenTasks,[...seenTasks].sort());
  const before=await api.listFeatures(f.user,studyId,subject.visitId,fileId,taskId,{limit:1});await tx.feature.update({where:{id:before.items[0].id},data:{value:123}});const after=await api.listFeatures(f.user,studyId,subject.visitId,fileId,taskId,{limit:1});assert.notEqual(after.items[0].sourceRef.contentHash,before.items[0].sourceRef.contentHash);
  const fileBefore=await tx.modalityFile.findUnique({where:{id:fileId}});await tx.modalityFile.update({where:{id:fileId},data:{meta:{sha256:'a'.repeat(64)}}});const unknown=await api.listFeatures(f.user,studyId,subject.visitId,fileId,taskId,{limit:1});assert.equal(unknown.items[0].sourceRef,null);await tx.modalityFile.update({where:{id:fileId},data:{meta:fileBefore.meta}});
  throw Error('INDEPENDENT_PAGE_ALL_ROLLBACK');
 }),/INDEPENDENT_PAGE_ALL_ROLLBACK/);
});
test('independent parent-bound cursors and every page reject wrong scope, current auth changes, deleted files and participation withdrawal',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const prefix=validateFixtureConfig(env).runId+'__indpageauth_'+randomUUID().slice(0,8);
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const f=await fixture(tx,prefix),{api,studyId}=f,a=f.files[0],b=f.files[1],c=f.files[2];
  await tx.feature.createMany({data:[0,1,2].map(n=>({id:prefix+'_feature_'+n,tenantId:f.id.tenant,subjectId:a.subject.subjectId,modality:'eye',featureKey:'synthetic.metric',value:n,sourceModalityFileId:a.fileId,sourceProcessingTaskId:a.taskId}))});
  // Inconsistent dual sources must never be counted for either valid parent pair.
  await tx.feature.create({data:{id:prefix+'_mismatch',tenantId:f.id.tenant,subjectId:a.subject.subjectId,modality:'eye',featureKey:'synthetic.mismatch',value:7,sourceModalityFileId:a.fileId,sourceProcessingTaskId:b.taskId}});
  const page=await api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,a.taskId,{limit:1});assert.equal(page.total,3);assert(page.nextCursor);
  assert.equal((await api.listFeatures(f.otherAdmin,studyId,a.subject.visitId,a.fileId,a.taskId,{})).total,3);
  for(const [user,sid,vid,fid,tid]of [[f.otherAdmin,studyId,a.subject.visitId,a.fileId,a.taskId],[{...f.user,authVersion:1},studyId,a.subject.visitId,a.fileId,a.taskId],[f.user,studyId+'_wrong',a.subject.visitId,a.fileId,a.taskId],[f.user,studyId,c.subject.visitId,c.fileId,c.taskId],[f.user,studyId,a.subject.visitId,b.fileId,b.taskId]])await assert.rejects(api.listFeatures(user,sid,vid,fid,tid,{cursor:page.nextCursor,limit:1}),e=>e.status===400);
  const tagStart=page.nextCursor.indexOf('.')+1,broken=page.nextCursor.slice(0,tagStart)+(page.nextCursor[tagStart]==='A'?'B':'A')+page.nextCursor.slice(tagStart+1);await assert.rejects(api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,a.taskId,{cursor:broken}),e=>e.status===400);
  await assert.rejects(api.listTasks(f.user,studyId,a.subject.visitId,a.fileId,{cursor:page.nextCursor}),e=>e.status===400);
  assert.equal((await api.listFeatures(f.user,studyId,a.subject.visitId,b.fileId,b.taskId,{})).total,0);
  await assert.rejects(api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,b.taskId,{}),e=>code(e)==='FILE_SOURCE_CHANGED');
  await assert.rejects(api.listTasks(f.user,studyId,a.subject.visitId,c.fileId,{}),e=>code(e)==='FILE_SOURCE_CHANGED');
  await assert.rejects(api.listTasks(f.user,studyId+'_wrong',a.subject.visitId,a.fileId,{}),e=>code(e)==='RESEARCH_NOT_FOUND');
  for(const limit of [0,101,'01','x'])await assert.rejects(api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,a.taskId,{limit}),e=>e.status===400);
  // Each real service request owns a separate transaction. This retained-fixture harness
  // must restore its mutation context after the deliberate nonexistent-Study request.
  await setContext(tx,f.user,f.id.group,f.id.project);
  await tx.modalityFile.update({where:{id:a.fileId},data:{deletedAt:new Date()}});await assert.rejects(api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,a.taskId,{}),e=>code(e)==='FILE_SOURCE_CHANGED');await tx.modalityFile.update({where:{id:a.fileId},data:{deletedAt:null}});
  await tx.account.update({where:{id:f.otherAdmin.accountId},data:{authVersion:1}});await assert.rejects(api.listFeatures(f.otherAdmin,studyId,a.subject.visitId,a.fileId,a.taskId,{}),e=>code(e)==='AUTH_SESSION_EXPIRED');
  await tx.$executeRaw`INSERT INTO public.study_participation_event(id,"tenantId","studyGroupId","researchProjectId","subjectId","enrollmentId","protocolVersionId","policyVersionId","policyHash",sequence,kind,decision,evidence,reason,"effectiveAt","recordedBy") SELECT ${prefix+'_withdraw'},${f.id.tenant},${f.id.group},${f.id.project},${a.subject.subjectId},${a.subject.enrollmentId},${f.id.protocol},${f.id.policy},"contentHash",4,'data_use_consent','withdrawn','synthetic','Independent pagination withdrawal',now(),${f.id.account} FROM public.study_execution_policy_version WHERE id=${f.id.policy}`;
  for(const read of [()=>api.list(f.user,studyId,a.subject.visitId,{}),()=>api.listTasks(f.user,studyId,a.subject.visitId,a.fileId,{}),()=>api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,a.taskId,{}),()=>api.listFeatures(f.user,studyId,a.subject.visitId,a.fileId,a.taskId,{cursor:page.nextCursor})])await assert.rejects(read,e=>code(e)==='PARTICIPATION_CAPTURE_BLOCKED');
  throw Error('INDEPENDENT_PAGE_AUTH_ALL_ROLLBACK');
 }),/INDEPENDENT_PAGE_AUTH_ALL_ROLLBACK/);
});
