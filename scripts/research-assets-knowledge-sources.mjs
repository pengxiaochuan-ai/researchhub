import {catalogError} from './research-assets-catalog-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
export const ASSET_SOURCE_KB='cmvjf87kz003eluf55ej04q7f';
const keys=['protocol-notes','dictionary-notes'];
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const invalid=()=>{throw catalogError('SOURCE_MANIFEST_INVALID',409,'来源用途依据无法核对，请联系管理员。');};
export function assertAssetSourceManifest(m,ids){
 if(!m||m.schemaVersion!=='rh-asset-source-manifest.v1'||m.kbId!==ASSET_SOURCE_KB||!['tenant','group','project','owner','admin'].every(k=>m.ids?.[k]===ids[k])||!Array.isArray(m.items)||m.items.length>2||new Set(m.items.map(x=>x.key)).size!==m.items.length||new Set(m.items.map(x=>x.id)).size!==m.items.length)invalid();
 for(const x of m.items){
  if(!keys.includes(x.key)||!valid(x.id)||x.createdBy!==ids.admin||typeof x.title!=='string'||!x.title.trim()||typeof x.rightsEvidence!=='string'||!x.rightsEvidence.trim()||!Array.isArray(x.allowedRecipients)||x.allowedRecipients.length>2||new Set(x.allowedRecipients).size!==x.allowedRecipients.length||x.allowedRecipients.some(id=>![ids.owner,ids.admin].includes(id))||!Array.isArray(x.versions)||x.versions.length>3||new Set(x.versions.map(v=>v.version)).size!==x.versions.length)invalid();
  for(const v of x.versions)if(!Number.isSafeInteger(v.version)||v.version<1||v.version>3||!hash(v.contentHash)||!valid(v.reviewAuditId)||![x.id,x.title+':pass'].includes(v.reviewTarget))invalid();
 }return m;
}
/** Old knowledge authorization executes on the SAME already-locked transaction. */
export function createAssetKnowledgeSources({ids,manifest,withKnowledgeRead,readVisibleDoc}){
 if([manifest,withKnowledgeRead,readVisibleDoc].some(x=>typeof x!=='function'))throw new TypeError('Current knowledge visibility and rights manifest required');
 const state=()=>assertAssetSourceManifest(manifest(),ids);
 async function fixed(tx,p,binding,ceiling){
  const m=state(),entry=m.items.find(x=>x.id===binding.id),proof=entry?.versions.find(v=>v.version===binding.version&&v.contentHash===binding.contentHash);
  if(!entry||!proof||!Array.isArray(ceiling)||ceiling.some(id=>!entry.allowedRecipients.includes(id)))return null;
  const doc=await readVisibleDoc(tx,p,entry.id);
  if(!doc||doc.id!==entry.id||doc.tenantId!==ids.tenant||doc.studyGroupId!==ids.group||doc.kbId!==ASSET_SOURCE_KB||doc.kb?.id!==ASSET_SOURCE_KB||doc.kb.tenantId!==ids.tenant||doc.kb.studyGroupId!==ids.group||doc.kb.researchProjectId!==ids.project||doc.kb.createdBy!==ids.admin||doc.createdBy!==ids.admin||doc.title!==entry.title||doc.version!==binding.version||doc.reviewed!==true||doc.status!=='published'||doc.trashedAt||doc.safetyLevel==='blocked'||assetDigest(doc.contentMd)!==binding.contentHash)return null;
  const projected=proof.reviewTarget===entry.id;
  const review=await tx.auditLog.findFirst({where:{id:proof.reviewAuditId,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:projected?'hub_asset_source_review_recorded':'review_kb_doc',target:proof.reviewTarget},select:{id:true,meta:true}});
  if(!projected)return review?{entry,doc}:null;
  const meta=review?.meta,audit=meta?.sourceAudit;
  if(!meta||meta.docId!==doc.id||meta.kbId!==ASSET_SOURCE_KB||meta.version!==binding.version||meta.contentHash!==binding.contentHash||!audit||!valid(audit.id)||audit.tenantId!==ids.tenant||audit.studyGroupId!==ids.group||audit.researchProjectId!==null||audit.accountId!==ids.admin||audit.action!=='review_kb_doc'||audit.target!==doc.title+':pass'||!Number.isFinite(Date.parse(audit.createdAt))||assetDigest(audit)!==meta.sourceAuditHash)return null;
  return{entry,doc};
 }
 async function authorized(tx,p,run){
  if(p.tenantId!==ids.tenant||p.studyGroupId!==ids.group||p.researchProjectId!==ids.project||![ids.owner,ids.admin].includes(p.accountId))return null;
  try{return await withKnowledgeRead(tx,p,run);}catch(e){const status=e.getStatus?.()??e.status;if([403,404].includes(status))return null;throw e;}
 }
 return{
  async assertSources(tx,p,policy){
   if(policy.sourceKind!=='knowledge'||!Array.isArray(policy.sourceBindings)||!policy.sourceBindings.length)return false;
   return await authorized(tx,p,async scoped=>{
    for(const binding of policy.sourceBindings){if(binding.kind!=='knowledge'||!await fixed(scoped,p,binding,policy.discoveryRecipientCeiling))return false;}return true;
   })===true;
  },
  async sources(tx,p){
   const rows=await authorized(tx,p,async scoped=>{
    const items=[];
    for(const entry of state().items){
     // Only a currently reviewed fixed version is eligible. Older body existence is not proof.
     for(const v of [...entry.versions].sort((a,b)=>b.version-a.version)){
      const binding={kind:'knowledge',id:entry.id,version:v.version,contentHash:v.contentHash},current=await fixed(scoped,p,binding,entry.allowedRecipients);if(!current)continue;
      items.push({id:entry.id,title:current.doc.title,version:v.version,sourceKind:'knowledge',binding,contentMd:current.doc.contentMd,rightsEvidence:entry.rightsEvidence,discoveryRecipients:entry.allowedRecipients});break;
     }
    }return items;
   });return rows??[];
  }
 };
}
