// M05 only: explicit native participation preparation after this round profiles.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,renameSync} from 'node:fs';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';import {prepareP05NamedVisitsInTransaction} from './ai-research-data-p05-fixture.mjs';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
const root='/Users/mac/aisciencesys/',file=new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url),cfg=JSON.parse(readFileSync(file,'utf8')),{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k];
try{
 assert.equal(process.argv[2],'--approved-p05-prepare-named');const actor=process.argv[3];assert(['owner','admin'].includes(actor)&&process.argv.length===4);assert.equal(cfg.scopeKey,'p05-import-20261113');
 const result=await withFixtureTransaction(env,'app',async tx=>{
  const t=cfg.target;await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,t.studyGroupId,t.executionProjectId,ids[actor]);await load('common/worker-publication','lockAuthorizationMutation')(tx,ids.tenant);
  const a=await tx.account.findFirst({where:{id:ids[actor],tenantId:ids.tenant}});assert(a?.status==='active');const user={tenantId:ids.tenant,accountId:a.id,authVersion:a.authVersion,role:a.role,isTenantAdmin:a.isTenantAdmin};
  const receipts=await tx.$queryRawUnsafe(`SELECT receipt FROM rh_ai.research_data_imports WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND study_id=$4 AND scope_key=$5 AND state='committed' AND snapshot->>'mode'='subjects'`,ids.tenant,a.id,cfg.sessions[a.id],t.studyId,cfg.scopeKey),subjectIds=[...new Set(receipts.flatMap(r=>r.receipt.subjects.filter(s=>s.created).map(s=>s.id)))].sort();assert.equal(subjectIds.length,2,'P05_EXPECT_EXACT_TWO_NEW_PROFILES');
  const prepared=await prepareP05NamedVisitsInTransaction(tx,user,t,{load,scopeKey:cfg.scopeKey,subjectIds});
  if(actor==='owner'){
   await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,ids.admin);const admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active'}});assert(admin?.role==='tenant_admin'&&admin.isTenantAdmin);
   await load('study-operations/formal-response-authority','authorizeFormalResponse')(tx,{tenantId:ids.tenant,accountId:admin.id,authVersion:admin.authVersion,role:admin.role,isTenantAdmin:admin.isTenantAdmin},t.studyGroupId,t.executionProjectId,'read');
   const [grant]=await tx.$queryRawUnsafe('SELECT * FROM rh_ai.research_data_import_access WHERE id=$1 FOR UPDATE',cfg.grantId);assert(grant?.status==='active'&&grant.account_id===ids.owner&&grant.expires_at>new Date());const objects={subjectIds:prepared.subjectIds,visitIds:prepared.visitIds};
   if(materialDigest(grant.objects)!==materialDigest(objects)){
    const auditId='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id:auditId,tenantId:ids.tenant,studyGroupId:t.studyGroupId,researchProjectId:t.executionProjectId,accountId:admin.id,action:'researchhub.data.access.fixture',target:grant.id,meta:{scopeKey:cfg.scopeKey,...objects,syntheticOnly:true}}});
    const count=await tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_import_access SET objects=$1::jsonb,version=version+1,audit_id=$2 WHERE id=$3 AND version=$4`,JSON.stringify(objects),auditId,grant.id,grant.version);assert.equal(count,1);
   }
  }
  const s={tenantId:ids.tenant,studyGroupId:t.studyGroupId,researchProjectId:t.executionProjectId};assert(await tx.subject.count({where:s})<=4);assert(await tx.studyEnrollment.count({where:s})<=4);assert(await tx.subjectVisit.count({where:s})<=4);return prepared;
 });
 const latest=JSON.parse(readFileSync(file,'utf8'));assert.equal(latest.scopeKey,cfg.scopeKey);latest.registeredObjects[ids[actor]]={subjectIds:result.subjectIds,visitIds:result.visitIds};const temp=new URL(file.href+'.'+randomUUID()+'.tmp');writeFileSync(temp,JSON.stringify(latest,null,2),{mode:0o600});renameSync(temp,file);console.log(JSON.stringify({passed:true,actor,separateFromImport:true,...result,modelCalls:0}));
}catch(e){console.log(JSON.stringify({passed:false,code:e.code??e.getResponse?.()?.code??e.name,pg:e.meta?.code}));process.exitCode=1;}
