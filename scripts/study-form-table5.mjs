// Historical pending-profile synthetic clone verification; current project policy has a separate fixed version.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {openHarness,key,json,sha,save,privateDir,evidenceDir,purpose} from './study-form-runtime.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchFormAdapter} from '../server/research-capture/form-core-adapter.mjs';
import {FANG_TABLE5_ITEMS} from '../server/research-capture/fang-table5-policy.mjs';
assert(['--prepare','--backend-ready'].includes(process.argv[2])&&process.argv.length===3);
const historicalProfileUrl=new URL('../docs/planning/study-form-electronic-scoring-2026-11-13/history/fang-2023-table5-v1-policy-pending-v1.json',import.meta.url);
function readHistoricalPendingProfile(){const raw=readFileSync(historicalProfileUrl);assert.equal(sha(raw),'031bb15099b50fcebc7321091acdc55b9985bc24376bf4bdbba827d6626402ea');return JSON.parse(raw.toString('utf8'));}
const canonical=readHistoricalPendingProfile(),canonicalHash=sha(JSON.stringify(canonical));
assert.equal(canonical.source.sha256,'5e34d90ff887e801d3635ecfb2e216227b5510c540302082694d352ee6def3f1');assert.equal(canonical.scoring.projectPolicy.status,'pending');
const h=await openHarness();
const path=privateDir+'table5-fixture.json',post=h.post,get=h.get;
if(process.argv[2]==='--prepare'){
 assert(!existsSync(path),'TABLE5_FIXTURE_ALREADY_EXISTS');
 const runId='rh-table5-form-'+key().slice(0,8),intent=(await post('/research-projects',{requestKey:key(),title:'表5合成操作策略软件验证 · '+runId,question:'仅合成操作策略；不代表用户临床规则批准'},201)).item;
 const study=(await post('/research-projects/'+intent.id+'/studies',{requestKey:key(),expectedVersion:intent.version,studyGroupId:h.runtime.ids.group})).item.study;
 const root='/research-studies/'+study.id,scope={tenantId:h.runtime.ids.tenant,studyGroupId:h.runtime.ids.group,researchProjectId:study.executionProjectId},profile=structuredClone(canonical);
 profile.scoring.projectPolicy={...profile.scoring.projectPolicy,status:'confirmed',reviewedBy:'synthetic-policy-reviewer',reviewedAt:new Date().toISOString()};
 const schema=createResearchFormAdapter(runtimeDependencies()).policy.normalizeFormSchema(profile.schema);
 const refs=await h.direct(async tx=>{
  const template=await tx.formTemplate.create({data:{...scope,key:runId,name:'表5合成操作策略评定表（非临床批准）'}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema,scoring:profile.scoring}});
  const outcome=await tx.outcomeDefinition.create({data:{...scope,key:runId,versionNumber:1,name:'合成表5评定',role:'primary',sourceType:'data_field',dataFieldKey:'main_depressed_emotion',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:h.actor.id}});
  const meta={purpose,runId,syntheticOnly:true,syntheticOperatingPolicyNotUserClinicalApproval:true,studyId:study.id,scope,source:canonical.source,canonicalProfileSha256:canonicalHash,cloneSchemaSha256:sha(JSON.stringify(schema)),scoring:profile.scoring};
  await tx.auditLog.create({data:{...scope,accountId:h.actor.id,action:'synthetic_fixture.table5.operating_policy_clone',target:form.id,meta}});
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(meta)}::jsonb)`;
  return {form:form.id,outcome:outcome.id};
 });
 const f={runId,syntheticOnly:true,syntheticOperatingPolicyNotUserClinicalApproval:true,study,scope,refs,source:canonical.source,profile,canonicalProfileSha256:canonicalHash,emailSent:false};save(path,f);
 let protocol=(await post(root+'/protocols',{requestKey:key(),title:'表5合成策略验证方案',purpose:'非临床批准，仅合成数据验证',primaryOutcomes:[{outcomeDefinitionId:refs.outcome,versionNumber:1}],secondaryOutcomes:[],statisticsSummary:'仅确定性评分和不可变修订核对',visitPlans:[{code:'BASELINE',name:'表5合成基线',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,requirements:[{kind:'form_response',code:'TABLE5',name:'表5合成操作策略',required:true,config:{formVersionId:refs.form,allowedCaptureModes:['researcher']}}]}]})).protocol;
 const pp=root+'/protocols/'+protocol.id,na={status:'not_applicable',source:'合成软件验证',reason:'无真实临床对象'},configured=rules=>({status:'configured',source:'合成软件验证',reason:'本轮合成规则',rules});
 const sections={ethics:na,safety:na,blinding:na,screening:configured({criteria:'人工核对合成对象',decisionMethod:'manual'}),researchConsent:configured({textVersion:'synthetic-table5-v1',evidenceRequirement:'合成记录'}),dataUse:configured({purposes:'表5软件核对',scope:'synthetic-table5-only'}),withdrawal:configured({effectiveRule:'停止新采集',retentionRule:'保留合成历史',futureUseRule:'限制新用途'}),site:{status:'configured',source:'合成范围',reason:'软件核对',mode:'study_wide'},captureReview:configured({correction:'保留修订及原因',locking:'复核后锁定',unlocking:'记录原因',reviewResponsibility:'合成评定者',reviewIndependence:'not_required'})};
 const policy=(await h.request(pp+'/policy',{method:'PUT',body:{requestKey:key(),expectedPolicyId:null,sections}})).value.policy;
 assert.equal((await post(pp+'/check',{requestKey:key(),expectedRevision:protocol.revision})).check.gate.ready,true);
 const submitted=await post(pp+'/submit',{requestKey:key(),expectedRevision:protocol.revision}),approved=await post(pp+'/approve',{requestKey:key(),expectedRevision:submitted.protocol.revision,policyVersionId:policy.id,expectedPolicyHash:policy.contentHash});
 protocol=(await post(pp+'/activate',{requestKey:key(),expectedRevision:approved.protocol.revision,migrateExisting:false})).protocol;
 const subject=(await post(root+'/subjects',{requestKey:key(),subjectId:'SYNTHETIC-TABLE5-'+runId.slice(-8)})).subject,p=root+'/subjects/'+subject.id+'/participation';
 for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:'synthetic-table5-v1'},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:'synthetic-table5-only'}])await post(p+'/events',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'仅合成表5软件验证'}});
 await post(p+'/enroll',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash});const visit=(await get(root+'/visits?subjectId='+subject.id)).items[0];
 const assigned=await post(root+'/visits/'+visit.id+'/assignments',{requestKey:key(),formVersionId:refs.form});
 Object.assign(f,{protocolId:protocol.id,policy,subject,visitId:visit.id,assignmentId:assigned.result.id,network:h.network});save(path,f);save(evidenceDir+'table5-fixture.json',f);
 console.log(JSON.stringify({prepared:true,studyId:study.id,syntheticOperatingPolicyNotUserClinicalApproval:true,emailSent:false}));
}else{
 const f=json(path);assert(f.syntheticOnly&&f.syntheticOperatingPolicyNotUserClinicalApproval);assert(!existsSync(evidenceDir+'table5-http-result.json'));
 await h.read(async tx=>{const [row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`;assert.equal(row.manifest.syntheticOperatingPolicyNotUserClinicalApproval,true);assert.equal(row.manifest.studyId,f.study.id);});
 const root='/research-studies/'+f.study.id,a=root+'/assignments/'+f.assignmentId;
 const present=new Set(['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_emotional_trigger','tongue_pale_red','pulse_wiry']);
 const positive={...Object.fromEntries(FANG_TABLE5_ITEMS.map(item=>[item.key,present.has(item.key)?'present':'absent'])),tongue_category:'met',pulse_category:'met'};
 const cases=[['positive',positive],['not_applicable',{...positive,secondary_irregular_menses:'not_applicable'}],['dual_pulse',{...positive,pulse_deep_wiry:'present'}]],results=[];
 for(const [name,answers]of cases){
  const before=await get(a),operation=results.length?'correct':'submit',body={requestKey:key(),expectedVersion:before.response.version,answers,...(results.length?{expectedRef:before.response.ref,reason:'合成操作策略状态核对：'+name}:{})};
  await post(a+'/'+operation,body);const current=await get(a),score=current.response.score;
  assert.equal(score.complete,true);assert.equal(score.missingRequired,0);assert.equal(current.response.ref.revisionNo,results.length+1);
  if(name==='positive'){assert.equal(score.scoreComplete,true);assert.equal(score.processingStatus,'scored');assert.equal(score.total,FANG_TABLE5_ITEMS.reduce((sum,item)=>sum+(present.has(item.key)?item.presentScore:0),0));assert(score.total>=20);assert.equal(score.classification,'positive');assert.equal(score.diagnosis,true);}
  else{assert.equal(score.scoreComplete,false);assert.equal(score.total,null);assert.equal(score.diagnosis,null);assert.equal(score.processingStatus,name==='dual_pulse'?'review_required':'incomplete_data');}
  assert.deepEqual(current.assignment.formVersion.schema,f.profile.schema);
  const ref=current.response.ref,revision=(await get(a+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision;
  assert.deepEqual(revision.answers,answers);assert.deepEqual(revision.score,score);results.push({name,revision});
  save(privateDir+'table5-progress.json',{studyId:f.study.id,results,network:h.network});
 }
 for(const result of results){const ref=result.revision.ref;assert.deepEqual((await get(a+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision,result.revision);}
 const db=await h.read(async tx=>{
  const form=await tx.formVersion.findFirst({where:{...f.scope,id:f.refs.form}});assert.deepEqual(form.schema,f.profile.schema);assert.deepEqual(form.scoring,f.profile.scoring);
  const rows=await tx.$queryRaw`SELECT * FROM public.form_response_revision WHERE "tenantId"=${f.scope.tenantId} AND "researchProjectId"=${f.scope.researchProjectId} AND "assignmentId"=${f.assignmentId} ORDER BY "revisionNo"`;
  assert.equal(rows.length,3);return rows.map(runtimeDependencies().load('study-operations/formal-response-history','verifyFormalRevisionEnvelope'));
 });
 assert.equal(sha(JSON.stringify(readHistoricalPendingProfile())),canonicalHash);assert.equal(readHistoricalPendingProfile().scoring.projectPolicy.status,'pending');
 save(evidenceDir+'table5-http-result.json',{passed:true,at:new Date().toISOString(),syntheticOnly:true,syntheticOperatingPolicyNotUserClinicalApproval:true,studyId:f.study.id,source:f.source,canonicalProfileUnchangedAndPending:true,results,databaseRehashedRevisions:db,network:h.network,emailSent:false,clinicalAcceptance:false,productionAcceptance:false});
 console.log(JSON.stringify({passed:true,syntheticOperatingPolicyNotUserClinicalApproval:true,evidence:evidenceDir+'table5-http-result.json'}));
}
