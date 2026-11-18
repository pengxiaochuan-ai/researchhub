import {createHash} from 'node:crypto';
import {taskError} from './authorization.mjs';
import {parseTaskEvidenceRef} from './contract.mjs';
const digest=text=>createHash('sha256').update(text).digest('hex');
const scope=a=>({tenantId:a.tenantId,studyGroupId:a.studyGroupId,researchProjectId:a.researchProjectId});
const types=['protocol_draft','research_report','data_quality_report'];
const ownWhere=a=>({...scope(a),ownerAccountId:a.actorAccountId,createdBy:a.actorAccountId,deletedAt:null,status:'draft',typeKey:{in:types}});
export async function canReadTaskEvidence(db,authority){
 // Only a server-derived, current Task authority can reach this helper.
 // The approved local own-artifact/scope fence below still applies to admins.
 if(authority.isTenantAdmin===true)return true;
 const member=await db.studyGroupMembership.findFirst({where:{tenantId:authority.tenantId,studyGroupId:authority.studyGroupId,accountId:authority.actorAccountId,status:'active',role:{tenantId:authority.tenantId,status:'active'}},select:{role:{select:{menuPermissions:true,buttonPermissions:true}}}});
 const project=await db.researchProjectMembership.findFirst({where:{...scope(authority),accountId:authority.actorAccountId,status:'active'},select:{id:true}});
 return Boolean(project&&Array.isArray(member?.role.menuPermissions)&&member.role.menuPermissions.includes('artifacts')&&Array.isArray(member.role.buttonPermissions)&&member.role.buttonPermissions.includes('artifact.read'));
}
const own=(artifact,a)=>artifact&&Object.entries(scope(a)).every(([key,value])=>artifact[key]===value)&&artifact.ownerAccountId===a.actorAccountId&&artifact.createdBy===a.actorAccountId&&artifact.deletedAt===null&&artifact.status==='draft'&&types.includes(artifact.typeKey);
async function checkedVersion(db,authority,ref){
 const artifact=await db.researchArtifact.findFirst({where:{...ownWhere(authority),id:ref.artifactId}});
 if(!own(artifact,authority))throw taskError('STUDY_TASK_EVIDENCE_RESTRICTED',403,'引用资料当前不可读，不因任务权限扩大资料范围');
 if(artifact.currentVersionNo!==ref.version)throw taskError('STUDY_TASK_EVIDENCE_CHANGED',409,'引用资料已换版，请重新核对固定版本');
 const version=await db.researchArtifactVersion.findFirst({where:{...scope(authority),artifactId:artifact.id,versionNo:ref.version}});
 if(!version||version.contentHash!==ref.contentHash||version.sourceSnapshotHash!==ref.sourceSnapshotHash||typeof version.contentMd!=='string'||digest(version.contentMd)!==ref.contentHash)
  throw taskError('STUDY_TASK_EVIDENCE_CHANGED',409,'引用版本或内容哈希无法核对，不提交旧引用');
 return {artifact,version};
}
export async function verifyTaskEvidence(db,authority,refs){
 if(!refs?.length)return [];
 if(!await canReadTaskEvidence(db,authority))throw taskError('STUDY_TASK_EVIDENCE_RESTRICTED',403,'当前没有该Study资料读取权限；可保留完成说明，不扩大资料授权');
 const normalized=refs.map(parseTaskEvidenceRef);
 // Pin existing artifact pointers for the remainder of the caller's transaction.
 const ids=[...new Set(normalized.map(ref=>ref.artifactId))].sort();
 await db.$queryRaw`SELECT id FROM research_artifact WHERE "tenantId"=${authority.tenantId} AND "studyGroupId"=${authority.studyGroupId}
  AND "researchProjectId"=${authority.researchProjectId} AND id=ANY(${ids}::text[]) ORDER BY id FOR SHARE`;
 for(const ref of normalized)await checkedVersion(db,authority,ref);
 return normalized;
}
export async function presentTaskEvidence(db,authority,raw){
 if(!Array.isArray(raw)||raw.length===0)return [];
 if(raw.length>10)return[{available:false}];
 try{
  if(!await canReadTaskEvidence(db,authority))return[{available:false}];
  const items=[];
  for(const value of raw){const ref=parseTaskEvidenceRef(value),{artifact}=await checkedVersion(db,authority,ref);items.push({available:true,...ref,title:artifact.title});}
  return items;
 }catch(error){if(error.code?.startsWith('STUDY_TASK_'))return[{available:false}];throw error;}
}
export async function readTaskEvidenceOptions(db,authority,query,cursor){
 if(!await canReadTaskEvidence(db,authority))return {items:[],nextCursor:null,availability:'restricted'};
 const binding={...authority,researchProjectId:authority.researchProjectId+'-completion-evidence'};
 const last=query.cursor?cursor.decode(binding,query,query.cursor):null;
 const rows=await db.researchArtifact.findMany({where:{...ownWhere(authority),...(query.q?{title:{contains:query.q,mode:'insensitive'}}:{}),...(last?{OR:[{createdAt:{lt:last.createdAt}},{createdAt:last.createdAt,id:{lt:last.id}}]}:{})},select:{id:true,title:true,currentVersionNo:true,createdAt:true,typeKey:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:query.limit+1});
 const items=[];let invalidRecords=0;
 for(const artifact of rows.slice(0,query.limit)){
  const v=await db.researchArtifactVersion.findFirst({where:{...scope(authority),artifactId:artifact.id,versionNo:artifact.currentVersionNo},select:{contentHash:true,sourceSnapshotHash:true,contentMd:true}});
  if(!v||!/^[a-f0-9]{64}$/.test(v.contentHash)||!/^[a-f0-9]{64}$/.test(v.sourceSnapshotHash)||digest(v.contentMd)!==v.contentHash){invalidRecords++;continue;}
  items.push({kind:'artifact_version',artifactId:artifact.id,version:artifact.currentVersionNo,contentHash:v.contentHash,sourceSnapshotHash:v.sourceSnapshotHash,title:artifact.title,typeKey:artifact.typeKey});
 }
 return {items,nextCursor:rows.length>query.limit?cursor.encode(binding,query,rows[query.limit-1]):null,availability:'available',invalidRecords};
}
