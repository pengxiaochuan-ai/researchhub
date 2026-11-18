import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{randomUUID}from'node:crypto';
import{loadFixtureInput}from'../../../app/server/scripts/wp01/local-config.mjs';import{withFixtureTransaction}from'../../../app/server/scripts/wp01/fixture-guard.mjs';
const api=await import('../../scripts/ai-session-media-content-schema.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const root=new URL('../../../',import.meta.url).pathname,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),target=JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/authorized-scope.json')).target,rollback=Symbol('content-schema-rollback');
test('two content tables enforce administrator-issued object permits, current source, immutable attempts and tenant RLS in real PG rollback',async t=>{
 assert(api,'content schema missing');await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  await api.correctMediaContentGuard(tx,env,'52ca769420d9534c27f11d9a4f9eedef409ef58c4babed0e0d0081f60c737b87');assert.equal((await api.applyMediaContentSchema(tx,env)).created,false);
  const session='rh-mc-session-'+randomUUID(),media='rh-media-'+randomUUID(),id='rh-mc-'+randomUUID();
  const ctx=account=>tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,account);
  await ctx(ids.owner);await tx.$executeRawUnsafe(`INSERT INTO public.session(id,"tenantId","studyGroupId","researchProjectId","accountId","agentId",title,channel,"contextKey","updatedAt") VALUES($1,$2,$3,$4,$5,$6,'MC rollback','knowledge',$7,now())`,session,ids.tenant,ids.group,ids.project,ids.owner,ids.tenant+'-kb-research','hub:lingshu-xinyu:conversation:'+randomUUID());
  await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_uploads(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,request_fingerprint,extension,content_type,safe_filename,byte_size,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'mp4','video/mp4',$9,100,$10)`,media,ids.tenant,ids.group,ids.project,ids.owner,session,'r-'+randomUUID(),'a'.repeat(64),media+'.mp4',ids.tenant+'/hub-media/'+session+'/'+media+'.mp4');
  await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_uploads SET upload_id=$1::uuid,source_sha256=$2,archive_state='archived',inspection_state='complete',inspection_classification='valid',inspection=$3::jsonb,version=version+1 WHERE id=$4`,randomUUID(),'b'.repeat(64),JSON.stringify({hasVideo:true,hasAudio:true,durationSeconds:2}),media);
  const insert=()=>tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_content_runs(id,root_id,attempt_no,tenant_id,study_group_id,research_project_id,account_id,session_id,media_id,study_id,source_version,source_sha256,source_bytes,grant_by,grant_audit_id,grant_expires_at,config_hash) VALUES($1,$1,0,$2,$3,$4,$5,$6,$7,$8,2,$9,100,$10,$11,now()+interval '1 day',$12)`,id,ids.tenant,ids.group,ids.project,ids.owner,session,media,target.studyId,'b'.repeat(64),ids.admin,id+'-grant-audit','c'.repeat(64));
  const reject=async(fn,code)=>{await tx.$executeRawUnsafe('SAVEPOINT mc_no');try{await assert.rejects(fn,e=>String(e.meta?.message??e.message).includes(code));}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT mc_no');}};
  await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');await reject(insert,'CONTENT_GRANT_ADMIN');
  await ctx(ids.admin);await insert();
  await ctx(ids.owner);assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_media_content_runs WHERE id=$1',id)).length,1);
  await reject(()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_content_runs SET grant_expires_at=grant_expires_at+interval '1 day',version=version+1 WHERE id=$1`,id),'CONTENT_GRANT_ADMIN');
  await ctx(ids.admin);assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_media_content_evidence WHERE root_id=$1',id)).length,0);
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id','not-this-tenant',true)`);assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_media_content_runs WHERE id=$1',id)).length,0);
  await tx.$executeRawUnsafe('RESET ROLE');await ctx(ids.owner);await tx.$executeRawUnsafe(`UPDATE public.session SET "deletedAt"=now() WHERE id=$1`,session);
  await ctx(ids.admin);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_content_runs SET grant_revoked_at=now(),grant_version=grant_version+1,grant_audit_id=$1,version=version+1 WHERE id=$2`,id+'-revoke',id);
  const [row]=await tx.$queryRawUnsafe('SELECT grant_version,grant_revoked_at FROM rh_ai.session_media_content_runs WHERE id=$1',id);assert.equal(row.grant_version,2);assert(row.grant_revoked_at);
  const [rights]=await tx.$queryRawUnsafe(`SELECT has_table_privilege(current_user,'rh_ai.session_media_content_runs','DELETE') AS del,has_table_privilege(current_user,'rh_ai.session_media_content_evidence','TRUNCATE') AS trunc`);assert.deepEqual(rights,{del:false,trunc:false});
  throw rollback;
 }),e=>e===rollback);
});
