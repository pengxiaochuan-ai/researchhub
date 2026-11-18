import {researchError} from '../server/research-studies/contract.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';

const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const invalid=()=>researchError(503,'FULL_STUDY_CAPABILITIES_CONTEXT_CHANGED','当前操作权限暂不可核对，请重新读取。');

// Private v2 composition only. Execute the unchanged public lookup and native
// actionCapabilities in one fresh native authorization transaction. No cache.
export function createFullStudyMethodsCapabilities(methods){
 const originalGet=methods.getDescriptiveCapabilities;
 return {async withDescriptiveCapabilities(user,allowedIds,callback){
  if(!['tenantId','studyGroupId','researchProjectId','accountId'].every(k=>id(user?.[k]))||!Number.isSafeInteger(user.authVersion)
   ||!Array.isArray(allowedIds)||allowedIds.length<1||allowedIds.length>39||!allowedIds.every(id)
   ||new Set(allowedIds).size!==allowedIds.length||typeof callback!=='function'||typeof originalGet!=='function')throw invalid();
  const allowed=new Set(allowedIds),actorHash=fullStudyHash(user),boundUser=structuredClone(user),native=methods.descriptiveRuns();
  return native.transaction(boundUser,async tx=>{
   let active=true,inFlight=false;const consumed=new Set(),pending=new Set();
   const current=actual=>{if(!active||actual!==boundUser||fullStudyHash(user)!==actorHash||fullStudyHash(boundUser)!==actorHash)throw invalid();};
   const child=Object.create(native),privateMethods=Object.create(methods);
   child.transaction=async(actual,fn)=>{current(actual);return fn(tx);};
   Object.defineProperties(privateMethods,{
    scopedDb:{value:actual=>{current(actual);return tx;}},
    descriptiveRuns:{value:()=>{current(boundUser);return child;}}
   });
   const get=runId=>{
    const work=(async()=>{
     current(boundUser);if(!allowed.has(runId)||consumed.has(runId)||inFlight)throw invalid();
     consumed.add(runId);inFlight=true;
     try{const value=await originalGet.call(privateMethods,boundUser,runId);current(boundUser);if(value?.runId!==runId)throw invalid();return value;}
     finally{inFlight=false;}
    })();
    pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));return work;
   };
   try{
    const result=await callback(get);current(boundUser);if(pending.size)throw invalid();return result;
   }finally{
    active=false;
    if(pending.size)await Promise.allSettled([...pending]);
   }
  });
 }};
}
