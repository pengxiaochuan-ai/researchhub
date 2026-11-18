import {only,invalid} from './contract.mjs';
export const visitWorkflowRoutes=[
 ['visitWorkflow','GET','research-studies/:id/visits/:visitId/workflow',false],
 ['visitWorkflowCreate','POST','research-studies/:id/visits/:visitId/workflow/batches',true],
 ['visitWorkflowRead','GET','research-studies/:id/visits/:visitId/workflow/batches/:batchId',false],
 ['visitWorkflowReceipt','GET','research-studies/:id/visits/:visitId/workflow/batch-receipts/:requestKey',false],
 ['visitWorkflowAdvance','POST','research-studies/:id/visits/:visitId/workflow/batches/:batchId/advance',true],
];
export function visitWorkflowRejection(name,error){
 const codes=name==='visitWorkflowCreate'?['VISIT_WORKFLOW_SUMMARY_CHANGED','VISIT_WORKFLOW_MEMBER_CHANGED']:name==='visitWorkflowAdvance'?['VISIT_WORKFLOW_BATCH_CHANGED']:[];
 return error?.status===409&&error.rejectedBeforeAcceptance===true&&codes.includes(error.code)?{rejectedBeforeAcceptance:true}:{};
}
export async function dispatchVisitWorkflow(service,name,user,params,body,query={}){
 only(query,[]);
 const {id,visitId,batchId,requestKey}=params;
 if(name==='visitWorkflow')return service.summary(user,id,visitId);
 if(name==='visitWorkflowCreate')return service.createBatch(user,id,visitId,body);
 if(name==='visitWorkflowRead')return service.readBatch(user,id,visitId,batchId);
 if(name==='visitWorkflowReceipt')return service.batchReceipt(user,id,visitId,requestKey);
 if(name==='visitWorkflowAdvance')return service.advanceBatch(user,id,visitId,batchId,body);
 invalid();
}
