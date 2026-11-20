import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {setContext} from '../research-studies/repository.mjs';
import {createMediaIngestNative} from '../../scripts/ai-session-media-ingest-native.mjs';
import {mediaIngestSnapshot} from './session-media-ingest-contract.mjs';
import {createLocalSessionMediaIngests} from '../../scripts/local-session-media-ingests.mjs';
import {upgradeNativeMediaTargetGuard,assertNativeMediaTargetGuardReady} from '../../scripts/ai-session-media-native-target-guard.mjs';
import {inspectMediaIngestSchema} from '../../scripts/ai-session-media-ingest-schema.mjs';
const root=new URL('../../../',import.meta.url).pathname,require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const load=(path,key)=>require(root+'app/server/src/'+path+'.ts')[key],{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const cfg=JSON.parse(readFileSync(new URL('../../.tmp/ai-video-binding-2026-11-16/authorized-scope.json',import.meta.url)));
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const rollback=Symbol('native-media-rollback');

test('applicable guarded revision, native noncreator proof, forged/grant denial and old reads all roll back',async()=>{
 await assertFixtureTarget(env);
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const fingerprints=()=>tx.$queryRawUnsafe(`SELECT (SELECT md5(COALESCE(string_agg(to_jsonb(r)::text,'' ORDER BY id),'')) FROM rh_ai.session_media_ingests r) AS operations,(SELECT md5(COALESCE(string_agg(to_jsonb(r)::text,'' ORDER BY id),'')) FROM rh_ai.session_media_ingest_access r) AS grants`),before=await fingerprints();
  const initial=await inspectMediaIngestSchema(tx),alreadyUp=Boolean(initial.receipt?.guardRevision),imageRevision=initial.receipt?.imageRevision==='tongue-images.v1';
  if(imageRevision)await assertNativeMediaTargetGuardReady(tx);
  else{if(alreadyUp){await assertNativeMediaTargetGuardReady(tx);assert.equal((await upgradeNativeMediaTargetGuard(tx,env,{direction:'down'})).changed,true);}
   assert.equal((await upgradeNativeMediaTargetGuard(tx,env)).changed,true);await assertNativeMediaTargetGuardReady(tx);assert.equal((await upgradeNativeMediaTargetGuard(tx,env)).changed,false);}
  const principal=async key=>{const account=await tx.account.findUnique({where:{id:cfg.actors[key].accountId}});assert(account?.status==='active');return{tenantId:cfg.tenantId,accountId:account.id,authVersion:account.authVersion,role:account.role,isTenantAdmin:account.isTenantAdmin,...cfg.source};};
  const admin=await principal('admin'),owner=await principal('owner');
  const mediaFor=async key=>(await tx.$queryRawUnsafe('SELECT * FROM rh_ai.session_media_uploads WHERE tenant_id=$1 AND account_id=$2 AND id=$3',cfg.tenantId,cfg.actors[key].accountId,cfg.actors[key].mediaId))[0];
  const adminMedia=await mediaFor('admin'),ownerMedia=await mediaFor('owner');assert(adminMedia&&ownerMedia);
  const [target]=await tx.$queryRawUnsafe(`SELECT b.id AS "studyId",b.study_group_id AS "studyGroupId",b.execution_project_id AS "executionProjectId",b.project_intent_id AS "projectIntentId",s.id AS "subjectId",s."createdBy" FROM rh_research.study_binding b JOIN public.subject s ON s."tenantId"=b.tenant_id AND s."studyGroupId"=b.study_group_id AND s."researchProjectId"=b.execution_project_id JOIN public.study_enrollment e ON e."subjectId"=s.id AND e.status='enrolled' WHERE b.tenant_id=$1 AND b.id<>$2 AND s."deletedAt" IS NULL AND NOT s."acceptanceFixture" AND s."createdBy" IS DISTINCT FROM $3 ORDER BY s."createdAt" DESC LIMIT 1`,cfg.tenantId,cfg.target.studyId,admin.accountId);assert(target,'existing noncreator subject in another Study required');
  const native=createMediaIngestNative({load,scopeKey:cfg.scopeKey,allowNativeTargets:true,boundary:()=>({subjectIds:[],visitIds:[],mediaIds:[]})}),source={...cfg.source,sessionId:adminMedia.session_id};
  await setContext(tx,admin,target.studyGroupId,target.executionProjectId);
  const permission=await native.currentInTx(tx,admin,target,source,{capability:'media.register',mediaId:adminMedia.id,subjectId:target.subjectId});
  const actual=await native.targetInTx(tx,admin,target,target.subjectId,null,null,{write:true,permission});assert.equal(actual.subject.id,target.subjectId);assert.notEqual(target.createdBy,admin.accountId);
  const insert=async(user,media,context,subjectTarget,ref)=>{
   await setContext(tx,user,context.studyGroupId,context.executionProjectId);const snapshot=mediaIngestSnapshot(media,subjectTarget,ref),id='rh-native-rollback-'+randomUUID();
   return tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_ingests(id,tenant_id,account_id,session_id,source_study_group_id,source_research_project_id,media_id,source_version,source_sha256,study_id,study_group_id,research_project_id,scope_key,subject_id,enrollment_id,visit_id,protocol_id,collected_at,request_key,confirmation_hash,snapshot,permission_ref,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NULL,$16,NULL,$17,$18,$19::jsonb,$20::jsonb,$21)`,id,user.tenantId,user.accountId,media.session_id,media.study_group_id,media.research_project_id,media.id,media.version,media.source_sha256,context.studyId,context.studyGroupId,context.executionProjectId,cfg.scopeKey,subjectTarget.subject.id,subjectTarget.enrollment?.id??null,subjectTarget.protocol?.id??null,'rollback-'+randomUUID(),snapshot.hash,JSON.stringify(snapshot),JSON.stringify(ref),id+'-audit');
  };
  const caseRollback=async(fn,error)=>{await tx.$executeRawUnsafe('SAVEPOINT native_case');try{if(error)await assert.rejects(fn,e=>String(e.meta?.message??e.message).includes(error));else await fn();}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT native_case');await tx.$executeRawUnsafe('RELEASE SAVEPOINT native_case');}};
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  await caseRollback(()=>insert(admin,adminMedia,target,actual,permission.permissionRef));
  await caseRollback(()=>insert(admin,adminMedia,target,actual,{kind:'native',id:'forged-actor',version:admin.authVersion}),'MEDIA_INGEST_PERMISSION');
  for(const ref of [{id:admin.accountId,version:admin.authVersion},{kind:null,id:admin.accountId,version:admin.authVersion},{kind:'unknown',id:admin.accountId,version:admin.authVersion},{kind:'native',id:admin.accountId},{kind:'native',id:admin.accountId,version:null}])await caseRollback(()=>insert(admin,adminMedia,target,actual,ref),'MEDIA_INGEST_PERMISSION');
  await caseRollback(()=>insert(admin,ownerMedia,target,actual,permission.permissionRef),'MEDIA_INGEST_PARENT');
  await caseRollback(()=>insert(owner,ownerMedia,target,actual,{kind:'native',id:owner.accountId,version:owner.authVersion}),'MEDIA_INGEST_PERMISSION');
  await caseRollback(async()=>{await tx.$executeRawUnsafe('RESET ROLE');await tx.studyGroup.update({where:{id:target.studyGroupId},data:{status:'archived'}});await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');await insert(admin,adminMedia,target,actual,permission.permissionRef);},'MEDIA_INGEST_PARENT');
  await tx.$executeRawUnsafe('RESET ROLE');
  assert.equal((await tx.studyGroup.findUnique({where:{id:target.studyGroupId},select:{status:true}})).status,'active');
  await setContext(tx,owner,cfg.target.studyGroupId,cfg.target.executionProjectId);
  const [grant]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingest_access WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND study_id=$4 AND scope_key=$5 AND status='active'`,cfg.tenantId,owner.accountId,ownerMedia.session_id,cfg.target.studyId,cfg.scopeKey);assert(grant,'existing precise grant required');
  const fixed={studyId:cfg.target.studyId,studyGroupId:cfg.target.studyGroupId,executionProjectId:cfg.target.executionProjectId,projectIntentId:cfg.target.projectIntentId};
  const foreignTarget={...actual,studyId:fixed.studyId,studyGroupId:fixed.studyGroupId,researchProjectId:fixed.executionProjectId,subject:{id:cfg.actors.admin.subjectId,subjectId:'SYNTHETIC'},enrollment:null,protocol:null,visit:null};
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');await caseRollback(()=>insert(owner,ownerMedia,fixed,foreignTarget,{kind:'grant',id:grant.id,version:grant.version}),'MEDIA_INGEST_PARENT');
  await tx.$executeRawUnsafe('RESET ROLE');
  const assembled=await createLocalSessionMediaIngests({env,ids,load,require,storage:{},transaction:fn=>fn(tx)});
  for(const [key,user]of[['owner',owner],['admin',admin]]){
   await setContext(tx,user,cfg.target.studyGroupId,cfg.target.executionProjectId);const [old]=await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND media_id=$4 AND state='committed' ORDER BY created_at LIMIT 1`,cfg.tenantId,user.accountId,cfg.actors[key].sessionId,cfg.actors[key].mediaId);assert(old);
   const read=await assembled.service.get(user,cfg.actors[key].sessionId,cfg.actors[key].mediaId,old.id);assert.equal(read.state,'committed');assert.equal(read.subject.id,cfg.actors[key].subjectId);
   const prior=await assembled.service.targets(user,cfg.actors[key].sessionId,cfg.actors[key].mediaId,{studyId:target.studyId});assert.equal(prior.current?.id,old.id);assert.equal(prior.current?.study.id,cfg.target.studyId);
  }
  await setContext(tx,admin,cfg.source.studyGroupId,cfg.source.researchProjectId);
  const [unbound]=await tx.$queryRawUnsafe(`SELECT m.id,m.session_id FROM rh_ai.session_media_uploads m JOIN public.session s ON s.id=m.session_id AND s."accountId"=m.account_id AND s.status='active' AND s."deletedAt" IS NULL WHERE m.tenant_id=$1 AND m.account_id=$2 AND m.study_group_id=$3 AND m.research_project_id=$4 AND m.archive_state='archived' AND m.inspection_state='complete' AND m.inspection_classification='valid' AND m.inspection->>'hasVideo'='true' AND NOT EXISTS(SELECT 1 FROM rh_ai.session_media_ingests i WHERE i.tenant_id=m.tenant_id AND i.media_id=m.id AND i.state='committed') ORDER BY m.created_at DESC LIMIT 1`,cfg.tenantId,admin.accountId,cfg.source.studyGroupId,cfg.source.researchProjectId);
  assert(unbound,'existing unregistered own media required; test does not create a source');
  const started=performance.now(),candidates=await assembled.service.targets(admin,unbound.session_id,unbound.id,{studyId:target.studyId});assert(candidates.items.some(x=>x.id===target.studyId),'dynamic native Study must be offered by the real local assembly');
  console.log(JSON.stringify({filteredTargetReadMs:Math.round(performance.now()-started),targetCount:candidates.items.length}));
  await assert.rejects(assembled.service.targets(admin,unbound.session_id,unbound.id,{studyId:'missing-study'}),e=>e.status===404);
  await assert.rejects(assembled.service.targets({...admin,authVersion:admin.authVersion+1},unbound.session_id,unbound.id,{studyId:target.studyId}),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');
  assert.deepEqual(await fingerprints(),before);
  if(imageRevision)await assertNativeMediaTargetGuardReady(tx);
  else{assert.equal((await upgradeNativeMediaTargetGuard(tx,env,{direction:'down'})).changed,true);assert.equal((await upgradeNativeMediaTargetGuard(tx,env,{direction:'down'})).changed,false);assert.deepEqual(await fingerprints(),before);
   if(alreadyUp)assert.equal((await upgradeNativeMediaTargetGuard(tx,env)).changed,true);}
  assert.deepEqual((await inspectMediaIngestSchema(tx)).receipt,initial.receipt);
  throw rollback;
 }),e=>e===rollback);
});
