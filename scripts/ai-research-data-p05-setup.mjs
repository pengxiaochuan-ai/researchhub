import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';import {inspectResearchDataImportSchema} from './ai-research-data-import-schema.mjs';
const root='/Users/mac/aisciencesys/',dir=root+'researchhub/.tmp/ai-file-data-2026-11-12/',file=dir+'p05-authorized-scope.json';
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const lock=require(root+'app/server/src/common/worker-publication.ts').lockAuthorizationMutation,authorize=require(root+'app/server/src/study-operations/formal-response-authority.ts').authorizeFormalResponse;
try{
 assert.deepEqual(process.argv.slice(2),['--approved-p05-import']);
 const current=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
 const result=await withFixtureTransaction(env,'app',async tx=>{
  const target={studyId:'rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090',studyGroupId:ids.group,executionProjectId:'cmwcc7ft60002lua6zkvh0mxj'},scopeKey='p05-import-20261113';
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,target.executionProjectId,ids.admin);await lock(tx,ids.tenant);
  assert.equal((await inspectResearchDataImportSchema(tx)).exists,2);
  const account=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant}});assert(account?.role==='tenant_admin'&&account.isTenantAdmin&&account.status==='active');
  const admin={tenantId:ids.tenant,accountId:ids.admin,role:account.role,isTenantAdmin:account.isTenantAdmin,authVersion:account.authVersion};await authorize(tx,admin,ids.group,target.executionProjectId,'read');
  const grantId='rh-p05-import-20261113-owner',sessionId='cmweju2c70002lua2apggpflo';
  const [prior]=await tx.$queryRawUnsafe('SELECT * FROM rh_ai.research_data_import_access WHERE id=$1',grantId);
  if(prior){assert.equal(prior.account_id,ids.owner);assert.equal(prior.study_id,target.studyId);assert.equal(prior.source_session_id,sessionId);assert.equal(prior.scope_key,scopeKey);assert(prior.status==='active'&&prior.expires_at>Date.now());return{...current,created:false,grantId,expiresAt:prior.expires_at.toISOString()};}
  assert.equal(current,null,'P05_LOCAL_SCOPE_CONFLICT');
  const auditId='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id:auditId,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:target.executionProjectId,accountId:ids.admin,action:'researchhub.data.access.grant',target:grantId,meta:{scopeKey,approval:'2026-11-13 M01-M05',capabilities:['profile.create','visit.import','result.read']}}});
  const [row]=await tx.$queryRawUnsafe(`INSERT INTO rh_ai.research_data_import_access(id,tenant_id,study_id,study_group_id,research_project_id,account_id,source_study_group_id,source_research_project_id,source_session_id,scope_key,capabilities,granted_by,audit_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$4,$7,$8,$9,ARRAY['profile.create','visit.import','result.read'],$10,$11,now()+interval '7 days') RETURNING *`,grantId,ids.tenant,target.studyId,ids.group,target.executionProjectId,ids.owner,ids.project,sessionId,scopeKey,ids.admin,auditId);
  return{schema:'hub-p05-local-scope.v1',created:true,scopeKey,grantId,grantedAt:row.created_at.toISOString(),expiresAt:row.expires_at.toISOString(),target,protocolVersionId:'cmwcc7kgi000ylua60qjdm1lg',visitPlanId:'cmwcc7kgi0010lua6lnh2kppe',formVersionId:'cmwcc7fux0002lux0dxq7ukdx',sessions:{[ids.owner]:sessionId,[ids.admin]:'cmwek2u7x0005lu0hgm44ej4q'},registeredObjects:{[ids.owner]:{subjectIds:[],visitIds:[]},[ids.admin]:{subjectIds:[],visitIds:[]}}};
 });
 writeFileSync(file,JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify({passed:true,created:result.created,studyId:result.target.studyId,grantId:result.grantId,expiresAt:result.expiresAt,changedRoles:0,changedTokenQuota:0}));
}catch(e){console.log(JSON.stringify({passed:false,code:e.code??e.name,pg:e.meta?.code}));process.exitCode=1;}
