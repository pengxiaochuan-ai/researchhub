import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {openGeneralUnitHarness,dir,configFile,json,save} from './ai-general-unit-runtime.mjs';
import {normalizePolicySections} from '../server/research-execution/policy-input.mjs';import {requestHash} from '../server/research-studies/contract.mjs';import {validateGeneralUnitScope,assertGeneralUnitManifest} from './ai-research-data-general-scope.mjs';
assert.equal(process.argv.length,3);assert(['--approved-general-unit','--recover-approved-general-unit'].includes(process.argv[2]));const recoveryOnly=process.argv[2]==='--recover-approved-general-unit',h=await openGeneralUnitHarness(),{ids,load}=h,runId='rh-general-unit-20261113',scopeKey='general-unit-20261113',checkpointFile=dir+'setup-checkpoint.json';
await h.login('owner');await h.login('admin');
const registered=await h.read(async tx=>(await tx.$queryRawUnsafe('SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=$1',runId))[0]);
if(registered){
 const saved=validateGeneralUnitScope(registered.manifest.config,ids);assertGeneralUnitManifest(saved,registered.manifest);if(existsSync(configFile))assertGeneralUnitManifest(validateGeneralUnitScope(json(configFile),ids),registered.manifest);else save(configFile,saved);
 save(dir+'registry-recovery.json',{passed:true,recoveryOnly,reused:true,studyId:saved.target.studyId,checkpointNeeded:false,newStudyRequests:0,newFixtureWrites:0});console.log(JSON.stringify({passed:true,reused:true,studyId:saved.target.studyId,newStudyRequests:0}));
}else{
 assert(!recoveryOnly,'REGISTRY_MISSING_CANNOT_RECOVER');assert(!existsSync(configFile),'UNREGISTERED_SCOPE_NO_NEW_STUDY');const checkpoint=existsSync(checkpointFile)?json(checkpointFile):{};
 checkpoint.intentKey??='general-intent-'+randomUUID();checkpoint.studyKey??='general-study-'+randomUUID();save(checkpointFile,checkpoint);
 if(!checkpoint.intent){checkpoint.intent=(await h.request('/research-projects',{method:'POST',status:201,body:{requestKey:checkpoint.intentKey,title:'GENERAL-UNIT-20261113 合成单位验收',question:'仅原owner/admin四例合成软件验证；源0g和2500g，目标0kg和2.5kg，保留false/true；非临床结论。'}})).item;save(checkpointFile,checkpoint);}
 if(!checkpoint.study){checkpoint.study=(await h.request('/research-projects/'+checkpoint.intent.id+'/studies',{method:'POST',status:200,body:{requestKey:checkpoint.studyKey,expectedVersion:checkpoint.intent.version,studyGroupId:ids.group}})).item.study;save(checkpointFile,checkpoint);}
 const target={studyId:checkpoint.study.id,studyGroupId:ids.group,executionProjectId:checkpoint.study.executionProjectId},s={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:target.executionProjectId};
 const install=async tx=>{
  assert.equal(await tx.subject.count({where:s}),0);assert.equal(await tx.studyProtocolVersion.count({where:s}),0);
  const users={};for(const actor of ['owner','admin']){const a=await tx.account.findFirst({where:{id:ids[actor],tenantId:ids.tenant,status:'active'}});assert(a&&a.authVersion===5);users[actor]={tenantId:ids.tenant,accountId:a.id,role:a.role,isTenantAdmin:a.isTenantAdmin,authVersion:a.authVersion,...s};}
  const admin=users.admin;assert(admin.role==='tenant_admin'&&admin.isTenantAdmin);
  const context=user=>tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,target.executionProjectId,user.accountId);
  await context(admin);await load('common/worker-publication','lockAuthorizationMutation')(tx,ids.tenant);
  await tx.researchProjectMembership.create({data:{...s,accountId:ids.owner,roleKey:'researcher',status:'active'}});
  const schema={schemaVersion:'form-schema.v1',fields:[{key:'weight',label:'体重',unit:'kg',type:'number',required:true,min:0,max:500},{key:'completed',label:'已完成',type:'boolean',required:true}]};
  assert.equal(load('study-operations/study-forms-policy','normalizeFormSchema')(schema).fields[0].unit,'kg');
  const template=await tx.formTemplate.create({data:{...s,key:scopeKey,name:'合成体重与完成记录',createdBy:ids.admin}}),form=await tx.formVersion.create({data:{...s,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema,createdBy:ids.admin}});
  const protocol=await tx.studyProtocolVersion.create({data:{...s,versionNumber:1,status:'draft',title:'GENERAL-UNIT 合成软件方案',purpose:'仅本轮四例合成单位换算与固定记录软件验收，不构成临床研究或审批',primaryOutcomes:[],createdBy:ids.admin}});
  const na={status:'not_applicable',source:'GENERAL-UNIT用户批准的具名合成软件验收',reason:'无真实受试者或临床用途'},input=Object.fromEntries(['ethics','screening','researchConsent','dataUse','withdrawal','safety','blinding'].map(k=>[k,na]));input.site={...na,status:'configured',mode:'study_wide'};input.captureReview={...na,status:'configured',rules:{correction:'保留修订与原因',locking:'本轮不锁定',unlocking:'本轮不解锁',reviewResponsibility:'合成管理员',reviewIndependence:'not_required'}};
  const now=new Date(),sections=normalizePolicySections(input,ids.admin,now),contentHash=requestHash(sections),policy=await tx.studyExecutionPolicyVersion.create({data:{id:'general-unit-policy-'+randomUUID(),...s,protocolVersionId:protocol.id,versionNumber:1,status:'approved',sections,contentHash,createdBy:ids.admin,reviewedBy:ids.admin,reviewedAt:now}});
  assert.deepEqual(load('study-operations/execution-policy-gate','executionPolicyIssues')({...policy,reviewedAt:now.toISOString()}),[]);
  await tx.studyProtocolVersion.update({where:{id:protocol.id},data:{status:'executing',approvedPolicyVersionId:policy.id,approvedPolicyHash:contentHash,effectiveFrom:now}});
  const plan=await tx.visitPlan.create({data:{...s,protocolVersionId:protocol.id,code:'BASELINE',name:'合成基线',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0}});await tx.visitRequirement.create({data:{...s,visitPlanId:plan.id,kind:'form_response',code:'GENERAL_UNIT',name:'合成单位表单',required:true,config:{formVersionId:form.id,allowedCaptureModes:['researcher']}}});
  const grantId='rh-general-unit-owner-20261113',auditId='rh-audit-'+randomUUID(),sessions={[ids.owner]:'cmwevnq180005lu2arv5lqab9',[ids.admin]:'cmwevnzrb000dlu2a2qm8k5ao'};
  await tx.auditLog.create({data:{id:auditId,...s,accountId:ids.admin,action:'researchhub.data.access.grant',target:grantId,meta:{scopeKey,syntheticOnly:true,approval:'用户允许GENERAL-UNIT最小验收范围',maxSubjects:4,maxVisits:4,maxCrf:4}}});
  await tx.$executeRawUnsafe(`INSERT INTO rh_ai.research_data_import_access(id,tenant_id,study_id,study_group_id,research_project_id,account_id,source_study_group_id,source_research_project_id,source_session_id,scope_key,capabilities,granted_by,audit_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$4,$7,$8,$9,ARRAY['profile.create','visit.import','result.read'],$10,$11,$12::timestamptz)`,grantId,ids.tenant,target.studyId,ids.group,target.executionProjectId,ids.owner,ids.project,sessions[ids.owner],scopeKey,ids.admin,auditId,'2026-11-20T07:36:52.684Z');
  const Subjects=load('subjects/subjects.service','SubjectsService'),subjects=new Subjects({},{}),Operations=load('study-operations/study-operations.service','StudyOperationsService'),operations=new Operations({},{}),authority=load('study-operations/formal-response-authority','authorizeFormalResponse'),registeredObjects={},records={};
  for(const actor of ['owner','admin']){
   const user=users[actor];await context(user);await authority(tx,user,ids.group,target.executionProjectId,'read');const own=[];
   for(const suffix of ['A','B']){
    const subject=await subjects.createInTransaction(tx,user,{subjectId:`GENERAL-UNIT-${actor.toUpperCase()}-${suffix}`});
    await context(admin);for(const kind of ['screening','research_consent','data_use_consent'])await load('study-operations/participation-events','recordParticipationInTransaction')(tx,admin,s,subject.id,{kind,decision:'not_applicable',effectiveAt:new Date().toISOString(),evidence:'GENERAL-UNIT 用户批准四例合成软件验证；无真实临床同意',reason:'沿本独立合成方案明确的不适用决定'});
    await operations.enrollInTransaction(admin,{subjectId:subject.id},tx,ids.group,target.executionProjectId);
    const visits=await tx.subjectVisit.findMany({where:{...s,subjectId:subject.id,protocolVersionId:protocol.id,visitPlanId:plan.id}});assert.equal(visits.length,1);own.push({subjectId:subject.id,subjectCode:subject.subjectId,visitId:visits[0].id,enrollmentId:visits[0].enrollmentId});await context(user);
   }
   records[actor]=own;registeredObjects[user.accountId]={subjectIds:own.map(x=>x.subjectId),visitIds:own.map(x=>x.visitId)};
  }
  await context(admin);const objectAudit='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id:objectAudit,...s,accountId:ids.admin,action:'researchhub.data.fixture.prepared',target:grantId,meta:{scopeKey,syntheticOnly:true,records,grantId,subjectPreparationSeparateFromImport:true}}});
  await tx.$executeRawUnsafe('UPDATE rh_ai.research_data_import_access SET objects=$1::jsonb,version=version+1,audit_id=$2 WHERE id=$3',JSON.stringify(registeredObjects[ids.owner]),objectAudit,grantId);
  const config={schema:'hub-general-unit-local-scope.v1',scopeKey,accounts:{owner:ids.owner,admin:ids.admin},target,sessions,expiresAt:'2026-11-20T07:36:52.684Z',registeredObjects,protocolVersionId:protocol.id,visitPlanId:plan.id,formVersionId:form.id,policyVersionId:policy.id,policyHash:contentHash,grantId,records};validateGeneralUnitScope(config,ids);
  await tx.$executeRawUnsafe('INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES($1,$2::jsonb)',runId,JSON.stringify({purpose:'general-unit-write-2026-11-13',syntheticOnly:true,scopeKey,target,config,formalApprovalsInvoked:false,oldRolesChanged:false,modelCalls:0}));return config;
 };
 const existing=await h.read(async tx=>(await tx.$queryRawUnsafe('SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=$1',runId))[0]);let config;
 if(existing){config=validateGeneralUnitScope(existing.manifest.config,ids);}else{
  const rollback=Symbol('general-unit-rehearsal');await assert.rejects(h.direct(async tx=>{await install(tx);throw rollback;}),e=>e===rollback);
  await h.read(async tx=>{assert.equal(await tx.subject.count({where:s}),0);assert.equal(await tx.studyProtocolVersion.count({where:s}),0);});
  config=await h.direct(install);
 }
 save(configFile,config);save(dir+'fixture.json',{...config,runId,syntheticOnly:true,preparedSubjects:4,formalCrf:0,modelCalls:0,rehearsalRolledBack:true});console.log(JSON.stringify({passed:true,studyId:target.studyId,subjects:4,visits:4,formalCrf:0,grantId:config.grantId,modelCalls:0}));
}
