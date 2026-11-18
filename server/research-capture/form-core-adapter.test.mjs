import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createResearchFormAdapter} from './form-core-adapter.mjs';
import {createCaptureImportService} from './imports.mjs';
import {FANG_TABLE5_ALGORITHM,FANG_TABLE5_SOURCE_SHA256,FANG_TABLE5_ITEMS} from './fang-table5-policy.mjs';

const dependencies=runtimeDependencies();
const schema={schemaVersion:'form-schema.v1',presentation:{title:'合成离散值问卷'},fields:[{key:'item',label:'合成项',type:'integer',required:true,min:0,max:3,choices:[{value:0,label:'无'},{value:3,label:'有'}]}]};
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};
function writerFixture(kind='submit',mode='researcher'){
 const row={id:'response',version:kind==='correct'?1:0,status:kind==='correct'?'submitted':'draft',currentRevisionId:kind==='correct'?'previous':null,lockedRevisionId:null,answers:{item:0}};
 const assignment={id:'assignment',subjectId:'subject',enrollmentId:'enrollment',subjectVisitId:null,formVersionId:'form',mode,response:row,formVersion:{id:'form',status:'published',schema,scoring:{algorithm:'numeric-sum-v1'}}};
 const executions=[],tx={
  formAssignment:{findFirst:async()=>assignment,update:async()=>({})},
  auditLog:{create:async()=>({})},
  $queryRaw:async(strings,...values)=>{const sql=strings.join('?');
   if(sql.includes('pg_advisory_xact_lock'))return [{locked:''}];
   if(sql.includes('FROM public.form_assignment'))return [{id:assignment.id}];
   if(sql.includes('FROM public.form_response_command_receipt'))return [];
   if(sql.includes('FROM public.form_response_revision'))return [{revisionNo:1}];
   if(sql.includes('FROM public.form_response'))return [row];
   if(sql.includes('JOIN public.study_execution_policy_version'))return [{policyId:'policy',policyHash:'f'.repeat(64)}];
   throw Error('Unexpected query '+sql);
  },
  $executeRaw:async(strings,...values)=>{executions.push({sql:strings.join('?'),values});return 1;},
 };
 const context={scope,actor:{kind:mode==='patient_h5'?'h5_session':'account',id:'actor'},assignmentId:assignment.id,subjectId:'subject',enrollmentId:'enrollment',protocolVersionId:'protocol'};
 const command={kind,requestKey:'synthetic-request',expectedVersion:row.version,answers:{item:3},...(kind==='correct'?{expectedRevisionId:'previous',reason:'合成更正'}:{})};
 return {tx,context,command,executions,assignment};
}

test('private three-module graph leaves legacy policy, writer and service exports unchanged',()=>{
 const legacyPolicy=dependencies.load('study-operations/study-forms-policy','normalizeFormSchema');
 const legacyWriter=dependencies.load('study-operations/formal-response-writer','writeFormalResponseInTransaction');
 const legacyCommands=dependencies.load('study-operations/formal-response-commands','writeAnswersInTransaction');
 const LegacyService=dependencies.load('study-operations/study-outreach.service','StudyOutreachService');
 const adapter=createResearchFormAdapter(dependencies);
 assert.notEqual(adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction'),legacyWriter);
 assert.notEqual(adapter.load('study-operations/formal-response-commands','writeAnswersInTransaction'),legacyCommands);
 assert.notEqual(adapter.load('study-operations/study-outreach.service','StudyOutreachService'),LegacyService);
 assert.equal(dependencies.load('study-operations/formal-response-writer','writeFormalResponseInTransaction'),legacyWriter);
 assert.equal(dependencies.load('study-operations/formal-response-commands','writeAnswersInTransaction'),legacyCommands);
 assert.equal(dependencies.load('study-operations/study-outreach.service','StudyOutreachService'),LegacyService);
 assert.equal(legacyPolicy(schema).presentation,undefined);
 assert.deepEqual(adapter.policy.normalizeFormSchema(schema).presentation,schema.presentation);
 assert.deepEqual(dependencies.load('study-operations/study-forms-policy','normalizeAndValidateAnswers')(schema,{item:1}),{item:1});
});
for(const [kind,mode] of [['draft','researcher'],['submit','researcher'],['correct','researcher'],['submit','patient_h5']]){
 test(`${kind}/${mode} actual writer enforces new discrete answers before any answer or revision write`,async()=>{
  const adapter=createResearchFormAdapter(dependencies),writer=adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction');
  const f=writerFixture(kind,mode);f.command.answers={item:1};
  await assert.rejects(writer(f.tx,f.context,f.command),error=>error.getResponse?.().code==='FORM_ANSWER_INVALID_OPTION');
  assert.equal(f.executions.length,0);
 });
 test(`${kind}/${mode} actual writer persists its injected policy score into response and revision`,async()=>{
  const policy=createResearchFormAdapter(dependencies).policy;let calls=0;
  const adapter=createResearchFormAdapter({...dependencies,policy:{...policy,scorePublishedFormResponse(...args){calls++;return {...policy.scorePublishedFormResponse(...args),syntheticPolicyProof:'new-policy'};}}});
  const f=writerFixture(kind,mode),result=await adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction')(f.tx,f.context,f.command);
  assert.equal(calls,1);assert.equal(result.score.total,3);assert.equal(result.score.syntheticPolicyProof,'new-policy');
  const update=f.executions.find(x=>x.sql.startsWith('UPDATE public.form_response SET'));assert.equal(JSON.parse(update.values[1]).syntheticPolicyProof,'new-policy');
  const revision=f.executions.find(x=>x.sql.startsWith('INSERT INTO public.form_response_revision'));
  if(kind==='draft')assert.equal(revision,undefined);
  else {assert.equal(JSON.parse(revision.values[16]).syntheticPolicyProof,'new-policy');assert.equal(revision.values[17],'numeric-sum-v1');assert.equal(revision.values[23],result.ref.contentHash);assert.equal(result.ref.revisionNo,kind==='correct'?2:1);}
 });
}
test('H5 service uses the private writer after the existing session authorization boundary',async()=>{
 const adapter=createResearchFormAdapter(dependencies),Service=adapter.load('study-operations/study-outreach.service','StudyOutreachService');
 const f=writerFixture('submit','patient_h5');
 f.tx.questionnaireSession={updateMany:async()=>({count:1})};f.tx.questionnaireInvitation={update:async()=>({})};
 const service=new Service({elevated:{$transaction:fn=>fn(f.tx)}},{});
 service.lockAuthorizedH5Context=async()=>({session:{id:'actor',invitationId:'invitation'},original:f.assignment,scope,enrollment:{id:'enrollment',subjectId:'subject',protocolVersionId:'protocol'},current:{session:{status:'active'}}});
 await assert.rejects(service.saveH5Session('s'.repeat(40),{item:1},true,{requestKey:'synthetic-h5-key',expectedVersion:0,expectedAssignmentId:'assignment'}),error=>error.getResponse?.().code==='FORM_ANSWER_INVALID_OPTION');
 assert.equal(f.executions.length,0);
 const result=await service.saveH5Session('s'.repeat(40),{item:3},true,{requestKey:'synthetic-h5-key',expectedVersion:0,expectedAssignmentId:'assignment'});
 assert.equal(result.score.total,3);assert(f.executions.some(x=>x.sql.startsWith('INSERT INTO public.form_response_revision')));
});

test('H5 session reads preserve the same versioned presentation and numeric choices',async()=>{
 const adapter=createResearchFormAdapter(dependencies),Service=adapter.load('study-operations/study-outreach.service','StudyOutreachService'),f=writerFixture();
 const service=new Service({elevated:{$transaction:fn=>fn(f.tx)}},{});
 service.lockAuthorizedH5Context=async()=>({session:{expiresAt:new Date(Date.now()+60000)},current:{assignment:f.assignment}});
 const value=await service.getH5Session('s'.repeat(40),'assignment');
 assert.deepEqual(value.schema.presentation,schema.presentation);assert.deepEqual(value.schema.fields[0].choices,schema.fields[0].choices);
});

function importFixture({legacyPreview=false}={}){
 const adapter=createResearchFormAdapter(dependencies),f=writerFixture(),user={...scope,accountId:'actor',authVersion:1};
 const originalQuery=f.tx.$queryRaw;
 f.tx.$queryRaw=(strings,...values)=>strings.join('?').includes('FROM public.subject ')?[{id:'subject'}]:originalQuery(strings,...values);
 f.tx.formVersion={findFirst:async()=>f.assignment.formVersion};
 f.tx.subject={findFirst:async()=>({id:'subject'})};
 f.tx.studyEnrollment={findMany:async()=>[{id:'enrollment',subjectId:'subject',protocolVersionId:'protocol',status:'active'}]};
 f.tx.subjectVisit={findMany:async()=>[{id:'visit'}]};
 f.tx.formAssignment.findMany=async()=>[];f.tx.auditLog.createMany=async()=>({count:1});
 const selectPolicy=name=>legacyPreview?dependencies.load('study-operations/study-forms-policy',name):adapter.policy[name];
 const writer=adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction');
 const core={authorize:async()=>{},normalizeSchema:selectPolicy('normalizeFormSchema'),normalizeAnswers:selectPolicy('normalizeAndValidateAnswers'),score:selectPolicy('scorePublishedFormResponse'),lockScope:async()=>{},lockBinding:async()=>{},assertMode:async()=>{},
  readVisit:async()=>({version:0,capabilities:{canAssign:true},visitPlan:{requirements:[{kind:'form_response',config:{formVersionId:'form'}}]}}),
  assign:async()=>({id:'assignment'}),write:(tx,_user,s,assignmentId,command)=>writer(tx,{...f.context,scope:s,assignmentId},command),
 };
 const studies={withResearchStudyTransaction:(_user,_study,_action,fn)=>fn(f.tx,{tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,executionProjectId:scope.researchProjectId})};
 const receipts={getReceipt:async()=>null,saveReceipt:async()=>{}};
 return {...f,user,api:createCaptureImportService({studies,core,receipts})};
}
test('CSV preview and actual commit share the private revision writer, preserving numeric values',async()=>{
 const f=importFixture(),body={formVersionId:'form',csv:'subject_code,visit_code,item\nSYNTHETIC-ONLY,BASELINE,3\n'};
 const preview=await f.api.preview(f.user,'study',body);assert.deepEqual(preview.errors,[]);
 const committed=await f.api.commit(f.user,'study',{...body,requestKey:'synthetic-csv-request',previewHash:preview.previewHash});
 const revision=f.executions.find(x=>x.sql.startsWith('INSERT INTO public.form_response_revision'));
 assert.equal(JSON.parse(revision.values[15]).item,3);assert.equal(JSON.parse(revision.values[16]).total,3);assert.equal(committed.rows[0].ref.contentHash,revision.values[23]);
});
test('actual CSV writer still refuses an invalid discrete value even if preview validation were stale',async()=>{
 const f=importFixture({legacyPreview:true}),body={formVersionId:'form',csv:'subject_code,visit_code,item\nSYNTHETIC-ONLY,BASELINE,1\n'};
 const preview=await f.api.preview(f.user,'study',body);assert.deepEqual(preview.errors,[]);
 await assert.rejects(f.api.commit(f.user,'study',{...body,requestKey:'synthetic-csv-request',previewHash:preview.previewHash}),error=>error.getResponse?.().code==='FORM_ANSWER_INVALID_OPTION');
 assert.equal(f.executions.length,0);
});
test('parallel private policy graphs cannot replace each other or the legacy score function',async()=>{
 const baseline=createResearchFormAdapter(dependencies).policy,legacyScore=dependencies.load('study-operations/study-forms-policy','scorePublishedFormResponse');
 const outcomes=await Promise.all(['first','second'].map(async marker=>{
  const adapter=createResearchFormAdapter({...dependencies,policy:{...baseline,scorePublishedFormResponse(...args){return {...baseline.scorePublishedFormResponse(...args),marker};}}}),f=writerFixture();
  return (await adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction')(f.tx,f.context,f.command)).score.marker;
 }));
 assert.deepEqual(outcomes,['first','second']);assert.equal(dependencies.load('study-operations/study-forms-policy','scorePublishedFormResponse'),legacyScore);assert.equal(legacyScore(schema,{algorithm:'numeric-sum-v1'},{item:1}).total,1);
});

function table5WriterFixture(kind,scenario){
 const f=writerFixture(kind),policy={status:'confirmed',categoryMode:'explicit_reviewed_categories',pulseCooccurrence:'review_required',inapplicable:'incomplete_no_total',reviewedBy:'synthetic-reviewer-only',reviewedAt:'2026-11-13T00:00:00.000Z'};
 f.assignment.formVersion.schema={fields:[...FANG_TABLE5_ITEMS.map(item=>({key:item.key,label:item.label,type:'select',required:true,options:['present','absent','not_applicable','uncertain']})),...['tongue_category','pulse_category'].map(key=>({key,label:key,type:'select',required:true,options:['met','not_met','uncertain']}))]};
 f.assignment.formVersion.scoring={algorithm:FANG_TABLE5_ALGORITHM,sourceSha256:FANG_TABLE5_SOURCE_SHA256,projectPolicy:scenario==='pending'?{status:'pending'}:policy};
 const positive=new Set(['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_emotional_trigger','tongue_pale_red','tongue_thin_white_coating']);
 f.command.answers={...Object.fromEntries(FANG_TABLE5_ITEMS.map(item=>[item.key,positive.has(item.key)?'present':'absent'])),tongue_category:'met',pulse_category:'not_met'};
 if(['not_applicable','uncertain'].includes(scenario))f.command.answers.secondary_irregular_menses=scenario;
 if(scenario==='missing')f.command.answers.secondary_irregular_menses=null;
 if(scenario==='dual_pulse'){f.command.answers.pulse_wiry='present';f.command.answers.pulse_deep_wiry='present';f.command.answers.pulse_category='met';}
 f.assignment.response.answers={...f.command.answers};return f;
}
for(const kind of ['submit','correct'])for(const scenario of ['not_applicable','uncertain','dual_pulse','pending']){
 test(`table5 ${kind} preserves ${scenario} as a revision with no fabricated total or classification`,async()=>{
  const adapter=createResearchFormAdapter(dependencies),f=table5WriterFixture(kind,scenario);
  const result=await adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction')(f.tx,f.context,f.command);
  assert.equal(result.score.complete,true);assert.equal(result.score.scoreComplete,false);assert.equal(result.score.total,null);assert.equal(result.score.classification,null);assert.deepEqual(result.answers,f.command.answers);
  assert.equal(result.score.processingStatus,scenario==='pending'?'awaiting_policy':scenario==='dual_pulse'?'review_required':'incomplete_data');
  const {values:v}=f.executions.find(x=>x.sql.startsWith('INSERT INTO public.form_response_revision'));
  const savedScore=JSON.parse(v[16]);assert.equal(savedScore.total,null);assert.equal(savedScore.classification,null);assert.equal(v[17],FANG_TABLE5_ALGORITHM);
  const envelope={hashVersion:'formal-response-v1',...scope,responseId:v[4],assignmentId:v[5],formVersionId:v[6],subjectId:v[7],enrollmentId:v[8],subjectVisitId:v[9],protocolVersionId:v[10],policyVersionId:v[11],policyHash:v[12],revisionNo:v[13],previousRevisionId:v[14],answers:JSON.parse(v[15]),score:savedScore,scoreAlgorithm:v[17],source:v[18],actorKind:v[19],actorId:v[20],reason:v[21],changes:JSON.parse(v[22]),sourceSubmittedAt:null,createdAt:v[24].toISOString()};
  const hash=dependencies.load('study-operations/formal-response-policy','formalResponseHash');assert.equal(hash(envelope),result.ref.contentHash);
  assert.notEqual(hash({...envelope,score:{...savedScore,total:0,classification:'negative',processingStatus:'scored'}}),result.ref.contentHash);
 });
}
test('table5 unanswered required data remains incomplete and cannot become a submitted revision',async()=>{
 const adapter=createResearchFormAdapter(dependencies),writer=adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction');
 const f=table5WriterFixture('submit','missing');
 await assert.rejects(writer(f.tx,f.context,f.command),error=>error.getResponse?.().code==='FORM_REQUIRED_MISSING');assert.equal(f.executions.length,0);
 const draft=table5WriterFixture('draft','missing'),result=await writer(draft.tx,draft.context,draft.command);assert.equal(result.score.complete,false);assert.equal(result.score.scoreComplete,false);assert.equal(result.score.total,null);assert.equal(result.ref,null);
});
