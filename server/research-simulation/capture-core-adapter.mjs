import {Module,createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createResearchFormAdapter} from '../research-capture/form-core-adapter.mjs';
const source=name=>fileURLToPath(new URL('../../../app/server/src/study-operations/'+name+'.ts',import.meta.url));
const names=['formal-response-writer','formal-response-commands','study-outreach.service','formal-response-assignment','formal-outreach','study-forms.service'];
const privateFiles=new Set(names.map(source)),lockPath=source('formal-response-lock'),policyPath=source('study-forms-policy'),writerPath=source('formal-response-writer'),outreachServicePath=source('study-outreach.service');
/** Trusted composition only. No global source/cache mutation, new transactions or clock replacement. */
export function createSimulationCaptureAdapter({require,load,simulation,policy}){
 if(typeof require!=='function'||typeof load!=='function'||typeof simulation?.guardVisitSchedule!=='function')throw Error('SIMULATION_CAPTURE_DEPENDENCIES_REQUIRED');
 const compiler=require.extensions?.['.ts'];if(typeof compiler!=='function')throw Error('SIMULATION_CAPTURE_TYPESCRIPT_UNAVAILABLE');
 const formPolicy=policy??createResearchFormAdapter({require,load}).policy,originalLock=require(lockPath),cache=new Map(),operation=new AsyncLocalStorage();
 async function guardSchedule(tx,scope,visitId,{operation:kind='submit'}={}){
  await originalLock.assertVisitCaptureSchedule(tx,scope,visitId);
  if(!visitId)return;
  return simulation.guardVisitSchedule(tx,scope,visitId,{operation:kind});
 }
 function lockExports(caller){
  // H5 reads, current-session authorization and original receipt GET execute this
  // anchor check before the writer sees its receipt. Keep them stage-neutral.
  if(caller===outreachServicePath)return originalLock;
  const kind=caller===source('formal-response-assignment')||caller===source('study-forms.service')?'assign':caller===source('formal-outreach')?'outreach':null;
  return{...originalLock,assertVisitCaptureSchedule:(tx,scope,visitId)=>guardSchedule(tx,scope,visitId,{operation:kind??operation.getStore()?.kind??'submit'})};
 }
 function correctionAfterReceipt(tx,context){
  return new Proxy(tx,{get(target,key){const value=Reflect.get(target,key,target);if(key!=='$queryRaw')return typeof value==='function'?value.bind(target):value;
   return async(...args)=>{const result=await value.apply(target,args),strings=args[0];
    if(Array.isArray(strings)&&strings.join('').includes('FROM public.form_response_command_receipt')&&Array.isArray(result)&&result.length===0){
     // The real writer has already checked current binding and locked response.
     // A known original receipt returns before this new-operation guard.
     const assignment=await target.formAssignment.findFirst({where:{...context.scope,id:context.assignmentId,acceptanceFixture:false},select:{subjectVisitId:true}});
     await guardSchedule(target,context.scope,assignment?.subjectVisitId,{operation:'correct'});
    }
    return result;
   };
  }});
 }
 function privateModule(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const resolver=createRequire(filename),instance=new Module(filename);instance.filename=filename;
  instance.require=specifier=>{const path=resolver.resolve(specifier);if(path===policyPath)return formPolicy;if(path===lockPath)return lockExports(filename);if(privateFiles.has(path))return privateModule(path);return resolver(specifier);};
  cache.set(filename,instance);
  try{compiler(instance,filename);instance.loaded=true;
   if(filename===writerPath){const native=instance.exports.writeFormalResponseInTransaction;instance.exports.writeFormalResponseInTransaction=(tx,context,command)=>operation.run({kind:command.kind},()=>native(command.kind==='correct'?correctionAfterReceipt(tx,context):tx,context,command));}
   return instance.exports;
  }catch(error){cache.delete(filename);throw error;}
 }
 function simulationLoad(path,name){
  if(path==='study-operations/study-forms-policy')return formPolicy[name];
  if(path==='study-operations/formal-response-lock')return lockExports(null)[name];
  const filename=path.startsWith('study-operations/')?source(path.slice('study-operations/'.length)):null;
  return filename&&privateFiles.has(filename)?privateModule(filename)[name]:load(path,name);
 }
 return{load:simulationLoad,policy:formPolicy,guardSchedule};
}
