export function systemConfigTarget(pageId,search='',{configured=false,explicitDemo=false}={}){
 if(pageId!=='g05'||!configured||explicitDemo)return null;
 const query=new URLSearchParams({view:'token-reconciliation'}),values=new URLSearchParams(search).getAll('record');
 if(values.length===1&&/^[A-Za-z0-9_-]{1,200}$/.test(values[0]))query.set('record',values[0]);
 return'/pages/g02/?'+query;
}
const failure=(status,message)=>Object.assign(Error(message),{status});
function validStatus(data){
 const keys=['account','email','parser','vector','ai'];
 return data?.schema==='hub-system-status.v1'&&Number.isFinite(Date.parse(data.observedAt))&&Array.isArray(data.services)&&data.services.length===5&&new Set(data.services.map(s=>s?.key)).size===5&&data.services.every(s=>keys.includes(s?.key)&&['configured','missing','unknown'].includes(s.configuration)&&['passed','failed','unknown'].includes(s.check?.status)&&(s.check.status==='unknown'?s.check.checkedAt===null:s.configuration==='configured'&&Number.isFinite(Date.parse(s.check.checkedAt))&&Date.parse(s.check.checkedAt)<=Date.parse(data.observedAt)));
}
export function createGovernanceSystemClient({fetchImpl=globalThis.fetch}={}){
 let generation=0;const controllers=new Set();
 return{
  invalidate(){generation++;for(const c of controllers)c.abort();controllers.clear();},
  async status(){
   const seq=generation,c=new AbortController();controllers.add(c);const timeout=setTimeout(()=>c.abort(),15000);
   try{
    let r,data;
    try{r=await fetchImpl('/api/governance-system/status',{method:'GET',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',signal:c.signal,headers:{Accept:'application/json'}});}
    catch{if(seq!==generation)throw new DOMException('身份或页面已变化','AbortError');throw failure(503,'服务状态暂时无法读取，请重试。');}
    if(seq!==generation)throw new DOMException('身份或页面已变化','AbortError');
    if(!r.ok)throw failure(r.status===401?401:r.status===403?403:503,r.status===401?'登录已失效，请重新登录。':r.status===403?'当前账号无权查看系统配置。':'服务状态暂时无法读取，请重试。');
    try{data=await r.json();}catch{if(seq!==generation)throw new DOMException('身份或页面已变化','AbortError');throw failure(503,'服务状态暂时无法读取，请重试。');}
    if(seq!==generation)throw new DOMException('身份或页面已变化','AbortError');
    if(!validStatus(data))throw failure(503,'服务状态暂时无法读取，请重试。');
    return data;
   }finally{clearTimeout(timeout);controllers.delete(c);}
  }
 };
}
