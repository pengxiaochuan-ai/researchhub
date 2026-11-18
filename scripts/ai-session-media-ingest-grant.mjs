// One approved, revocable permit; never changes a role or an old tool grant.
import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{pathToFileURL}from'node:url';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';import{assertFixtureTarget,withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
import{validateMediaIngestScope}from'./ai-session-media-ingest-scope.mjs';
const root=new URL('../../',import.meta.url).pathname;
export async function grantMediaIngestScope(){
 const{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const c=validateMediaIngestScope(JSON.parse(readFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/authorized-scope.json')),ids,{checkpoint:JSON.parse(readFileSync(root+'researchhub/.tmp/ai-media-origin-2026-11-16/live/checkpoint.json')),registered:JSON.parse(readFileSync(root+'researchhub/.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json')).registeredObjects});
 return withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,c.target.studyGroupId,c.target.executionProjectId,ids.admin);
  const lock=(await import('node:module')).createRequire(root+'app/server/package.json');lock('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});await lock(root+'app/server/src/common/worker-publication.ts').lockAuthorizationMutation(tx,ids.tenant);
  const admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active',role:'tenant_admin',isTenantAdmin:true,tenant:{status:'active'}}});assert(admin,'MEDIA_INGEST_GRANT_ADMIN');
  const id='rh-media-bind-owner-20261116',owner=c.actors.owner,expected={media_ids:[owner.mediaId],subject_ids:[owner.subjectId],visit_ids:owner.visit?[owner.visit.id]:[],capabilities:['media.register','result.read']};
  const [old]=await tx.$queryRawUnsafe('SELECT * FROM rh_ai.session_media_ingest_access WHERE id=$1',id);
  if(old){assert.equal(old.status,'active');assert(old.expires_at>new Date());assert.equal(old.account_id,ids.owner);assert.equal(old.study_id,c.target.studyId);assert.equal(old.session_id,owner.sessionId);for(const[k,v]of Object.entries(expected))assert.deepEqual(old[k],v);return{created:false,id,expiresAt:old.expires_at};}
  const audit=await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:c.target.studyGroupId,accountId:ids.admin,action:'hub_media_ingest_granted',target:id,meta:{scopeKey:c.scopeKey,studyId:c.target.studyId,sourceMediaId:owner.mediaId,subjectId:owner.subjectId}}});
  const [row]=await tx.$queryRawUnsafe(`INSERT INTO rh_ai.session_media_ingest_access(id,tenant_id,account_id,source_study_group_id,source_research_project_id,session_id,study_id,study_group_id,research_project_id,scope_key,media_ids,subject_ids,visit_ids,capabilities,granted_by,audit_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],$12::text[],$13::text[],$14::text[],$15,$16,now()+interval '6 days 23 hours') RETURNING id,expires_at`,id,ids.tenant,ids.owner,c.source.studyGroupId,c.source.researchProjectId,owner.sessionId,c.target.studyId,c.target.studyGroupId,c.target.executionProjectId,c.scopeKey,expected.media_ids,expected.subject_ids,expected.visit_ids,expected.capabilities,ids.admin,audit.id);
  return{created:true,id:row.id,expiresAt:row.expires_at};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mvb01-mvb03']);const result=await grantMediaIngestScope();writeFileSync(root+'researchhub/.tmp/ai-video-binding-2026-11-16/grant-receipt.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));}
