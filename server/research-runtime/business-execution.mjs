import {AsyncLocalStorage} from 'node:async_hooks';

// Native Sessions/Billing own permission, quota reservation and settlement.
// This wrapper retains the live task fence without a second acceptance quota.
export function createBusinessExecution({raw,unknownError=(detail,route)=>Object.assign(Error(detail),{code:'MODEL_OUTCOME_UNKNOWN',route})}){
 const context=new AsyncLocalStorage();
 const current=()=>{
  const proof=context.getStore();
  if(typeof proof?.assertExecution!=='function')throw Error('HUB_CURRENT_EXECUTION_REQUIRED');
  return proof;
 };
 const provider=new Proxy(raw,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(['chat','chatWithTools','chatJson'].includes(key)&&typeof value==='function')return async(...args)=>{
   const proof=current();await proof.assertExecution();
   const result=await value.apply(target,args);
   try{await proof.assertExecution();}catch(error){
    if(!result?.usage)throw error;
    const failure=unknownError('hub_execution_revoked_after_response',result.route??{model:args[1]?.model,fallbackIndex:0});
    failure.knownUsage=result.usage;throw failure;
   }
   return result;
  };
  return typeof value==='function'?value.bind(target):value;
 }});
 return{provider,get active(){return Boolean(context.getStore());},guardFetch:fetch=>async(...args)=>{
  const proof=context.getStore();if(proof)await proof.assertExecution();
  if(proof?.dispatch||proof?.validateRequest){const body=JSON.parse(args[1]?.body??'null');await proof.validateRequest?.(args[0],body);const response=proof.dispatch?await proof.dispatch(()=>fetch(...args),body?.model):await fetch(...args);await proof.observeResponse?.(response);return response;}
  return fetch(...args);
 },withExecution:async(proof,operation)=>{
  if(typeof proof?.assertExecution!=='function')throw Error('HUB_CURRENT_EXECUTION_REQUIRED');
  await proof.assertExecution();return context.run(proof,operation);
 }};
}
