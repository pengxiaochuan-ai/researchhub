import test from'node:test';import assert from'node:assert/strict';import{runtimeProfileProjection}from'./profile.mjs';
const p={accountId:'a',tenantId:'tenant',authVersion:0},profile={...p,role:'tenant_admin',isTenantAdmin:true,studyGroups:[]};
test('tenant admin sees actual tenant studies without creating group or project memberships',async()=>{
 const tx={account:{findFirst:async()=>({id:'a'})},studyGroup:{findMany:async()=>[{id:'g',name:'Group',slug:'g',tenantId:'tenant'}]},researchProject:{findMany:async()=>[{id:'project',name:'Study',studyGroupId:'g',tenantId:'tenant'}]}},project=runtimeProfileProjection({prisma:{elevated:{$transaction:fn=>fn(tx)}},scope:{allowedTenantIds:['tenant']},lockAuthorization:async()=>{}});
 const r=await project(profile,p);assert.equal(r.studyGroups[0].researchProjects[0].id,'project');assert.deepEqual(r.studyGroups[0].role.buttonPermissions,['*']);
 tx.account.findFirst=async()=>null;await assert.rejects(project(profile,p),e=>e.status===401);
});
test('researchers retain actual memberships and cannot borrow the admin projection',async()=>{
 const original={...profile,role:'researcher',isTenantAdmin:false},project=runtimeProfileProjection({prisma:{},scope:{allowedTenantIds:['tenant']},lockAuthorization:()=>assert.fail('must not run admin query')});assert.equal(await project(original,p),original);await assert.rejects(project(profile,{...p,tenantId:'foreign'}),e=>e.status===401);
});
