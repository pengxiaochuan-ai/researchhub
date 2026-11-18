import {draftInput,only,fail} from './policy.mjs';
// Accept the server's normalized draft on a round trip without accepting a caller-defined resource identity.
export function normalizeDraft(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return draftInput(value);
 const result={...value};
 if(Array.isArray(value.resources))result.resources=value.resources.map((resource,index)=>{if(!resource||typeof resource!=='object')return resource;const {key,...input}=resource;if(key!==undefined&&key!==String(index+1))fail(400,'CONTENT_INPUT_INVALID','资料标识无效。');return input;});
 if(value.event&&typeof value.event==='object'){const {timezone,...input}=value.event;if(timezone!==undefined&&timezone!=='Asia/Shanghai')fail(400,'CONTENT_INPUT_INVALID','活动时区无效。');result.event=input;}
 return draftInput(result);
}
export function operationPayload(action,id,body){
 if(!['create','save','publish','withdraw'].includes(action))fail(400,'CONTENT_INPUT_INVALID','操作类型无效。');
 const fields=action==='create'?['requestKey','draft']:action==='save'?['requestKey','baseRevision','draft']:action==='withdraw'?['requestKey','baseRevision','reason']:['requestKey','baseRevision'];only(body,fields);
 const input={requestKey:body.requestKey,...(action!=='create'?{baseRevision:body.baseRevision}:{})};
 if(action==='create'||action==='save')input.draft=normalizeDraft(body.draft);
 if(action==='withdraw')input.reason=typeof body.reason==='string'?body.reason.trim():body.reason;
 return{action,contentId:id??null,body:input};
}
export const canonicalContent=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
