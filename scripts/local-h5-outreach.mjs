/** Local fixture-only adapter. direct must be the fixture-guarded transaction runner. */
export function createLocalH5Outreach({ids,direct,load}){
 if(!ids?.tenant||typeof direct!=='function'||typeof load!=='function')throw Error('LOCAL_H5_SCOPE_REQUIRED');
 const fenced=tx=>new Proxy(tx,{get(target,name){
  if(name==='questionnaireInvitation'||name==='questionnaireSession'){
   const model=target[name];return new Proxy(model,{get(m,method){const value=m[method];if(method!=='findUnique')return typeof value==='function'?value.bind(m):value;return async(...args)=>{const row=await value.apply(m,args);return row?.tenantId===ids.tenant?row:null;};}});
  }
  const value=target[name];return typeof value==='function'?value.bind(target):value;
 }});
 const prisma={elevated:{$transaction:fn=>direct(tx=>fn(fenced(tx)))}};
 const features={assertEnabled:async(tenantId,featureKey)=>{
  if(tenantId!==ids.tenant)throw Error('LOCAL_H5_SCOPE_REJECTED');
  const enabled=await direct(tx=>tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ids.tenant,featureKey,enabled:true}}));
  if(!enabled)throw Object.assign(Error('FEATURE_NOT_ENABLED'),{code:'FEATURE_NOT_ENABLED'});
 }};
 return new(load('study-operations/study-outreach.service','StudyOutreachService'))(prisma,features);
}
