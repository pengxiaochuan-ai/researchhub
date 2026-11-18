// Hub asset semantics only. No initialization, database, model, or old lifecycle side effects.
export const CATALOG_ASSET_PREFIX='rh-research-asset:catalog-20261112:';
export const CATALOG_KINDS=Object.freeze(['protocol','dataset','instrument','analysis','publication']);
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const text=value=>typeof value==='string'&&value.trim().length>0;
export function catalogError(code,status,message){return Object.assign(new Error(message),{code:'ASSET_CATALOG_'+code,status});}
const reject=(code,status=400,message='资产请求无效，请核对输入。')=>{throw catalogError(code,status,message);};
const sameScope=(a,b)=>scopeKeys.every(k=>text(a?.[k])&&a[k]===b?.[k]);
const people=value=>Array.isArray(value)&&value.length<=2&&value.every(id)&&new Set(value).size===value.length;
export function assetTrashBlock(record,records){
 const r=record.registry;
 if(r.workingState!=='draft'||r.everSubmitted||r.releaseState!=='unreleased'||record.grants.length||record.events.some(e=>!['created','revised','trashed','restored'].includes(e.type)))return'已有提交、发布、申请或引用历史，不能回收。';
 if(records.some(other=>other.registry.assetId!==r.assetId&&other.policies.some(p=>p.sourceBindings?.some(b=>b.kind==='artifact'&&b.id===r.assetId))))return'仍被其他资产固定版本引用，不能回收。';
 return null;
}

export function assertAssetCatalogInput(query){
 const allowed=['q','kind','domain','status','scope','source','page','pageSize','sort','direction'];
 let entries;
 if(query instanceof URLSearchParams)entries=[...query];
 else if(query&&typeof query==='object'&&!Array.isArray(query))entries=Object.entries(query);
 else reject('INPUT_INVALID');
 if(entries.some(([k,v])=>!allowed.includes(k)||typeof v!=='string')||new Set(entries.map(([k])=>k)).size!==entries.length)reject('INPUT_INVALID');
 const q=Object.fromEntries(entries),pick=(k,values,fallback)=>{const value=q[k]??fallback;if(!values.includes(value))reject('INPUT_INVALID');return value;};
 const number=(k,fallback,max)=>{const value=q[k]??String(fallback);if(!/^[1-9][0-9]*$/.test(value)||!positive(Number(value))||Number(value)>max)reject('INPUT_INVALID');return Number(value);};
 if(q.q!==undefined&&q.q.trim().length>120||q.domain!==undefined&&(!q.domain.trim()||q.domain.length>80||/[\u0000-\u001f]/.test(q.domain)))reject('INPUT_INVALID');
 const pageSize=number('pageSize',20,50);if(![5,10,20,50].includes(pageSize))reject('INPUT_INVALID');
 return{q:(q.q??'').trim(),kind:pick('kind',['all',...CATALOG_KINDS],'all'),domain:q.domain??'all',status:pick('status',['all','draft','in_review','changes_requested','approved','released','withdrawn','expired'],'all'),scope:pick('scope',['all','private','received','sent'],'all'),source:pick('source',['all','author','knowledge','artifact','upload'],'all'),page:number('page',1,1000000),pageSize,sort:pick('sort',['updatedAt','title','kind'],'updatedAt'),direction:pick('direction',['asc','desc'],'desc')};
}

/** Actor is rebuilt from current database authorization, not supplied by the browser. */
export function assertAssetAction(current,input,actor,now=Date.now()){
 const r=current?.registry;
 if(!r||!sameScope(r,actor))reject('NOT_FOUND',404,'未找到有权操作的资产。');
 if(!input||!id(input.requestKey)||input.requestKey.length<8||!positive(input.expectedRevision)||!positive(input.version))reject('INPUT_INVALID');
 const actions=['revise','submit','review','release','withdraw','trash','restore'];
 if(!actions.includes(input.action))reject('INPUT_INVALID');
 if(input.expectedRevision!==r.revision)reject('VERSION_CONFLICT',409,'资产状态已变化，请核对最新版本。');
 const own=r.ownerAccountId===actor.accountId,admin=actor.isTenantAdmin===true;
 if(['review','release','withdraw'].includes(input.action)?!admin:!own&&!admin)reject('FORBIDDEN',403,'当前身份没有此资产操作权限。');
 if(!admin&&!(actor.permissions??[]).includes('artifact.edit'))reject('FORBIDDEN',403,'当前身份没有编辑权限。');
 if(input.action!=='restore'&&r.deletedAt||input.action==='restore'&&!r.deletedAt)reject('STATE_CONFLICT',409,'资产当前回收状态不允许此操作。');
 if(!positive(r.revision)||!positive(r.workingVersionNo))reject('CONTEXT_INVALID',409,'资产状态无法核对。');
 if(!['withdraw'].includes(input.action)&&input.version!==r.workingVersionNo)reject('VERSION_CONFLICT',409,'操作不是当前固定版本。');
 const reducing=admin&&(input.action==='withdraw'||input.action==='review'&&input.conclusion==='changes_requested');
 if(current.sourceValid!==true&&!reducing)reject('SOURCE_INVALID',409,'来源或当前用途无法核对，未提交变更。');
 const next={...r,revision:r.revision+1};
 switch(input.action){
  case'revise':
   if(input.baseVersion!==r.workingVersionNo||r.workingVersionNo>=(current.family?.family==='business'?2147483647:8)||r.revision>=2147483647)reject('VERSION_CONFLICT',409,'版本已变化或达到可用上限。');
   Object.assign(next,{workingVersionNo:r.workingVersionNo+1,workingState:'draft',submittedVersionNo:null,approvedVersionNo:null});break;
  case'submit':
   if(!['draft','changes_requested'].includes(r.workingState))reject('STATE_CONFLICT',409);
   if(!text(current.policy?.rightsEvidence))reject('RIGHTS_REQUIRED',422,'请补齐可追溯来源与用途依据。');
   Object.assign(next,{workingState:'in_review',submittedVersionNo:input.version,approvedVersionNo:null});break;
  case'review':
   if(!['approved','changes_requested'].includes(input.conclusion)||!text(input.reason))reject('INPUT_INVALID');
   if(r.workingState!=='in_review'||r.submittedVersionNo!==input.version)reject('VERSION_CONFLICT',409);
   if(input.conclusion==='approved'&&!text(current.policy?.rightsEvidence))reject('RIGHTS_REQUIRED',422);
   Object.assign(next,{workingState:input.conclusion,approvedVersionNo:input.conclusion==='approved'?input.version:null});break;
  case'release':{
   if(r.workingState!=='approved'||r.approvedVersionNo!==input.version)reject('STATE_CONFLICT',409);
   if(!text(input.reason)||!people(input.discoveryRecipients)||!input.discoveryRecipients.length||input.discoveryRecipients.some(x=>!current.policy?.discoveryRecipientCeiling?.includes(x)))reject('RIGHTS_REQUIRED',422,'发布范围超出本版已确认用途。');
   const until=Date.parse(input.expiresAt??new Date(now+7*86400000).toISOString());
   if(!Number.isFinite(until)||until<=now||until>now+7*86400000)reject('INPUT_INVALID');
   Object.assign(next,{releasedVersionNo:input.version,releaseState:'released'});break;
  }
  case'withdraw':
   if(!text(input.reason)||input.version>r.workingVersionNo)reject('INPUT_INVALID');
   if(!current.publishedVersions?.includes(input.version))reject('STATE_CONFLICT',409);
   if(r.releasedVersionNo===input.version)Object.assign(next,{releasedVersionNo:null,releaseState:'withdrawn'});break;
  case'trash':
   if(r.workingState!=='draft'||current.everSubmitted||current.hasReferences||r.releasedVersionNo||r.releaseState!=='unreleased')reject('STATE_CONFLICT',409,'有提交、许可或引用历史的资产不能删除，请核对撤回。');
   next.deletedAt=new Date(now).toISOString();break;
  case'restore':next.deletedAt=null;break;
 }
 return next;
}

export function effectiveAssetRelease(events,version,now=Date.now()){
 const ordered=[...(events??[])].sort((a,b)=>a.revision-b.revision);
 if(ordered.some((e,i)=>!positive(e.revision)||!positive(e.version)||i>0&&e.revision===ordered[i-1].revision))reject('CONTEXT_INVALID',409);
 let state={active:false,recipients:[],expiresAt:null};
 for(const event of ordered.filter(e=>e.version===version)){
  if(event.type==='released'){
   if(!people(event.discoveryRecipients)||!Number.isFinite(Date.parse(event.expiresAt)))reject('CONTEXT_INVALID',409);
   state={active:true,recipients:[...event.discoveryRecipients],expiresAt:event.expiresAt};
  }else if(event.type==='scope_narrowed'){
   if(!state.active||!people(event.discoveryRecipients)||event.discoveryRecipients.some(x=>!state.recipients.includes(x)))reject('CONTEXT_INVALID',409);
   state={...state,recipients:[...event.discoveryRecipients]};
  }else if(['withdrawn','expired'].includes(event.type))state={...state,active:false,recipients:[]};
 }
 return{...state,active:state.active&&Date.parse(state.expiresAt)>now};
}

export function assetUsageActions(record,p,version,now=Date.now()){
 const r=record.registry,policy=record.policies.find(x=>x.version===version),release=effectiveAssetRelease(record.events,version,now),manager=r.ownerAccountId===p.accountId||p.isTenantAdmin===true;
 if(!policy||policy.sourceValid===false||r.deletedAt||!release.active||!manager&&!release.recipients.includes(p.accountId)||r.revision>=23)return[];
 const grants=record.grants??[],live=grants.filter(g=>g.version===version&&Date.parse(g.expiresAt)>now&&g.recipientAccountId===p.accountId&&['pending','approved'].includes(g.state));
 return[...(manager?['share','manage_access']:live.length?[]:['request_access']),...(manager||live.some(g=>g.state==='approved'&&g.actions.includes('cite'))?['cite']:[])];
}

export function catalogVisibleVersion({registry:r,events,policies,grants=[],principal,now=Date.now(),version,sourceValid=true}){
 if(!sameScope(r,principal)||r.deletedAt||sourceValid!==true)return null;
 const privileged=r.ownerAccountId===principal.accountId||principal.isTenantAdmin===true;
 const candidates=version!==undefined?[version]:privileged?[r.workingVersionNo]:[...new Set(events.filter(e=>e.type==='released').map(e=>e.version))].sort((a,b)=>b-a);
 for(const selected of candidates){
  if(!positive(selected)||selected>r.workingVersionNo)return null;
  const policy=policies.find(p=>p.version===selected);if(!policy)reject('CONTEXT_INVALID',409);
  if(policy.sourceValid===false)continue;
  const release=effectiveAssetRelease(events,selected,now);
  if(!privileged&&(!release.active||!release.recipients.includes(principal.accountId)))continue;
  const actions=new Set(grants.filter(g=>g.version===selected&&g.recipientAccountId===principal.accountId&&g.state==='approved'&&Date.parse(g.expiresAt)>now).flatMap(g=>g.actions));
  const bodyExpiresAt=!privileged&&actions.has('read_body')?new Date(Math.min(Date.parse(release.expiresAt),Math.max(...grants.filter(g=>g.version===selected&&g.recipientAccountId===principal.accountId&&g.state==='approved'&&g.actions.includes('read_body')&&Date.parse(g.expiresAt)>now).map(g=>Date.parse(g.expiresAt))))).toISOString():null;
  return{version:selected,bodyExpiresAt,bodyAllowed:privileged||actions.has('read_body'),citeAllowed:release.active&&(privileged||actions.has('cite')),aiAllowed:false};
 }
 return null;
}

export function assertCatalogFixtureInventory(rows,ids){
 if(!Array.isArray(rows)||rows.length>10)reject('FIXTURE_CAPACITY',409);
 const expected=new Map(['owner','admin'].flatMap(actor=>CATALOG_KINDS.map(kind=>[CATALOG_ASSET_PREFIX+actor+':'+kind,{actor,kind}]))),keys=new Set(),identities=new Set();
 let events=0;
 for(const row of rows){
  const entry=expected.get(row.idempotencyKey);
  if(!entry||keys.has(row.idempotencyKey)||identities.has(row.id)||!id(row.id)||row.tenantId!==ids.tenant||row.studyGroupId!==ids.group||row.researchProjectId!==ids.project||row.ownerAccountId!==ids[entry.actor]||row.createdBy!==ids[entry.actor]||row.status!=='draft'||row.deletedAt!==null||!positive(row.currentVersionNo)||row.currentVersionNo>8||!Number.isSafeInteger(row.eventCount)||row.eventCount<0||row.eventCount>24)reject('FIXTURE_SCOPE',409,'本轮具名资产集合或额度不匹配。');
  keys.add(row.idempotencyKey);identities.add(row.id);events+=row.eventCount;
 }
 if(events>240)reject('FIXTURE_CAPACITY',409);
 return rows.length;
}
