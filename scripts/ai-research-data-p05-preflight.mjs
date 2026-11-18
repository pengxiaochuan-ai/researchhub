// P05 factual admission report. Strong READ ONLY, no grants/DDL/model calls.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const out='.tmp/ai-file-data-2026-11-12/p05-preflight-'+Date.now();mkdirSync(out,{recursive:true,mode:0o700});
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {authorizeIngestInTransaction}=require(root+'app/server/src/ingest/ingest-authorization.ts'),{authorizeFormalResponse}=require(root+'app/server/src/study-operations/formal-response-authority.ts');
try{
 const report=await withFixtureTransaction(env,'app',async tx=>{
  const [mode]=await tx.$queryRawUnsafe('SHOW transaction_read_only');assert.equal(mode.transaction_read_only,'on');
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,ids.owner);
  const sourceScope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project};
  const sourceBindings=await tx.$queryRawUnsafe('SELECT id FROM rh_research.study_binding WHERE tenant_id=$1 AND execution_project_id=$2',ids.tenant,ids.project);assert.equal(sourceBindings.length,0);
  const [study]=await tx.$queryRawUnsafe('SELECT b.id,b.tenant_id,b.study_group_id,b.execution_project_id,b.project_intent_id,i.title FROM rh_research.study_binding b JOIN rh_research.project_intent i ON i.id=b.project_intent_id AND i.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.id=$2',ids.tenant,'rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090');assert(study);
  await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true)`,study.study_group_id,study.execution_project_id);
  const scope={tenantId:ids.tenant,studyGroupId:study.study_group_id,researchProjectId:study.execution_project_id};
  const protocols=await tx.studyProtocolVersion.findMany({where:scope,select:{id:true,status:true,versionNumber:true,approvedPolicyVersionId:true,approvedPolicyHash:true},orderBy:{versionNumber:'asc'}}),active=protocols.filter(p=>p.status==='executing');assert.equal(active.length,1);
  const visits=await tx.visitPlan.findMany({where:{...scope,protocolVersionId:active[0].id},select:{id:true,name:true,code:true}}),requirements=await tx.visitRequirement.findMany({where:{...scope,visitPlanId:{in:visits.map(v=>v.id)},kind:'form_response'},select:{visitPlanId:true,config:true}}),forms=await tx.formVersion.findMany({where:{...scope,status:{in:['published','locked']}},select:{id:true,status:true,versionNumber:true,schema:true,scoring:true}});
  const counts=async()=>({subject:await tx.subject.count({where:scope}),enrollment:await tx.studyEnrollment.count({where:scope}),visit:await tx.subjectVisit.count({where:scope}),responses:await tx.formResponse.count({where:scope}),jobs:await tx.knowledgeChatJob.count({where:{tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]}}}),reservations:await tx.tokenQuotaReservation.count({where:{tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]}}})}),before=await counts(),accounts=[];
  for(const actor of ['owner','admin']){
   const a=await tx.account.findUnique({where:{id:ids[actor]},select:{id:true,role:true,isTenantAdmin:true,status:true,authVersion:true}});assert.equal(a.status,'active');
   const memberships=await tx.researchProjectMembership.findMany({where:{...scope,accountId:a.id},select:{status:true,roleKey:true}}),member=await tx.studyGroupMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:study.study_group_id,accountId:a.id,status:'active'},select:{role:{select:{id:true,status:true,menuPermissions:true,buttonPermissions:true}}}});
   const u={tenantId:ids.tenant,accountId:a.id,role:a.role,isTenantAdmin:a.isTenantAdmin,authVersion:a.authVersion};const native={};
   for(const [key,fn]of [['ingest',()=>authorizeIngestInTransaction(tx,u,study.study_group_id,study.execution_project_id)],['formFill',()=>authorizeFormalResponse(tx,u,study.study_group_id,study.execution_project_id,'form.fill')]]){try{await fn();native[key]={allowed:true};}catch(e){native[key]={allowed:false,status:e.getStatus?.()??e.status,code:e.getResponse?.()?.code??e.code};if(native[key].status!==403)throw e;}}
   accounts.push({actor,account:a,memberships,permissionRole:member?.role??null,native});
  }
  const [pendingTables]=await tx.$queryRawUnsafe(`SELECT to_regclass('rh_ai.research_data_import_access')::text AS access,to_regclass('rh_ai.research_data_imports')::text AS imports`),after=await counts();assert.deepEqual(after,before);
  return{passed:true,at:new Date().toISOString(),database:'wp01_test_full_baseline',applicationRole:true,transactionReadOnly:true,sourceScope,sourceStudyBindings:0,study,protocols,activeProtocol:active[0],visits,requirements,forms,accounts,pendingTables,before,after,modelCalls:0,businessWrites:0};
 },{readOnly:true});
 writeFileSync(out+'/result.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({passed:true,evidence:out,studyId:report.study.id,activeProtocol:report.activeProtocol.versionNumber,accounts:report.accounts.map(a=>({actor:a.actor,native:a.native})),pendingTables:report.pendingTables,businessWrites:0,modelCalls:0}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({code:e.code??e.name},null,2),{mode:0o600});console.log(JSON.stringify({passed:false,evidence:out,code:e.code??e.name}));process.exitCode=1;}
