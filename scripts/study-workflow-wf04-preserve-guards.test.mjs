// Pure fixtures/adapters only. Never imports a harness or executes target/PG/Chrome/credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {requireWF04Window,normalizeWF04Cases,wf04ImmutableTables,wf04AppendTables,captureWF04Protection,compareWF04Protection,assertWF04OperationBudget} from './study-workflow-wf04-preserve.mjs';
const env={STUDY_WORKFLOW_WF04_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'},hash='a'.repeat(64),at='2026-11-17T00:00:00.000Z';
const cases=Object.fromEntries(['A','B','D'].map(code=>[code,{studyId:'study-'+code,studyGroupId:'group-'+code,executionProjectId:'project-'+code,protocolId:'protocol-'+code,policyId:'policy-'+code,policyHash:hash,pseudonym:'SYNTHETIC-WF04-'+code,actorId:code==='B'?'original-researcher':'actual-admin'}]));
const subjectsByCase=Object.fromEntries(['A','B','D'].map(code=>[code,'new-subject-'+code]));
const row=(id,extra={})=>({id,hash:'full-row-'+id,...extra}),scope=c=>({studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId});
const science={word:{size:22581,hash:'fixed-word'},nativeRuns:'old-316',revisions:'old-48',snapshots:'old-39',files:'old-36'};
const compareProtection=(a,b)=>assert.deepEqual(b,a,'OLD_SCIENCE_WORD_CHANGED');
function snapshots({templates=false,shared=false}={}){
 const fixtureCases=shared?Object.fromEntries(Object.entries(cases).map(([code,c])=>[code,{...c,...Object.fromEntries(['studyId','studyGroupId','executionProjectId','protocolId','policyId','policyHash'].map(k=>[k,cases.A[k]]))}])):cases,fixedCases=[...new Map(Object.values(fixtureCases).map(c=>[c.protocolId,c])).values()];
 const immutable=Object.fromEntries(wf04ImmutableTables.map(table=>[table,[row('old-'+table)]])),append=Object.fromEntries(wf04AppendTables.map(table=>[table,[row('old-'+table)]]));
 immutable['public.study_protocol_version']=[...fixedCases.map(c=>row(c.protocolId,{...scope(c),status:'executing',approvedPolicyVersionId:c.policyId,approvedPolicyHash:c.policyHash})),...Array.from({length:24},(_,i)=>row('original-protocol-'+i))];
 immutable['public.study_execution_policy_version']=fixedCases.map(c=>row(c.policyId,{...scope(c),protocolVersionId:c.protocolId,status:'approved',contentHash:c.policyHash,textVersionHash:'fixed-text',dataScopeHash:'fixed-scope'}));
 immutable['public.visit_plan']=fixedCases.flatMap(c=>[1,2].map(n=>row(c.protocolId+'-plan-'+n,{...scope(c),protocolVersionId:c.protocolId,sequence:n})));
 immutable['public.visit_requirement']=immutable['public.visit_plan'].flatMap(p=>[1,2].map(n=>row(p.id+'-req-'+n,{studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,visitPlanId:p.id})));
 immutable['public.study_task_template']=templates?fixedCases.flatMap(c=>[row('global-template-'+c.protocolId,{...scope(c),protocolVersionId:c.protocolId,visitPlanId:null,taskType:'screening'}),row('visit-template-'+c.protocolId,{...scope(c),protocolVersionId:c.protocolId,visitPlanId:c.protocolId+'-plan-1',taskType:'data_capture'})]):[];
 if(shared)for(const table of wf04AppendTables)append[table]=Array.from({length:13},(_,i)=>row('legacy-'+table+'-'+i,{...scope(cases.A),pseudonym:'LEGACY-'+i}));
 const before={schema:1,task:'WF04',phase:'before',at,tenantId:'synthetic-tenant',cases:structuredClone(fixtureCases),science:structuredClone(science),readOnly:true,readRole:'root-read',wf03AdmissionVerified:true,immutable,append},after=structuredClone(before);after.phase='after';after.wf03AdmissionVerified=false;
 function operation(code,action,extra={}){const c=fixtureCases[code],id='operation-'+code+'-'+action.replace('.','-')+'-'+after.append['rh_research.operation'].length,auditId='audit-'+id;
  const o=row(id,{action,...scope(c),actorId:c.actorId,targetId:action==='subject.create'?c.studyId:subjectsByCase[code],requestKey:'key-'+id,requestHash:hash,auditId,studyId:c.studyId,subjectId:subjectsByCase[code],pseudonym:c.pseudonym,receiptId:id,...(action==='subject.create'?{}:{protocolId:c.protocolId,policyId:c.policyId,policyHash:c.policyHash}),...extra});after.append['rh_research.operation'].push(o);after.append['public.audit_log'].push(row(auditId,{...scope(c),action:'researchhub.'+action,actorId:c.actorId,target:action==='subject.create'?c.pseudonym:subjectsByCase[code]}));}
 for(const code of ['A','B','D']){
  const c=fixtureCases[code],subjectId=subjectsByCase[code];after.append['public.subject'].push(row(subjectId,{...scope(c),pseudonym:c.pseudonym,createdBy:c.actorId,acceptanceFixture:false,deletedAt:null,deletedBy:null,group:null,syndrome:null,sex:null,age:null,clinicalLabelSource:null,consentScope:null}));operation(code,'subject.create');
  for(const [index,kind]of (code==='D'?['screening']:['screening','research_consent','data_use_consent']).entries()){
   const e=row('event-'+code+'-'+kind,{...scope(c),subjectId,enrollmentId:null,protocolVersionId:c.protocolId,policyVersionId:c.policyId,policyHash:c.policyHash,sequence:index+1,kind,decision:kind==='screening'?(code==='D'?'failed':'passed'):'granted',method:kind==='screening'?'manual':null,recordedBy:c.actorId,supersedesEventId:null,textVersionHash:kind==='research_consent'?'fixed-text':null,dataScopeHash:kind==='data_use_consent'?'fixed-scope':null,hasEvidence:true,hasReason:code==='D',hasSigner:kind!=='screening'});after.append['public.study_participation_event'].push(e);operation(code,'participation.record',{eventId:e.id,enrollmentId:null});
  }
  if(code==='D')continue;const enrollmentId='enrollment-'+code,anchorId='anchor-'+code;
  after.append['public.study_enrollment'].push(row(enrollmentId,{...scope(c),subjectId,protocolVersionId:c.protocolId,status:'enrolled',createdBy:c.actorId,acceptanceFixture:false,enrolledAt:at,withdrawnAt:null,withdrawReason:null,armCode:null}));operation(code,'participation.enroll',{enrollmentId});
  after.append['public.study_enrollment_anchor'].push(row(anchorId,{...scope(c),enrollmentId,kind:'enrollment',eventKey:'',occurredAt:at,recordedBy:c.actorId,evidenceRefs:[{type:'study_enrollment',id:enrollmentId}]}));
  for(const p of immutable['public.visit_plan'].filter(p=>p.protocolVersionId===c.protocolId)){
   const visitId='visit-'+code+'-'+p.sequence;after.append['public.subject_visit'].push(row(visitId,{...scope(c),subjectId,enrollmentId,protocolVersionId:c.protocolId,visitPlanId:p.id,occurrence:1,status:'planned',acceptanceFixture:false,anchorRecordId:anchorId,anchorAt:at,anchorSubjectVisitId:null,scheduleState:'scheduled',actualStartedAt:null,actualCompletedAt:null,performedBy:null,verifiedBy:null,verifiedAt:null,version:0}));
   for(const req of immutable['public.visit_requirement'].filter(r=>r.visitPlanId===p.id))after.append['public.visit_requirement_fulfillment'].push(row('fulfillment-'+visitId+'-'+req.id,{...scope(c),subjectVisitId:visitId,visitRequirementId:req.id,status:'missing',source:'system',ruleVersion:'visit-requirement-v1',satisfiedAt:null,satisfiedBy:null,verifiedAt:null,verifiedBy:null}));
  }
  const common={...scope(c),subjectId,enrollmentId,status:'open',createdBy:c.actorId,assigneeAccountId:c.actorId,acceptanceFixture:false,version:0,reviewStatus:'not_required',requiresReview:false,reviewedBy:null,reviewedAt:null};
  if(templates)for(const t of immutable['public.study_task_template'].filter(t=>t.protocolVersionId===c.protocolId))after.append['public.study_task'].push(row('task-'+code+'-'+t.id,{...common,templateId:t.id,subjectVisitId:t.visitPlanId?'visit-'+code+'-1':null,source:'template',taskType:t.taskType}));
  else after.append['public.study_task'].push(row('task-'+code,{...common,templateId:null,subjectVisitId:'visit-'+code+'-1',source:'manual',taskType:'data_capture'}));
 }
 after.append['public.audit_log'].push(row('new-auth-log',{action:'login',actorId:'actual-admin',target:'actual-admin'}));return{before,after};
}
const compare=(b,a,extra={})=>compareWF04Protection(b,a,{compareProtection,subjectsByCase,requireComplete:true,...extra});
const additions=(s,table)=>s.append[table].slice(1);
test('04 and shared guard, explicit three cases and synthetic pseudonyms precede all injected reads',async()=>{
 assert.throws(()=>requireWF04Window({}),/ROOT_WF04/);assert.throws(()=>requireWF04Window({STUDY_WORKFLOW_WF04_QA_WINDOW:'explicit'}),/SHARED_HELPER/);requireWF04Window(env);assert.deepEqual(normalizeWF04Cases(cases),cases);
 for(const patch of [{A:{...cases.A,pseudonym:'real-patient'}},{B:{...cases.B,actorId:cases.A.actorId}},{D:{...cases.D,pseudonym:cases.A.pseudonym}}])assert.throws(()=>normalizeWF04Cases({...cases,...patch}));
 let calls=0;const h={read(){calls++;},runtime:{ids:{tenant:'synthetic-tenant'}}};await assert.rejects(()=>captureWF04Protection(h,{cases,env:{}}),/ROOT_WF04/);await assert.rejects(()=>captureWF04Protection(h,{cases,env,readProtection(){calls++;},compareProtection,originalScience:science}),/ADMISSION_REQUIRED/);assert.equal(calls,0);
});
test('native fallback and template tasks both pass exact 3 create / 7 record / 2 enroll without form writes',async()=>{
 for(const templates of [false,true]){const {before,after}=snapshots({templates}),result=await compare(before,after);assert.equal(result.passed,true);assert.deepEqual({...result.budget,perCase:undefined},{create:3,record:7,enroll:2,total:12,perCase:undefined});assert.equal(result.addedCounts['public.study_task'],templates?4:2);assert.equal(result.addedCounts['public.subject_visit'],4);assert.equal(result.addedCounts['public.visit_requirement_fulfillment'],8);assert.equal(result.globalAuditDeltaIsBusinessCount,false);assert.equal(result.rawNativeAuditAndProofVerified,false);}
});
test('all existing full IDs/hashes including WF01–03, 24 sources, fixed policy, jobs and Word stay exact',async()=>{
 for(const table of wf04ImmutableTables){const {before,after}=snapshots();if(!after.immutable[table].length)after.immutable[table].push(row('new-template'));else after.immutable[table][0].hash='drift';await assert.rejects(()=>compare(before,after));}
 for(const table of wf04AppendTables)for(const mutation of ['change','delete']){const {before,after}=snapshots();if(mutation==='change')after.append[table][0].hash='drift';else after.append[table].shift();await assert.rejects(()=>compare(before,after));}
 const {before,after}=snapshots();after.science.word.hash='drift';await assert.rejects(()=>compare(before,after),/SCIENCE_WORD/);
});
test('subject receipt IDs/scopes/creator and absence of invented demographics are strict',async()=>{
 for(const mutate of [s=>s.id='old-public.subject',s=>s.researchProjectId=cases.B.executionProjectId,s=>s.createdBy=cases.B.actorId,s=>s.pseudonym='unfrozen',s=>s.acceptanceFixture=true,s=>s.age=0,s=>s.consentScope='invented']){const {before,after}=snapshots();mutate(additions(after,'public.subject')[0]);await assert.rejects(()=>compare(before,after));}
});
test('events bind original actor/subject/protocol/policy, fixed consent text and initial unique sequence',async()=>{
 for(const mutate of [e=>e.subjectId='old-public.subject',e=>e.protocolVersionId=cases.D.protocolId,e=>e.policyHash='b'.repeat(64),e=>e.recordedBy=cases.B.actorId,e=>e.enrollmentId='enrollment-A',e=>e.supersedesEventId='old-fact',e=>e.sequence=2,e=>e.decision='withdrawn',e=>e.hasEvidence=false]){const {before,after}=snapshots();mutate(additions(after,'public.study_participation_event')[0]);await assert.rejects(()=>compare(before,after));}
 for(const [kind,field]of [['research_consent','textVersionHash'],['data_use_consent','dataScopeHash']]){const {before,after}=snapshots();additions(after,'public.study_participation_event').find(e=>e.kind===kind)[field]='different-policy';await assert.rejects(()=>compare(before,after));}
 const {before,after}=snapshots();additions(after,'public.study_participation_event').find(e=>e.subjectId===subjectsByCase.D).hasReason=false;await assert.rejects(()=>compare(before,after));
});
test('D cannot enroll; enrollment/anchor must keep exact subject/protocol and complete three facts',async()=>{
 for(const mutate of [a=>additions(a,'public.study_enrollment')[0].subjectId=subjectsByCase.D,a=>additions(a,'public.study_enrollment')[0].protocolVersionId=cases.D.protocolId,a=>additions(a,'public.study_enrollment')[0].status='in_progress',a=>additions(a,'public.study_enrollment_anchor')[0].enrollmentId='old-public.study_enrollment',a=>additions(a,'public.study_enrollment_anchor')[0].recordedBy=cases.B.actorId,a=>additions(a,'public.study_enrollment_anchor')[0].occurredAt='2026-11-16T00:00:00Z',a=>a.append['public.study_enrollment_anchor'].splice(1,1)]){const {before,after}=snapshots();mutate(after);await assert.rejects(()=>compare(before,after));}
});
test('native visits, fulfillments and tasks require exact fixed parent sets and untouched initial state',async()=>{
 for(const mutate of [a=>additions(a,'public.subject_visit')[0].visitPlanId=cases.D.protocolId+'-plan-1',a=>additions(a,'public.subject_visit')[0].status='in_progress',a=>additions(a,'public.subject_visit')[0].actualStartedAt=at,a=>a.append['public.subject_visit'].splice(1,1),a=>additions(a,'public.visit_requirement_fulfillment')[0].visitRequirementId=cases.D.protocolId+'-plan-1-req-1',a=>additions(a,'public.visit_requirement_fulfillment')[0].status='satisfied',a=>a.append['public.visit_requirement_fulfillment'].splice(1,1),a=>additions(a,'public.study_task')[0].assigneeAccountId=cases.B.actorId,a=>additions(a,'public.study_task')[0].status='done',a=>a.append['public.study_task'].splice(1,1)]){const {before,after}=snapshots();mutate(after);await assert.rejects(()=>compare(before,after));}
 const {before,after}=snapshots({templates:true});additions(after,'public.study_task')[0].templateId='unapproved-template';await assert.rejects(()=>compare(before,after));
});
test('native operation budget/receipt/result/audit links count successes, not auth audit delta',async()=>{
 for(const mutate of [o=>o.action='protocol.activate',o=>o.actorId=cases.B.actorId,o=>o.targetId='old-subject',o=>o.policyId='wrong-policy',o=>o.requestHash='invalid',o=>o.receiptId='weak-wrong-id',o=>o.auditId='old-public.audit_log',o=>o.eventId='wrong-event']){const {before,after}=snapshots();mutate(additions(after,'rh_research.operation').find(o=>o.action==='participation.record'));await assert.rejects(()=>compare(before,after));}
 const {before,after}=snapshots();after.append['rh_research.operation'].push({...additions(after,'rh_research.operation')[0],id:'fourth-create',receiptId:'fourth-create',requestKey:'fourth-key'});await assert.rejects(()=>compare(before,after),/BUDGET/);
});
test('partial checkpoints allow actual completed subset and final requires all twelve',async()=>{
 const {before,after}=snapshots();for(const table of wf04AppendTables)after.append[table]=after.append[table].filter(r=>r.id.startsWith('old-')||r.id===subjectsByCase.D||r.action==='subject.create'&&r.studyId===cases.D.studyId||r.action==='researchhub.subject.create'&&r.target===cases.D.pseudonym);
 const result=await compare(before,after,{subjectsByCase:{D:subjectsByCase.D},requireComplete:false});assert.equal(result.budget.total,1);await assert.rejects(()=>compare(before,after,{subjectsByCase:{D:subjectsByCase.D}}),/FINAL_TWELVE/);
});
test('capture executes only bound read-only SELECTs, rejects old drift and requires real prior admission callback',async()=>{
 const {before}=snapshots();const calls=[];const h={runtime:{ids:{tenant:'synthetic-tenant'}},read:async fn=>fn({$queryRawUnsafe:async(sql,...params)=>{calls.push(sql);assert(sql.startsWith('SELECT '));if(sql.includes('transaction_read_only'))return[{readonly:'on',role:'root-read'}];assert.deepEqual(params,['synthetic-tenant']);const table=sql.match(/ FROM ([^ ]+) t WHERE /)[1].replaceAll('"','');return structuredClone(before.immutable[table]??before.append[table]);}})};
 let admitted=0;const result=await captureWF04Protection(h,{cases,env,phase:'before',originalScience:science,readProtection:async()=>science,compareProtection,verifyAdmission:async snapshot=>{admitted++;assert.equal(snapshot.append['public.subject'].length,1);}});assert(result.wf03AdmissionVerified);assert.equal(admitted,1);assert(calls.some(s=>s.includes('public."study_protocol_version"')));assert(calls.some(s=>s.includes('rh_analysis.snapshot')));
 await assert.rejects(()=>captureWF04Protection(h,{cases,env,originalScience:science,readProtection:async()=>({...science,word:'drift'}),compareProtection,verifyAdmission:async()=>{}}),/SCIENCE_WORD/);
});
test('each event operation and wrapper audit is one-to-one, and budget cannot omit allocated subject IDs',async()=>{
 for(const field of ['eventId','auditId']){const {before,after}=snapshots(),ops=additions(after,'rh_research.operation').filter(o=>o.action==='participation.record'&&o.studyId===cases.A.studyId);ops[1][field]=ops[0][field];await assert.rejects(()=>compare(before,after));}
 const {after}=snapshots(),create={...additions(after,'rh_research.operation')[0]};delete create.subjectId;assert.throws(()=>assertWF04OperationBudget([create],{cases,subjectsByCase:{}}));
});
test('shared existing Study keeps 13 old subjects/facts and budgets A/B/D by allocated subjects, not Study ID',async()=>{
 for(const templates of [false,true]){const {before,after}=snapshots({shared:true,templates});assert.deepEqual(normalizeWF04Cases(before.cases),before.cases);const result=await compare(before,after);assert.deepEqual(result.budget.perCase,{A:{create:1,record:3,enroll:1},B:{create:1,record:3,enroll:1},D:{create:1,record:1,enroll:0}});assert.equal(result.addedCounts['public.subject'],3);assert.equal(before.append['public.subject'].length,13);
  const creates=after.append['rh_research.operation'].filter(o=>o.action==='subject.create');assert.equal(assertWF04OperationBudget(creates,{cases:before.cases}).create,3);
  after.append['public.subject'][0].hash='old-subject-drift';await assert.rejects(()=>compare(before,after),/OLD_FULL_ROW_CHANGED/);
 }
});
test('before capture admits old shared subjects but refuses only the three already-used pseudonyms',async()=>{
 const {before}=snapshots({shared:true}),read=async fn=>fn({$queryRawUnsafe:async sql=>sql.includes('transaction_read_only')?[{readonly:'on',role:'root-read'}]:structuredClone((()=>{const t=sql.match(/ FROM ([^ ]+) t WHERE /)[1].replaceAll('"','');return before.immutable[t]??before.append[t];})())}),h={read,runtime:{ids:{tenant:'synthetic-tenant'}}},options={cases:before.cases,env,originalScience:science,readProtection:async()=>science,compareProtection,verifyAdmission:async()=>{}};
 assert.equal((await captureWF04Protection(h,options)).append['public.subject'].length,13);before.append['public.subject'][0].pseudonym=before.cases.B.pseudonym;await assert.rejects(()=>captureWF04Protection(h,options),/PSEUDONYM/);
});
test('shared Study requires one exact parent tuple; different Studies cannot alias project/protocol/policy',()=>{
 const shared=snapshots({shared:true}).before.cases;for(const field of ['studyGroupId','executionProjectId','protocolId','policyId','policyHash']){const wrong=structuredClone(shared);wrong.B[field]=field==='policyHash'?'b'.repeat(64):'different-parent';assert.throws(()=>normalizeWF04Cases(wrong),/SAME_STUDY/);}
 for(const field of ['executionProjectId','protocolId','policyId']){const wrong=structuredClone(cases);wrong.B[field]=wrong.A[field];assert.throws(()=>normalizeWF04Cases(wrong),/DIFFERENT_STUDY/);}
});
test('each new Subject event sequence remains independent inside the shared Study',async()=>{
 const {before,after}=snapshots({shared:true});const event=after.append['public.study_participation_event'].find(e=>e.subjectId===subjectsByCase.B&&e.kind==='screening');event.sequence=4;await assert.rejects(()=>compare(before,after),/SUBJECT_EVENT_SEQUENCE/);
});
