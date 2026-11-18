import {directoryError,directoryHash,directoryId,normalizeProvenance,normalizeAssertion,normalizeFactContent,normalizeDivisionCodes} from './contract.mjs';
const bad=(message='团队资料字段不正确。',status=400)=>{throw directoryError(status===409?'DIRECTORY_VERSION_CONFLICT':'DIRECTORY_INVALID_INPUT',status,message);};
function keys(v,allowed){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))bad();}
function str(v,max,required=false){if(v===undefined||v===null)v='';if(typeof v!=='string'||v.trim().length>max||required&&!v.trim())bad(required?'请填写团队名称。':'输入内容超长或格式不正确。');return v.trim();}
const id=v=>v==null||v===''?null:directoryId(v);
const list=(v,max,fn)=>{if(!Array.isArray(v)||v.length>max)bad('条目数量超过本次上限。');return v.map(fn);};
const unique=v=>{if(new Set(v).size!==v.length)bad('同一人员或资料项不能重复添加。');};
function draftProof(ref){
 keys(ref,['kind','sourceId','versionId','rowId','sourceHash','locator','fieldNames']);const locator=str(ref.locator,500),fields=list(ref.fieldNames??[],10,x=>str(x,40,true));
 if(ref.kind==='admin_verification')bad('人工核实记录由系统生成，不能作为可编辑外部资料提交。');
 // Reuse the strict source-identity/field whitelist. These shape-only defaults
 // are never persisted: an incomplete draft keeps its real empty values.
 const checked=normalizeProvenance([{...ref,locator:locator||'draft-shape-check',fieldNames:fields.length?fields:['title']}])[0];
 return {...checked,locator,fieldNames:fields.length?checked.fieldNames:[]};
}
function org(v){
 if(!v)return null;keys(v,['entityId','name','type','edit']);const o={entityId:id(v.entityId),name:str(v.name,200),type:str(v.type,100)};
 if(v.edit!==undefined){const e=v.edit;keys(e,['expectedRevision','baseProfile','profile']);if(!o.entityId||!Number.isSafeInteger(e.expectedRevision)||e.expectedRevision<1)bad();
  const normalize=payload=>{const cleaned={...payload};for(const k of ['aliases','directions'])if(Array.isArray(cleaned[k])&&cleaned[k].every(x=>typeof x==='string'))cleaned[k]=cleaned[k].map(x=>x.trim()).filter(Boolean);return normalizeFactContent({kind:'profile',assertionKey:'profile',expectedRevision:e.expectedRevision,payload:cleaned,relatedEntityId:null,provenance:[],requestKey:'00000000-0000-4000-8000-000000000000'},'organization').payload;};
  const baseProfile=normalize(e.baseProfile),profile=normalize(e.profile),fixed=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['name','organizationType','summary','aliases','directions'].includes(k)));
  if(directoryHash(fixed(baseProfile))!==directoryHash(fixed(profile))||o.name!==profile.name||o.type!==(profile.organizationType??''))bad('机构编辑内容与所选资料不一致。');
  o.edit={expectedRevision:e.expectedRevision,baseProfile,profile};
 }return o;
}
export function normalizeTeamData(v){
 keys(v,['name','summary','directions','city','region','teamType','organization','members','evidence','notes','location','verificationMethod']);
 const d={name:str(v.name,200,true),summary:str(v.summary,4000),directions:list(v.directions??[],10,x=>str(x,40,true)),city:str(v.city,100),region:str(v.region,100),teamType:str(v.teamType,100),organization:org(v.organization),members:list(v.members??[],20,m=>{
  keys(m,['key','entityId','name','rank','organization','role']);const role=m.role??'member';if(!['member','lead','co_lead'].includes(role))bad();
  return {key:directoryId(m.key),entityId:id(m.entityId),name:str(m.name,200),rank:str(m.rank,100),organization:org(m.organization),role};
 }),evidence:list(v.evidence??[],10,e=>{keys(e,['reference','targets']);const reference=draftProof(e.reference),targets=list(e.targets??[],42,x=>str(x,200,true));unique(targets);return {reference,targets};}),notes:str(v.notes,2000)};
 if(v.location!==undefined)d.location=v.location===null?null:normalizeDivisionCodes(v.location);
 if(v.verificationMethod!==undefined){if(!['administrator','sources'].includes(v.verificationMethod))bad();d.verificationMethod=v.verificationMethod;}
 const edits=new Map();for(const o of [d.organization,...d.members.map(m=>m.organization)].filter(o=>o?.edit)){if(d.verificationMethod!=='administrator')bad('机构修订需要管理员本人核实。');if(edits.has(o.entityId)&&edits.get(o.entityId)!==directoryHash(o.edit))bad('同一机构的修改不一致，请核对。');edits.set(o.entityId,directoryHash(o.edit));}
 if(d.members.some(m=>m.entityId&&m.organization?.edit))bad('已有研究者的任职资料不能在团队页修改。');
 unique(d.directions);unique(d.members.map(m=>m.key));unique(d.members.map(m=>m.entityId).filter(Boolean));
 const targets=['team','organization',...d.members.flatMap(m=>['member:'+m.key,'member-organization:'+m.key])];
 if(d.evidence.some(e=>e.targets.some(t=>!targets.includes(t))))bad('依据对应的人员或资料项已不存在，请重新选择。');
 if(Buffer.byteLength(JSON.stringify(d))>40000)bad('团队草稿超过大小上限。');return d;
}
const profile=(g,id)=>g.heads.find(x=>x.entityId===id&&x.kind==='profile');
const currentAffiliations=(g,id)=>g.heads.filter(x=>x.entityId===id&&x.kind==='affiliation'&&x.payload.current);
export function chosenOrg(g,entityId){const all=currentAffiliations(g,entityId),primary=all.filter(x=>x.payload.isPrimaryForDisplay),r=primary.length===1?primary[0]:all.length===1?all[0]:null,p=r&&profile(g,r.relatedEntityId);return p?{entityId:r.relatedEntityId,name:p.payload.name,type:p.payload.organizationType??''}:null;}
export function teamSeed(g,teamId){
 const p=profile(g,teamId)?.payload??{},members=g.heads.filter(x=>x.kind==='team_member'&&x.relatedEntityId===teamId&&x.payload.current).map(r=>{const person=profile(g,r.entityId)?.payload??{};return {key:r.entityId,entityId:r.entityId,name:person.name??'',rank:person.rank??'',organization:chosenOrg(g,r.entityId),role:r.payload.memberRole};});
 const evidence=new Map();function refs(f,target){for(const reference of f?.provenance??[]){if(reference.kind==='admin_verification')continue;const key=directoryHash(reference);if(!evidence.has(key))evidence.set(key,{reference,targets:[]});const e=evidence.get(key);if(!e.targets.includes(target))e.targets.push(target);}}
 refs(profile(g,teamId),'team');const organization=chosenOrg(g,teamId);if(organization)refs(profile(g,organization.entityId),'organization');for(const a of currentAffiliations(g,teamId))refs(a,'team');
 for(const m of members){refs(profile(g,m.entityId),'member:'+m.key);for(const r of g.heads.filter(x=>x.kind==='team_member'&&x.entityId===m.entityId&&x.relatedEntityId===teamId))refs(r,'member:'+m.key);if(m.organization)refs(profile(g,m.organization.entityId),'member-organization:'+m.key);}
 return {name:p.name??'',summary:p.summary??'',directions:p.directions??[],city:p.city?.name??'',region:p.city?.region??'',...(p.city?.division?{location:p.city.division}:{}),teamType:p.teamType??'',organization,members,evidence:[...evidence.values()],notes:''};
}
const visible=(p,audience)=>p?.decision?.decision==='approve'&&['public',...(audience==='tenant'?['tenant']:[])].includes(p.decision.audience)&&(!p.decision.expiresAt||new Date(p.decision.expiresAt)>new Date())&&p.sources?.length>0&&p.sources.every(s=>s.available);
export function planTeamChanges(g,teamId,data,audience,{verificationProposal=false,publicInstitutionIds=[]}={}){
 if(!['tenant','public'].includes(audience))bad();const issues=[],creates=[],facts=[],jointInstitutions=[];
 const team=g.entities.find(e=>e.id===teamId&&!e.archivedAt&&e.kind==='team');if(!team)bad('团队不存在或当前不可用。',409);
 const proof=target=>data.evidence.filter(e=>e.targets.includes(target)&&e.reference.locator&&e.reference.fieldNames.length).map(e=>e.reference);
 function add(entityId,kind,key,payload,related,target,label,factAudience=audience){
  const old=g.heads.find(x=>x.entityId===entityId&&x.assertionKey===key),provenance=proof(target);
  if(!verificationProposal&&!provenance.length){issues.push(label+'：请关联资料依据。');return;}
  const entityKind=creates.find(x=>x.ref===entityId)?.kind??g.entities.find(x=>x.id===entityId)?.kind;
  // Temporary references are substituted only inside the committing transaction.
  const input={kind,assertionKey:key,relatedEntityId:related,expectedRevision:old?.revision??0,payload,provenance,requestKey:'00000000-0000-4000-8000-000000000000'},normalized=verificationProposal?{...normalizeFactContent(input,entityKind),provenance:[],requestKey:input.requestKey}:normalizeAssertion(input,entityKind);
  // A shared form proof can support several items. Keep an unchanged fact's
  // already-reviewed references when all remain explicitly selected; avoid
  // creating new versions merely because another item's proof was reused.
  const selectedProofs=new Set(normalized.provenance.map(directoryHash));
  const unchanged=old&&directoryHash(old.payload)===directoryHash(normalized.payload)&&(verificationProposal||old.provenance.every(ref=>selectedProofs.has(directoryHash(ref))));
  if(unchanged&&visible(old,factAudience)&&old.decision.audience===factAudience)return;
  facts.push({entityId,label,audience:factAudience,existingId:!verificationProposal&&unchanged?old.id:null,decisionVersion:!verificationProposal&&unchanged?old.decision?.version??0:0,...normalized});
 }
 function existing(eid,kind,label){const e=g.entities.find(x=>x.id===eid&&!x.archivedAt&&x.kind===kind),p=e&&profile(g,eid);if(!p)bad(label+'已变化或不属于当前目录，请重新选择。',409);if(!visible(p,audience))issues.push(label+'尚无对当前展示范围有效的已审核资料。');return p;}
 function organization(o,ref,target,label){
  if(!o||!o.entityId&&!o.name){issues.push(label+'：请填写所属机构。');return null;}
  if(o.entityId){
   if(!verificationProposal){const p=existing(o.entityId,'organization',label);if(o.name!==p.payload.name||o.type!==(p.payload.organizationType??''))bad('已有机构资料已变化，请重新选择，团队页不覆盖共用机构。',409);return o.entityId;}
   const e=g.entities.find(x=>x.id===o.entityId&&!x.archivedAt&&x.kind==='organization'),p=e&&profile(g,o.entityId);if(!p)bad(label+'已变化，请重新选择。',409);
   if(o.edit){
    if(o.edit.expectedRevision!==p.revision||directoryHash(o.edit.baseProfile)!==directoryHash(p.payload))bad('机构档案已变化，输入已保留，请核对最新机构资料。',409);
    if(directoryHash(o.edit.profile)!==directoryHash(p.payload)){
     const history=Boolean(p.decision||(g.reviewedProfiles??[]).includes(o.entityId));
     if(history&&(!visible(p,audience)||p.decision?.audience==='public'&&audience==='tenant'&&!publicInstitutionIds.includes(o.entityId))){issues.push(label+'的已审核资料当前不可用于本次展示，可能已撤回、到期或缺少有效依据。请核对该机构资料；本次未提交，输入已保留。');return o.entityId;}
     const institutionAudience=history?p.decision.audience:audience;
     if(!jointInstitutions.some(x=>x.id===o.entityId)){jointInstitutions.push({id:o.entityId,name:o.edit.profile.name,profile:p.payload,status:'editing',audience:institutionAudience});add(o.entityId,'profile','profile',o.edit.profile,null,target,label+'资料修订',institutionAudience);}
     return o.entityId;
    }
   }
   if(o.name!==p.payload.name||o.type!==(p.payload.organizationType??''))bad('已有机构资料已变化，请重新选择，团队页不覆盖共用机构。',409);
   if(!visible(p,audience)){
    if(p.decision||(g.reviewedProfiles??[]).includes(o.entityId))issues.push(label+'已有审核历史或当前依据失效，请在机构档案中核对；本次不自动恢复或扩大范围。');
    else if(!jointInstitutions.some(x=>x.id===o.entityId)){jointInstitutions.push({id:o.entityId,name:p.payload.name,profile:p.payload,status:'pending',audience});add(o.entityId,'profile','profile',p.payload,null,target,label);}
   }
   return o.entityId;
  }
  if(verificationProposal){const same=creates.find(c=>c.kind==='organization'&&c.name===o.name&&c.type===o.type);if(same)return same.ref;}
  creates.push({ref,kind:'organization',...(verificationProposal?{name:o.name,type:o.type}:{})});add(ref,'profile','profile',{name:o.name,organizationType:o.type||null},null,target,label);return ref;
 }
 const oldProfile=profile(g,teamId)?.payload??{};
 const city=data.city?{name:data.city,region:data.region||data.city,longitude:null,latitude:null,coordinateKind:null}:null;
 if(city&&oldProfile.city?.name===city.name&&oldProfile.city?.region===city.region)Object.assign(city,oldProfile.city);
 if(city&&data.location)city.division=data.location;else if(city&&data.location===null)delete city.division;
 if(data.location&&!data.location.cityCode&&!data.city)issues.push('请选择所在城市／地区，或清除未完成的省市选择。');
 add(teamId,'profile','profile',{...oldProfile,name:data.name,summary:data.summary,directions:data.directions,city,teamType:data.teamType||null},null,'team','团队基本资料');
 const orgId=organization(data.organization,'new-org-team','organization','团队所属机构');
 function affiliation(eid,oid,target,label){
  if(!oid)return;const all=currentAffiliations(g,eid),primary=all.filter(x=>x.payload.isPrimaryForDisplay);if(primary.length>1){issues.push(label+'有多个主要机构，请在历史资料中核对后再审核。');return;}
  for(const old of all.filter(x=>x.payload.isPrimaryForDisplay&&x.relatedEntityId!==oid))add(eid,'affiliation',old.assertionKey,{...old.payload,current:false,isPrimaryForDisplay:false},old.relatedEntityId,target,label+'：结束原所属机构');
  const old=g.heads.find(x=>x.kind==='affiliation'&&x.entityId===eid&&x.relatedEntityId===oid),key=old?.assertionKey??'affiliation:team-form:'+oid;
  add(eid,'affiliation',key,{...old?.payload,current:true,isPrimaryForDisplay:true,endMonth:null},oid,target,label);
 }
 affiliation(teamId,orgId,'team','团队所属关系');
 if(!data.members.some(m=>['lead','co_lead'].includes(m.role)))issues.push('请至少添加一位负责人或共同负责人。');
 for(const m of data.members){
  const ref=m.entityId??'new-person-'+m.key;
  if(!m.name){issues.push('成员姓名尚未填写。');continue;}
  if(m.entityId){const p=existing(m.entityId,'researcher','成员 '+m.name);if(m.name!==p.payload.name||m.rank!==(p.payload.rank??'')||directoryHash(m.organization)!==directoryHash(chosenOrg(g,m.entityId)))bad('已有研究者资料已变化，请重新选择；团队页不修改其姓名、职称或任职。',409);}
  else {creates.push({ref,kind:'researcher'});add(ref,'profile','profile',{name:m.name,rank:m.rank||null},null,'member:'+m.key,'成员 '+m.name);const memberOrganization=m.organization??(verificationProposal?data.organization:null);if(memberOrganization?.entityId||memberOrganization?.name){const oid=memberOrganization===data.organization?orgId:organization(memberOrganization,'new-org-'+m.key,'member-organization:'+m.key,m.name+'所属机构');affiliation(ref,oid,'member:'+m.key,m.name+'任职关系');}}
  const old=g.heads.find(x=>x.kind==='team_member'&&x.entityId===ref&&x.relatedEntityId===teamId);
  add(ref,'team_member',old?.assertionKey??'team_member:team-form:'+teamId,{...old?.payload,memberRole:m.role,current:true,isPrimary:old?.payload.isPrimary??false,endMonth:null},teamId,'member:'+m.key,m.name+'的团队角色');
 }
 for(const old of g.heads.filter(x=>x.kind==='team_member'&&x.relatedEntityId===teamId&&x.payload.current&&!data.members.some(m=>m.entityId===x.entityId)))add(old.entityId,'team_member',old.assertionKey,{...old.payload,current:false,isPrimary:false},teamId,'team','结束成员关系：'+(profile(g,old.entityId)?.payload.name??old.entityId));
 return {issues:[...new Set(issues)],creates,facts,jointInstitutions};
}
