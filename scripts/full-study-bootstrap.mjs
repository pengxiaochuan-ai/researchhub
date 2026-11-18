// Authorized fresh synthetic scope only. Preparation stops before policy/activation/enrollment.
import assert from 'node:assert/strict';import {existsSync,writeFileSync} from 'node:fs';import {randomBytes} from 'node:crypto';
import {openHarness,key,json,save,sha,privateDir,evidenceDir,purpose} from './full-study-runtime.mjs';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';import {createResearchFormAdapter} from '../server/research-capture/form-core-adapter.mjs';
import {requestHash} from '../server/research-studies/contract.mjs';import {ARMS,GENERATOR,generateSubjectData} from './full-study-generator.mjs';
assert.deepEqual(process.argv.slice(2),['--prepare']);const h=await openHarness();
assert(!existsSync(privateDir+'bootstrap.json'),'BOOTSTRAP_EXISTS_DO_NOT_CREATE_ANOTHER_STUDY');
const checkpoint=existsSync(privateDir+'bootstrap-checkpoint.json')?json(privateDir+'bootstrap-checkpoint.json'):{};
const runId=checkpoint.runId??'rh-full-study-'+key().slice(0,8),caseId=runId+'-case',groupId=runId+'-group',registrationAuditId=checkpoint.registrationAuditId??'rh-simulation-registration-'+key();
const {require}=runtimeDependencies(),profiles={phq:getSourceFormProfile('phq9-zh-CN-v1'),fang:getSourceFormProfile('fang-2023-table5-v1'),hamd:getSourceFormProfile('hamd17-crf-simulation-v1')};
assert.equal(profiles.fang.scoring.projectPolicy.status,'confirmed');assert.equal(profiles.hamd.scoring.algorithm,'hamd17-simulation-sum-v1');
const roleDefinitions={manager:['subject.create','study.configure','study.execute','form.fill','form.manage','data.upload','data.analyze','data.release','artifact.read','artifact.create','artifact.edit','artifact.export'],collector:['subject.create','study.execute','form.fill','data.upload','participant.outreach','artifact.read'],reviewer:['study.configure','study.review','study.execute','data.review','data.release','artifact.read','artifact.review','artifact.release','artifact.export']};
const accounts=checkpoint.runId?json(privateDir+'identities.json').accounts:Object.fromEntries(Object.keys(roleDefinitions).map(kind=>[kind,{id:runId+'-'+kind,username:runId+'-'+kind+'@example.test',password:randomBytes(24).toString('base64url'),roleId:runId+'-'+kind+'-role'}]));
save(privateDir+'identities.json',{runId,accounts});
if(!checkpoint.runId)await h.direct(async tx=>{
 const tenant=await tx.tenant.findUnique({where:{id:h.runtime.ids.tenant},select:{status:true}});assert.equal(tenant.status,'active');
 await tx.studyGroup.create({data:{id:groupId,tenantId:h.runtime.ids.tenant,slug:groupId,name:'整课题独立合成模拟组 · '+runId,createdBy:h.actor.id}});
 for(const [kind,account]of Object.entries(accounts)){
  await tx.account.create({data:{id:account.id,tenantId:h.runtime.ids.tenant,username:account.username,passwordHash:await require('bcryptjs').hash(account.password,10),displayName:'整课题合成'+({manager:'研究负责人',collector:'采集研究员',reviewer:'独立审阅员'}[kind]),role:'researcher',isTenantAdmin:false}});
  await tx.permissionRole.create({data:{id:account.roleId,tenantId:h.runtime.ids.tenant,key:runId+'-'+kind,name:'仅本合成组'+kind,menuPermissions:['workbench','subjects','data','artifacts'],buttonPermissions:roleDefinitions[kind],dataScope:'project'}});
  await tx.studyGroupMembership.create({data:{tenantId:h.runtime.ids.tenant,studyGroupId:groupId,accountId:account.id,roleId:account.roleId,isDefault:true}});
 }
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify({purpose,syntheticOnly:true,caseId,runId,tenantId:h.runtime.ids.tenant,studyGroupId:groupId,accounts:Object.fromEntries(Object.entries(accounts).map(([name,a])=>[name,a.id])),phase:'new-synthetic-scope-prepared',externalEmailSent:false,oldRolesChanged:false})}::jsonb)`;
 await tx.auditLog.create({data:{tenantId:h.runtime.ids.tenant,studyGroupId:groupId,accountId:h.actor.id,action:'synthetic_fixture.full_study.scope.create',target:groupId,meta:{purpose,runId,caseId,syntheticOnly:true,oldRolesChanged:false,externalEmailSent:false}}});
});
await h.loginActor(accounts.manager);
const title='基于舌象—语音—神经影像多模态特征融合的抑郁症肝郁气滞证客观辨识研究 · 合成数据模拟验收';
const intent=checkpoint.intent??(await h.post('/research-projects',{requestKey:key(),title,question:'单Study三组各2例的合成软件演练，四逻辑访视；非真实研究启用。负责人辛老师为场景说明，操作由合成身份承担。'},201)).item;
const study=checkpoint.study??(await h.post('/research-projects/'+intent.id+'/studies',{requestKey:key(),expectedVersion:intent.version,studyGroupId:groupId})).item.study,scope={tenantId:h.runtime.ids.tenant,studyGroupId:groupId,researchProjectId:study.executionProjectId};
Object.assign(checkpoint,{runId,registrationAuditId,intent,study});save(privateDir+'bootstrap-checkpoint.json',checkpoint);
const root='/research-studies/'+study.id,refs=checkpoint.refs??await h.direct(async tx=>{
 for(const kind of ['collector','reviewer'])await tx.researchProjectMembership.create({data:{...scope,accountId:accounts[kind].id,roleKey:kind==='reviewer'?'project_manager':'researcher',status:'active'}});
 const formRefs={};const policy=createResearchFormAdapter(runtimeDependencies()).policy;
 for(const [name,p]of Object.entries(profiles)){
  const schema=policy.normalizeFormSchema(p.schema);assert.deepEqual(schema,p.schema);
  const template=await tx.formTemplate.create({data:{...scope,key:runId+'-'+name,name:p.name}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema,scoring:p.scoring}});
  formRefs[name]={id:form.id,profileKey:p.key,versionTag:p.versionTag,schemaHash:requestHash(schema),scoringHash:requestHash(p.scoring),source:p.source};
  await tx.auditLog.create({data:{...scope,accountId:accounts.manager.id,action:'synthetic_fixture.full_study.source_profile.install',target:form.id,meta:{runId,caseId,syntheticOnly:true,profileSnapshot:p,profileHash:requestHash(p),schemaHash:formRefs[name].schemaHash,scoringHash:formRefs[name].scoringHash}}});
 }
 await tx.$executeRaw`UPDATE wp01_meta.fixture_run SET manifest=manifest||${JSON.stringify({scope,studyId:study.id,phase:'profiles-installed',registrationAuditId,registrationActorId:accounts.manager.id})}::jsonb WHERE run_id=${runId}`;
 return formRefs;
});
checkpoint.refs=refs;save(privateDir+'bootstrap-checkpoint.json',checkpoint);
const subjects=checkpoint.subjects??[],data=[];
for(const armCode of ARMS)for(let index=0;index<2;index++){
 const subjectCode='SYNTHETIC-'+runId.slice(-8)+'-'+armCode+'-'+(index+1),existing=subjects.find(s=>s.armCode===armCode&&s.index===index),subject=existing??(await h.post(root+'/subjects',{requestKey:key(),subjectId:subjectCode})).subject;
 if(!existing)subjects.push({id:subject.id,subjectCode,armCode,index});checkpoint.subjects=subjects;save(privateDir+'bootstrap-checkpoint.json',checkpoint);data.push({subjectId:subject.id,subjectCode,...generateSubjectData(armCode,index,profiles)});
}
const formReq=(name,modes=['researcher'])=>({kind:'form_response',code:name.toUpperCase(),name:profiles[name].name,required:true,config:{formVersionId:refs[name].id,allowedCaptureModes:modes}});
const fileReq=modality=>({kind:'modality_file',code:'SYNTHETIC_'+modality.toUpperCase(),name:({tongue:'舌象',voice:'语音',eeg:'EEG'}[modality])+'合成预处理特征',required:true,config:{modality,sourceKind:'synthetic_preprocessed_features',rawExtractionClaim:false}});
const definitions=[['V1_PATIENT','V1',0,0,['phq','fang','hamd'],['tongue','voice','eeg']],['V1_HEALTHY','V1',0,0,['phq'],['tongue','voice','eeg']],['V2','V2',14,3,['phq','fang'],[]],['V3','V3',28,3,['phq','fang','hamd'],['tongue','voice']],['V4','V4',56,7,['phq','fang','hamd'],['tongue','voice','eeg']]];
const visitPlans=definitions.map(([code,logicalVisit,targetDayOffset,window,forms,modalities],i)=>({code,name:code+' · '+logicalVisit+'合成模拟访视',sequence:i+1,anchor:'enrollment',targetDayOffset,windowBeforeDays:window,windowAfterDays:window,requirements:[...forms.map(name=>formReq(name,code==='V2'&&name==='phq'?['patient_h5']:['researcher'])),...modalities.map(fileReq)]}));
const protocol=checkpoint.protocol??(await h.post(root+'/protocols',{requestKey:key(),title:title+' · 单方案',purpose:'真实题名场景的整课题软件模拟；临床主要终点未冻结，v2统计计划单独固定三量表总分。无真实受试者，不冒用真实PI签署。',primaryOutcomes:[],secondaryOutcomes:[],methodsSummary:'合成预处理舌/语音/EEG特征，经原上传与来源路径；不声明原始信号提取能力。',populationSummary:'MDD_TARGET、MDD_NON_TARGET、HEALTHY_REFERENCE各2例；组别为固定合成设计标签。患者V1–V4，健康仅V1；不构成临床样本量。',statisticsSummary:'full-study-simulation-v2：三量表score_total，分组时点描述及患者配对变化；特殊9/NA/待复核无总分，不补0。临床主要终点/AUC未冻结。',visitPlans})).protocol;
checkpoint.protocol=protocol;save(privateDir+'bootstrap-checkpoint.json',checkpoint);
const armVisitCodes={MDD_TARGET:['V1_PATIENT','V2','V3','V4'],MDD_NON_TARGET:['V1_PATIENT','V2','V3','V4'],HEALTHY_REFERENCE:['V1_HEALTHY']};
const variables=[['phq','PHQ-9总分',['V1','V2','V3','V4'],ARMS],['fang','表5总分',['V1','V2','V3','V4'],ARMS.slice(0,2)],['hamd','HAMD-17合成约定总分',['V1','V3','V4'],ARMS.slice(0,2)]].map(([name,label,logicalVisits,armCodes])=>({key:({phq:'phq9_total',fang:'fang_total',hamd:'hamd17_total'}[name]),label,formVersionId:refs[name].id,fieldKey:'total',valueType:'number',unit:'分',logicalVisits,armCodes,source:'score_total'}));
const generatorManifest={...GENERATOR,subjects,data};generatorManifest.manifestHash=requestHash(generatorManifest);
const manifest={schemaVersion:'full-study-simulation-case-v1',caseId,studyId:study.id,scope,protocolVersionId:protocol.id,protocolHash:protocol.revision,policyId:null,policyHash:null,baseDate:new Date().toISOString(),subjects:subjects.map(({id,armCode})=>({id,armCode})),visitPlans:protocol.visitPlans.map(p=>({id:p.id,code:p.code,logicalVisit:p.code.startsWith('V1')?'V1':p.code,armCodes:ARMS.filter(arm=>armVisitCodes[arm].includes(p.code))})),forms:Object.values(refs).map(({id,schemaHash,scoringHash})=>({id,schemaHash,scoringHash})),variables,generator:{version:GENERATOR.version,seed:GENERATOR.seed,manifestHash:generatorManifest.manifestHash},assumptions:['六例为软件用例不是临床样本量','健康参考仅基线是模拟假设','0/14/28/56及窗口0/3/3/7为模拟假设','HAMD17特殊9与漏答不产总分；不补0或分层','五主症source_missing；fNIRS/fMRI不纳入','模态为合成预处理特征，不声明原始提取能力']};
const bootstrap={phase:'prepared-awaiting-typed-policy-and-core',syntheticOnly:true,runId,caseId,title,study,intentId:intent.id,scope,subjects,refs,protocol,registrationAuditId,registrationActorId:accounts.manager.id,manifest,accounts:Object.fromEntries(Object.entries(accounts).map(([kind,a])=>[kind,{id:a.id,username:a.username,roleId:a.roleId}])),network:h.network,externalEmailSent:false,paidModelCalls:0,oldRolesChanged:false,limitations:['protocol草稿；primary/secondaryOutcomes为空，原发布checker会阻断，父需明确受控模拟策略','未保存typed policy、未登记case、未审批分析计划、未启用协议、未入组或采集']};
save(privateDir+'bootstrap.json',bootstrap);save(evidenceDir+'bootstrap.json',bootstrap);save(privateDir+'generator.json',generatorManifest);save(evidenceDir+'generator.json',generatorManifest);
const targets=[{caseId,studyId:study.id,scope,registrationAuditId,registrationActorId:accounts.manager.id}];save(privateDir+'targets.json',targets);save(evidenceDir+'target-metadata.json',targets);
await h.direct(tx=>tx.$executeRaw`UPDATE wp01_meta.fixture_run SET manifest=manifest||${JSON.stringify({phase:bootstrap.phase,subjects:subjects.map(s=>s.id),protocolVersionId:protocol.id,forms:Object.values(refs).map(f=>f.id),generatorManifestHash:generatorManifest.manifestHash})}::jsonb WHERE run_id=${runId}`);
console.log(JSON.stringify({prepared:true,phase:bootstrap.phase,studyId:study.id,groupId,caseId,subjects:subjects.length,plans:protocol.visitPlans.length,targetsFile:privateDir+'targets.json',evidence:evidenceDir+'bootstrap.json'}));
