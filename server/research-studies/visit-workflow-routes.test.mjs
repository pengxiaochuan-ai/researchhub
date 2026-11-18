import test from 'node:test';
import assert from 'node:assert/strict';
import {visitWorkflowRoutes,dispatchVisitWorkflow} from './visit-workflow-routes.mjs';
test('visit workflow routes retain an explicit scoped visit parent and separate read/write verbs',()=>{
 assert.deepEqual(visitWorkflowRoutes.map(x=>[x[0],x[1],x[3]]),[['visitWorkflow','GET',false],['visitWorkflowCreate','POST',true],['visitWorkflowRead','GET',false],['visitWorkflowReceipt','GET',false],['visitWorkflowAdvance','POST',true]]);
 assert(visitWorkflowRoutes.every(x=>x[2].startsWith('research-studies/:id/visits/:visitId/workflow')));
});
test('delegation preserves the authenticated user, all parent ids and exact mutation body',async()=>{
 const user={accountId:'actor',authVersion:5},params={id:'study',visitId:'visit',batchId:'batch',requestKey:'receipt'},body={requestKey:'command',expectedStateHash:'hash'};const calls=[];
 const service=Object.fromEntries(['summary','createBatch','readBatch','batchReceipt','advanceBatch'].map(k=>[k,async(...args)=>{calls.push([k,...args]);return k;}]));
 for(const [name]of visitWorkflowRoutes)await dispatchVisitWorkflow(service,name,user,params,body,{});
 assert.deepEqual(calls,[['summary',user,'study','visit'],['createBatch',user,'study','visit',body],['readBatch',user,'study','visit','batch'],['batchReceipt',user,'study','visit','receipt'],['advanceBatch',user,'study','visit','batch',body]]);
});
test('unknown names and extra query arguments fail before touching the service',async()=>{
 let calls=0;const service={summary(){calls++;}};
 await assert.rejects(dispatchVisitWorkflow(service,'visitWorkflow',{},{},{},{scope:'other'}),e=>e.status===400);
 await assert.rejects(dispatchVisitWorkflow(service,'not-a-route',{},{},{},{}),e=>e.status===400);
 assert.equal(calls,0);
});
