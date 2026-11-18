import {randomUUID} from 'node:crypto';
import {directoryError,directoryHash,directoryId} from './contract.mjs';
import {normalizeTeamData,teamSeed,planTeamChanges,chosenOrg} from './team-contract.mjs';
import {directoryRevision,projectDirectory} from './read-model.mjs';
import {holdDirectorySources,resolveDirectorySource} from './sources.mjs';
import {resolveLocation} from '../reference/divisions.mjs';
import {buildAdminVerification} from './admin-verification.mjs';
const fail=(code,status,message)=>{throw directoryError(code,status,message);};
function command(v,allowed){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k))||typeof v.requestKey!=='string'||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v.requestKey))fail('DIRECTORY_INVALID_INPUT',400,'团队提交字段或编号不正确。');}
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const sha=v=>typeof v==='string'&&/^[a-f\d]{64}$/.test(v);
export function teamWorkspaceMethods({db,transaction,graph,audit,child}){
 const t=db.tenantId,h=db.hubKey??'lingshu-xinyu';
 const admin=(ctx,write,fn)=>transaction(ctx,{write,admin:true},fn);
 async function checkLocation(tx,data){if(!data.location)return;const value=await resolveLocation(tx,data.location);if(value.city!==data.city||value.region!==data.region)fail('DIRECTORY_INVALID_INPUT',400,'省市名称与字典代码不一致，请重新选择。');}
 async function row(tx,id,g){directoryId(id);const e=g.entities.find(x=>x.id===id&&x.kind==='team'&&!x.archivedAt);if(!e)fail('DIRECTORY_NOT_FOUND',404,'该团队当前不可维护。');const [r]=await tx.$queryRaw`SELECT team_draft AS draft FROM rh_directory.entity WHERE tenant_id=${t} AND id=${id} AND kind='team' AND creation_hub_key=${h}`;if(!r||r.draft&&r.draft.hubKey!==h)fail('DIRECTORY_NOT_FOUND',404,'该团队不属于当前维护范围。');return r.draft;}
 function replay(d,actor,key,operation,hash){const old=d?.operations?.find(x=>x.key===key);if(!old)return null;if(old.actor!==actor.id||old.operation!==operation||hash&&old.hash!==hash)fail('DIRECTORY_REQUEST_CONFLICT',409,'本次编号已用于其他操作，请先核对原提交。');return old.result;}
 async function store(tx,id,next,actor,operation,key,hash,result){
  next.operations=[...(next.operations??[]),{key,actor:actor.id,operation,hash,result}];
  if(Buffer.byteLength(JSON.stringify(next))>250000)fail('DIRECTORY_DRAFT_LIMIT',409,'草稿记录已达大小上限，请保留输入核对。');
  await tx.$executeRaw`UPDATE rh_directory.entity SET team_draft=${JSON.stringify(next)}::jsonb WHERE tenant_id=${t} AND id=${id}`;
  await audit(tx,actor,'team_'+operation,id,hash);return result;
 }
 async function save(tx,ctx,actor,id,input,operation){
  const data=normalizeTeamData(input.data),g=await graph(tx,ctx),d=await row(tx,id,g),hash=directoryHash(operation==='create'?{operation,id,data,requestKey:input.requestKey}:{operation,id,...input,data});
  const old=replay(d,actor,input.requestKey,operation,hash);if(old)return old;
  await checkLocation(tx,data);
  if(!integer(input.expectedVersion)||(d?.version??0)!==input.expectedVersion)fail('DIRECTORY_VERSION_CONFLICT',409,'团队草稿已被修改，请保留输入并核对当前版本。');
  const revision=directoryRevision(g);if(input.baseRevision!==revision)fail('DIRECTORY_VERSION_CONFLICT',409,'目录或依据已变化，请先核对当前展示资料，再保存。');
  const next={...d,hubKey:h,version:(d?.version??0)+1,data,baseRevision:revision,savedAt:new Date().toISOString(),operations:d?.operations??[]};
  return store(tx,id,next,actor,operation,input.requestKey,hash,{id,version:next.version,savedAt:next.savedAt});
 }
 async function preview(tx,ctx,id,audience){
  const g=await graph(tx,ctx),d=await row(tx,id,g);if(!d)fail('DIRECTORY_DRAFT_REQUIRED',409,'请先保存团队草稿再预览。');
  await checkLocation(tx,d.data);
  const currentRevision=directoryRevision(g),view=audience==='tenant'?g:await graph(tx,ctx,audience),publicView=audience==='public'?view:await graph(tx,ctx,'public'),publicInstitutionIds=projectDirectory(publicView,'public',{kind:'organization'}).map(x=>x.id),manual=d.data.verificationMethod==='administrator',plan=planTeamChanges(view,id,d.data,audience,{verificationProposal:manual,publicInstitutionIds}),sourceStates=[];
  if(d.baseRevision!==currentRevision)plan.issues.push('目录或原资料已变化，请核对当前展示资料后重新保存草稿。');
  for(const [index,e] of (manual?[]:d.data.evidence).entries()){
   if(!e.reference.locator||!e.reference.fieldNames.length){plan.issues.push('依据'+(index+1)+'：请补齐原文位置与引用范围。');sourceStates.push({reference:e.reference,available:false,fingerprint:directoryHash({reference:e.reference,incomplete:true}),title:null});continue;}
   const source=await resolveDirectorySource(tx,{tenantId:t,hubKey:h,principal:ctx.user,audience},e.reference);sourceStates.push({reference:e.reference,available:source.available,fingerprint:source.fingerprint,title:source.title??null});if(!source.available)plan.issues.push('所选依据当前未获准、版本已变化或不适用于选定展示范围。');
  }
  const planHash=directoryHash({id,version:d.version,baseRevision:d.baseRevision,currentRevision,audience,plan,sourceStates,publicInstitutionIds,actor:ctx.user,verificationMethod:d.data.verificationMethod??'sources'});
  const publicIds=new Set(publicInstitutionIds);
  const publicExposure=audience==='public'&&(plan.jointInstitutions.some(x=>!publicIds.has(x.id))||plan.creates.length>0);
  return {d,g,plan,output:{id,version:d.version,planHash,audience,publicExposure,jointInstitutions:plan.jointInstitutions,canApprove:plan.issues.length===0&&plan.facts.length>0,issues:[...new Set(plan.issues)],changes:plan.facts.map(x=>({label:x.label,kind:x.kind,action:x.existingId?'审核现有资料':'保存并审核修订',name:x.payload.name??null})),newObjects:plan.creates.map(x=>({kind:x.kind})),data:d.data,current:projectDirectory(view,audience).find(x=>x.id===id)??null,sources:sourceStates}};
 }
 const methods={
  teamWorkspaces:(ctx,{q='',page=1}={})=>admin(ctx,false,async tx=>{
   if(typeof q!=='string'||q.length>120||!Number.isSafeInteger(page)||page<1)fail('DIRECTORY_INVALID_INPUT',400,'团队搜索条件不正确。');
   const g=await graph(tx,ctx),rows=await tx.$queryRaw`SELECT id,team_draft AS draft FROM rh_directory.entity WHERE tenant_id=${t} AND creation_hub_key=${h} AND kind='team' AND archived_at IS NULL ORDER BY created_at,id`;
   const published=new Set(projectDirectory(g,'tenant').map(x=>x.id));const items=rows.map(r=>{const p=g.heads.find(x=>x.entityId===r.id&&x.kind==='profile');return {id:r.id,name:r.draft?.data.name??p?.payload.name??'待填写团队',savedAt:r.draft?.savedAt??null,version:r.draft?.version??0,hasDraft:Boolean(r.draft),hasPublished:published.has(r.id),reviewed:r.draft? r.draft.reviewedVersion===r.draft.version:p?.decision?.decision==='approve'};}).filter(x=>x.name.includes(q));return {items:items.slice((page-1)*20,page*20),pagination:{page,pageSize:20,totalItems:items.length,totalPages:Math.ceil(items.length/20)}};
  }),
  teamWorkspace:(ctx,id)=>admin(ctx,false,async tx=>{
   const g=await graph(tx,ctx),d=await row(tx,id,g),currentRevision=directoryRevision(g),hasPublished=projectDirectory(g,'tenant').some(x=>x.id===id),isPublic=projectDirectory(await graph(tx,ctx,'public'),'public').some(x=>x.id===id);return {id,version:d?.version??0,reviewedVersion:d?.reviewedVersion??null,data:d?.data??teamSeed(g,id),verifications:d?.verifications??[],baseRevision:d?.baseRevision??currentRevision,currentRevision,currentData:teamSeed(g,id),hasPublished,publishedAudience:isPublic?'public':hasPublished?'tenant':null,hasDraft:Boolean(d),savedAt:d?.savedAt??null,history:(d?.operations??[]).map(o=>({operation:o.operation,version:o.result.version,at:o.result.savedAt??o.result.reviewedAt}))};
  }),
  createTeamWorkspace:(ctx,input)=>admin(ctx,true,async(tx,actor)=>{
   command(input,['data','requestKey']);const data=normalizeTeamData(input.data),service=child(tx),e=await service.createEntity(ctx,{kind:'team',stableKey:'team-form-'+input.requestKey,requestKey:input.requestKey});
   return save(tx,ctx,actor,e.id,{data,requestKey:input.requestKey,expectedVersion:0,baseRevision:directoryRevision(await graph(tx,ctx))},'create');
  }),
  saveTeamWorkspace:(ctx,id,input)=>admin(ctx,true,async(tx,actor)=>{command(input,['expectedVersion','baseRevision','data','requestKey']);if(!sha(input.baseRevision))fail('DIRECTORY_INVALID_INPUT',400,'目录基准不正确。');return save(tx,ctx,actor,id,input,'save');}),
  previewTeamWorkspace:(ctx,id,audience='tenant')=>admin(ctx,false,async tx=>(await preview(tx,ctx,id,audience)).output),
  reviewTeamWorkspace:(ctx,id,input)=>admin(ctx,true,async(tx,actor)=>{
   command(input,['expectedVersion','planHash','audience','reason','requestKey']);if(!integer(input.expectedVersion)||!sha(input.planHash)||!['public','tenant'].includes(input.audience)||input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>2000))fail('DIRECTORY_INVALID_INPUT',400,'请核对展示范围及审核备注格式，备注最多2000字。');
   const reviewNote=(input.reason??'').trim();
   let g=await graph(tx,ctx),d=await row(tx,id,g);const hash=directoryHash({operation:'review',id,...input}),old=replay(d,actor,input.requestKey,'review',hash);if(old)return old;
   if(d?.version!==input.expectedVersion)fail('DIRECTORY_VERSION_CONFLICT',409,'草稿版本已变化，请重新预览。');
   const before=await preview(tx,ctx,id,input.audience),dependencies=new Set([id,...before.plan.facts.flatMap(f=>[f.entityId,f.relatedEntityId]).filter(Boolean)]);
   if(before.output.planHash!==input.planHash||!before.output.canApprove)fail('DIRECTORY_VERSION_CONFLICT',409,before.output.issues[0]??'预览已变化或没有待审核变更，请重新核对。');
   const manual=d.data.verificationMethod==='administrator',changed=new Set(before.plan.facts.map(f=>f.entityId+':'+f.assertionKey));
   const retained=g.heads.filter(x=>dependencies.has(x.entityId)&&!changed.has(x.entityId+':'+x.assertionKey)&&(x.kind==='profile'||x.payload.current&&(x.kind==='affiliation'&&x.payload.isPrimaryForDisplay||x.kind==='team_member'&&x.relatedEntityId===id)));
   await holdDirectorySources(tx,manual?[...retained,...g.heads.filter(x=>x.kind==='profile'&&x.decision?.decision==='approve'&&before.plan.jointInstitutions.some(i=>i.id===x.entityId))].flatMap(x=>x.provenance):[...d.data.evidence.map(x=>x.reference),...before.plan.facts.flatMap(x=>x.provenance),...g.heads.filter(x=>x.kind==='profile'&&dependencies.has(x.entityId)).flatMap(x=>x.provenance)]);
   const p=await preview(tx,ctx,id,input.audience);if(p.output.planHash!==input.planHash||!p.output.canApprove)fail('DIRECTORY_VERSION_CONFLICT',409,p.output.issues[0]??'预览已变化或没有待审核变更，请重新核对。');
   const s=child(tx),ids=new Map();
   for(const item of p.plan.creates){const e=await s.createEntity(ctx,{kind:item.kind,stableKey:id+'-'+item.ref+'-'+input.requestKey,requestKey:randomUUID()});ids.set(item.ref,e.id);}
   // Profiles first, ended relations before replacements. All are inside the same outer transaction.
   const facts=p.plan.facts.map(f=>({...f,entityId:ids.get(f.entityId)??f.entityId,relatedEntityId:ids.get(f.relatedEntityId)??f.relatedEntityId,assertionKey:f.assertionKey.replace(/new-org-[A-Za-z0-9_-]+$/,m=>ids.get(m)??m),revision:f.expectedRevision+1})).sort((a,b)=>(a.kind==='profile'?0:a.payload.current===false?1:2)-(b.kind==='profile'?0:b.payload.current===false?1:2));
   if(manual){
    const records=[];
    for(const audience of [...new Set(facts.map(f=>f.audience??input.audience))]){
     const scoped=facts.filter(f=>(f.audience??input.audience)===audience),{record,reference}=buildAdminVerification({tenantId:t,hubKey:h,teamId:id,draftVersion:d.version,actor,reason:reviewNote,audience,facts:scoped,id:randomUUID(),verifiedAt:new Date().toISOString()});
     records.push(record);for(const fact of scoped)fact.provenance=[reference];
    }
    d={...d,verifications:[...(d.verifications??[]),...records]};
    if(Buffer.byteLength(JSON.stringify(d))>250000)fail('DIRECTORY_DRAFT_LIMIT',409,'核实记录已达大小上限，请保留输入核对。');
    await tx.$executeRaw`UPDATE rh_directory.entity SET team_draft=${JSON.stringify(d)}::jsonb WHERE tenant_id=${t} AND id=${id}`;
   }
   for(const f of facts){let fact;if(f.existingId)fact=await s.adminAssertion(ctx,f.existingId);else {const result=await s.appendAssertion(ctx,ids.get(f.entityId)??f.entityId,{assertionKey:f.assertionKey.replace(/new-org-[A-Za-z0-9_-]+$/,m=>ids.get(m)??m),kind:f.kind,relatedEntityId:ids.get(f.relatedEntityId)??f.relatedEntityId,expectedRevision:f.expectedRevision,payload:f.payload,provenance:f.provenance,requestKey:randomUUID()});fact={...result,decision:null};}
    await s.decide(ctx,fact.id,{expectedDecisionVersion:fact.decision?.version??0,assertionHash:fact.hash,decision:'approve',audience:f.audience??input.audience,reason:reviewNote||'审核通过（未填写备注）',requestKey:randomUUID()});
   }
   g=await graph(tx,ctx);const version=d.version+1,reviewedAt=new Date().toISOString(),next={...d,version,reviewedVersion:version,data:{...teamSeed(g,id),...(d.data.verificationMethod?{verificationMethod:d.data.verificationMethod}:{}),notes:d.data.notes},baseRevision:directoryRevision(g),savedAt:reviewedAt};
   return store(tx,id,next,actor,'review',input.requestKey,hash,{id,version,reviewedAt,changedFacts:facts.length});
  }),
  teamWorkspaceReceipt:(ctx,id,key)=>admin(ctx,false,async(tx,actor)=>{const d=await row(tx,id,await graph(tx,ctx)),o=d?.operations.find(x=>x.key===directoryId(key)&&x.actor===actor.id);if(!o)fail('DIRECTORY_RECEIPT_NOT_FOUND',404,'尚未找到原提交回执，不代表未提交。');return {operation:o.operation,result:o.result};}),
  teamWorkspaceChoices:(ctx,{kind='organization',q='',page=1}={})=>admin(ctx,false,async tx=>{
   if(!['organization','researcher'].includes(kind)||typeof q!=='string'||q.length>120||!Number.isSafeInteger(page)||page<1)fail('DIRECTORY_INVALID_INPUT',400,'人员或机构搜索条件不正确。');
   const g=await graph(tx,ctx),items=g.entities.filter(e=>e.kind===kind&&!e.archivedAt).flatMap(e=>{const p=g.heads.find(x=>x.entityId===e.id&&x.kind==='profile');if(!p||!p.payload.name.includes(q))return [];return [{id:e.id,name:p.payload.name,rank:p.payload.rank??'',type:p.payload.organizationType??'',organization:kind==='researcher'?chosenOrg(g,e.id):null,reviewed:p.decision?.decision==='approve'}];});
   return {items:items.slice((page-1)*20,page*20),pagination:{page,pageSize:20,totalItems:items.length,totalPages:Math.ceil(items.length/20)}};
  }),
 };
 return methods;
}
