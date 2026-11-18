const invalid=()=>Object.assign(new Error('省市字典暂不可用，请重试；已有输入不会被替换。'),{code:'REFERENCE_UNAVAILABLE'});
export function createDivisionClient({fetchImpl=globalThis.fetch}={}){
 let generation=0;const controllers=new Set();
 const invalidate=()=>{generation++;for(const c of controllers)c.abort();controllers.clear();};
 async function list(parentCode){
  if(parentCode!==undefined&&(typeof parentCode!=='string'||!/^\d{2}0000$/.test(parentCode)))throw invalid();
  const n=generation,c=new AbortController();controllers.add(c);const timer=setTimeout(()=>c.abort(),20000);
  try{const r=await fetchImpl('/api/reference/administrative-divisions'+(parentCode?'?parentCode='+parentCode:''),{credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:c.signal}),d=await r.json();
   if(n!==generation)throw new DOMException('身份或省份已变化','AbortError');
   if(!r.ok||typeof d?.version!=='string'||!/^MCA-\d{4}-\d{2}-\d{2}$/.test(d.version)||!Array.isArray(d.items)||d.items.length>100||d.items.some(x=>typeof x.code!=='string'||!/^\d{6}$/.test(x.code)||typeof x.name!=='string'||!x.name)||new Set(d.items.map(x=>x.code)).size!==d.items.length)throw invalid();return d;
  }catch(e){if(n!==generation)throw new DOMException('身份或省份已变化','AbortError');if(e.name==='AbortError')throw invalid();throw invalid();}
  finally{clearTimeout(timer);controllers.delete(c);}
 }
 return Object.freeze({list,invalidate});
}
