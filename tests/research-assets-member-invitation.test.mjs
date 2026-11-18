import test from 'node:test';import assert from 'node:assert/strict';
import {assetMemberInvitationTarget,assetMemberRoleAllowed,ASSET_MEMBER_ROLE,ASSET_MEMBER_EMAIL} from '../server/research-assets/member-local-invitation.mjs';
test('asset invitation binds the server-stored target role, recipient and exact Study',()=>{
 const ids={tenant:'t',group:'g',project:'p'},row={studyGroupId:'g',researchProjectId:'p',targetRoleId:ASSET_MEMBER_ROLE,email:ASSET_MEMBER_EMAIL};
 assert.equal(assetMemberInvitationTarget(ids,row).readerRoleId,ASSET_MEMBER_ROLE);
 for(const changed of [{email:'other@example.org'},{studyGroupId:'other'},{researchProjectId:'B'},{targetRoleId:'other'}])assert.equal(assetMemberInvitationTarget(ids,{...row,...changed}),null);
});
test('asset invitation role admits exactly three asset actions, no wildcard or extra capability',()=>{
 const role={id:ASSET_MEMBER_ROLE,menuPermissions:['artifacts'],buttonPermissions:['artifact.read','artifact.create','artifact.edit']};assert(assetMemberRoleAllowed(role));
 for(const changed of [{id:'old-role'},{menuPermissions:['artifacts','workbench']},{buttonPermissions:[...role.buttonPermissions,'chat.use']},{buttonPermissions:['*']},{buttonPermissions:['artifact.read','artifact.read','artifact.edit']}])assert(!assetMemberRoleAllowed({...role,...changed}));
});
