const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const projectSQL='SELECT id FROM public.research_project WHERE id=? AND "tenantId"=? AND "studyGroupId"=? FOR SHARE';
const protocolSQL='SELECT id FROM public.study_protocol_version WHERE "tenantId"=? AND "studyGroupId"=? AND "researchProjectId"=? AND id=ANY(?::text[]) ORDER BY id FOR SHARE';
const subjectSQL='SELECT id FROM public.subject WHERE id=? AND "tenantId"=? AND "studyGroupId"=? AND "researchProjectId"=? AND "deletedAt" IS NULL FOR UPDATE';
const subjectsSQL='SELECT id FROM public.subject WHERE "tenantId"=? AND "studyGroupId"=? AND "researchProjectId"=? AND id=ANY(?::text[]) AND "deletedAt" IS NULL AND "acceptanceFixture"=false ORDER BY id FOR UPDATE';
const tenantSQL='SELECT pg_advisory_xact_lock(hashtextextended(?,0))';
const mutations=new Set(['create','createMany','createManyAndReturn','update','updateMany','updateManyAndReturn','upsert','delete','deleteMany']);
const tagged=args=>Array.isArray(args[0])&&Array.isArray(args[0].raw)&&args[0].length===args.length&&args[0].every(x=>typeof x==='string');
const ids=x=>Array.isArray(x)&&x.length>0&&x.every(identifier)&&new Set(x).size===x.length;
function lockIdentity(method,args,s){
 if(!tagged(args))return null;
 const sql=args[0].join('?'),p=args.slice(1);let expected;
 if(method==='$executeRaw'){
  if(sql!==tenantSQL||p.length!==1||p[0]!=='wp01:tenant:'+s.tenantId)return null;
  return{key:JSON.stringify([method,args[0],p]),advisory:true};
 }
 if(sql===projectSQL&&p.length===3&&p[0]===s.researchProjectId&&p[1]===s.tenantId&&p[2]===s.studyGroupId)expected=[p[0]];
 else if(sql===protocolSQL&&p.length===4&&p[0]===s.tenantId&&p[1]===s.studyGroupId&&p[2]===s.researchProjectId&&ids(p[3]))expected=[...p[3]];
 else if(sql===subjectSQL&&p.length===4&&identifier(p[0])&&p[1]===s.tenantId&&p[2]===s.studyGroupId&&p[3]===s.researchProjectId)expected=[p[0]];
 else if(sql===subjectsSQL&&p.length===4&&p[0]===s.tenantId&&p[1]===s.studyGroupId&&p[2]===s.researchProjectId&&ids(p[3]))expected=[...p[3]];
 return expected?{key:JSON.stringify([method,args[0],p]),expected}:null;
}
function successful(value,identity){
 if(identity.advisory)return Number.isSafeInteger(value)&&value>=0;
 return Array.isArray(value)&&value.length===identity.expected.length&&value.every(row=>row&&typeof row==='object'&&Object.keys(row).length===1&&identifier(row.id)&&identity.expected.includes(row.id))&&new Set(value.map(row=>row.id)).size===value.length;
}
// Non-allowlisted reads never memoize. Writes/context changes conservatively
// invalidate witnesses; FOR UPDATE on a source SELECT is still a fresh read.
function readOnlySelect(args){
 if(!tagged(args))return false;
 const sql=args[0].join('?');
 if(!/^\s*SELECT\b/i.test(sql)||/;|--|\/\*|\bset_config\s*\(/i.test(sql))return false;
 if(/\b(?:INSERT|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY|VACUUM|REFRESH|RESET|SET|INTO)\b/i.test(sql))return false;
 // SELECT can invoke a writing function. Only SQL syntax constructs are known
 // harmless here; unknown function calls clear memo rather than being parsed.
 for(const match of sql.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*"?\s*\(/g))if(!['ANY','ALL','IN','EXISTS','AND','OR','NOT','SELECT'].includes(match[1].toUpperCase()))return false;
 return !/\bUPDATE\b/i.test(sql.replace(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b/gi,''));
}

/** One project, one physical transaction. Never reuse across calls/transactions.
 * Only exact successful ID locks are remembered, never source/model rows.
 * No initial lock is assumed held. The caller must not span transaction clients.
 * All writes/context changes during that projection must use the returned view.
 */
export function memoizeFullStudyIdLocks(tx,scope){
 if(!tx||typeof tx.$queryRaw!=='function'||!scope||!['tenantId','studyGroupId','researchProjectId'].every(k=>identifier(scope[k])))throw Error('FULL_STUDY_LOCK_SCOPE_REQUIRED');
 const s={tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId},memo=new Map(),delegates=new WeakMap();
 let generation=0,writes=0;
 const clear=()=>{generation++;memo.clear();};
 const mutate=async(fn,target,args)=>{clear();writes++;try{return await fn.apply(target,args);}finally{writes--;clear();}};
 return new Proxy(tx,{get(target,key){
  const value=Reflect.get(target,key,target);
  if((key==='$queryRaw'||key==='$executeRaw')&&typeof value==='function')return async(...args)=>{
   const identity=lockIdentity(key,args,s);
   if(!identity)return key==='$queryRaw'&&readOnlySelect(args)?value.apply(target,args):mutate(value,target,args);
   if(!writes&&memo.has(identity.key))return structuredClone(memo.get(identity.key));
   const started=generation,result=await value.apply(target,args);
   if(!writes&&generation===started&&successful(result,identity)){
    const witness=structuredClone(result);memo.set(identity.key,witness);return structuredClone(witness);
   }
   return result;
  };
  if(['$queryRawUnsafe','$executeRawUnsafe','$runCommandRaw'].includes(key)&&typeof value==='function')return(...args)=>mutate(value,target,args);
  if(!value||typeof value!=='object')return typeof value==='function'?value.bind(target):value;
  if(!delegates.has(value))delegates.set(value,new Proxy(value,{get(model,method){
   const fn=Reflect.get(model,method,model);if(typeof fn!=='function')return fn;
   return mutations.has(method)?(...args)=>mutate(fn,model,args):fn.bind(model);
  }}));
  return delegates.get(value);
 }});
}
