import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStatusTransition,advanceSessionVersion} from './account-status.mjs';
const actor={id:'admin',tenantId:'tenant',role:'tenant_admin',isTenantAdmin:true,status:'active',authVersion:5};
const target={id:'member',tenantId:'tenant',role:'researcher',isTenantAdmin:false,status:'active',authVersion:2};
const input={status:'disabled'};
test('status mutation uses current database administrator, never caller role claims',()=>{
 for(const change of [{status:'disabled'},{role:'researcher'},{isTenantAdmin:false},{authVersion:6}])assert.throws(()=>validateStatusTransition({actor:{...actor,...change},principal:{accountId:'admin',tenantId:'tenant',authVersion:5},target,input,activeAdmins:1}),{status:403});
});
test('self, platform account, cross-tenant target and last administrator are protected',()=>{
 const run=t=>validateStatusTransition({actor,principal:{accountId:'admin',tenantId:'tenant',authVersion:5},target:t,input,activeAdmins:1});
 for(const t of [{...target,id:'admin'},{...target,role:'platform_admin'},{...target,tenantId:'other'},{...target,role:'tenant_admin',isTenantAdmin:true}])assert.throws(()=>run(t));
});
test('no-op does not create a new operation or consume a session version',()=>{
 assert.throws(()=>validateStatusTransition({actor,principal:{accountId:'admin',tenantId:'tenant',authVersion:5},target,input:{status:'active'},activeAdmins:1}),{status:409});
});
test('disable and restore each invalidate all preceding credentials; version overflow rejects',()=>{
 assert.equal(advanceSessionVersion(2),3);assert.equal(advanceSessionVersion(3),4);
 for(const n of [-1,null,2147483647])assert.throws(()=>advanceSessionVersion(n),{status:409});
});
