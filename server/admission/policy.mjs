import {createHash} from 'node:crypto';
export const HUB_KEY='lingshu-xinyu';
export const POLICY_VERSION='f01-v0.3';
export const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
export const requestHash=value=>createHash('sha256').update(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)).digest('hex');
export function only(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k)))fail(400,'HUB_ADMISSION_INPUT_INVALID','请核对本次输入。');}
const text=(v,required)=>{if(v===undefined&&!required)return '';if(typeof v!=='string'||[...v.trim()].length>(500)||required&&!v.trim())fail(400,'HUB_ADMISSION_INPUT_INVALID','请填写具体说明（1–500字符）。');return v.trim();};
function mutation(input){if(!Number.isSafeInteger(input.baseRevision)||input.baseRevision<1||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.requestKey))fail(400,'HUB_ADMISSION_INPUT_INVALID','操作信息无效，请重新核对当前申请。');}
export function decisionInput(input){only(input,['action','reason','baseRevision','requestKey','allowResubmit']);mutation(input);if(!['approve','needs_information','reject'].includes(input.action)||input.allowResubmit!==undefined&&typeof input.allowResubmit!=='boolean'||input.allowResubmit===true&&input.action!=='reject')fail(400,'HUB_ADMISSION_INPUT_INVALID','请选择有效审核决定。');return {action:input.action,reason:text(input.reason,input.action!=='approve'),baseRevision:input.baseRevision,requestKey:input.requestKey,allowResubmit:input.allowResubmit??false};}
export function submissionInput(input){only(input,['action','text','baseRevision','requestKey']);mutation(input);if(!['supplement','resubmit'].includes(input.action))fail(400,'HUB_ADMISSION_INPUT_INVALID','当前补充操作无效。');return {...input,text:text(input.text,true)};}
export function transition(state,action){const next={pending:{approve:'approved',needs_information:'needs_information',reject:'rejected'},needs_information:{supplement:'pending'},rejected:{resubmit:'pending'}}[state]?.[action];if(!next)fail(409,'HUB_ADMISSION_STATE_CONFLICT','申请状态已变化，请核对最新结果。');return next;}
export const registrationMaterial=a=>({displayName:a.displayName,email:a.emailNormalized??null});
export function admissionException(method,path,hubKey=HUB_KEY){
 if(method==='GET'&&path==='/api/auth/me')return true;
 if(['GET','PATCH'].includes(method)&&path==='/api/account-access/profile')return true;
 const base='/api/hubs/'+hubKey+'/admission';
 return method==='GET'&&(path===base||new RegExp('^'+base+'/operations/[A-Za-z0-9_-]{8,128}$').test(path))||method==='POST'&&path===base+'/submissions';
}
