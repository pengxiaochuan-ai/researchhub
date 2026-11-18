// P06 admission: the existing named synthetic database, strict READ ONLY.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),config=JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url),'utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const out='.tmp/ai-file-data-2026-11-12/p06-preflight-'+Date.now();mkdirSync(out,{recursive:true,mode:0o700});
try{
 const report=await withFixtureTransaction(env,'app',async tx=>{
  const [mode]=await tx.$queryRawUnsafe('SHOW transaction_read_only');assert.equal(mode.transaction_read_only,'on');
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,config.target.executionProjectId,ids.admin);
  const s={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:config.target.executionProjectId},form=await tx.formVersion.findFirst({where:{...s,id:config.formVersionId},select:{id:true,status:true,schema:true,scoring:true}});assert(form&&['published','locked'].includes(form.status));
  const responses=await tx.$queryRawUnsafe(`SELECT r.id,r.status,r.answers,r.score,r.version,a."createdBy",a."subjectId",a."subjectVisitId",rev."revisionNo",rev."contentHash" FROM public.form_response r JOIN public.form_assignment a ON a.id=r."assignmentId" JOIN public.form_response_revision rev ON rev.id=r."currentRevisionId" AND rev."responseId"=r.id WHERE r."tenantId"=$1 AND r."studyGroupId"=$2 AND r."researchProjectId"=$3 ORDER BY r.id`,ids.tenant,ids.group,config.target.executionProjectId);assert.equal(responses.length,4);
  const agents=await tx.agent.findMany({where:{tenantId:ids.tenant,type:{in:['data','research']}},select:{id:true,type:true,status:true}}),configs=await tx.agentConfig.findMany({where:{tenantId:ids.tenant,agentId:{in:agents.map(a=>a.id)},active:true,archivedAt:null},select:{agentId:true,version:true,tools:true}}),accounts=[],imports=[];
  for(const actor of ['owner','admin']){
   await tx.$queryRawUnsafe(`SELECT set_config('app.research_project_id',$1,true),set_config('app.account_id',$2,true)`,ids.project,ids[actor]);
   const a=await tx.account.findFirst({where:{tenantId:ids.tenant,id:ids[actor]},select:{id:true,status:true,role:true,isTenantAdmin:true,authVersion:true}});assert(a?.status==='active');accounts.push({actor,...a});
   const rows=await tx.$queryRawUnsafe(`SELECT id,state,version,receipt FROM rh_ai.research_data_imports WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND scope_key=$4 AND state='committed'`,ids.tenant,ids[actor],config.sessions[ids[actor]],config.scopeKey);imports.push(...rows.map(r=>({actor,...r})));
  }
  const grant=await tx.$queryRawUnsafe('SELECT status,version,capabilities,expires_at FROM rh_ai.research_data_import_access WHERE id=$1',config.grantId);assert.equal(grant[0]?.status,'active');
  return{passed:true,at:new Date().toISOString(),readOnly:true,study:config.target,form,responses,agents,configs,accounts,imports,grant,businessWrites:0,modelCalls:0};
 },{readOnly:true});writeFileSync(out+'/result.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({passed:true,evidence:out,responses:report.responses.length,dataAgents:report.agents.filter(a=>a.type==='data').length,fields:report.form.schema.fields,businessWrites:0,modelCalls:0}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({code:e.code??e.name,message:e.message.slice(0,300)}),{mode:0o600});console.log(JSON.stringify({passed:false,evidence:out,code:e.code??e.name}));process.exitCode=1;}
