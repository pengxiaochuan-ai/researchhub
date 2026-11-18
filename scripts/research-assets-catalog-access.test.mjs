import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogAccess,authorizeCatalogScope} from './research-assets-catalog-access.mjs';
const ids={tenant:'t',group:'g',project:'p',owner:'o',admin:'a'};
const user={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'o',role:'researcher',authVersion:2};
test('aggregate can reuse current authorization within its existing locked transaction without nesting one',async()=>{
 let nested=0;const tx={account:{findFirst:async()=>({id:'o',role:'tenant_admin',authVersion:2,status:'active',tenant:{status:'active'}})},researchProject:{findFirst:async()=>({id:'p',name:'Authorized study'})},$executeRawUnsafe:async()=>{},$transaction:()=>{nested++;assert.fail('nested authorization transaction');}};
 const principal=await authorizeCatalogScope({ids,tx,user:{...user,role:'tenant_admin'},permission:'artifact.read'});assert.equal(principal.researchProjectId,'p');assert.equal(principal.isTenantAdmin,true);assert.equal(nested,0);
 await assert.rejects(authorizeCatalogScope({ids,tx,user:{...user,tenantId:'other'},permission:'artifact.read'}),e=>e.status===403);
 await assert.rejects(authorizeCatalogScope({ids,tx,user:{...user,role:'tenant_admin',authVersion:1},permission:'artifact.read'}),e=>e.status===401);
});
// This boundary double contains the actual current-account, parent and membership shapes;
// all query filtering is asserted independently, not a permissive global database mock.
function setup(overrides={}){
 const account={id:'o',tenantId:'t',role:'researcher',status:'active',authVersion:2,tenant:{status:'active'},...overrides.account};
 const membership=overrides.noMember?null:{status:'active',role:{status:'active',menuPermissions:['artifacts'],buttonPermissions:['artifact.read','artifact.edit']}};
 const tx={account:{findFirst:async({where})=>{assert.equal(where.id,user.accountId);assert.equal(where.tenantId,'t');return account;}},researchProject:{findFirst:async({where})=>{assert.deepEqual(where,{id:'p',tenantId:'t',studyGroupId:'g',status:'active',studyGroup:{tenantId:'t',status:'active'}});return overrides.projectMissing?null:{id:'p',tenantId:'t',studyGroupId:'g',status:'active'};}},studyGroupMembership:{findFirst:async()=>membership},researchProjectMembership:{findFirst:async()=>overrides.noProjectMember?null:{status:'active'}},$executeRawUnsafe:async(sql,...params)=>{assert.match(sql,/^SELECT set_config/);assert.equal(params.length,2);}};
 return createCatalogAccess({ids,transaction:async(received,run)=>{assert.equal(received,user);return run(tx);}});
}
test('catalog rebuilds current principal and never refreshes a stale JWT authVersion',async()=>{
 const access=setup();const result=await access(user,'artifact.read',async(_tx,p)=>p);
 assert.equal(result.accountId,'o');assert.equal(result.isTenantAdmin,false);assert.equal(result.authVersion,2);
 assert.equal(result.role,'researcher');
 await assert.rejects(setup({account:{authVersion:3}})(user,'artifact.read',()=>assert.fail('stale token must not execute')),e=>e.status===401);
 await assert.rejects(setup({account:{role:'tenant_admin'}})(user,'artifact.read',()=>assert.fail('stale role must not execute')),e=>e.status===401);
});
test('current Study parent, ordinary memberships and permissions are not replaced by a tenant string',async()=>{
 for(const overrides of [{noMember:true},{noProjectMember:true},{projectMissing:true},{account:{status:'disabled'}},{account:{tenant:{status:'disabled'}}}])await assert.rejects(setup(overrides)(user,'artifact.read',()=>assert.fail()),e=>[401,403].includes(e.status));
 await assert.rejects(setup()(user,'artifact.review',()=>assert.fail()),e=>e.status===403);
});
test('current tenant admin may act on this scope without rewriting or requiring Study membership',async()=>{
 // The role is read from the account; matching the token alone would not be enough.
 const adminUser={...user,role:'tenant_admin'};
 const account={id:'o',tenantId:'t',role:'tenant_admin',authVersion:2,status:'active',tenant:{status:'active'}};
 const tx={account:{findFirst:async()=>account},researchProject:{findFirst:async()=>({id:'p'})},studyGroupMembership:{findFirst:async()=>null},researchProjectMembership:{findFirst:async()=>null},$executeRawUnsafe:async()=>{}};
 const access=createCatalogAccess({ids,transaction:async(_u,run)=>run(tx)});
 const p=await access(adminUser,'artifact.review',async(_tx,p)=>p);assert.equal(p.isTenantAdmin,true);
 await assert.rejects(access({...adminUser,tenantId:'other'},'artifact.read',()=>assert.fail()),e=>e.status===403);
});
