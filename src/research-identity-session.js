const fields=['researchName','researchDirections','biography','orcid','publicHomepages','affiliationClaims','educationClaims','verificationPreparation'];
const messages={401:'会话已失效，请重新登录；私有资料已清除。',403:'当前身份不能执行此操作。',409:'资料版本已变化；输入仍保留，请重新核对后提交。',422:'请核对标出的科研资料。',429:'操作过于频繁，请稍后核对。'};
const fail=(code,status,extra={})=>Object.assign(new Error(messages[status]??'操作结果未确认，请保留输入并核对最近提交，不会自动重试。'),{code,status,...extra});
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const validKey=v=>typeof v==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
const version=v=>Number.isSafeInteger(v)&&v>=0;
const date=v=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
const receipt=v=>{if(v?.saved!==true||!version(v.version)||v.version<1||!['L0','L1'].includes(v.level)||!date(v.establishedAt)||(v.level==='L1')!==(v.establishedAt!==null))throw fail('IDENTITY_INVALID_RESPONSE',503,{uncertain:true});return{saved:true,version:v.version,level:v.level,establishedAt:v.establishedAt,...(v.alreadyEstablished===true?{alreadyEstablished:true}:{})};};
function safeProfile(p){
  if(!exact(p,['schemaVersion',...fields])||p.schemaVersion!==1||typeof p.researchName!=='string'||typeof p.biography!=='string'||!(p.orcid===null||typeof p.orcid==='string')||!['researchDirections','publicHomepages'].every(k=>Array.isArray(p[k])&&p[k].every(x=>typeof x==='string'))||!['affiliationClaims','educationClaims'].every(k=>Array.isArray(p[k])&&p[k].every(x=>object(x)&&typeof x.claimId==='string'&&typeof x.organizationName==='string'))||!exact(p.verificationPreparation,['professionalStatement','publicEvidenceLinks'])||typeof p.verificationPreparation.professionalStatement!=='string'||!Array.isArray(p.verificationPreparation.publicEvidenceLinks)||!p.verificationPreparation.publicEvidenceLinks.every(x=>typeof x==='string'))throw fail('IDENTITY_INVALID_RESPONSE',503);
  return structuredClone(p);
}
export function createResearchIdentityClient({enabled=false,fetchImpl=globalThis.fetch}={}){
  let epoch=0;const active=new Set();
  const invalidate=()=>{epoch++;for(const c of active)c.abort();active.clear();};
  async function request(suffix,method,body){
    if(!enabled)throw fail('IDENTITY_NOT_CONFIGURED',503);const current=epoch,c=new AbortController();active.add(c);const timeout=setTimeout(()=>c.abort(),15000);
    try{
      let res,data;
      try{res=await fetchImpl('/api/account-access/'+suffix,{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:c.signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});data=await res.json();}
      catch{if(epoch!==current)throw new DOMException('身份已切换','AbortError');throw fail('IDENTITY_NETWORK',503,{uncertain:method!=='GET'});}
      if(epoch!==current)throw new DOMException('身份已切换','AbortError');
      if(!res.ok){const errors=object(data?.fieldErrors)?Object.fromEntries(Object.entries(data.fieldErrors).filter(([k,v])=>fields.some(f=>k===f||k.startsWith(f+'.'))&&typeof v==='string').map(([k,v])=>[k,v.slice(0,200)])):{};throw fail(typeof data?.code==='string'?data.code:'IDENTITY_UNAVAILABLE',res.status,{fieldErrors:errors,uncertain:res.status>=500&&method!=='GET'});}
      return data;
    }finally{clearTimeout(timeout);active.delete(c);}
  }
  function command(v,save=false){if(!exact(v,save?['expectedVersion','requestKey','changes']:['expectedVersion','requestKey'])||!version(v.expectedVersion)||!validKey(v.requestKey)||(save&&(!object(v.changes)||Object.keys(v.changes).some(k=>!fields.includes(k)))))throw fail('IDENTITY_INVALID_INPUT',400);return v;}
  return Object.freeze({configured:enabled,invalidate,
    read:async()=>{const d=await request('research-profile','GET');if(!version(d?.version)||!date(d.establishedAt)||!['L0','L1'].includes(d.level)||(d.level==='L1')!==(d.establishedAt!==null)||d.verificationStage!=='NOT_OPEN'||d.sourceType!=='SELF_DECLARED'||!Array.isArray(d.missingFields)||d.missingFields.some(k=>!['researchName','researchDirections'].includes(k)))throw fail('IDENTITY_INVALID_RESPONSE',503);return{profile:safeProfile(d.profile),version:d.version,establishedAt:d.establishedAt,level:d.level,missingFields:d.missingFields,verificationStage:'NOT_OPEN',sourceType:'SELF_DECLARED'};},
    save:async v=>receipt(await request('research-profile','PATCH',command(v,true))),
    establish:async v=>receipt(await request('research-profile/establishments','POST',command(v))),
    receipt:async(key,base)=>{if(!validKey(key)||!version(base))throw fail('IDENTITY_INVALID_INPUT',400);return receipt(await request(`research-profile/receipts/${key}?baseVersion=${base}`,'GET'));},
  });
}
export function profileToForm(p){return{researchName:p.researchName,researchDirections:p.researchDirections.join('；'),biography:p.biography,orcid:p.orcid??'',publicHomepages:p.publicHomepages.join('\n'),affiliationClaims:structuredClone(p.affiliationClaims),educationClaims:structuredClone(p.educationClaims),professionalStatement:p.verificationPreparation.professionalStatement,publicEvidenceLinks:p.verificationPreparation.publicEvidenceLinks.join('\n')};}
export function formToChanges(f){const lines=s=>s.split('\n').map(v=>v.trim()).filter(Boolean);return{researchName:f.researchName.trim(),researchDirections:f.researchDirections.split(/[；;\n]/).map(v=>v.trim()).filter(Boolean),biography:f.biography.trim(),orcid:f.orcid.trim()||null,publicHomepages:lines(f.publicHomepages),affiliationClaims:structuredClone(f.affiliationClaims),educationClaims:structuredClone(f.educationClaims),verificationPreparation:{professionalStatement:f.professionalStatement.trim(),publicEvidenceLinks:lines(f.publicEvidenceLinks)}};}
