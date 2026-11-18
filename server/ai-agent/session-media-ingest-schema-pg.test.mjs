import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{randomUUID}from'node:crypto';
import{loadFixtureInput}from'../../../app/server/scripts/wp01/local-config.mjs';import{withFixtureTransaction}from'../../../app/server/scripts/wp01/fixture-guard.mjs';
const schema=await import('../../scripts/ai-session-media-ingest-schema.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const{env}=loadFixtureInput(new URL('../../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname),scope=JSON.parse(readFileSync(new URL('../../.tmp/ai-video-binding-2026-11-16/authorized-scope.json',import.meta.url))),rollback=Symbol('mvb-rollback');
test('MVB two-table schema enforces current parents, admin-only narrow grants and account RLS, wholly rolled back',async t=>{
 assert(schema,'MVB schema migration missing');
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await schema.applyMediaIngestSchema(tx,env);assert.equal((await schema.applyMediaIngestSchema(tx,env)).created,false);
  const owner=scope.actors.owner,admin=scope.actors.admin,key='mvb-schema-'+randomUUID();
  const context=account=>tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,scope.tenantId,scope.target.studyGroupId,scope.target.executionProjectId,account);
  const insert=(accountId=owner.accountId,subjectId=owner.subjectId)=>tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_ingest_access(id,tenant_id,account_id,source_study_group_id,source_research_project_id,session_id,study_id,study_group_id,research_project_id,scope_key,media_ids,subject_ids,visit_ids,capabilities,granted_by,audit_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,ARRAY[$11]::text[],ARRAY[$12]::text[],ARRAY[]::text[],ARRAY['media.register','result.read']::text[],$13,$14,now()+interval '1 day')`,key,scope.tenantId,accountId,scope.source.studyGroupId,scope.source.researchProjectId,owner.sessionId,scope.target.studyId,scope.target.studyGroupId,scope.target.executionProjectId,key,owner.mediaId,subjectId,admin.accountId,key+'-audit');
  const rejects=async(name,fn,code)=>t.test(name,async()=>{await tx.$executeRawUnsafe('SAVEPOINT mvb_reject');try{await assert.rejects(fn,e=>String(e.meta?.message??e.message).includes(code));}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT mvb_reject');}});
  await context(owner.accountId);await rejects('a researcher cannot issue their own video grant',()=>insert(),'MEDIA_INGEST_GRANT_ADMIN');
  await context(admin.accountId);await rejects('a grant cannot point at another account source',()=>insert(admin.accountId),'MEDIA_INGEST_PARENT');
  await rejects('a grant cannot point at an unrelated subject',()=>insert(owner.accountId,admin.subjectId),'MEDIA_INGEST_PARENT');
  await insert();
  await rejects('grant cannot silently expand its object set',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_ingest_access SET subject_ids=subject_ids||$1::text,version=version+1 WHERE id=$2`,admin.subjectId,key),'MEDIA_INGEST_IMMUTABLE');
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');await context(owner.accountId);
  assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_media_ingest_access WHERE id=$1',key)).length,1);
  const [rights]=await tx.$queryRawUnsafe(`SELECT has_table_privilege(current_user,'rh_ai.session_media_ingests','DELETE') AS del,has_table_privilege(current_user,'rh_ai.session_media_ingests','TRUNCATE') AS trunc`);assert.deepEqual(rights,{del:false,trunc:false});
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id','not-this-tenant',true)`);assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_media_ingest_access WHERE id=$1',key)).length,0);
  await tx.$executeRawUnsafe('RESET ROLE');await context(admin.accountId);
  await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_ingest_access SET status='revoked',version=version+1,audit_id=$1 WHERE id=$2`,key+'-revoked',key);
  await rejects('revoked permission cannot be restored in place',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_ingest_access SET status='active',version=version+1 WHERE id=$1`,key),'MEDIA_INGEST_GRANT_STATE');
  await rejects('migration refuses drift rather than patching other schemas',async()=>{await tx.$executeRawUnsafe('ALTER TABLE rh_ai.session_media_ingests DISABLE ROW LEVEL SECURITY');await schema.applyMediaIngestSchema(tx,env);},'MEDIA_INGEST_SCHEMA_CONFLICT');
  throw rollback;
 }),e=>e===rollback);
});
