// Private synthetic-local diagnostic only. No enable-file, environment, DB or IO side effects.
import {performance} from 'node:perf_hooks';

const roles=new Set(['platform_admin','tenant_admin','researcher']);
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const object=x=>x!==null&&(typeof x==='object'||typeof x==='function');
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const safe=(fn,fallback)=>{try{return fn();}catch{return fallback;}};
const own=(value,key)=>safe(()=>{const d=object(value)?Object.getOwnPropertyDescriptor(value,key):null;return d&&Object.hasOwn(d,'value')?d.value:undefined;},undefined);
const name=key=>typeof key==='string'&&/^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(key)?key:'other';
function field(value,key,allowed){
 const d=safe(()=>Object.getOwnPropertyDescriptor(value,key),null),v=d&&Object.hasOwn(d,'value')?d.value:undefined;
 return{own:!!d,type:d?(Object.hasOwn(d,'value')?typeof v:'accessor'):'absent',value:allowed(v)?v:null};
}
function actorMetadata(user){return{
 fieldKeys:safe(()=>Object.keys(user).sort(),[]),
 role:field(user,'role',v=>roles.has(v)),
 isTenantAdmin:field(user,'isTenantAdmin',v=>typeof v==='boolean'),
 authVersion:field(user,'authVersion',v=>Number.isSafeInteger(v)&&v>=0)
};}
function thenKind(value){
 if(!object(value))return'none';
 return safe(()=>{let current=value;for(let i=0;current&&i<12;i++,current=Object.getPrototypeOf(current)){const d=Object.getOwnPropertyDescriptor(current,'then');if(d)return Object.hasOwn(d,'value')?(typeof d.value==='function'?'data':'none'):'accessor';}return'none';},'accessor');
}
/** Do not subscribe here: PrismaPromise execution begins when its consumer calls
 * then/await. The proxy observes that same consumption, never adds an eager one.
 * Resolved values and rejection objects are passed unchanged. */
function observeReturn(value,success,failure,unobservable=()=>{}){
 const kind=thenKind(value);if(kind==='accessor'){unobservable();return value;}
 if(kind==='none'){success(value);return value;}
 const then=(ok,bad)=>Reflect.apply(Reflect.get(value,'then',value),value,[
  result=>{success(result);return typeof ok==='function'?ok(result):result;},
  error=>{failure(error);if(typeof bad==='function')return bad(error);throw error;}
 ]);
 return new Proxy(value,{get(target,key){
  if(key==='then')return then;
  if(key==='catch')return bad=>then(undefined,bad);
  if(key==='finally')return done=>typeof done!=='function'?then(undefined,undefined):then(
   result=>Promise.resolve(done()).then(()=>result),
   error=>Promise.resolve(done()).then(()=>{throw error;})
  );
  const member=Reflect.get(target,key,target);return typeof member==='function'?member.bind(target):member;
 }});
}

export function observeFullStudyCore(core,{sourceHash,scope,studyId,emit,clock=()=>performance.now()}={}){
 if(!object(core)||typeof core.authorize!=='function'||typeof core.project!=='function'||!hex(sourceHash)||!scopeKeys.every(k=>id(own(scope,k)))||!id(studyId)||typeof emit!=='function'||typeof clock!=='function')throw Error('FULL_STUDY_PROJECT_OBSERVER_CONFIGURATION_REQUIRED');
 const fixedScope=Object.fromEntries(scopeKeys.map(k=>[k,own(scope,k)])),contexts=new WeakMap();let sequence=0;
 const now=()=>safe(()=>{const value=clock();return Number.isFinite(value)?value:null;},null);
 const duration=started=>{const end=now();return started!==null&&end!==null&&end>=started?end-started:null;};
 const matches=(s,study)=>study===studyId&&scopeKeys.every(k=>own(s,k)===fixedScope[k]);
 const principal=user=>({accountId:own(user,'accountId'),authVersion:own(user,'authVersion')});
 function deliver(record){safe(()=>{const pending=emit(record);if(pending&&typeof pending.then==='function')pending.then(undefined,()=>{});},undefined);}
 function authorize(...args){
  const [tx,user,s,study,,phase='snapshot']=args,track=object(tx)&&matches(s,study),token={};
  if(object(tx))contexts.set(tx,{token});
  let value;try{value=Reflect.apply(core.authorize,this===facade?core:this,args);}catch(error){if(object(tx)&&contexts.get(tx)?.token===token)contexts.delete(tx);throw error;}
  return observeReturn(value,result=>{
   if(track&&contexts.get(tx)?.token===token){const p=principal(user);contexts.set(tx,{token,accountId:p.accountId,authVersion:p.authVersion,phase:['snapshot','dispatch','publish','export'].includes(phase)?phase:'unknown'});}
   return result;
  },()=>{if(object(tx)&&contexts.get(tx)?.token===token)contexts.delete(tx);});
 }
 function project(...args){
  const [tx,user,s,study]=args,context=object(tx)?contexts.get(tx):null;
  if(object(tx))contexts.delete(tx);
  if(!object(tx)||!matches(s,study))return Reflect.apply(core.project,this===facade?core:this,args);
  const p=principal(user),phase=context&&id(p.accountId)&&context.accountId===p.accountId&&context.authVersion===p.authVersion?context.phase??'unknown':'unknown';
  const started=now(),projectSequence=++sequence,actor=actorMetadata(user),stats=new Map(),delegates=new Map();let active=true,finished=false;
  function measured(key,fn,target,callArgs){
   if(!active)return Reflect.apply(fn,target,callArgs);
   let row=stats.get(key);if(!row){row={key,count:0,settled:0,errors:0,unobserved:0,totalMs:0,maxMs:null};stats.set(key,row);}row.count++;
   const begin=now();let settled=false;
   const done=failed=>{if(!active||settled)return;settled=true;row.settled++;if(failed)row.errors++;const elapsed=duration(begin);if(elapsed!==null){row.totalMs+=elapsed;row.maxMs=row.maxMs===null?elapsed:Math.max(row.maxMs,elapsed);}};
   try{return observeReturn(Reflect.apply(fn,target,callArgs),v=>done(false),()=>done(true),()=>{row.unobserved++;});}catch(error){done(true);throw error;}
  }
  const view=new Proxy(tx,{get(target,key){
   const value=Reflect.get(target,key,target);
   if(typeof value==='function')return(...callArgs)=>measured('raw.'+name(key),value,target,callArgs);
   if(!object(value))return value;
   if(!delegates.has(key))delegates.set(key,new Proxy(value,{get(model,method){const fn=Reflect.get(model,method,model);return typeof fn==='function'?(...callArgs)=>measured(name(key)+'.'+name(method),fn,model,callArgs):fn;}}));
   return delegates.get(key);
  }});
  function finish(outcome,value){
   if(finished)return;finished=true;const wallMs=duration(started);active=false;delegates.clear();
   const manifest=own(value,'manifest'),hash=own(value,'manifestHash'),rows=own(manifest,'rowCount'),slices=own(manifest,'slices'),calls=[...stats.values()].map(row=>({...row}));
   deliver({version:'full-study-project-observer-v1',sourceHash,projectSequence,phase,actor,scope:{...fixedScope},studyId,projectedHash:hex(hash)?hash:null,rows:Number.isSafeInteger(rows)&&rows>=0?rows:null,slices:Array.isArray(slices)?slices.length:null,wallMs,outcome,calls,pendingCalls:calls.reduce((n,row)=>n+row.count-row.settled-row.unobserved,0)});
  }
  const forwarded=[view,...args.slice(1)];
  try{return observeReturn(Reflect.apply(core.project,this===facade?core:this,forwarded),value=>finish('success',value),()=>finish('error',null),()=>{active=false;delegates.clear();});}catch(error){finish('error',null);throw error;}
 }
 const descriptors=Object.getOwnPropertyDescriptors(core);
 descriptors.authorize={value:authorize,writable:descriptors.authorize?.writable??true,enumerable:descriptors.authorize?.enumerable??true,configurable:descriptors.authorize?.configurable??true};descriptors.project={value:project,writable:descriptors.project?.writable??true,enumerable:descriptors.project?.enumerable??true,configurable:descriptors.project?.configurable??true};
 const facade=Object.create(Object.getPrototypeOf(core),descriptors);return facade;
}
