import {assertApprovedInTransaction} from '../admission/service.mjs';
import {HUB_KEY,validId} from './contract.mjs';

// A navigation hint only. No source body/Study is loaded; the editor repeats target checks.
export function createHubCopyWorkspace({readTarget}){
 if(typeof readTarget!=='function')throw TypeError('HUB_COPY_TARGET_READER_REQUIRED');
 return async(tx,user,draft,blocks)=>{
  const actor=user?.accountId,block=Array.isArray(blocks)&&blocks.length===1?blocks[0]:null;
  if(!validId(actor)||!validId(draft?.id)||draft.typeKey!=='protocol_draft'||draft.ownerAccountId!==actor||draft.createdBy!==actor||!draft.idempotencyKey?.startsWith('hub-asset-copy:'+actor+':')||!/^[-A-Za-z0-9_]{8,128}$/.test(draft.idempotencyKey.slice(('hub-asset-copy:'+actor+':').length))||block?.type!=='rh-hub-asset-copy.v1'||block.ownerAccountId!==actor||block.targetProjectId!==draft.researchProjectId||!validId(block.targetStudyId))return false;
  try{
   await assertApprovedInTransaction(tx,user,HUB_KEY);
   const [row]=await tx.$queryRawUnsafe('SELECT rh_hub_asset.copy_fact($1) AS fact',draft.id),fact=row?.fact;
   if(!fact||fact.actor_id!==actor||fact.target_artifact_id!==draft.id||fact.target_study_id!==block.targetStudyId)return false;
   const [binding]=await tx.$queryRawUnsafe('SELECT id,study_group_id,execution_project_id FROM rh_research.study_binding WHERE tenant_id=$1 AND id=$2',user.tenantId,fact.target_study_id);
   if(!binding||binding.study_group_id!==draft.studyGroupId||binding.execution_project_id!==draft.researchProjectId)return false;
   const target=await readTarget(tx,user,{artifactId:draft.id,copyFact:fact});
   return target?.id===draft.id&&target.studyId===fact.target_study_id;
  }catch(error){if([401,403,404,409].includes(error.status??error.getStatus?.()))return false;throw error;}
 };
}
