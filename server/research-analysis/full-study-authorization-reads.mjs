import {fullStudyHash} from './full-study-projection.mjs';
const models=new Set(['account','researchProjectMembership','tenantFeatureEntitlement','studyGroup','researchProject','studyGroupMembership']);
const reads=new Set(['findFirst','findUnique','findMany']);
const mutations=new Set(['create','createMany','createManyAndReturn','update','updateMany','updateManyAndReturn','upsert','delete','deleteMany']);
/** One projection, one already authorized/locked transaction. Never memoizes sources or SQL. */
export function memoizeFullStudyAuthorizationReads(tx){
 const cache=new Map(),delegates=new Map();
 return new Proxy(tx,{get(target,key){
  const delegate=Reflect.get(target,key,target);
  if(!models.has(key)||!delegate)return typeof delegate==='function'?delegate.bind(target):delegate;
  if(delegates.has(key))return delegates.get(key);
  const view=new Proxy(delegate,{get(model,method){
   const fn=Reflect.get(model,method,model);if(typeof fn!=='function')return fn;
   if(reads.has(method))return(...args)=>{
    const identity=String(key)+'.'+String(method)+':'+fullStudyHash(args);let pending=cache.get(identity);
    if(!pending){pending=Promise.resolve().then(()=>fn.apply(model,args)).then(value=>structuredClone(value));cache.set(identity,pending);pending.catch(()=>{if(cache.get(identity)===pending)cache.delete(identity);});}
    return pending.then(value=>structuredClone(value));
   };
   if(mutations.has(method))return async(...args)=>{cache.clear();try{return await fn.apply(model,args);}finally{cache.clear();}};
   return fn.bind(model);
  }});delegates.set(key,view);return view;
 }});
}
