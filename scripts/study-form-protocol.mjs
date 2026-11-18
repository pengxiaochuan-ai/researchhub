import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {openHarness,key,json,save,privateDir,evidenceDir,purpose} from './study-form-runtime.mjs';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const h=await openHarness(),f=json(privateDir+'fixture.json'),root='/research-studies/'+f.study.id;
assert(f.syntheticOnly&&!f.protocolReady);assert.equal(f.scope.tenantId,h.runtime.ids.tenant);
await h.read(async tx=>{const [row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`;assert.equal(row.manifest.purpose,purpose);assert.equal(row.manifest.studyId,f.study.id);});
const profile=getSourceFormProfile('phq9-zh-CN-v1');
let protocol=(await h.post(root+'/protocols',{requestKey:key(),title:'PHQ9电子表单独立合成方案',purpose:'仅合成数据的软件验证，不代表临床启用',primaryOutcomes:[{outcomeDefinitionId:f.refs.outcome,versionNumber:1}],secondaryOutcomes:[],statisticsSummary:'仅核对固定表单确定性计分与原始修订',visitPlans:[{code:'BASELINE',name:'合成基线核对',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,requirements:[{kind:'form_response',code:'PHQ9',name:profile.name,required:true,config:{formVersionId:f.refs.form,allowedCaptureModes:['researcher','patient_h5']}},{kind:'form_response',code:'LEGACY',name:'旧schema兼容核对',required:false,config:{formVersionId:f.refs.legacy,allowedCaptureModes:['researcher']}}]}]})).protocol;
const pp=root+'/protocols/'+protocol.id,na={status:'not_applicable',source:'独立合成软件验收',reason:'无真实受试者或临床用途'},configured=rules=>({status:'configured',source:'独立合成软件验收',reason:'明确的合成规则',rules});
const sections={ethics:na,safety:na,blinding:na,screening:configured({criteria:'授权研究者人工核对合成对象',decisionMethod:'manual'}),researchConsent:configured({textVersion:'synthetic-phq9-consent-v1',evidenceRequirement:'本轮合成确认记录'}),dataUse:configured({purposes:'独立电子表单软件验证',scope:'synthetic-study-form-only'}),withdrawal:configured({effectiveRule:'停止新的采集',retentionRule:'保留合成历史',futureUseRule:'限制新的使用'}),site:{status:'configured',source:'独立合成案例',reason:'研究范围',mode:'study_wide'},captureReview:configured({correction:'保留修订与原因',locking:'审阅后锁定',unlocking:'记录原因',reviewResponsibility:'授权研究者',reviewIndependence:'not_required'})};
const policy=(await h.request(pp+'/policy',{method:'PUT',body:{requestKey:key(),expectedPolicyId:null,sections}})).value.policy;
assert.equal((await h.post(pp+'/check',{requestKey:key(),expectedRevision:protocol.revision})).check.gate.ready,true);
const submitted=await h.post(pp+'/submit',{requestKey:key(),expectedRevision:protocol.revision});
const approved=await h.post(pp+'/approve',{requestKey:key(),expectedRevision:submitted.protocol.revision,policyVersionId:policy.id,expectedPolicyHash:policy.contentHash});
protocol=(await h.post(pp+'/activate',{requestKey:key(),expectedRevision:approved.protocol.revision,migrateExisting:false})).protocol;
f.protocolId=protocol.id;f.policy=policy;f.cases={};f.protocolReady=true;
save(privateDir+'fixture.json',f); // Preserve created protocol identity if later setup fails.
for(const code of ['ONSITE','H5','CSV']){
 const subject=(await h.post(root+'/subjects',{requestKey:key(),subjectId:'SYNTHETIC-PHQ9-'+code+'-'+f.runId.slice(-8)})).subject,p=root+'/subjects/'+subject.id+'/participation';
 for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:sections.researchConsent.rules.textVersion},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:sections.dataUse.rules.scope}])await h.post(p+'/events',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'本轮独立合成表单软件确认'}});
 await h.post(p+'/enroll',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash});
 const visits=await h.get(root+'/visits?subjectId='+subject.id);assert.equal(visits.items.length,1);
 f.cases[code]={subject,visitId:visits.items[0].id};save(privateDir+'fixture.json',f);
}
const vectors={ONSITE:[0,1,2,3,0,1,2,3,0],H5:[1,1,1,1,1,1,1,1,1],CSV:[2,2,2,2,2,2,2,2,2]},answers=Object.fromEntries(Object.entries(vectors).map(([name,vector])=>[name,{...Object.fromEntries(vector.map((value,index)=>['phq9_q'+(index+1),value])),functional_difficulty:'difficulty_2'}]));
f.answers=answers;f.expectedScores=Object.fromEntries(Object.entries(vectors).map(([name,vector])=>[name,vector.reduce((sum,value)=>sum+value,0)]));
const csv=['subject_code,visit_code,'+profile.schema.fields.map(field=>field.key).join(','),f.cases.CSV.subject.subjectId+',BASELINE,'+profile.schema.fields.map(field=>answers.CSV[field.key]).join(',')].join('\r\n')+'\r\n';
writeFileSync(evidenceDir+'phq9-synthetic.csv',csv);f.csvPath=evidenceDir+'phq9-synthetic.csv';f.checks.push('formal_protocol_policy_approval_activation','three_new_synthetic_subjects_consent_enrollment_visits');f.network.push(...h.network);save(privateDir+'fixture.json',f);save(evidenceDir+'fixture.json',f);
console.log(JSON.stringify({prepared:true,studyId:f.study.id,protocolReady:true,cases:Object.keys(f.cases),emailSent:false,evidence:evidenceDir+'fixture.json'}));
