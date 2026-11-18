// Server-only composition. Native Study and upload authority remain owners of
// permissions. No role changes, fixture grants, worker, upload or model calls.
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=()=>{throw Object.assign(Error('研究或来源会话无法核对，请重新选择。'),{status:403,code:'DATA_AGENT_TARGET_REJECTED'});};
class SourceAccessFailure extends Error{
 constructor(cause){super('来源会话无法核对，请重新打开当前会话。',{cause});this.status=cause?.status??cause?.getStatus?.()??503;this.code=cause?.code??'DATA_AGENT_SOURCE_UNAVAILABLE';}
}
const checkUser=u=>{if(!u||!valid(u.tenantId)||!valid(u.accountId)||!Number.isSafeInteger(u.authVersion)||u.authVersion<0)fail();};
export function createDataAgentTargets({studies,sourceAccess,authorizeIngest}){
 if(!studies?.list||!studies?.withResearchStudyTransaction||!sourceAccess?.transaction||!sourceAccess?.inTransaction||typeof authorizeIngest!=='function')throw Error('DATA_AGENT_NATIVE_DEPENDENCIES_REQUIRED');
 function checkSource(p,u,sid){if(!valid(sid)||!p||['tenantId','accountId','authVersion'].some(k=>p[k]!==u[k])||!valid(p.studyGroupId)||!valid(p.researchProjectId))fail();return{sessionId:sid,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId};}
 async function withTarget(user,sid,studyId,operation){
  checkUser(user);
  if(!valid(studyId)||!valid(sid)||typeof operation!=='function')fail();
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,c)=>{
   if(c.tenantId!==user.tenantId||c.studyId!==studyId||![c.studyGroupId,c.executionProjectId,c.projectIntentId].every(valid))fail();
   let sourcePrincipal,source;
   // Source validation uses the SAME transaction. Restore destination GUC even
   // when source authorization fails; never open nested cross-project lanes.
   try{await sourceAccess.inTransaction(tx,user,sid,async(_tx,p)=>{source=checkSource(p,user,sid);sourcePrincipal=p;});if(!sourcePrincipal)fail();}
   catch(e){throw new SourceAccessFailure(e);}
   finally{await tx.$queryRawUnsafe("SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)",c.studyGroupId,c.executionProjectId,user.accountId);}
   const targetPrincipal={...sourcePrincipal,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId};
   await authorizeIngest(tx,targetPrincipal,c.studyGroupId,c.executionProjectId);
   return operation(tx,{sourcePrincipal,targetPrincipal,source,target:{studyId:c.studyId,projectIntentId:c.projectIntentId,studyGroupId:c.studyGroupId,executionProjectId:c.executionProjectId}});
  });
 }
 return{withTarget,async list(user,sid){
  checkUser(user);if(!valid(sid))fail();
  await sourceAccess.transaction(user,sid,async(_tx,p)=>checkSource(p,user,sid));
  const items=[],seen=new Set(),cursors=new Set();let cursor;
  do{
   const page=await studies.list(user,{limit:100,...(cursor?{cursor}:{})});if(!Array.isArray(page?.items)||page.nextCursor!==null&&!valid(page.nextCursor))throw Error('DATA_AGENT_TARGET_PAGE_INVALID');
   for(const item of page.items){const id=item.study?.id;if(!id||seen.has(id))continue;seen.add(id);
    try{await withTarget(user,sid,id,async()=>{items.push({id,name:item.title});});}catch(e){if(e instanceof SourceAccessFailure||![403,404].includes(e.status??e.getStatus?.()))throw e;}
   }
   cursor=page.nextCursor;if(cursor){if(cursors.has(cursor)||cursors.size>=100)throw Error('DATA_AGENT_TARGET_CAPACITY');cursors.add(cursor);}
  }while(cursor);
  return{items};
 }};
}
