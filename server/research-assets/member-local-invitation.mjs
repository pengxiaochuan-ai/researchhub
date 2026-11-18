// Approved synthetic invitation only; no change to default public invitation roles.
export const ASSET_MEMBER_ROLE='rh-c1-asset-only-20261117';
export const ASSET_MEMBER_EMAIL='asset.member.20261117@example.org';
export function assetMemberInvitationTarget(ids,row){
 if(row?.studyGroupId!==ids.group||row.researchProjectId!==ids.project||row.email!==ASSET_MEMBER_EMAIL||row.targetRoleId!==ASSET_MEMBER_ROLE)return null;
 return{tenantId:ids.tenant,groupId:ids.group,projectId:ids.project,readerRoleId:ASSET_MEMBER_ROLE};
}
export function assetMemberRoleAllowed(role){
 const exact=(actual,wanted)=>Array.isArray(actual)&&actual.length===wanted.length&&new Set(actual).size===actual.length&&wanted.every(x=>actual.includes(x));
 return role?.id===ASSET_MEMBER_ROLE&&exact(role.menuPermissions,['artifacts'])&&exact(role.buttonPermissions,['artifact.read','artifact.create','artifact.edit']);
}
