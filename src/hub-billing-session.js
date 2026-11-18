const failure=(status,message,uncertain=false)=>Object.assign(Error(message),{status,uncertain});
export function createHubBillingClient({fetchImpl=globalThis.fetch}={}){
 let generation=0;const controllers=new Set();
 const invalidate=()=>{generation++;for(const c of controllers)c.abort();controllers.clear();};
 async function request(path,body){
  const seq=generation,c=new AbortController();controllers.add(c);const timer=setTimeout(()=>c.abort(),20000);
  try{
   let r,data;
   try{r=await fetchImpl('/api/hub-billing/'+path,{method:body?'POST':'GET',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',signal:c.signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});data=await r.json();}
   catch{if(seq!==generation)throw new DOMException('身份或页面已变化','AbortError');throw failure(503,'连接暂不可用，结果尚未确认；请核对原提交。',!!body);}
   if(seq!==generation)throw new DOMException('身份或页面已变化','AbortError');
   if(!r.ok)throw failure(r.status,typeof data?.message==='string'?data.message:'用量服务暂时不可用，请重试。',!!body&&r.status>=500);
   if(!data||typeof data!=='object'||Array.isArray(data))throw failure(503,'返回结果无法核对，请重试。',!!body);
   return data;
  }finally{clearTimeout(timer);controllers.delete(c);}
 }
 const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(value))throw failure(400,'记录标识无效。');return value;};
 return{invalidate,me:()=>request('me'),list:query=>request('reconciliations?'+new URLSearchParams(query)),detail:value=>request('reconciliations/'+id(value)),resolve:(value,input)=>request('reconciliations/'+id(value)+'/resolve',input)};
}
