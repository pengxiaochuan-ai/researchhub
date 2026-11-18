export const isCurrentRecovery=(start,current)=>Boolean(start.actor&&start.requestKey&&start.generation===current.generation&&start.actor===current.actor&&start.requestKey===current.requestKey);
export async function recoverOperation(api,operation,{retry=false}={}){
 if(retry){const result=operation.kind==='account'?await api.status(operation.id,operation.input):await api.changeMember(operation.groupId,operation.projectId,operation.id,operation.input);return{result};}
 try{
  const result=operation.kind==='account'?await api.receipt(operation.input.requestKey):await api.request('studies/'+encodeURIComponent(operation.projectId)+'/member-receipts/'+encodeURIComponent(operation.input.requestKey)+'?'+new URLSearchParams({studyGroupId:operation.groupId}));
  return{result};
 }catch(e){if(e.status===404)return{unsubmitted:true};throw e;}
}
