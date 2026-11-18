export const reviewVisibilityNames={public:'公开页面与AI',tenant:'仅租户内页面与AI',withheld:'暂不放行',public_display:'公开展示；AI未获准'};
export const isDecidedReview=item=>['public','tenant','withheld','public_display'].includes(item.state.status);
export const isPendingReview=item=>['pending','partial','changed'].includes(item.state.status);
// Presentation only: never use this explanation to authorize content or change review status.
export function sourceReviewCopy(item,now=Date.now()) {
  if(item?.state?.status!=='partial')return {label:item?.state?.label||'',summary:''};
  const fallback={label:'展示与AI范围待确认',summary:'请核对当前内容的页面展示与AI使用范围。'};
  const detail=item.detail,decisions=detail?.decisions;
  if(item.kind!=='external'||!Array.isArray(decisions)||!decisions.length)return fallback;
  const matches=(field,purpose)=>decisions.filter(d=>d?.fieldKind===field&&d.purpose===purpose);
  const bibliographic=matches('bibliographic','display');
  if(bibliographic.length!==1)return fallback;
  const effective=d=>d?.decision==='approve'&&['public','tenant'].includes(d.audience)&&
    (d.expiresAt==null||Number.isFinite(Date.parse(d.expiresAt))&&Date.parse(d.expiresAt)>now);
  const display=[bibliographic[0]];
  for(const [key,field]of [['structuredExtraction','registry_details'],['guidanceExtraction','guidance_clauses']]){
    if(detail[key]){const d=detail[key].review;display.push(d?.fieldKind===field&&d.purpose==='display'?d:null);}
  }
  const reference=bibliographic[0].evidenceRef;
  const unifiedReference=reference?.startsWith('evidence://hub-review/')||
    detail.structuredExtraction&&reference?.startsWith('evidence://hub-display/');
  const approved=display.every(effective)&&display.every(d=>d.audience===display[0].audience)&&
    (!unifiedReference||display.every(d=>d.evidenceRef===reference));
  const displayText=approved?`页面展示已批准（${display[0].audience==='public'?'公开':'仅本租户'}）`:
    display.some(effective)?'部分内容已有展示批准，展示范围需确认':'页面展示范围需确认';
  const ai=matches('bibliographic','ai_retrieval');
  let aiLabel='AI范围待确认',aiText='AI使用范围需确认';
  if(!ai.length){aiLabel='AI未授权';aiText='AI检索尚未授权';}
  else if(ai.length===1){
    const d=ai[0];
    if(d.decision==='revoke'){aiLabel='AI已撤回';aiText='AI检索已撤回';}
    else if(d.decision==='approve'&&d.expiresAt!=null&&Number.isFinite(Date.parse(d.expiresAt))&&Date.parse(d.expiresAt)<=now){aiLabel='AI授权已过期';aiText='AI检索授权已过期';}
    else if(effective(d))aiText='AI检索已有批准，当前内容范围待确认';
  }
  return {label:`${approved?'展示已批准':'展示范围待确认'} · ${aiLabel}`,summary:`${displayText}；${aiText}。`};
}
export function filterReviewQueue(items,{kind='all',status='pending',q=''}={}) {
  const query=q.trim().toLocaleLowerCase();
  return items.filter(item=>(kind==='all'||item.kind===kind) &&
    (status==='all'||(status==='pending'?isPendingReview(item):isDecidedReview(item))) &&
    (!query||[item.title,item.subtitle].some(value=>String(value||'').toLocaleLowerCase().includes(query))));
}
export function nextPendingKey(items,currentKey,filters={}) {
  const candidates=new Set(filterReviewQueue(items,{...filters,status:'pending'}).map(x=>x.key));
  const index=items.findIndex(x=>x.key===currentKey);
  for(let offset=1;offset<=items.length;offset++) {
    const item=items[(index+offset+items.length)%items.length];
    if(item&&item.key!==currentKey&&candidates.has(item.key)) return item.key;
  }
  return null;
}
export function nextPendingAfterSave(items,currentKey,filters={}) {
  return filters.status==='decided'?null:nextPendingKey(items,currentKey,filters);
}
// A display-name refresh is not a new editing session. Never use this key as authorization.
export function sourceReviewIdentityKey(identity) {
  if(identity?.authenticated!==true||identity.status!=='authenticated'||typeof identity.id!=='string'||!identity.id||identity.mode!=='real')return null;
  return JSON.stringify([identity.id,identity.authVersion??null,identity.mode]);
}
