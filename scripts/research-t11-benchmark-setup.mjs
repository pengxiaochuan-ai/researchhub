// New generic case through real Study/configuration/participation APIs. Only reusable
// published form/outcome fixtures and the owned local tenant feature are seeded.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
const base='http://127.0.0.1:19501',runId='rh-workflow-benchmark-'+randomUUID().slice(0,8),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t12-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const key=()=>randomUUID(),network=[],checks=[];let stage='setup';
async function request(path,method='GET',body,status=200){
 const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies.admin,Origin:base,...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const value=await r.json().catch(()=>null);network.push({at:new Date().toISOString(),stage,path,method,status:r.status});assert.equal(r.status,status,JSON.stringify({stage,path,status:r.status,code:value?.code}));return value;
}
const post=(p,b,s)=>request(p,'POST',b,s),direct=fn=>withFixtureTransaction(env,'direct',fn);
try{
 const context=await request('/research-projects/context');assert(context.creationGroups.some(x=>x.id===runtime.ids.group));
 const intent=(await post('/research-projects',{requestKey:key(),title:'通用科研流程合成验收 · '+runId,question:'现场、H5、CSV正式答卷及确定性描述统计，无真实受试者',hubKey:context.hubs[0].hubKey},201)).item;
 const study=(await post('/research-projects/'+intent.id+'/studies',{requestKey:key(),expectedVersion:intent.version,studyGroupId:runtime.ids.group})).item.study;
 const root='/research-studies/'+study.id,scope={tenantId:runtime.ids.tenant,studyGroupId:runtime.ids.group,researchProjectId:study.executionProjectId};
 const refs=await direct(async tx=>{
  const marker=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runtime.key}`;assert.equal(marker[0]?.manifest?.syntheticOnly,true);
  const before=await tx.tenantFeatureEntitlement.findUnique({where:{tenantId_featureKey:{tenantId:scope.tenantId,featureKey:'participant_h5'}}});
  await tx.tenantFeatureEntitlement.upsert({where:{tenantId_featureKey:{tenantId:scope.tenantId,featureKey:'participant_h5'}},create:{tenantId:scope.tenantId,featureKey:'participant_h5',enabled:true,updatedBy:runtime.ids.admin,enabledAt:new Date(),config:{syntheticOnly:true,purpose:runId}},update:{enabled:true,updatedBy:runtime.ids.admin,enabledAt:new Date()}});
  await tx.auditLog.create({data:{tenantId:scope.tenantId,accountId:runtime.ids.admin,action:'synthetic_fixture.participant_h5.enable',target:scope.tenantId,meta:{runId,previousEnabled:before?.enabled??false,syntheticOnly:true}}});
  const template=await tx.formTemplate.create({data:{...scope,key:runId,name:'通用观察问卷'}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'观察值',type:'number',required:true},{key:'optional_value',label:'选填观察值',type:'number',required:false},{key:'completed',label:'已完成',type:'boolean',required:true}]}}});
  const outcome=await tx.outcomeDefinition.create({data:{...scope,key:runId,versionNumber:1,name:'通用观察值',role:'primary',sourceType:'data_field',dataFieldKey:'value',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:runtime.ids.admin}});
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify({syntheticOnly:true,runId,scope,studyId:study.id,purpose:'onsite-h5-csv-description-benchmark'})}::jsonb)`;
  return {form:form.id,outcome:outcome.id};
 });
 stage='protocol';let protocol=(await post(root+'/protocols',{requestKey:key(),title:'通用观察方案',purpose:'合成软件验收',primaryOutcomes:[{outcomeDefinitionId:refs.outcome,versionNumber:1}],secondaryOutcomes:[],statisticsSummary:'基线每被试一条当前有效记录，描述统计，样本标准差',visitPlans:[{code:'BASELINE',name:'基线访视',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,requirements:[{kind:'form_response',code:'OBSERVATION',name:'通用观察问卷',required:true,config:{formVersionId:refs.form,allowedCaptureModes:['researcher','patient_h5']}}]}]})).protocol;
 const pp=root+'/protocols/'+protocol.id,na={status:'not_applicable',source:'通用合成软件验收',reason:'无真实受试者或临床用途'},configured=rules=>({status:'configured',source:'通用合成软件验收',reason:'明确的合成规则',rules});
 const sections={ethics:na,safety:na,blinding:na,screening:configured({criteria:'授权研究者人工核对合成对象',decisionMethod:'manual'}),researchConsent:configured({textVersion:'synthetic-consent-v1',evidenceRequirement:'合成确认记录'}),dataUse:configured({purposes:'科研软件验证',scope:'synthetic-research-only'}),withdrawal:configured({effectiveRule:'停止新的采集',retentionRule:'保留合成历史',futureUseRule:'限制新的使用'}),site:{status:'configured',source:'合成案例',reason:'研究范围',mode:'study_wide'},captureReview:configured({correction:'保留修订与原因',locking:'审阅后锁定',unlocking:'记录原因',reviewResponsibility:'授权研究者',reviewIndependence:'not_required'})};
 const policy=(await request(pp+'/policy','PUT',{requestKey:key(),expectedPolicyId:null,sections})).policy;
 assert.equal((await post(pp+'/check',{requestKey:key(),expectedRevision:protocol.revision})).check.gate.ready,true);
 const submitted=await post(pp+'/submit',{requestKey:key(),expectedRevision:protocol.revision}),approved=await post(pp+'/approve',{requestKey:key(),expectedRevision:submitted.protocol.revision,policyVersionId:policy.id,expectedPolicyHash:policy.contentHash});
 protocol=(await post(pp+'/activate',{requestKey:key(),expectedRevision:approved.protocol.revision,migrateExisting:false})).protocol;
 checks.push('actual_new_study_fixed_three_field_form_approved_mode_configuration_and_activation');
 stage='subjects';const cases={};
 for(const code of ['ONSITE','H5','CSV','H5_SWITCH','H5_WITHDRAW']){
  const subject=(await post(root+'/subjects',{requestKey:key(),subjectId:'SYNTHETIC-'+code+'-'+runId.slice(-8)})).subject,p=root+'/subjects/'+subject.id+'/participation';
  for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:'synthetic-consent-v1'},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:'synthetic-research-only'}])await post(p+'/events',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'通用合成软件确认记录'}});
  const enrollment=await post(p+'/enroll',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash});const visits=await request(root+'/visits?subjectId='+subject.id);assert.equal(visits.items.length,1);cases[code]={subject,enrollment,visitId:visits.items[0].id};
 }
 checks.push('actual_screen_consent_enroll_five_isolated_cases_three_selected_analysis_subjects');
 const result={passed:true,syntheticOnly:true,runId,at:new Date().toISOString(),study,scope,refs,protocolId:protocol.id,policy,cases,analysisSubjectIds:['ONSITE','H5','CSV'].map(c=>cases[c].subject.id),checks,network,emailSent:false,browserAcceptance:false,clinicalAcceptance:false,productionAcceptance:false};
 writeFileSync(out+'setup.json',JSON.stringify(result,null,2));writeFileSync(workspaceRoot+'.tmp/researchhub-workflow/benchmark-current.json',JSON.stringify({acceptedFile:out+'setup.json'}),{mode:0o600});console.log(JSON.stringify({passed:true,evidence:out+'setup.json',checks}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,at:new Date().toISOString(),stage,message:String(error.message).slice(0,1400),checks,network},null,2));console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,900)}));process.exitCode=1;}
