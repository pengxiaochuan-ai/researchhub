import {createHash} from 'node:crypto';
export const researchError=(status,code,message)=>Object.assign(new Error(message),{status,code});
export const invalid=()=>{throw researchError(400,'RESEARCH_INPUT_INVALID','请检查课题内容后重试，输入已保留。');};
export function only(input,keys){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))invalid();}
function text(value,max,fallback=''){if(value===undefined)return fallback;if(typeof value!=='string'||value.length>max||value.includes('\u0000'))invalid();return value.trim();}
export function normalizeIntent(input,{partial=false}={}){
 only(input,['title','question','pico','researchType','hubKey']);const out={};
 if(!partial||Object.hasOwn(input,'title')){out.title=text(input.title,300);if(!out.title)invalid();}
 if(!partial||Object.hasOwn(input,'question'))out.question=text(input.question,20000);
 if(!partial||Object.hasOwn(input,'pico')){const pico=input.pico??{};only(pico,['p','i','c','o']);out.pico=Object.fromEntries(['p','i','c','o'].map(k=>[k,text(pico[k],10000)]));}
 if(!partial||Object.hasOwn(input,'researchType'))out.researchType=text(input.researchType,100);
 if(!partial||Object.hasOwn(input,'hubKey')){out.hubKey=input.hubKey===null?null:text(input.hubKey,160,null);if(out.hubKey!==null&&!/^[A-Za-z0-9_-]+$/.test(out.hubKey))invalid();}
 return out;
}
export function validateMutation(input,version=false){if(typeof input?.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey))invalid();if(version&&(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1))invalid();return input;}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const requestHash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const isTenantAdmin=user=>user.role==='tenant_admin'&&user.isTenantAdmin===true;
export function selectCreationGroup(groups,id){if(id!==undefined&&typeof id!=='string')invalid();const chosen=id?groups.find(g=>g.id===id):groups.length===1?groups[0]:null;if(!chosen)throw researchError(groups.length?400:403,groups.length?'RESEARCH_GROUP_REQUIRED':'RESEARCH_CREATION_SCOPE_REQUIRED',groups.length?'请选择一个可创建研究的课题组。':'课题草稿已保留，请联系租户管理员配置研究创建权限。');return chosen;}
