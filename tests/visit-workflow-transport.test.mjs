import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaptureClient} from '../src/formal-capture-session.js';
import {visitWorkflowRejection} from '../server/research-studies/visit-workflow-routes.mjs';
test('only explicitly unaccepted workflow writes expose the narrow rejection flag',async()=>{
 for(const [path,code,flag,want,method='POST',status=409]of [
  ['/research-studies/study/visits/visit/workflow/batches','VISIT_WORKFLOW_SUMMARY_CHANGED',true,true],
  ['/research-studies/study/visits/visit/workflow/batches/batch/advance','VISIT_WORKFLOW_BATCH_CHANGED',true,true],
  ['/research-studies/study/visits/visit/workflow/batches','VISIT_WORKFLOW_POLICY_CHANGED',false,false],
  ['/research-studies/study/assignments/assignment/review','VISIT_WORKFLOW_SUMMARY_CHANGED',true,false],
  ['/research-studies/study/visits/visit/workflow/batches','VISIT_WORKFLOW_SUMMARY_CHANGED',true,false,'GET'],
  ['/research-studies/study/visits/visit/workflow/batches','VISIT_WORKFLOW_SUMMARY_CHANGED',true,false,'POST',503],
  ['/research-studies/study/visits/visit/workflow/batches','VISIT_WORKFLOW_BATCH_CHANGED',true,false],
 ]){
  const client=createCaptureClient({fetchImpl:async()=>Response.json({code,message:'changed',...(flag?{rejectedBeforeAcceptance:true}:{})},{status})});
  await assert.rejects(client.request(path,{method,body:{}}),e=>e.status===status&&e.code===code&&e.unknown===(method!=='GET'&&status>=500)&&(e.rejectedBeforeAcceptance===true)===want);
 }
});
test('controller emits rejection metadata only for the matching new route, code, status and explicit pre-acceptance fact',()=>{
 const e={status:409,code:'VISIT_WORKFLOW_SUMMARY_CHANGED',rejectedBeforeAcceptance:true};
 assert.deepEqual(visitWorkflowRejection('visitWorkflowCreate',e),{rejectedBeforeAcceptance:true});
 for(const [name,error]of [['formSubmit',e],['visitWorkflowAdvance',e],['visitWorkflowCreate',{...e,rejectedBeforeAcceptance:false}],['visitWorkflowCreate',{...e,status:503}],['visitWorkflowCreate',{...e,code:'VISIT_WORKFLOW_POLICY_CHANGED'}]])assert.deepEqual(visitWorkflowRejection(name,error),{});
});
