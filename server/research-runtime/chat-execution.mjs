import {AsyncLocalStorage} from 'node:async_hooks';

export const BOUNDED_CHAT_CORE='85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135';
export const KNOWLEDGE_CHAT_CORE='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669';
export const supportsBoundedChatCore=(core,budget)=>core===BOUNDED_CHAT_CORE&&budget?.admission?.schema==='hub-chat-admission.v1'||core===KNOWLEDGE_CHAT_CORE&&(
 budget?.admission?.schema==='hub-chat-admission.v1'&&budget.admission.coreDigest===BOUNDED_CHAT_CORE||budget?.admission?.schema==='hub-chat-admission.v2'&&budget.admission.coreDigest===KNOWLEDGE_CHAT_CORE);
const deny=()=>{throw Object.assign(Error('HUB_CHAT_EXECUTION_NOT_ADMITTED'),{code:'HUB_CHAT_EXECUTION_NOT_ADMITTED',status:403});};

// The sealed core is unchanged. Intercept the actual per-candidate credential
// boundary immediately before its single fetch, not just its public chat method.
export function createBoundedChatProvider({raw,budget,coreDigest,unknownError=(detail,route)=>Object.assign(Error(detail),{code:'MODEL_OUTCOME_UNKNOWN',route}),diagnostic=()=>{}}){
 if(!supportsBoundedChatCore(coreDigest,budget)||!['chat','credentials','candidates'].every(k=>typeof raw?.[k]==='function'))deny();
 const context=new AsyncLocalStorage(),nativeChat=raw.chat.bind(raw),credentials=raw.credentials.bind(raw);
 raw.candidates=model=>{const current=context.getStore();if(!current||model!==current.model)deny();return[{...model,fallbacks:undefined}];};
 raw.credentials=model=>{
  const current=context.getStore();if(!current||model.provider!=='deepseek'||model.model!==budget.admission.model.model||model.maxTokens!==current.model.maxTokens||model.maxTokens>budget.admission.model.maxOutputTokens||model.secretRef&&model.secretRef!=='DEEPSEEK_API_KEY')deny();
  const value=credentials(model);
  if(value?.baseUrl!==budget.admission.model.baseUrl||typeof value.apiKey!=='string'||!value.apiKey)deny();
  current.dispatch=budget.reserveDispatch(current.proof,current.messages,model);
  return value;
 };
 // Do not let provider error bodies/connection errors leak into shared logs.
 raw.logger={warn:()=>diagnostic('HUB_CHAT_PROVIDER_REQUEST_FAILED')};
 const provider=Object.freeze({
  get hasKey(){return raw.hasKey===true;},
  async chat(messages,model,options){
   const current=context.getStore();if(!current)deny();
   if(!Array.isArray(messages)||model?.provider!=='deepseek'||model.model!==budget.admission.model.model)deny();
   await current.proof.assertExecution();
   const maximum=model.maxTokens??budget.admission.model.maxOutputTokens;if(!Number.isSafeInteger(maximum)||maximum<1)deny();
   const selected={...model,maxTokens:Math.min(maximum,budget.admission.model.maxOutputTokens),fallbacks:undefined};
   const turn={...current,messages,model:selected,dispatch:null};
   return context.run(turn,async()=>{
    let result;
    try{result=await nativeChat(messages,selected,options);if(!turn.dispatch||result.usedMock===true)deny();budget.settle(turn.dispatch.id,result.usage);return result;}
    catch(error){
     if(turn.dispatch){try{budget.markUnknown(turn.dispatch.id);}catch{}if(result?.usage){const failure=unknownError('hub_budget_publication_failed',result.route??{model:selected.model,fallbackIndex:0});failure.knownUsage=result.usage;throw failure;}}
     throw error;
    }
   });
  },
  chatWithTools:async()=>deny(),chatJson:async()=>deny(),getBalance:async()=>null,
 });
 return{
  provider,
  async withExecution(proof,operation){
   if(typeof proof?.assertExecution!=='function'||!budget.admission.accounts.includes(proof.accountId)||proof.tenantId!==budget.admission.tenantId)deny();
   await proof.assertExecution();return context.run({proof},operation);
  },
 };
}

export function fenceBoundedChatQueue(instance,budget,coreDigest){
 if(!supportsBoundedChatCore(coreDigest,budget)||!['scopeWhere','claimNext','processSession','resumePending'].every(k=>typeof instance?.[k]==='function'))deny();
 const claiming=new AsyncLocalStorage();
 instance.scopeWhere=()=>{const scope=budget.claimScope();return claiming.getStore()?{...scope,AND:[...scope.AND,{attempts:0}]}:scope;};
 const claim=instance.claimNext.bind(instance);
 instance.claimNext=(sessionId,...args)=>budget.canClaim(sessionId)?claiming.run(true,()=>claim(sessionId,...args)):Promise.resolve(null);
 const resume=instance.resumePending.bind(instance);instance.resumePending=(...args)=>claiming.run(true,()=>resume(...args));
 if(typeof instance.scheduleSession==='function'){const schedule=instance.scheduleSession.bind(instance);instance.scheduleSession=(...args)=>claiming.exit(()=>schedule(...args));}
 // One owned queue instance is registered in the one API container. Serializing
// its two admitted sessions avoids a paid-in-flight conflict; native CAS/leases
// and terminal handling remain untouched. No automatic Provider retry is added.
 const process=instance.processSession.bind(instance);let tail=Promise.resolve();
 instance.processSession=(...args)=>{const result=tail.then(()=>process(...args));tail=result.catch(()=>{});return result;};
 return instance;
}
