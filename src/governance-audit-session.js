export function createGovernanceAuditClient({fetchImpl=globalThis.fetch}={}){
 async function request(path){let r;try{r=await fetchImpl('/api/governance-audit'+path,{credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});}catch{throw Object.assign(Error('连接中断或超时，请重试读取审计记录。'),{status:0});}let data;try{data=await r.json();}catch{throw Object.assign(Error('审计记录暂时无法读取，请重试。'),{status:503});}if(!r.ok)throw Object.assign(Error(data.message||'审计记录暂时无法读取。'),{status:r.status});return data;}
 return{list:query=>request('?'+new URLSearchParams(Object.entries(query).filter(([,v])=>v!==''&&v!==undefined))),detail:id=>request('/'+encodeURIComponent(id))};
}
// Both list and detail share this epoch: a refresh, identity change or filter
// replacement invalidates every result captured for the previous collection.
export function createAuditEpoch(){let n=0;return{advance:()=>++n,current:()=>n,isCurrent:v=>v===n};}
export function readAuditFilters(search=''){
 const q=new URLSearchParams(search),result={take:20,skip:0};
 for(const k of ['action','target','cursor'])if(q.get(k))result[k]=q.get(k);
 if(/^[1-9]\d{0,4}$/.test(q.get('skip')??''))result.skip=Number(q.get('skip'));
 return result;
}
