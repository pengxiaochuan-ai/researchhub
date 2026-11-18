import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePolicySections} from './policy-input.mjs';
test('records current actor and timestamp, never client supplied responsibility',()=>{
 const at=new Date('2026-11-11T00:00:00.000Z');
 const sections=normalizePolicySections({blinding:{status:'not_applicable',source:'合成依据',reason:'合成单臂'}},'actor',at);
 assert.equal(sections.blinding.decidedBy,'actor');assert.equal(sections.blinding.decidedAt,at.toISOString());assert.equal(sections.ethics.status,'missing');
 assert.throws(()=>normalizePolicySections({blinding:{status:'not_applicable',source:'x',reason:'x',decidedBy:'forged'}},'actor',at));
});
test('draft sections may be incomplete but unexpected keys and unsupported values are rejected',()=>{
 assert.equal(normalizePolicySections({ethics:{status:'configured',rules:{}}},'actor',new Date()).ethics.status,'configured');
 assert.throws(()=>normalizePolicySections({unknown:{status:'configured'}},'actor',new Date()));
 assert.throws(()=>normalizePolicySections({ethics:{status:'pass'}},'actor',new Date()));
 assert.throws(()=>normalizePolicySections({ethics:{status:'configured',rules:{unknown:'x'}}},'actor',new Date()));
});
test('approval authority requires server verified admin or active project manager with configured workbench permission', async()=>{
 const {canManageRelease}=await import('./policy-input.mjs');
 assert.equal(canManageRelease({account:{role:'researcher',isTenantAdmin:false},projectMember:null,groupMember:null,hubOwner:true}),false);
 const base={account:{tenantId:'t',role:'researcher',isTenantAdmin:false},projectMember:{status:'active',roleKey:'project_manager'},groupMember:{status:'active',role:{tenantId:'t',status:'active',menuPermissions:['workbench'],buttonPermissions:['study.configure']}}};
 assert.equal(canManageRelease(base),true);
 assert.equal(canManageRelease({...base,account:{...base.account,isTenantAdmin:true}}),false);
 assert.equal(canManageRelease({...base,projectMember:{...base.projectMember,status:'disabled'}}),false);
 assert.equal(canManageRelease({account:{role:'tenant_admin',isTenantAdmin:false}}),false);
 assert.equal(canManageRelease({account:{role:'tenant_admin',isTenantAdmin:true}}),true);
});
