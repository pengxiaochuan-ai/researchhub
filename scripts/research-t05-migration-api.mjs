// New synthetic case: actual HTTP configuration/release/migration and actual old-core enrollment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const base='http://127.0.0.1:19501',cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json')),runtime=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));
const runId='rh-t05-migration-http-'+randomUUID().slice(0,8),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t05-2026-11-11/'+runId+'/',privateDir=workspaceRoot+'.tmp/researchhub-workflow/'+runId+'/';
mkdirSync(out,{recursive:true});mkdirSync(privateDir,{recursive:true,mode:0o700});
const checks=[],network=[],key=()=>randomUUID(),direct=fn=>withFixtureTransaction(env,'direct',fn);let stage='preflight',study,protocol,target,policy,prisma;
async function request(path,method='GET',body,expected=200,role='admin'){
 const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[role]??'',Origin:base,Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);network.push({stage,role,path,method,status:response.status,at:new Date().toISOString()});
 assert.equal(response.status,expected,JSON.stringify({stage,path,status:response.status,code:data?.code,message:data?.message}));return data;
}
try{
 // Confirm this runtime has the controlled route before creating a case.
 const probe=await request('/research-studies/not-a-study/protocols/not-a-protocol/migration-candidates','GET',undefined,404);assert.equal(probe.code,'RESEARCH_NOT_FOUND');
 stage='create';const context=await request('/research-projects/context'),group=context.creationGroups.find(x=>x.id===runtime.ids.group);assert(group);
 const intent=(await request('/research-projects','POST',{requestKey:key(),title:'历史转版合成验收 · '+runId,question:'验证显式转版、历史保留与同意版本阻断，无真实受试者。',hubKey:context.hubs[0].hubKey},201)).item;
 study=(await request('/research-projects/'+intent.id+'/studies','POST',{requestKey:key(),expectedVersion:intent.version,studyGroupId:group.id})).item.study;
 const scope={tenantId:runtime.ids.tenant,studyGroupId:group.id,researchProjectId:study.executionProjectId};
 const refs=await direct(async tx=>{
  assert(await tx.researchProject.findFirst({where:{id:scope.researchProjectId,tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,name:intent.title}}));
  const template=await tx.formTemplate.create({data:{...scope,key:runId,name:'合成访视记录'}}),form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema:{fields:[{key:'value',label:'观察值',type:'number',required:true}]}}}),outcome=await tx.outcomeDefinition.create({data:{...scope,key:runId,versionNumber:1,name:'合成观察值',role:'primary',sourceType:'data_field',dataFieldKey:'value',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:runtime.ids.admin}});
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify({runId,syntheticOnly:true,scope,studyId:study.id,purpose:'research-t05-migration-http'})}::jsonb)`;
  return {form:form.id,outcome:outcome.id};
 });
 const config={title:'通用合成方案 · 原版',purpose:'仅验证软件转版，无临床用途',primaryOutcomes:[{outcomeDefinitionId:refs.outcome,versionNumber:1}],secondaryOutcomes:[],visitPlans:[{code:'BASELINE',name:'基线访视',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,requirements:[{kind:'form_response',code:'F',name:'合成访视记录',required:true,config:{formVersionId:refs.form}}]}]};
 const na={status:'not_applicable',source:'通用合成软件验收案例',reason:'无真实受试者及临床用途'},sections=Object.fromEntries(['ethics','screening','researchConsent','dataUse','withdrawal','safety','blinding'].map(x=>[x,na]));
 sections.site={status:'configured',source:'通用合成软件案例',reason:'合成研究统一范围',mode:'study_wide'};sections.captureReview={status:'configured',source:'通用合成软件案例',reason:'测试修订审阅',rules:{correction:'保留更正历史',locking:'审阅后锁定',unlocking:'说明解锁理由',reviewResponsibility:'授权研究者',reviewIndependence:'not_required'}};
 async function approve(configuration){
  const p=(await request('/research-studies/'+study.id+'/protocols','POST',{...configuration,requestKey:key()})).protocol,path='/research-studies/'+study.id+'/protocols/'+p.id;
  const saved=(await request(path+'/policy','PUT',{requestKey:key(),expectedPolicyId:null,sections})).policy;
  assert.equal((await request(path+'/check','POST',{requestKey:key(),expectedRevision:p.revision})).check.gate.ready,true);
  const submitted=await request(path+'/submit','POST',{requestKey:key(),expectedRevision:p.revision});
  const result=await request(path+'/approve','POST',{requestKey:key(),expectedRevision:submitted.protocol.revision,policyVersionId:saved.id,expectedPolicyHash:saved.contentHash});return {protocol:result.protocol,policy:saved};
 }
 stage='source-release';const source=await approve(config);policy=source.policy;
 protocol=(await request('/research-studies/'+study.id+'/protocols/'+source.protocol.id+'/activate','POST',{requestKey:key(),expectedRevision:source.protocol.revision,migrateExisting:false})).protocol;
 process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;const {load}=runtimeDependencies();prisma=new(load('prisma/prisma.service','PrismaService'))();const core=new(load('study-operations/study-operations.service','StudyOperationsService'))(prisma,new(load('remediation/remediation.service','RemediationCasesService'))(prisma));
 const user={...scope,accountId:runtime.ids.admin,authVersion:0},cases={};
 stage='real-enroll';for(const code of ['A','B','C','D']){
  const subject=await direct(tx=>tx.subject.create({data:{...scope,subjectId:'SYNTHETIC-'+code+'-'+runId.slice(-8)}}));
  const enrollment=await core.enroll(user,{subjectId:subject.id});assert(enrollment.visits.length===1);
  cases[code]={subjectId:subject.id,subjectCode:subject.subjectId,enrollmentId:enrollment.id,visitId:enrollment.visits[0].id};
 }
 await direct(async tx=>{
  // Controlled synthetic negative state; no pre-existing study or collected answers are changed.
  await tx.subjectVisit.update({where:{id:cases.B.visitId},data:{status:'in_progress',actualStartedAt:new Date()}});
  await tx.$executeRaw`INSERT INTO public.study_participation_event (id,"tenantId","studyGroupId","researchProjectId","subjectId","enrollmentId","protocolVersionId","policyVersionId","policyHash",sequence,kind,decision,evidence,reason,"effectiveAt","recordedBy") VALUES (${runId+'-event'},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${cases.C.subjectId},${cases.C.enrollmentId},${protocol.id},${policy.id},${policy.contentHash},1,'research_consent','not_applicable','合成软件案例','无临床用途',now(),${user.accountId})`;
  for(const code of ['A','D']){const task=await tx.studyTask.create({data:{...scope,subjectId:cases[code].subjectId,enrollmentId:cases[code].enrollmentId,subjectVisitId:cases[code].visitId,source:'manual',taskType:'data_capture',name:'合成旧访视采集',status:'open'}});cases[code].taskId=task.id;}
 });checks.push('source_actual_http_approved_and_activated_four_real_core_enrollments');
 stage='target-release';target=(await approve({...config,title:'通用合成方案 · 目标版',visitPlans:config.visitPlans.map(v=>({...v,name:'新版基线访视',targetDayOffset:1}))})).protocol;
 const path='/research-studies/'+study.id+'/protocols/'+target.id;
 stage='candidates';let cursor,all=[];do{const page=await request(path+'/migration-candidates?limit=1'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert(page.items.length<=1);all.push(...page.items);cursor=page.nextCursor;}while(cursor);
 assert.deepEqual(all.map(x=>x.id).sort(),Object.values(cases).map(x=>x.enrollmentId).sort());assert(all.every(x=>x.subjectCode.startsWith('SYNTHETIC-')&&x.sourceProtocol.id===protocol.id));
 await request(path+'/migration-candidates?siteId=other','GET',undefined,400);checks.push('actual_scoped_candidates_stable_pagination_subject_codes_and_query_rejection');
 stage='blocked-previews';for(const code of ['B','C']){const preview=await request(path+'/activation-preview','POST',{requestKey:key(),expectedRevision:target.revision,enrollmentIds:[cases[code].enrollmentId]});assert.equal(preview.canMigrate,false);assert(preview.snapshot.items[0].blockingReasons.includes(code==='B'?'visit_ineligible':'existing_evidence'));}
 checks.push('actual_started_visit_and_old_version_participation_facts_block_without_mutation');
 stage='preview';const previewBody={requestKey:key(),expectedRevision:target.revision,enrollmentIds:[cases.A.enrollmentId]},preview=await request(path+'/activation-preview','POST',previewBody);assert.equal(preview.canMigrate,true);assert.deepEqual(await request(path+'/activation-preview','POST',previewBody),preview);
 const body={requestKey:key(),expectedRevision:target.revision,migrateExisting:true,previewRequestKey:previewBody.requestKey,previewToken:preview.token,reason:'通用合成案例验证显式转版'};
 stage='bad-token';await request(path+'/migration','POST',{...body,requestKey:key(),previewToken:'x'.repeat(43)},409);await request(path+'/migration','POST',{...body,requestKey:key(),reason:''},400);
 stage='execute';const executed=await request(path+'/migration','POST',body);assert.equal(executed.migrations.length,1);assert.equal(executed.migrations[0].enrollmentId,cases.A.enrollmentId);assert.equal(executed.migrations[0].newVisitIds.length,1);assert.deepEqual(await request(path+'/migration','POST',body),executed);
 await request(path+'/migration','POST',{...body,reason:'changed'},409);
 stage='readback';const facts=await direct(async tx=>({source:await tx.studyProtocolVersion.findUnique({where:{id:protocol.id},select:{status:true}}),target:await tx.studyProtocolVersion.findUnique({where:{id:target.id},select:{status:true}}),enrollments:await tx.studyEnrollment.findMany({where:{...scope,id:{in:Object.values(cases).map(x=>x.enrollmentId)}},select:{id:true,protocolVersionId:true}}),visits:await tx.subjectVisit.findMany({where:{...scope,subjectId:cases.A.subjectId},select:{id:true,status:true,protocolVersionId:true}}),task:await tx.studyTask.findUnique({where:{id:cases.A.taskId},select:{status:true}}),requirements:await tx.visitRequirementFulfillment.findMany({where:{...scope,subjectVisitId:{in:executed.migrations[0].newVisitIds}},select:{status:true}})}));
 assert.equal(facts.source.status,'superseded');assert.equal(facts.target.status,'executing');assert.equal(facts.task.status,'cancelled');assert.equal(facts.visits.find(x=>x.id===cases.A.visitId).status,'cancelled');assert.equal(facts.visits.find(x=>x.id===cases.A.visitId).protocolVersionId,protocol.id);assert(facts.visits.some(x=>x.protocolVersionId===target.id&&x.status!=='cancelled'));assert(facts.requirements.length===1&&facts.requirements.every(x=>x.status==='missing'));
 for(const code of ['B','C','D'])assert.equal(facts.enrollments.find(x=>x.id===cases[code].enrollmentId).protocolVersionId,protocol.id);
 checks.push('actual_approved_activation_and_selected_migration_atomic_old_rows_preserved_new_visits_requirements_and_receipt_replay');
 stage='expired-recovery';await direct(tx=>tx.$executeRaw`UPDATE rh_research.operation SET result=jsonb_set(result,'{expiresAt}',to_jsonb('2000-01-01T00:00:00.000Z'::text)) WHERE tenant_id=${scope.tenantId} AND actor_id=${user.accountId} AND request_key=${previewBody.requestKey}`);
 assert.deepEqual(await request(path+'/migration','POST',body),executed);
 const receipt=await request(path+'/migration-receipts/'+body.requestKey);assert.deepEqual(receipt,executed);
 await request(path+'/migration-receipts/'+body.requestKey,'GET',undefined,403,'owner');checks.push('successful_execution_recoverable_after_preview_expiry_only_for_current_authorized_actor');
 const remaining=await request(path+'/migration-candidates?limit=100');assert(!remaining.items.some(x=>x.id===cases.A.enrollmentId));assert(remaining.items.some(x=>x.id===cases.D.enrollmentId));
 const accepted={runId,study,projectIntentId:intent.id,sourceProtocolId:protocol.id,targetProtocolId:target.id,cases,base,syntheticOnly:true};
 writeFileSync(privateDir+'accepted.json',JSON.stringify(accepted,null,2),{mode:0o600});writeFileSync(workspaceRoot+'.tmp/researchhub-workflow/t05-migration-current.json',JSON.stringify({acceptedFile:privateDir+'accepted.json'},null,2),{mode:0o600});
 writeFileSync(out+'http-result.json',JSON.stringify({passed:true,at:new Date().toISOString(),...accepted,checks,network,facts,clinicalAcceptance:false,productionDeployment:false,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks,studyId:study.id,targetProtocolId:target.id,evidence:out+'http-result.json'}));
}catch(error){const failure={passed:false,at:new Date().toISOString(),runId,stage,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,1400),checks,network,study,sourceProtocolId:protocol?.id,targetProtocolId:target?.id};writeFileSync(out+'http-failure.json',JSON.stringify(failure,null,2));console.error(JSON.stringify({passed:false,stage,message:failure.message}));process.exitCode=1;}finally{await prisma?.app.$disconnect();await prisma?.elevated.$disconnect();}
