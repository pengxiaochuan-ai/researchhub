import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createRequire}from'node:module';import{randomUUID}from'node:crypto';import{Readable}from'node:stream';
import{loadFixtureInput}from'../../../app/server/scripts/wp01/local-config.mjs';import{withFixtureTransaction}from'../../../app/server/scripts/wp01/fixture-guard.mjs';
import{applyMediaIngestSchema}from'../../scripts/ai-session-media-ingest-schema.mjs';import{createLocalMaterialAccess}from'../../scripts/local-session-materials.mjs';import{createResearchStudiesService}from'../research-studies/commands.mjs';import{createMediaIngestNative}from'../../scripts/ai-session-media-ingest-native.mjs';
import{createSubjectsService}from'../research-execution/subjects.mjs';
const api=await import('./session-media-ingests.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const root=new URL('../../../',import.meta.url).pathname,require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k];
const{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),baseScope=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/authorized-scope.json')),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),rollback=Symbol('mvb-pg-rollback');
test('real PG media registration, exact current authority, atomic receipt and subject-level Range read remain scoped without old jobs',async t=>{
 assert(api,'MVB service missing');
 const cfg=structuredClone(baseScope);cfg.scopeKey='mvb-pg-'+randomUUID();
 // Fresh rollback-only source identities: never rebind an accepted live file.
 for(const a of Object.values(cfg.actors)){a.sessionId='rh-mvb-pg-'+randomUUID();a.mediaId='rh-media-'+randomUUID();a.storageKey=`${cfg.tenantId}/hub-media/${a.sessionId}/${a.mediaId}.mp4`;}
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await applyMediaIngestSchema(tx,env);let sequence=0,failCommit=false,afterStat,afterOpen,lastStream;
  for(const a of Object.values(cfg.actors)){
   await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,cfg.tenantId,cfg.source.studyGroupId,cfg.source.researchProjectId,a.accountId);
   await tx.$executeRawUnsafe(`INSERT INTO public.session(id,"tenantId","studyGroupId","researchProjectId","accountId","agentId",title,channel,"contextKey","updatedAt") VALUES($1,$2,$3,$4,$5,$6,'MVB rollback only','knowledge',$7,now())`,a.sessionId,cfg.tenantId,cfg.source.studyGroupId,cfg.source.researchProjectId,a.accountId,cfg.tenantId+'-kb-research','hub:lingshu-xinyu:conversation:'+randomUUID());
   await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_uploads(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,request_fingerprint,extension,content_type,safe_filename,byte_size,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'mp4','video/mp4',$9,$10,$11)`,a.mediaId,cfg.tenantId,cfg.source.studyGroupId,cfg.source.researchProjectId,a.accountId,a.sessionId,'fixture-'+randomUUID(),'a'.repeat(64),a.mediaId+'.mp4',a.byteSize,a.storageKey);
   await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_uploads SET upload_id=$1::uuid,source_sha256=$2,archive_state='archived',inspection_state='complete',inspection_classification='valid',inspection=$3::jsonb,inspection_attempt_id=$4::uuid,version=version+1 WHERE id=$5`,randomUUID(),a.sha256,JSON.stringify(a.inspection),randomUUID(),a.mediaId);
  }
  const context=async(actor,source=false)=>tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,cfg.tenantId,source?cfg.source.studyGroupId:cfg.target.studyGroupId,source?cfg.source.researchProjectId:cfg.target.executionProjectId,cfg.actors[actor].accountId);
  const prisma={withTenantTransaction:async(tenant,_g,_p,fn)=>{const name='mvb_business_'+(++sequence);await tx.$executeRawUnsafe('SAVEPOINT '+name);try{await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id','',true),set_config('app.research_project_id','',true)`,tenant??cfg.tenantId);const v=await fn(tx);if(failCommit&&v?.state==='committed')throw Error('SYNTHETIC_COMMIT_FAILURE');return v;}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+name);throw e;}finally{await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+name);}}};
  const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[cfg.tenantId]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('FORBIDDEN');}});
  const sourceAccess=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>prisma.withTenantTransaction(null,null,null,fn)});
  const native=createMediaIngestNative({load,scopeKey:cfg.scopeKey,boundary:(u,c,source,mid)=>{const a=Object.values(cfg.actors).find(a=>a.accountId===u.accountId);return{mediaIds:[a.mediaId],subjectIds:[a.subjectId],visitIds:a.visit?[a.visit.id]:[]};}});
  const objects=new Map(Object.values(cfg.actors).map(a=>[a.storageKey,a]));
  const storage={statObject:async key=>{const a=objects.get(key);assert(a);await afterStat?.();return{size:a.byteSize,metaData:{'aisci-sha256':a.sha256,'aisci-media-id':a.mediaId,'aisci-account-id':a.accountId,'aisci-session-id':a.sessionId}};},getStream:async(_key,_start,length)=>{lastStream=Readable.from([Buffer.alloc(length??16)]);await afterOpen?.();return lastStream;}};
  const service=api.createSessionMediaIngests({studies,sourceAccess,native,storage,scopeKey:cfg.scopeKey,sourceScope:cfg.source,allowedStudyIds:[cfg.target.studyId],parseRange:load('sessions/sessions.service','parseAttachmentByteRange')});
  const user=actor=>({...cfg.source,tenantId:cfg.tenantId,accountId:cfg.actors[actor].accountId,authVersion:cfg.actors[actor].authVersion});
  const owner=cfg.actors.owner,admin=cfg.actors.admin;
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  await assert.rejects(service.prepare(user('owner'),owner.sessionId,owner.mediaId,{requestKey:'ungranted',studyId:cfg.target.studyId,subjectId:owner.subjectId}),e=>e.code==='MEDIA_INGEST_PERMISSION');
  await tx.$executeRawUnsafe('RESET ROLE');await context('admin');
  const permit='mvb-pg-'+randomUUID();
  await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_ingest_access(id,tenant_id,account_id,source_study_group_id,source_research_project_id,session_id,study_id,study_group_id,research_project_id,scope_key,media_ids,subject_ids,visit_ids,capabilities,granted_by,audit_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,ARRAY[$11]::text[],ARRAY[$12]::text[],ARRAY[]::text[],ARRAY['media.register','result.read']::text[],$13,$14,now()+interval '1 day')`,permit,cfg.tenantId,owner.accountId,cfg.source.studyGroupId,cfg.source.researchProjectId,owner.sessionId,cfg.target.studyId,cfg.target.studyGroupId,cfg.target.executionProjectId,cfg.scopeKey,owner.mediaId,owner.subjectId,admin.accountId,permit+'-audit');
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const counts=async()=>{await context('owner');return{files:await tx.modalityFile.count({where:{tenantId:cfg.tenantId,subjectId:{in:[owner.subjectId,admin.subjectId]}}}),tasks:await tx.processingTask.count({where:{tenantId:cfg.tenantId}}),status:await tx.processingStatus.count({where:{tenantId:cfg.tenantId}})};};
  const before=await counts();
  const candidates=await service.targets(user('owner'),owner.sessionId,owner.mediaId);assert.equal(candidates.items[0].subjects.length,1);assert.equal(candidates.items[0].subjects[0].id,owner.subjectId);
  const body={requestKey:'bind-'+randomUUID(),studyId:cfg.target.studyId,subjectId:owner.subjectId};
  const plan=await service.prepare(user('owner'),owner.sessionId,owner.mediaId,body);assert.equal(plan.state,'planned');assert.equal(plan.visit,null);assert.equal(plan.collectedAt,null);assert.equal((await counts()).files,before.files);
  const otherPlan=await service.prepare(user('owner'),owner.sessionId,owner.mediaId,{...body,requestKey:'other-'+randomUUID(),collectedAt:'2026-01-01T00:00:00.000Z'});
  await assert.rejects(service.confirm(user('owner'),owner.sessionId,owner.mediaId,plan.id,{expectedVersion:plan.version+1,confirmationHash:plan.confirmationHash}),e=>e.code==='MEDIA_INGEST_VERSION');
  failCommit=true;await assert.rejects(service.confirm(user('owner'),owner.sessionId,owner.mediaId,plan.id,{expectedVersion:plan.version,confirmationHash:plan.confirmationHash}),/SYNTHETIC_COMMIT_FAILURE/);failCommit=false;assert.deepEqual(await counts(),before);
  const result=await service.confirm(user('owner'),owner.sessionId,owner.mediaId,plan.id,{expectedVersion:plan.version,confirmationHash:plan.confirmationHash});assert.equal(result.state,'committed');assert(result.receipt.modalityFileId);
  const replay=await service.confirm(user('owner'),owner.sessionId,owner.mediaId,plan.id,{expectedVersion:plan.version,confirmationHash:plan.confirmationHash});assert.equal(replay.receipt.modalityFileId,result.receipt.modalityFileId);
  await assert.rejects(service.confirm(user('owner'),owner.sessionId,owner.mediaId,otherPlan.id,{expectedVersion:otherPlan.version,confirmationHash:otherPlan.confirmationHash}),e=>e.code==='MEDIA_INGEST_ALREADY_REGISTERED');
  const receipt=await service.receipt(user('owner'),owner.sessionId,owner.mediaId,body.requestKey);assert.equal(receipt.item.id,result.id);
  const listed=await service.subjectList(user('owner'),cfg.target.studyId,owner.subjectId,{});assert.equal(listed.items.length,1);assert.equal(listed.items[0].visit,null);
  const subjects=createSubjectsService({studies,core:{},limitedMediaRead:service.limitedReadInTx}),metadata=await subjects.detail(user('owner'),cfg.target.studyId,owner.subjectId);assert.equal(metadata.subject.id,owner.subjectId);assert.equal(metadata.visits.length,0);assert.equal(metadata.capabilities.canCreate,false);
  assert.equal((await service.subjectList(user('owner'),cfg.target.studyId,owner.subjectId,{fileId:result.receipt.modalityFileId})).items.length,1);
  const content=await service.content(user('owner'),cfg.target.studyId,owner.subjectId,result.id,'bytes=0-15');assert.equal(content.status,206);let bytes=0;for await(const b of content.stream)bytes+=b.length;assert.equal(bytes,16);
  await assert.rejects(service.get(user('admin'),owner.sessionId,owner.mediaId,plan.id),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');
  await assert.rejects(service.prepare(user('owner'),owner.sessionId,owner.mediaId,{...body,requestKey:'foreign',subjectId:admin.subjectId}),e=>e.code==='MEDIA_INGEST_PERMISSION');
  await t.test('revocation during object stat blocks delivery and closes an unopened stream',async()=>{
   await tx.$executeRawUnsafe('SAVEPOINT mvb_revoke');
   try{afterOpen=async()=>{await tx.$executeRawUnsafe('RESET ROLE');await context('admin');await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_ingest_access SET status='revoked',version=version+1,audit_id=$1 WHERE id=$2`,permit+'-revoked',permit);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');};
    await assert.rejects(service.content(user('owner'),cfg.target.studyId,owner.subjectId,result.id,'bytes=0-15'),e=>e.code==='MEDIA_INGEST_PERMISSION');assert.equal(lastStream.destroyed,true);
   }finally{afterOpen=null;await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT mvb_revoke');}
  });
  const adminBody={requestKey:'admin-'+randomUUID(),studyId:cfg.target.studyId,subjectId:admin.subjectId,...(admin.visit?{subjectVisitId:admin.visit.id}:{})};
  const a=await service.prepare(user('admin'),admin.sessionId,admin.mediaId,adminBody),done=await service.confirm(user('admin'),admin.sessionId,admin.mediaId,a.id,{expectedVersion:a.version,confirmationHash:a.confirmationHash});assert.equal(done.visit?.id,admin.visit?.id);
  const after=await counts();assert.deepEqual(after,{files:before.files+2,tasks:before.tasks,status:before.status});
  await t.test('an administrator can revoke a grant even after its fresh source session becomes unavailable',async()=>{
   await tx.$executeRawUnsafe('SAVEPOINT mvb_unavailable_revoke');
   try{
    await tx.$executeRawUnsafe('RESET ROLE');await context('owner',true);
    await tx.$executeRawUnsafe(`UPDATE public.session SET "deletedAt"=now() WHERE id=$1`,owner.sessionId);
    await context('admin');await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
    await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_ingest_access SET status='revoked',version=version+1,audit_id=$1 WHERE id=$2`,permit+'-unavailable-revoked',permit);
    const [grant]=await tx.$queryRawUnsafe('SELECT status,version FROM rh_ai.session_media_ingest_access WHERE id=$1',permit);
    assert.deepEqual(grant,{status:'revoked',version:2});
    const [ctx]=await tx.$queryRawUnsafe(`SELECT current_setting('app.study_group_id') AS g,current_setting('app.research_project_id') AS p,current_setting('app.account_id') AS a`);
    assert.deepEqual(ctx,{g:cfg.target.studyGroupId,p:cfg.target.executionProjectId,a:admin.accountId});
   }finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT mvb_unavailable_revoke');}
  });
  await context('owner');const file=await tx.modalityFile.findUnique({where:{id:result.receipt.modalityFileId}});assert.equal(file.storageKey,owner.storageKey);assert.equal(file.subjectVisitId,null);assert.equal(file.meta.sha256,owner.sha256);
  assert.equal(JSON.stringify(result).includes('storageKey'),false);assert.equal(JSON.stringify(result).includes(owner.storageKey),false);
  throw rollback;
 }),e=>e===rollback);
});
