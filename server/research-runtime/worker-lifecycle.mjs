// Adapt only instances owned by this standalone runtime. The legacy class and
// worker publication/claim contracts remain unchanged.
export function boundWorkerLifecycle(instance,stopGates){
 if(typeof instance.enabled!=='function')throw Error('RUNTIME_WORKER_LIFECYCLE_UNSUPPORTED');
 let live=true;
 const enabled=instance.enabled.bind(instance),destroy=instance.onModuleDestroy?.bind(instance);
 const stop=()=>{live=false;};stopGates.push(stop);
 instance.enabled=(...args)=>live&&enabled(...args);
 instance.onModuleDestroy=()=>{stop();return destroy?.();};
 return instance;
}
export function disabledEmbeddings(){return Object.freeze({dim:512,embed:async()=>null,embedOne:async()=>null,healthy:async()=>false});}
export function disabledModelExecution(){
 const blocked=async()=>{throw Object.assign(Error('科研AI尚未配置启用。'),{code:'RESEARCH_RUNTIME_AI_NOT_ENABLED',status:503});};
 return{provider:Object.freeze({hasKey:false,chat:blocked,chatJson:blocked,chatWithTools:blocked,getBalance:async()=>null}),pool:Object.freeze({available:()=>false,acquire:blocked,onModuleDestroy:async()=>{}})};
}
