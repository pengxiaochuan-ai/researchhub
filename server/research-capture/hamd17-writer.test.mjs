import test from 'node:test';
import assert from 'node:assert/strict';
import {getSourceFormProfile} from './source-profiles.mjs';
import {createResearchFormAdapter} from './form-core-adapter.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';

const dependencies=runtimeDependencies(),adapter=createResearchFormAdapter(dependencies);
const writer=adapter.load('study-operations/formal-response-writer','writeFormalResponseInTransaction');
const scope={tenantId:'synthetic-tenant',studyGroupId:'synthetic-group',researchProjectId:'synthetic-project'};
function fixture(kind='submit',special9=true){
 const p=getSourceFormProfile('hamd17-crf-simulation-v1'),answers=Object.fromEntries(p.schema.fields.map(field=>[field.key,0]));if(special9)answers.hamd17_q14=9;
 const row={id:'response',version:kind==='correct'?1:0,status:kind==='correct'?'submitted':'draft',currentRevisionId:kind==='correct'?'previous':null,lockedRevisionId:null,answers:Object.fromEntries(p.schema.fields.map(field=>[field.key,0]))};
 const assignment={id:'assignment',subjectId:'subject',enrollmentId:'enrollment',subjectVisitId:null,formVersionId:'hamd-form',response:row,formVersion:{status:'published',schema:p.schema,scoring:p.scoring}};
 const executions=[],tx={formAssignment:{findFirst:async()=>assignment,update:async()=>({})},auditLog:{create:async()=>({})},
  $queryRaw:async(strings)=>{const sql=strings.join('?');
   if(sql.includes('pg_advisory_xact_lock'))return [];
   if(sql.includes('FROM public.form_assignment'))return [{id:'assignment'}];
   if(sql.includes('FROM public.form_response_command_receipt'))return [];
   if(sql.includes('FROM public.form_response_revision'))return [{revisionNo:1}];
   if(sql.includes('FROM public.form_response'))return [row];
   if(sql.includes('JOIN public.study_execution_policy_version'))return [{policyId:'policy',policyHash:'a'.repeat(64)}];
   throw Error('Unexpected SQL '+sql);
  },
  $executeRaw:async(strings,...values)=>{executions.push({sql:strings.join('?'),values});return 1;},
 };
 const context={scope,actor:{kind:'account',id:'synthetic-clinician'},assignmentId:'assignment',subjectId:'subject',enrollmentId:'enrollment',protocolVersionId:'protocol'};
 const command={kind,requestKey:'hamd-synthetic-request',expectedVersion:row.version,answers,...(kind==='correct'?{expectedRevisionId:'previous',reason:'合成HAMD更正'}:{})};
 return {tx,context,command,executions};
}
for(const kind of ['submit','correct'])test(`actual ${kind} writer retains source9 and hashes its non-scored result without fabricating a total`,async()=>{
 const f=fixture(kind),result=await writer(f.tx,f.context,f.command);
 assert.equal(result.answers.hamd17_q14,9);assert.equal(result.score.complete,true);assert.equal(result.score.scoreComplete,false);assert.equal(result.score.total,null);assert.equal(result.score.classification,null);assert.equal(result.score.algorithm,'hamd17-simulation-sum-v1');
 const {values:v}=f.executions.find(x=>x.sql.startsWith('INSERT INTO public.form_response_revision'));
 assert.equal(JSON.parse(v[15]).hamd17_q14,9);assert.deepEqual(JSON.parse(v[16]),result.score);assert.equal(v[17],'hamd17-simulation-sum-v1');
 const envelope={hashVersion:'formal-response-v1',...scope,responseId:v[4],assignmentId:v[5],formVersionId:v[6],subjectId:v[7],enrollmentId:v[8],subjectVisitId:v[9],protocolVersionId:v[10],policyVersionId:v[11],policyHash:v[12],revisionNo:v[13],previousRevisionId:v[14],answers:JSON.parse(v[15]),score:JSON.parse(v[16]),scoreAlgorithm:v[17],source:v[18],actorKind:v[19],actorId:v[20],reason:v[21],changes:JSON.parse(v[22]),sourceSubmittedAt:null,createdAt:v[24].toISOString()};
 const hash=dependencies.load('study-operations/formal-response-policy','formalResponseHash');assert.equal(hash(envelope),result.ref.contentHash);assert.notEqual(hash({...envelope,score:{...envelope.score,total:0,scoreComplete:true}}),result.ref.contentHash);
});
test('actual writer persists an ordinary zero sum as valid rather than missing',async()=>{
 const f=fixture('submit',false),result=await writer(f.tx,f.context,f.command);assert.equal(result.score.total,0);assert.equal(result.score.scoreComplete,true);assert.equal(result.score.complete,true);assert(result.ref);
});
test('actual writer refuses missing submission but retains incomplete draft; no silent special code string coercion',async()=>{
 const f=fixture('submit');f.command.answers.hamd17_q1=null;
 await assert.rejects(writer(f.tx,f.context,f.command),error=>error.getResponse?.().code==='FORM_REQUIRED_MISSING');assert.equal(f.executions.length,0);
 const draft=fixture('draft');draft.command.answers.hamd17_q1=null;
 const result=await writer(draft.tx,draft.context,draft.command);assert.equal(result.score.complete,false);assert.equal(result.score.total,null);assert.equal(result.ref,null);
 const invalid=fixture();invalid.command.answers.hamd17_q14='9';await assert.rejects(writer(invalid.tx,invalid.context,invalid.command),error=>error.getResponse?.().code==='FORM_ANSWER_INVALID_TYPE');assert.equal(invalid.executions.length,0);
});
