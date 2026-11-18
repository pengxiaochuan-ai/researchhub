// VB01: only the dedicated synthetic database and two saved synthetic objects.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=new URL('../../',import.meta.url).pathname,out=root+'researchhub/.tmp/ai-video-binding-2026-11-16/';
const runtime=()=>{const r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.equal(r.key,'rh-kb-local-b0e2af9d');return r;};
export async function readMediaBindingProtection(env,ids,target){
 return withFixtureTransaction(env,'direct',async tx=>{
  const snapshots={};
  // IDs and row digests only; never export passwords, raw data or personal names.
  for(const table of ['account','study_group_membership','research_project_membership','agent_config','agent_access','subject','study_enrollment','subject_visit','modality_file','processing_task','processing_status','form_response','usage_record','token_quota_reservation']){
   const tableName='public.'+table;
   const rows=await tx.$queryRawUnsafe(`SELECT id,md5(to_jsonb(t)::text) AS digest FROM ${tableName} t WHERE "tenantId"=$1 ORDER BY id`,ids.tenant);
   snapshots[table]=rows;
  }
  snapshots.media=await tx.$queryRawUnsafe(`SELECT id,md5(to_jsonb(t)::text) AS digest FROM rh_ai.session_media_uploads t WHERE tenant_id=$1 ORDER BY id`,ids.tenant);
  return snapshots;
 },{readOnly:true});
}
export async function mediaBindingPreflight(){
 const {ids}=runtime(),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const c=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json'));
 assert.equal(c.target.studyId,'rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090');assert.equal(c.target.studyGroupId,ids.group);assert.equal(c.target.executionProjectId,'cmwcc7ft60002lua6zkvh0mxj');
 const sources=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-media-origin-2026-11-16/live/checkpoint.json'));
 assert.equal(sources.scope,'media-origin-two-synthetic-20261116');
 const facts=await withFixtureTransaction(env,'direct',async tx=>{
  const actors={};
  for(const actor of ['owner','admin']){
   const allowed=c.registeredObjects[ids[actor]],a=await tx.account.findUnique({where:{id:ids[actor]},select:{id:true,tenantId:true,status:true,authVersion:true,role:true,isTenantAdmin:true}});
   assert.equal(a.tenantId,ids.tenant);assert.equal(a.status,'active');
   const [media]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND id=$4`,ids.tenant,a.id,sources.actors[actor].sessionId,sources.actors[actor].mediaId);
   assert.equal(media.archive_state,'archived');assert.equal(media.inspection_state,'complete');assert.equal(media.inspection_classification,'valid');assert.equal(media.inspection.hasVideo,true);
   const subjects=await tx.subject.findMany({where:{tenantId:ids.tenant,studyGroupId:c.target.studyGroupId,researchProjectId:c.target.executionProjectId,id:{in:allowed.subjectIds},createdBy:a.id,deletedAt:null,acceptanceFixture:false},select:{id:true,subjectId:true,createdBy:true}});
   assert(subjects.length);
   const visits=await tx.subjectVisit.findMany({where:{tenantId:ids.tenant,studyGroupId:c.target.studyGroupId,researchProjectId:c.target.executionProjectId,id:{in:allowed.visitIds},subjectId:{in:subjects.map(s=>s.id)},acceptanceFixture:false},select:{id:true,subjectId:true,enrollmentId:true,status:true,scheduleState:true,version:true,visitPlanId:true,protocolVersionId:true}});
   const selectedVisit=actor==='admin'?visits.find(v=>['planned','due_soon','overdue','in_progress','deviation'].includes(v.status)&&v.scheduleState!=='pending_anchor'):null;
   const subject=selectedVisit?subjects.find(s=>s.id===selectedVisit.subjectId):subjects[0];
   actors[actor]={accountId:a.id,authVersion:a.authVersion,role:a.role,sessionId:media.session_id,mediaId:media.id,mediaVersion:media.version,sha256:media.source_sha256,byteSize:Number(media.byte_size),storageKey:media.storage_key,inspectionAttemptId:media.inspection_attempt_id,inspection:media.inspection,subjectId:subject.id,subjectCode:subject.subjectId,visit:selectedVisit??null};
  }
  return{schema:'hub-media-binding-scope.v1',scopeKey:'media-bind-20261116',tenantId:ids.tenant,source:{studyGroupId:ids.group,researchProjectId:ids.project},target:c.target,actors};
 },{readOnly:true});
 const storage=JSON.parse(readFileSync(root+'.tmp/wp01-pre-release/rehearsal-o7gOnS/runtime.json')).profiles[0].env;
 assert.equal(storage.S3_ENDPOINT,'http://127.0.0.1:19402');const require=createRequire(root+'app/server/package.json'),{Client}=require('minio');
 const client=new Client({endPoint:'127.0.0.1',port:19402,useSSL:false,accessKey:storage.S3_ACCESS_KEY,secretKey:storage.S3_SECRET_KEY,region:storage.S3_REGION});
 for(const actor of Object.values(facts.actors)){
  const stat=await client.statObject('rh-kb-local-b0e2af9d',actor.storageKey),meta=Object.fromEntries(Object.entries(stat.metaData).map(([k,v])=>[k.toLowerCase().replace(/^x-amz-meta-/,''),v]));
  assert.equal(stat.size,actor.byteSize);assert.equal(meta['aisci-sha256'],actor.sha256);assert.equal(meta['aisci-media-id'],actor.mediaId);assert.equal(meta['aisci-account-id'],actor.accountId);assert.equal(meta['aisci-session-id'],actor.sessionId);
 }
 mkdirSync(out,{recursive:true,mode:0o700});
 if(existsSync(out+'authorized-scope.json'))assert.deepEqual(JSON.parse(readFileSync(out+'authorized-scope.json')),facts,'MEDIA_BINDING_SCOPE_DRIFT');
 else writeFileSync(out+'authorized-scope.json',JSON.stringify(facts,null,2)+'\n',{mode:0o600});
 if(!existsSync(out+'protection-before.json'))writeFileSync(out+'protection-before.json',JSON.stringify(await readMediaBindingProtection(env,ids,c.target),null,2)+'\n',{mode:0o600});
 return{passed:true,actors:2,sourceObjectsReadOnly:true,targetStudyId:facts.target.studyId,withVisit:Boolean(facts.actors.admin.visit),newBusinessWrites:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mvb01-mvb03']);
 console.log(JSON.stringify(await mediaBindingPreflight()));
}
