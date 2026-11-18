import test from 'node:test';
import assert from 'node:assert/strict';
import {requireWF06Discovery,selectWF06DiscoveryVisits,projectWF06DiscoverySummary,runWF06Discovery} from './study-workflow-wf06-discover.mjs';
const env={STUDY_WORKFLOW_WF06_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit',STUDY_WORKFLOW_WF05_QA_WINDOW:'explicit'};
const visit=(label='MAIN',extra={})=>({visitId:'visit-'+label,subject:{id:'subject-'+label,subjectId:'SYNTHETIC-QA-'+label},enrollmentId:'enroll-'+label,protocolVersionId:'protocol',visitPlan:{id:'plan',code:'BASELINE',name:'三量表'},...extra});
test('WF06/shared/WF05 windows and exact discover CLI reject before fixture dependencies',async()=>{
 assert.throws(()=>requireWF06Discovery({}),/ROOT_WF06_IO_WINDOW_REQUIRED/);
 assert.throws(()=>requireWF06Discovery({STUDY_WORKFLOW_WF06_QA_WINDOW:'explicit'}),/SHARED_HELPER_WINDOW_REQUIRED/);
 await assert.rejects(runWF06Discovery({env:{},args:['--local-synthetic','--discover']}),/ROOT_WF06_IO_WINDOW_REQUIRED/);
 await assert.rejects(runWF06Discovery({env:{...env,STUDY_WORKFLOW_WF05_QA_WINDOW:undefined},args:['--local-synthetic','--discover']}),/ROOT_WF05_IO_WINDOW_REQUIRED/);
 await assert.rejects(runWF06Discovery({env,args:['--other']}),/EXACT_DISCOVERY_COMMAND_REQUIRED/);
 await assert.rejects(runWF06Discovery({env,args:['--local-synthetic','--discover-attention','--extra']}),/EXACT_DISCOVERY_COMMAND_REQUIRED/);
});
test('attention discovery is fixed to CONCURRENT/RECOVERY/UX01 BASELINE and admin',()=>{
 const data={studyId:'study',items:[visit('MAIN'),visit('CONCURRENT'),visit('RECOVERY'),visit('UX01'),visit('OTHER'),visit('UX01',{visitId:'followup',visitPlan:{code:'FOLLOWUP'}})]};
 assert.deepEqual(selectWF06DiscoveryVisits(data,'study','discover-attention').map(x=>[x.label,x.role]),[['CONCURRENT','admin'],['RECOVERY','admin'],['UX01','admin']]);
 assert.deepEqual(selectWF06DiscoveryVisits(data,'study').map(x=>x.label),['MAIN']);assert.throws(()=>selectWF06DiscoveryVisits(data,'other','discover-attention'));assert.throws(()=>selectWF06DiscoveryVisits(data,'study','scan-all'));
});
test('HTTP 200 remains numeric when combined with planned/in_progress visit metadata',()=>{
 for(const status of ['in_progress','planned']){const row=visit('SELF'),summary={studyId:'study',visitId:row.visitId,visit:{id:row.visitId,subject:row.subject,enrollmentId:row.enrollmentId,protocolVersionId:row.protocolVersionId,status,visitPlan:row.visitPlan},items:[]};
  const projected=projectWF06DiscoverySummary(summary,row,'study'),sample={httpStatus:200,...projected};assert.equal(projected.visitStatus,status);assert.equal(sample.httpStatus,200);assert.equal(sample.visitStatus,status);assert.equal(Object.hasOwn(projected,'status'),false);
 }
});
test('only the approved Study and synthetic MAIN/SELF/H5 BASELINE rows yield at most three summaries',()=>{
 const data={studyId:'study',items:[visit(),visit('MAIN',{visitId:'duplicate'}),visit('SELF'),visit('H5'),visit('CSV'),visit('SELF',{visitId:'followup',visitPlan:{code:'FOLLOWUP'}}),visit('MAIN',{visitId:'real',subject:{id:'x',subjectId:'REAL-MAIN'}})]};
 assert.deepEqual(selectWF06DiscoveryVisits(data,'study').map(x=>[x.label,x.row.visitId,x.role]),[['MAIN','visit-MAIN','admin'],['SELF','visit-SELF','reviewer'],['H5','visit-H5','admin']]);assert.throws(()=>selectWF06DiscoveryVisits(data,'other'));
});
test('projection retains raw flags/ref/capabilities but never reads answers, total, diagnosis or full schema',()=>{
 const row=visit(),score={processingStatus:'incomplete_data',scoreComplete:false,missingRequired:1,unresolvedItems:[{private:'not emitted'}]},response={status:'submitted',ref:{responseId:'response',assignmentId:'assignment',revisionNo:1,contentHash:'a'.repeat(64)},version:0,review:null,locked:false,score};
 for(const key of ['answers','total','diagnosis'])Object.defineProperty(key==='answers'?response:score,key,{get(){throw Error('FORBIDDEN_READ:'+key);}});
 const item={assignmentId:'assignment',formVersionId:'form',title:'合成表单',required:true,mode:'researcher',response,capabilities:{canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}},formVersion:{get schema(){throw Error('FORBIDDEN_SCHEMA');}}};
 const summary={studyId:'study',visitId:row.visitId,summaryHash:'b'.repeat(64),canStartBatch:false,maxBatchItems:20,visit:{id:row.visitId,subject:row.subject,enrollmentId:row.enrollmentId,protocolVersionId:row.protocolVersionId,visitPlan:{...row.visitPlan,requirements:[{id:'req',kind:'form_response',name:'合成表单',required:true,config:{formVersionId:'form',secret:'not emitted'}}]},fulfillments:[{id:'fulfill',visitRequirementId:'req',status:'missing',evidence:'not emitted'}]},items:[item]};
 const projected=projectWF06DiscoverySummary(summary,row,'study'),text=JSON.stringify(projected);assert.equal(projected.items[0].response.score.scoreComplete,false);assert.equal(projected.items[0].response.score.unresolvedItemsLength,1);assert.equal(projected.items[0].independentReviewReason,'FORM_INDEPENDENT_REVIEW_REQUIRED');for(const word of ['answers','diagnosis','schema','not emitted','private'])assert(!text.includes(word));
 assert.throws(()=>projectWF06DiscoverySummary({...summary,studyId:'other'},row,'study'));assert.throws(()=>projectWF06DiscoverySummary({...summary,visit:{...summary.visit,enrollmentId:'other'}},row,'study'));
});
