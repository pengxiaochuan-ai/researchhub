import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {verifyTaskEvidence} from './evidence.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const authority={tenantId:'t',studyGroupId:'g',researchProjectId:'p',actorAccountId:'owner'};
const ref={kind:'artifact_version',artifactId:'artifact',version:1,contentHash:hash('本人已有合成草稿'),sourceSnapshotHash:'b'.repeat(64)};
function fixture(){
 const artifact={id:'artifact',tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:'owner',createdBy:'owner',status:'draft',deletedAt:null,typeKey:'protocol_draft',currentVersionNo:1};
 const version={...ref,versionNo:1,contentMd:'本人已有合成草稿'};
 return{artifact,version,db:{$queryRaw:async()=>[],studyGroupMembership:{findFirst:async()=>({role:{menuPermissions:['artifacts'],buttonPermissions:['artifact.read']}})},researchProjectMembership:{findFirst:async()=>({id:'member'})},researchArtifact:{findFirst:async()=>artifact},researchArtifactVersion:{findFirst:async()=>version}}};
}
test('controlled_evidence_revalidates_own_real_parent_version_and_hash',async()=>{
 const f=fixture();assert.deepEqual(await verifyTaskEvidence(f.db,authority,[ref]),[ref]);
 f.artifact.currentVersionNo=2;await assert.rejects(()=>verifyTaskEvidence(f.db,authority,[ref]),{code:'STUDY_TASK_EVIDENCE_CHANGED'});
});
test('task_authority_does_not_grant_artifact_or_other_owner_access',async()=>{
 const f=fixture();f.db.studyGroupMembership.findFirst=async()=>null;
 await assert.rejects(()=>verifyTaskEvidence(f.db,authority,[ref]),{code:'STUDY_TASK_EVIDENCE_RESTRICTED'});
 const other=fixture();other.artifact.ownerAccountId='other';await assert.rejects(()=>verifyTaskEvidence(other.db,authority,[ref]),{code:'STUDY_TASK_EVIDENCE_RESTRICTED'});
});
test('corrupted_or_disappeared_artifact_body_never_becomes_completion_evidence',async()=>{
 const f=fixture();f.version.contentMd='已被改变';await assert.rejects(()=>verifyTaskEvidence(f.db,authority,[ref]),{code:'STUDY_TASK_EVIDENCE_CHANGED'});
});
test('scalar_permission_json_never_grants_artifact_read',async()=>{
 const f=fixture();f.db.studyGroupMembership.findFirst=async()=>({role:{menuPermissions:['artifacts'],buttonPermissions:'artifact.read'}});
 await assert.rejects(()=>verifyTaskEvidence(f.db,authority,[ref]),{code:'STUDY_TASK_EVIDENCE_RESTRICTED'});
});
test('current_task_admin_needs_no_membership_but_still_only_own_same_study_evidence',async()=>{
 const f=fixture();f.db.studyGroupMembership.findFirst=async()=>null;
 assert.deepEqual(await verifyTaskEvidence(f.db,{...authority,isTenantAdmin:true},[ref]),[ref]);
 f.artifact.ownerAccountId='other';await assert.rejects(()=>verifyTaskEvidence(f.db,{...authority,isTenantAdmin:true},[ref]),{code:'STUDY_TASK_EVIDENCE_RESTRICTED'});
});
