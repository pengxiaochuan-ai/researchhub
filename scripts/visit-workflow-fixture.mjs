// New synthetic Study only. No live I/O unless root grants this exact acceptance window.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {purpose,privateDir,evidenceDir,json,save,sha,requireQAWindow,sourceProfiles,makeVisitPlans,makePolicySections,syntheticAnswers,validateFixture} from './visit-workflow-qa.mjs';
import {preserveOld} from './visit-workflow-preserve.mjs';

export async function prepareFixture(){
 requireQAWindow(['--local-synthetic','--prepare']);
 if(existsSync(privateDir+'fixture.json'))assert(!json(privateDir+'fixture.json').ready,'FIXTURE_ALREADY_READY_DO_NOT_RESEED_OR_REWRITE_ITS_QA_METADATA');
 const {openHarness}=await import('./full-study-runtime.mjs'),{runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs'),{createResearchFormAdapter}=await import('../server/research-capture/form-core-adapter.mjs');
 const h=await openHarness({privateOutputDir:privateDir+'fixture-auth/'});await preserveOld(h,'before');
 const checkpointPath=privateDir+'fixture-checkpoint.json',checkpoint=existsSync(checkpointPath)?json(checkpointPath):{runId:'rh-visit-qa-'+randomUUID().slice(0,8),steps:{},direct:{}};
 assert.match(checkpoint.runId,/^rh-visit-qa-[a-f0-9]{8}$/);const runId=checkpoint.runId,groupId=runId+'-group';save(checkpointPath,checkpoint);
 const persist=()=>save(checkpointPath,checkpoint),roles={collector:['subject.create','study.execute','form.fill','data.upload','participant.outreach'],reviewer:['subject.create','study.configure','study.execute','form.fill','study.review','data.upload','participant.outreach']};
 const identitiesPath=privateDir+'identities.json',accounts=existsSync(identitiesPath)?json(identitiesPath).accounts:Object.fromEntries(Object.keys(roles).map(kind=>[kind,{id:runId+'-'+kind,username:runId+'-'+kind+'@example.test',password:randomBytes(24).toString('base64url'),roleId:runId+'-'+kind+'-role'}]));
 if(!existsSync(identitiesPath))save(identitiesPath,{runId,accounts},true);assert(Object.values(accounts).every(a=>a.id.startsWith(runId+'-')));
 async function direct(name,fn){if(checkpoint.direct[name]?.status==='done')return checkpoint.direct[name].value;assert(!checkpoint.direct[name],'NATIVE_STEP_UNCONFIRMED_STOP_FOR_READONLY_RECONCILIATION:'+name);checkpoint.direct[name]={status:'started',at:new Date().toISOString()};persist();const value=await h.direct(fn);checkpoint.direct[name]={...checkpoint.direct[name],status:'done',value};persist();return value;}
 async function step(name,path,body,status=200,cookie){
  const previous=checkpoint.steps[name];if(previous){assert.equal(previous.path,path);assert.equal(sha(JSON.stringify({...previous.body,requestKey:null})),sha(JSON.stringify({...body,requestKey:null})),'FIXTURE_INPUT_CHANGED');if(previous.status==='done')return previous.value;throw Error('ORIGINAL_FIXTURE_REQUEST_UNCONFIRMED_READONLY_RECONCILE:'+name);}
  const command={path,body:{...body,requestKey:randomUUID()},status:'started',at:new Date().toISOString()};checkpoint.steps[name]=command;persist();
  const result=await h.request(path,{method:'POST',body:command.body,status,...(cookie?{h5Cookie:cookie}:{})});command.status='done';command.value=result.value;persist();return result.value;
 }
 const {require}=runtimeDependencies();
 await direct('new-scope-and-actors',async tx=>{
  const tenant=await tx.tenant.findUnique({where:{id:h.actor.tenantId},select:{status:true}});assert.equal(tenant.status,'active');
  await tx.studyGroup.create({data:{id:groupId,tenantId:h.actor.tenantId,slug:groupId,name:'访视流程独立合成组 · '+runId,createdBy:h.actor.id}});
  for(const[kind,a]of Object.entries(accounts)){
   await tx.account.create({data:{id:a.id,tenantId:h.actor.tenantId,username:a.username,passwordHash:await require('bcryptjs').hash(a.password,10),displayName:kind==='collector'?'访视合成采集员':'访视合成独立审阅员',role:'researcher',isTenantAdmin:false}});
   await tx.permissionRole.create({data:{id:a.roleId,tenantId:h.actor.tenantId,key:runId+'-'+kind,name:'本合成组'+kind,menuPermissions:['workbench','subjects','data'],buttonPermissions:roles[kind],dataScope:'project'}});
   await tx.studyGroupMembership.create({data:{tenantId:h.actor.tenantId,studyGroupId:groupId,accountId:a.id,roleId:a.roleId,isDefault:true}});
  }
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify({purpose,syntheticOnly:true,runId,tenantId:h.actor.tenantId,studyGroupId:groupId,externalEmailSent:false,oldRolesChanged:false,phase:'new-visit-scope-created'})}::jsonb)`;
  await tx.auditLog.createMany({data:{id:runId+'-scope-audit',tenantId:h.actor.tenantId,studyGroupId:groupId,accountId:h.actor.id,action:'synthetic_fixture.visit_workflow.scope.create',target:groupId,meta:{runId,purpose,syntheticOnly:true,oldRolesChanged:false}}});return{groupId,accounts:Object.values(accounts).map(a=>a.id)};
 });
 const intent=(await step('intent','/research-projects',{title:'访视采集、集中审阅与完成 · 独立合成演练 '+runId,question:'仅验证完整VC01–VC09操作链，无真实受试者、临床判定或模型调用。'},201)).item;
 const study=(await step('study','/research-projects/'+intent.id+'/studies',{expectedVersion:intent.version,studyGroupId:groupId})).item.study,scope={tenantId:h.actor.tenantId,studyGroupId:groupId,researchProjectId:study.executionProjectId},root='/research-studies/'+study.id;
 const f={purpose,syntheticOnly:true,runId,study,scope,intentId:intent.id,accounts:Object.fromEntries(Object.entries(accounts).map(([kind,a])=>[kind,{id:a.id,username:a.username}])),cases:{},externalEmailSent:false,paidModelCalls:0,oldRolesChanged:false};validateFixture(f);
 const profiles=sourceProfiles(),researchPolicy=createResearchFormAdapter(runtimeDependencies()).policy;
 const refs=await direct('profiles-and-project-members',async tx=>{
  for(const[kind,a]of Object.entries(accounts))await tx.researchProjectMembership.create({data:{...scope,accountId:a.id,roleKey:kind==='reviewer'?'project_manager':'researcher',status:'active'}});
  const refs={};for(const[name,p]of Object.entries(profiles)){
   const schema=researchPolicy.normalizeFormSchema(p.schema);assert.deepEqual(schema,p.schema);const template=await tx.formTemplate.create({data:{...scope,key:runId+'-'+name,name:p.name}}),form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema,scoring:p.scoring}});refs[name]=form.id;
   await tx.auditLog.createMany({data:{id:runId+'-profile-'+name,...scope,accountId:h.actor.id,action:'synthetic_fixture.visit_workflow.source.install',target:form.id,meta:{runId,purpose,syntheticOnly:true,profileKey:p.key,schemaHash:sha(JSON.stringify(schema)),scoringHash:sha(JSON.stringify(p.scoring))}}});
  }
  const schema={schemaVersion:'form-schema.v1',fields:[{key:'value',label:'合成选填观察值',type:'number',required:false},{key:'completed',label:'合成完成选项',type:'boolean',required:false}]},template=await tx.formTemplate.create({data:{...scope,key:runId+'-legacy',name:'合成选采观察记录'}});refs.legacy=(await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema}})).id;
  refs.outcome=(await tx.outcomeDefinition.create({data:{...scope,key:runId,versionNumber:1,name:'合成PHQ首项原始值',role:'primary',sourceType:'data_field',dataFieldKey:'phq9_q1',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:h.actor.id}})).id;
  await tx.$executeRaw`UPDATE wp01_meta.fixture_run SET manifest=manifest||${JSON.stringify({scope,studyId:study.id,phase:'source-forms-installed',formVersionIds:Object.values(refs)})}::jsonb WHERE run_id=${runId}`;return refs;
 });f.refs=refs;f.answers=syntheticAnswers(profiles);save(privateDir+'fixture.json',f);await preserveOld(h,'after-new-source-profiles');
 const definition={title:'访视流程通用合成方案 · '+runId,purpose:'只验证固定三量表、独立审阅、明确双渠道及非表单必采，无临床诊断或疗效结论。',primaryOutcomes:[{outcomeDefinitionId:refs.outcome,versionNumber:1}],secondaryOutcomes:[],methodsSummary:'真实固定量表版本与本机预处理合成文件；不声明原始信号特征提取。',populationSummary:'合成软件编号，不代表临床样本量。',statisticsSummary:'本轮不执行统计或模型。',visitPlans:makeVisitPlans(refs,profiles)};
 let protocol=(await step('protocol',root+'/protocols',definition)).protocol;const pp=root+'/protocols/'+protocol.id,sections=makePolicySections();
 let policy;
 if(checkpoint.direct['policy-put']?.status==='done')policy=checkpoint.direct['policy-put'].value;else{assert(!checkpoint.direct['policy-put'],'POLICY_PUT_UNCONFIRMED');const body={requestKey:randomUUID(),expectedPolicyId:null,sections};checkpoint.direct['policy-put']={status:'started',path:pp+'/policy',body};persist();policy=(await h.request(pp+'/policy',{method:'PUT',body})).value.policy;checkpoint.direct['policy-put'].status='done';checkpoint.direct['policy-put'].value=policy;persist();}
 assert.equal((await step('check',pp+'/check',{expectedRevision:protocol.revision})).check.gate.ready,true);
 const submitted=await step('submit',pp+'/submit',{expectedRevision:protocol.revision});
 const reviewerLogin=await h.request('/auth/login',{method:'POST',status:201,body:{tenantSlug:h.runtime.ids.tenant,username:accounts.reviewer.username,password:accounts.reviewer.password}});assert(reviewerLogin.cookie);
 const approved=await step('approve',pp+'/approve',{expectedRevision:submitted.protocol.revision,policyVersionId:policy.id,expectedPolicyHash:policy.contentHash},200,reviewerLogin.cookie),activated=await step('activate',pp+'/activate',{expectedRevision:approved.protocol.revision,migrateExisting:false});protocol=activated.protocol;assert.equal(protocol.status,'executing');assert.equal(activated.policy.status,'approved');f.protocol=protocol;f.policy=activated.policy;save(privateDir+'fixture.json',f);await preserveOld(h,'after-protocol-activation');
 for(const code of ['MAIN','CSV','H5','SELF','RECOVERY','CORRECTION','CONCURRENT','OPTIONAL']){
  const subject=(await step('subject-'+code,root+'/subjects',{subjectId:'SYNTHETIC-'+runId.slice(-8)+'-'+code})).subject,part=root+'/subjects/'+subject.id+'/participation';
  for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'软件合成授权主体',textVersion:sections.researchConsent.rules.textVersion},{kind:'data_use_consent',decision:'granted',signer:'软件合成授权主体',scope:sections.dataUse.rules.scope}])await step('fact-'+code+'-'+event.kind,part+'/events',{expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash,event:{...event,effectiveAt:checkpoint.steps['fact-'+code+'-'+event.kind]?.body.event.effectiveAt??new Date(Date.now()-1000).toISOString(),evidence:'访视流程独立合成软件确认'}});
  await step('enroll-'+code,part+'/enroll',{expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash});const visits=await h.get(root+'/visits?'+new URLSearchParams({subjectId:subject.id,limit:'20'}));assert.equal(visits.items.length,2);f.cases[code]={subject,visitId:visits.items.find(v=>v.visitPlan.code==='BASELINE').id,channelVisitId:visits.items.find(v=>v.visitPlan.code==='CHANNEL').id};save(privateDir+'fixture.json',f);
 }
 for(const[kind,a]of Object.entries(accounts)){const login=await h.request('/auth/login',{method:'POST',status:201,body:{tenantSlug:h.runtime.ids.tenant,username:a.username,password:a.password}});assert(login.cookie);save(privateDir+kind+'-session.json',{cookie:login.cookie,at:new Date().toISOString(),actorId:a.id,runtimeKey:h.runtime.key});}
 f.ready=true;f.network=h.network;save(privateDir+'fixture.json',f);save(evidenceDir+'fixture.json',f);await preserveOld(h,'after-fixture-ready');console.log(JSON.stringify({prepared:true,studyId:study.id,runId,subjects:Object.keys(f.cases).length,visits:16,forms:4,independentReview:'required',existingRolesChanged:false,externalEmailSent:false,fixture:privateDir+'fixture.json'}));return f;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.equal(requireQAWindow(process.argv.slice(2)),'prepare');await prepareFixture();}
