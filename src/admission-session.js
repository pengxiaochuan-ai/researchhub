export const ADMISSION_PAGE='/pages/p006/?section=admission';
const base='/api/hubs/lingshu-xinyu/admission';
const states=new Set(['pending','needs_information','approved','rejected','unregistered']);
const nextStatus={approve:'approved',needs_information:'needs_information',reject:'rejected',supplement:'pending',resubmit:'pending'};
const resultMatches=(value,body,id)=>value&&typeof value.id==='string'&&(!id||value.id===id)&&value.status===nextStatus[body.action]&&value.revision===body.baseRevision+1&&Number.isSafeInteger(value.materialVersion)&&value.materialVersion>0&&typeof value.allowResubmit==='boolean';
const application=value=>value&&typeof value.id==='string'&&typeof value.accountId==='string'&&states.has(value.status)&&value.status!=='unregistered'&&Number.isSafeInteger(value.revision)&&value.revision>0&&typeof value.material?.registration?.displayName==='string';
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const decisionBody=body=>({...body,reason:(body.reason??'').trim(),allowResubmit:body.allowResubmit??false});
async function proofOf(operation){
 const body=['approve','needs_information','reject'].includes(operation.body.action)?decisionBody(operation.body):{...operation.body,text:operation.body.text.trim()};
 const value=['approve','needs_information','reject'].includes(body.action)?{id:operation.id,...body}:body;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
 return{applicationId:operation.id,action:body.action,baseRevision:String(body.baseRevision),requestHash:[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
export function createAdmissionClient({fetchImpl=globalThis.fetch}={}){
 async function request(path,method='GET',body,{signal}={}){
  let response,data;
  try{response=await fetchImpl(path,{method,credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
  catch(e){throw Object.assign(Error('连接中断，结果尚未确认，请先核对。'),{code:'HUB_ADMISSION_NETWORK',unknown:method!=='GET',cause:e});}
  try{data=await response.json();}catch{throw Object.assign(Error('结果无法确认，请重新核对。'),{unknown:method!=='GET',status:response.status});}
  if(!response.ok)throw Object.assign(Error(data.message??'加入审核暂时不可用，请重试。'),{code:data.code,status:response.status,unknown:method!=='GET'&&response.status>=500});
  return data;
 }
 return Object.freeze({
  async self(options){const data=await request(base,'GET',undefined,options);if(!states.has(data?.status)||typeof data.accountId!=='string'||!data.accountId||data.status!=='unregistered'&&(!Number.isSafeInteger(data.revision)||data.revision<1||typeof data.id!=='string'||typeof data.material?.registration?.displayName!=='string'))throw Error('加入状态无法确认，请重新核对。');return data;},
  async list(query){const value=await request(base+'s?'+new URLSearchParams(query));if(!Array.isArray(value?.items)||!value.items.every(application)||!Number.isSafeInteger(value.page)||value.page<1||!Number.isSafeInteger(value.total)||value.total<0)throw Error('申请列表无法确认，请重新读取。');return value;},
  async detail(id){const value=await request(base+'s/'+encodeURIComponent(id));if(!application(value)||value.id!==id||!Array.isArray(value.events))throw Error('申请资料无法确认，请重新读取。');return value;},
  async decide(id,body){const value=await request(base+'s/'+encodeURIComponent(id)+'/decisions','POST',decisionBody(body));if(!resultMatches(value,body,id))throw Object.assign(Error('审核结果无法确认，请先核对原决定。'),{unknown:true});return value;},
  async submit(body){const value=await request(base+'/submissions','POST',body);if(!resultMatches(value,body))throw Object.assign(Error('提交结果无法确认，请先核对原提交。'),{unknown:true});return value;},
  async operation(value){
   const key=typeof value==='string'?value:value.body.requestKey,proof=typeof value==='string'?null:await proofOf(value);
   const result=await request(base+'/operations/'+encodeURIComponent(key)+(proof?'?'+new URLSearchParams(proof):''));
   if(proof&&(!['committed','unsubmitted','superseded'].includes(result.state)||result.requestKey!==key||result.applicationId!==proof.applicationId||result.action!==proof.action||String(result.baseRevision)!==proof.baseRevision||result.requestHash!==proof.requestHash))throw Error('原回执与当前操作无法匹配，请保留原输入后核对。');
   if(proof&&(result.state==='committed'&&!resultMatches(result.result,value.body,value.id)||result.state==='unsubmitted'&&result.revision!==value.body.baseRevision||result.state==='superseded'&&(!Number.isSafeInteger(result.revision)||result.revision<=value.body.baseRevision||!states.has(result.status))))throw Error('原回执与当前操作无法匹配，请保留原输入后核对。');
   return result;
  },
 });
}
