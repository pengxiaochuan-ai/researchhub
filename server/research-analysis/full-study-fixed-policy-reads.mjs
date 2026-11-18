import {fullStudyHash} from './full-study-projection.mjs';

const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const sameScope=(x,s)=>scopeKeys.every(k=>x?.[k]===s[k]);
const reads=new Set(['findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','findMany','count','aggregate','groupBy']);
const tagged=args=>Array.isArray(args[0])&&Array.isArray(args[0].raw)&&args[0].length===args.length&&args[0].every(x=>typeof x==='string');
function harmlessRaw(method,args,s){
 if(!tagged(args))return false;
 const sql=args[0].join('?');
 if(method==='$executeRaw')return sql==='SELECT pg_advisory_xact_lock(hashtextextended(?,0))'&&args.length===2&&args[1]==='wp01:tenant:'+s.tenantId;
 if(method!=='$queryRaw'||!/^\s*SELECT\b/i.test(sql)||/;|--|\/\*|\bset_config"?\s*\(/i.test(sql))return false;
 if(/\b(?:INSERT|INTO|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY|VACUUM|REFRESH|RESET|SET)\b/i.test(sql))return false;
 for(const match of sql.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*"?\s*\(/g))if(!['ANY','ALL','IN','EXISTS','AND','OR','NOT','SELECT'].includes(match[1].toUpperCase()))return false;
 return !/\bUPDATE\b/i.test(sql.replace(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b/gi,''));
}

/** Install only after validateCase acquired the fixed protocol FOR SHARE and
 * verified the approved immutable policy. One project / physical transaction;
 * all operations during that projection must use this view. Never seed from a
 * previous read, cache a query's null/error, or cache mutable subject data. */
export function memoizeFullStudyFixedPolicyReads(tx,scope,c){
 if(!tx||typeof tx.$queryRaw!=='function'||!scope||!scopeKeys.every(k=>identifier(scope[k]))||!sameScope(c?.scope,scope)||!identifier(c?.protocolVersionId)||!identifier(c?.policyId)||!hex(c?.policyHash))throw Error('FULL_STUDY_FIXED_POLICY_SCOPE_REQUIRED');
 const s=Object.fromEntries(scopeKeys.map(k=>[k,scope[k]])),fixed={protocolId:c.protocolVersionId,policyId:c.policyId,policyHash:c.policyHash},memo=new Map(),delegates=new Map();
 let epoch=0,writes=0;const clear=()=>{epoch++;memo.clear();};
 const mutate=async(fn,target,args)=>{clear();writes++;try{return await fn.apply(target,args);}finally{writes--;clear();}};
 function eligible(model,args){
  if(args.length!==1||!exact(args[0],['where'])||!sameScope(args[0].where,s))return false;
  const w=args[0].where;
  if(model==='studyProtocolVersion')return exact(w,[...scopeKeys,'id','acceptanceFixture'])&&w.id===fixed.protocolId&&w.acceptanceFixture===false;
  if(model!=='studyExecutionPolicyVersion'||w.id!==fixed.policyId||w.protocolVersionId!==fixed.protocolId)return false;
  return exact(w,[...scopeKeys,'id','protocolVersionId'])||exact(w,[...scopeKeys,'id','protocolVersionId','status','contentHash'])&&w.status==='approved'&&w.contentHash===fixed.policyHash;
 }
 function successful(model,value){
  if(!plain(value)||!sameScope(value,s))return false;
  if(model==='studyProtocolVersion')return value.id===fixed.protocolId&&value.acceptanceFixture===false&&['approved','executing','superseded'].includes(value.status)&&value.approvedPolicyVersionId===fixed.policyId&&value.approvedPolicyHash===fixed.policyHash;
  return value.id===fixed.policyId&&value.protocolVersionId===fixed.protocolId&&value.status==='approved'&&value.contentHash===fixed.policyHash&&plain(value.sections)&&fullStudyHash(value.sections)===fixed.policyHash&&typeof value.reviewedBy==='string'&&value.reviewedBy.length>0&&value.reviewedAt instanceof Date&&Number.isFinite(value.reviewedAt.getTime());
 }
 return new Proxy(tx,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(typeof value==='function'){
   if(typeof key==='string'&&key.startsWith('$'))return(...args)=>harmlessRaw(key,args,s)?value.apply(target,args):mutate(value,target,args);
   return value.bind(target);
  }
  if(!value||typeof value!=='object')return value;
  if(!delegates.has(key))delegates.set(key,new Proxy(value,{get(model,method){
   const fn=Reflect.get(model,method,model);if(typeof fn!=='function')return fn;
   if(!reads.has(method))return(...args)=>mutate(fn,model,args);
   if(method!=='findFirst')return fn.bind(model);
   return async(...args)=>{
    if(!eligible(key,args))return fn.apply(model,args);
    const query=structuredClone(args[0]),identity=String(key)+':'+fullStudyHash(query);
    if(!writes&&memo.has(identity))return structuredClone(memo.get(identity));
    const started=epoch,result=await fn.call(model,query);
    if(!successful(key,result))return result;
    const witness=structuredClone(result);if(!writes&&epoch===started)memo.set(identity,witness);
    return structuredClone(witness);
   };
  }}));
  return delegates.get(key);
 }});
}
