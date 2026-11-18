// User-confirmed canonical operating policy, fresh synthetic data only. No real Study enablement.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {openHarness,key,json,sha,save,privateDir,evidenceDir,purpose} from './study-form-rule-runtime.mjs';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchFormAdapter} from '../server/research-capture/form-core-adapter.mjs';
import {FANG_TABLE5_ITEMS} from '../server/research-capture/fang-table5-policy.mjs';
assert(['--prepare','--backend-ready'].includes(process.argv[2])&&process.argv.length===3);
const h=await openHarness(),canonical=getSourceFormProfile('fang-2023-table5-v1'),canonicalHash=sha(JSON.stringify(canonical));
assert.equal(canonicalHash,'6fcb993c3791925ffe4b1d4770b925a7b3c20aff7b7e4729807fbbd181c50ae4','APPROVED_CANONICAL_SNAPSHOT_CHANGED');
assert.equal(canonical.source.sha256,'5e34d90ff887e801d3635ecfb2e216227b5510c540302082694d352ee6def3f1');assert.equal(canonical.scoring.projectPolicy.status,'confirmed');assert.equal(canonical.scoring.projectPolicy.reviewedBy,'project-user-confirmation');assert.equal(canonical.scoring.projectPolicy.reviewedAt,'2026-11-13T09:18:47.000Z');assert(canonical.versionTag.endsWith('project-policy-v1'));
const path=privateDir+'rule-fixture.json',post=h.post,get=h.get;
if(process.argv[2]==='--prepare'){
 assert(!existsSync(path),'TABLE5_FIXTURE_ALREADY_EXISTS');
 const runId='rh-rule-confirm-'+key().slice(0,8),intent=(await post('/research-projects',{requestKey:key(),title:'表5已确认项目操作规则合成验证 · '+runId,question:'项目操作规则已获用户确认；研究数据全新合成，不代表真实Study启用或业务签认'},201)).item;
 const study=(await post('/research-projects/'+intent.id+'/studies',{requestKey:key(),expectedVersion:intent.version,studyGroupId:h.runtime.ids.group})).item.study;
 const root='/research-studies/'+study.id,scope={tenantId:h.runtime.ids.tenant,studyGroupId:h.runtime.ids.group,researchProjectId:study.executionProjectId},profile=structuredClone(canonical);
 assert.deepEqual(profile,canonical); // Install the complete approved snapshot unchanged.
 const schema=createResearchFormAdapter(runtimeDependencies()).policy.normalizeFormSchema(profile.schema);assert.deepEqual(schema,canonical.schema);
 const refs=await h.direct(async tx=>{
  const template=await tx.formTemplate.create({data:{...scope,key:runId,name:canonical.name}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema,scoring:profile.scoring}});
  const outcome=await tx.outcomeDefinition.create({data:{...scope,key:runId,versionNumber:1,name:'合成表5评定',role:'primary',sourceType:'data_field',dataFieldKey:'main_depressed_emotion',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:h.actor.id}});
  const meta={purpose,runId,syntheticOnly:true,projectOperatingPolicyUserConfirmed:true,realStudyEnabled:false,businessSignoff:false,studyId:study.id,scope,source:canonical.source,policyVersion:canonical.versionTag,canonicalSnapshot:canonical,canonicalProfileSha256:canonicalHash,schemaSha256:sha(JSON.stringify(schema)),scoring:profile.scoring};
  await tx.auditLog.create({data:{...scope,accountId:h.actor.id,action:'synthetic_fixture.table5.approved_policy_snapshot_install',target:form.id,meta}});
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify(meta)}::jsonb)`;
  return {form:form.id,outcome:outcome.id};
 });
 const f={canonicalSnapshot:canonical,policyVersion:canonical.versionTag,runId,syntheticOnly:true,projectOperatingPolicyUserConfirmed:true,realStudyEnabled:false,study,scope,refs,source:canonical.source,profile,canonicalProfileSha256:canonicalHash,emailSent:false};save(path,f);
 let protocol=(await post(root+'/protocols',{requestKey:key(),title:'表5已确认规则合成验证方案',purpose:'用户确认操作规则，仅合成数据验证，不代表真实Study启用或业务签认',primaryOutcomes:[{outcomeDefinitionId:refs.outcome,versionNumber:1}],secondaryOutcomes:[],statisticsSummary:'仅确定性评分和不可变修订核对',visitPlans:[{code:'BASELINE',name:'表5合成基线',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,requirements:[{kind:'form_response',code:'TABLE5',name:'表5合成操作策略',required:true,config:{formVersionId:refs.form,allowedCaptureModes:['researcher']}}]}]})).protocol;
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
 const visible=await get('/research-projects?limit=100');save(evidenceDir+'visible-project-metadata.json',{at:new Date().toISOString(),tenantId:scope.tenantId,items:visible.items.map(item=>({id:item.id,title:item.title,study:item.study,hubKey:item.hubKey,status:item.status})),nextCursor:visible.nextCursor??null,actualStudyBinding:null,realStudyBindingCreated:false,note:'Metadata only. Matching the actual research title requires the confirmed real PI/group/Study identity; none fabricated.'});
 Object.assign(f,{protocolId:protocol.id,policy,subject,visitId:visit.id,assignmentId:assigned.result.id,network:h.network});save(path,f);save(evidenceDir+'rule-fixture.json',f);
 console.log(JSON.stringify({prepared:true,studyId:study.id,projectOperatingPolicyUserConfirmed:true,realStudyEnabled:false,emailSent:false}));
}else{
 const f=json(path);assert(f.syntheticOnly&&f.projectOperatingPolicyUserConfirmed);assert(!existsSync(evidenceDir+'rule-http-result.json'));
 await h.read(async tx=>{const [row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`;assert.equal(row.manifest.projectOperatingPolicyUserConfirmed,true);assert.equal(row.manifest.studyId,f.study.id);});
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
  save(privateDir+'rule-progress.json',{studyId:f.study.id,results,network:h.network});
 }
 for(const result of results){const ref=result.revision.ref;assert.deepEqual((await get(a+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision,result.revision);}
 const db=await h.read(async tx=>{
  const form=await tx.formVersion.findFirst({where:{...f.scope,id:f.refs.form}});assert.deepEqual(form.schema,f.profile.schema);assert.deepEqual(form.scoring,f.profile.scoring);
  const rows=await tx.$queryRaw`SELECT * FROM public.form_response_revision WHERE "tenantId"=${f.scope.tenantId} AND "researchProjectId"=${f.scope.researchProjectId} AND "assignmentId"=${f.assignmentId} ORDER BY "revisionNo"`;
  assert.equal(rows.length,3);return rows.map(runtimeDependencies().load('study-operations/formal-response-history','verifyFormalRevisionEnvelope'));
 });
 assert.equal(sha(JSON.stringify(getSourceFormProfile('fang-2023-table5-v1'))),canonicalHash);assert.equal(getSourceFormProfile('fang-2023-table5-v1').scoring.projectPolicy.status,'confirmed');
 save(evidenceDir+'rule-http-result.json',{passed:true,at:new Date().toISOString(),syntheticOnly:true,projectOperatingPolicyUserConfirmed:true,realStudyEnabled:false,studyId:f.study.id,source:f.source,policyVersion:f.policyVersion,canonicalSnapshotSha256:f.canonicalProfileSha256,projectPolicy:f.profile.scoring.projectPolicy,canonicalProfileUnchangedAndConfirmed:true,results,databaseRehashedRevisions:db,network:h.network,emailSent:false,clinicalAcceptance:false,productionAcceptance:false});
 console.log(JSON.stringify({passed:true,projectOperatingPolicyUserConfirmed:true,realStudyEnabled:false,evidence:evidenceDir+'rule-http-result.json'}));
}
