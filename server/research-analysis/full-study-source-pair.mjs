import {coreSourcePath} from '../research-runtime/dependencies.mjs';
import {Module,createRequire} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {researchError} from '../research-studies/contract.mjs';
import {fullStudyHash} from './full-study-projection.mjs';

const source=name=>coreSourcePath('study-operations/'+name);
const reads=new Set(['findFirst','findUnique','findMany','findFirstOrThrow','findUniqueOrThrow','count','aggregate','groupBy']);
const changed=()=>researchError(409,'FULL_STUDY_PAIR_CONTEXT_CHANGED','当前来源读取上下文已变化，请重新核对。');
const noWrite=()=>researchError(500,'FULL_STUDY_PAIR_WRITE_REJECTED','来源成对读取不允许写入。');
function readOnly(tx){
 const models=new Map();
 return new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);
  if(key==='$queryRaw'||key==='$executeRaw')return(...args)=>{const sql=Array.isArray(args[0])?args[0].join(''):'';if(!/^\s*SELECT\b/i.test(sql)||/;\s*\S|\bset_config\s*\(/i.test(sql))throw noWrite();return value.apply(target,args);};
  if(typeof key==='string'&&key.startsWith('$'))throw noWrite();
  if(!value||typeof value!=='object')return typeof value==='function'?value.bind(target):value;
  if(models.has(key))return models.get(key);
  const model=new Proxy(value,{get(delegate,method){const fn=Reflect.get(delegate,method,delegate);if(typeof fn!=='function')return fn;if(!reads.has(method))return()=>{throw noWrite();};return fn.bind(delegate);}});
  models.set(key,model);return model;
 }});
}

/** One sequential native current+fixed read. No source cache or caller-supplied witness. */
export function createFullStudySourcePairReader({require,load}){
 const compiler=require?.extensions?.['.ts'];if(typeof compiler!=='function'||typeof load!=='function')throw Error('FULL_STUDY_PAIR_DEPENDENCIES_REQUIRED');
 const currentRead=load('study-operations/formal-response-query','readFormalResponseInTransaction');
 const queryPath=source('formal-response-query'),historyPath=source('formal-response-history'),originalQuery=require(queryPath),context=new AsyncLocalStorage(),resolver=createRequire(historyPath),history=new Module(historyPath);history.filename=historyPath;
 async function witnessedCurrent(tx,user,scope,assignmentId){
  const w=context.getStore();
  if(!w||!w.active)return currentRead(tx,user,scope,assignmentId);
  if(w.consumed||tx!==w.tx||fullStudyHash(user)!==w.userHash||fullStudyHash(scope)!==w.scopeHash||assignmentId!==w.assignmentId||fullStudyHash(w.requestRef)!==w.refHash)throw changed();
  w.consumed=true;return structuredClone(w.current);
 }
 history.require=specifier=>resolver.resolve(specifier)===queryPath?{...originalQuery,readFormalResponseInTransaction:witnessedCurrent}:resolver(specifier);
 compiler(history,historyPath);history.loaded=true;
 const fixedRead=history.exports.readFormalResponseRevisionInTransaction;if(typeof fixedRead!=='function')throw Error('FULL_STUDY_PAIR_HISTORY_UNAVAILABLE');
 return{async readPair(tx,user,scope,assignmentId,binding){
  if(!binding||!['subjectId','enrollmentId','subjectVisitId','formVersionId'].every(k=>typeof binding[k]==='string')||typeof assignmentId!=='string')throw changed();
  const protectedTx=readOnly(tx),stableUser=structuredClone(user),stableScope=structuredClone(scope);
  const current=structuredClone(await currentRead(protectedTx,stableUser,stableScope,assignmentId)),a=current.assignment,r=current.response;
  const eligible=r.status==='submitted'&&r.ref&&r.locked&&r.review==='review_approved';
  const bound=a.id===assignmentId&&a.subjectId===binding.subjectId&&a.enrollmentId===binding.enrollmentId&&a.subjectVisitId===binding.subjectVisitId&&a.formVersion.id===binding.formVersionId;
  if(!eligible||!bound)return{current,fixed:null};
  const requestRef=structuredClone(r.ref),w={active:true,consumed:false,tx:protectedTx,userHash:fullStudyHash(stableUser),scopeHash:fullStudyHash(stableScope),assignmentId,requestRef,refHash:fullStudyHash(requestRef),current:structuredClone(current)};
  try{
   const fixed=await context.run(w,()=>fixedRead(protectedTx,stableUser,stableScope,assignmentId,requestRef));
   if(!w.consumed||fullStudyHash(fixed.ref)!==w.refHash)throw changed();
   return{current,fixed};
  }finally{w.active=false;w.current=null;}
 }};
}
