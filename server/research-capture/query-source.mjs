import {researchError} from '../research-studies/contract.mjs';
// Called only after the shared query reader has authorized and locked every target.
export async function presentFormalDataQueries(tx,scope,queries){
 const assignmentIds=[...new Set(queries.map(q=>q.target.ref.assignmentId))];
 if(!assignmentIds.length)return [];
 const assignments=await tx.formAssignment.findMany({where:{...scope,id:{in:assignmentIds},acceptanceFixture:false},select:{id:true,subjectId:true,subjectVisitId:true,subject:{select:{subjectId:true}},subjectVisit:{select:{visitPlan:{select:{name:true}}}},formVersion:{select:{schema:true,template:{select:{name:true}}}}}});
 const byId=new Map(assignments.map(a=>[a.id,a]));
 const actorIds=[...new Set(queries.flatMap(q=>q.events.map(e=>e.actorId)))];
 const accounts=actorIds.length?await tx.account.findMany({where:{tenantId:scope.tenantId,id:{in:actorIds}},select:{id:true,displayName:true}}):[];
 const names=new Map(accounts.map(a=>[a.id,a.displayName?.trim()||'历史账号']));
 return queries.map(query=>{
  const a=byId.get(query.target.ref.assignmentId);
  if(!a?.subjectId||!a.subject?.subjectId||!a.subjectVisitId||!a.subjectVisit?.visitPlan?.name||!a.formVersion?.template?.name)throw researchError(409,'DATA_QUERY_SOURCE_CHANGED','问题来源已变化，请重新核对。');
  const field=query.target.fieldKey==null?null:a.formVersion.schema?.fields?.find(f=>f.key===query.target.fieldKey);
  if(query.target.fieldKey!=null&&!field)throw researchError(409,'DATA_QUERY_SOURCE_CHANGED','问题字段已变化，请重新核对。');
  return {...query,source:{subjectId:a.subjectId,subjectCode:a.subject.subjectId,visitId:a.subjectVisitId,visitName:a.subjectVisit.visitPlan.name,assignmentId:a.id,formTitle:a.formVersion.template.name,fieldLabel:field?.label??null},events:query.events.map(e=>({...e,actorDisplayName:names.get(e.actorId)??'历史账号'}))};
 });
}
