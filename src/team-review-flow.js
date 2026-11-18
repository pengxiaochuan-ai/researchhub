// This prepares a proposal only. Approval remains a separate explicit command.
import {sameTeamDraft} from './team-draft-equality.js';
// currentRevision is the snapshot read for THIS edit, not a fresh revision
// fetched during submission. Keep later concurrent changes detectable by CAS.
export const teamEditRevision=workspace=>workspace.currentRevision??workspace.baseRevision;
export const requiresPublicConfirmation=preview=>preview.audience==='public'&&(!preview.current||preview.publicExposure===true);
export const manualInstitutionKey=data=>data.verificationMethod==='administrator'?JSON.stringify([...new Set([data.organization,...(data.members??[]).filter(m=>!m.entityId).map(m=>m.organization)].map(o=>o?.entityId).filter(Boolean))].sort()):null;
export const hasUnsavedTeamWork=({dirty,pending,busy})=>Boolean(dirty||pending||busy);
export const teamReviewCheckKey=(workspace,dirty,audience)=>workspace?.id&&workspace.reviewedVersion===workspace.version&&!dirty&&audience===workspace.publishedAudience?JSON.stringify([workspace.id,workspace.version,workspace.currentRevision,audience]):null;
export function teamReviewCheckOutcome(preview){if(!Array.isArray(preview?.changes)||!Array.isArray(preview?.issues))throw Error('审核状态暂未核对完成，请重试。');return preview.changes.length?'needed':'unchanged';}
export async function prepareTeamReview({client,workspace,data,dirty,audience='tenant',requestKey,onSaved=()=>{},onRequest=()=>{},isCurrent=()=>true,institutionSnapshots=[],onInstitutionsChanged=()=>{}}){
 const current=()=>{if(!isCurrent())throw new DOMException('身份或对象已变化','AbortError');};
 current();let saved=workspace;
 const baseRevision=teamEditRevision(workspace);
 if(dirty||!workspace.hasDraft||workspace.baseRevision!==baseRevision||data?.verificationMethod&&(workspace.data?.verificationMethod??'sources')!==data.verificationMethod){
  const body={data:{...data,directions:(data.directions??[]).map(x=>x.trim()).filter(Boolean)},requestKey};
  const request=workspace.id?{operation:'save',id:workspace.id,body:{...body,expectedVersion:workspace.version,baseRevision}}:{operation:'create',body};
  onRequest(request);
  const result=workspace.id?await client.saveTeamWorkspace(workspace.id,request.body):await client.createTeamWorkspace(request.body);
  current();try{saved=await client.teamWorkspace(result.id);}catch(e){current();if(e.name==='AbortError'||e.status===401||e.status===403&&e.code!=='DIRECTORY_ORIGIN_REJECTED')throw e;throw Object.assign(Error('草稿已返回保存成功，资料暂未回读完成；请核对原提交结果，不要重新提交。'),{status:503,uncertain:true,postCommit:true,cause:e});}current();await onSaved(saved);current();
 }
 const preview=await client.previewTeamWorkspace(saved.id,audience);current();
 if(data?.verificationMethod==='administrator'&&(preview.jointInstitutions??[]).some(item=>!institutionSnapshots.some(old=>old.id===item.id&&sameTeamDraft(old.profile,item.profile)))){
  onInstitutionsChanged();throw Object.assign(Error('机构资料已变化，正在刷新核对内容；本次未提交审核。团队输入与理由已保留，请核对关联机构后重试。'),{code:'DIRECTORY_INSTITUTION_CHANGED',status:409});
 }
 return preview;
}
