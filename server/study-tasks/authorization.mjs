export function taskError(code,status=403,message='当前身份或研究范围不可访问') {
 return Object.assign(new Error(message),{code,status});
}

// This fence is ONLY the approved local synthetic run, not a product admin policy.
// Product rights still come from the shared current-identity Task authority below.
export function createTaskAuthorization({boundary,assertAuthority}) {
 const {scope,ids,project}=boundary;
 return async (db,principal,target,action='read',task)=>{
  if(!principal||![ids.owner,ids.admin].includes(principal.accountId)||principal.tenantId!==scope.tenantId||
   target?.tenantId!==scope.tenantId||target.studyGroupId!==scope.studyGroupId||
   ![scope.researchProjectId,project.id].includes(target.researchProjectId))
   throw taskError('STUDY_TASK_SCOPE_REJECTED');
  return assertAuthority(db,principal,target,action,task);
 };
}
