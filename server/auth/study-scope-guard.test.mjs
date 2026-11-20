import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubStudyScopeGuard} from './study-scope-guard.mjs';

function harness({role='tenant_admin',required=true,missing,projectRequired=true}={}){
 const user={tenantId:'hub',accountId:'actor',authVersion:3,role};let nativeCalls=0,reads=0;
 const account={id:'actor',role:'tenant_admin',isTenantAdmin:true};
 const tx={account:{findFirst:async({where})=>{assert.equal(where.tenantId,'hub');assert.equal(where.authVersion,3);return missing==='account'?null:account;}},studyGroup:{findFirst:async({where})=>{assert.equal(where.id,'group');assert.equal(where.tenantId,'hub');return missing==='group'?null:{id:'group'};}},researchProject:{findFirst:async({where})=>{assert.equal(where.id,'project');assert.equal(where.studyGroupId,'group');assert.equal(where.tenantId,'hub');return missing==='project'?null:{id:'project'};}}};
 const request={user,headers:{'x-study-group-id':'group',...projectRequired&&{'x-research-project-id':'project'}}};
 const reflector={getAllAndOverride:key=>key==='requireStudyGroup'?required:projectRequired};
 const load=(_path,name)=>name==='lockAuthorizationMutation'?async()=>{}:value=>{assert.equal(typeof value,'string');return value;};
 const guard=createHubStudyScopeGuard({native:{canActivate:async()=>{nativeCalls++;return true;}},reflector,prisma:{elevated:{$transaction:async fn=>{reads++;return fn(tx);}}},load,allowedTenantIds:['hub']});
 const context={getHandler:()=>{},getClass:()=>class{},switchToHttp:()=>({getRequest:()=>request})};
 return{guard,context,user,account,get nativeCalls(){return nativeCalls;},get reads(){return reads;}};
}
test('current tenant admin uses the same real-parent guard on every scoped Hub controller',async()=>{const h=harness();assert.equal(await h.guard.canActivate(h.context),true);assert.equal(h.nativeCalls,0);assert.equal(h.user.studyGroupId,'group');assert.equal(h.user.researchProjectId,'project');});
for(const missing of ['account','group','project'])test('rejects missing current '+missing,async()=>{const h=harness({missing});assert.equal(await h.guard.canActivate(h.context),false);assert.equal(h.user.studyGroupId,undefined);});
test('does not trust a stale admin role or grant membership to a different tenant',async()=>{const h=harness();h.account.isTenantAdmin=false;assert.equal(await h.guard.canActivate(h.context),false);const other=harness();other.user.tenantId='other';assert.equal(await other.guard.canActivate(other.context),false);assert.equal(other.reads,0);});
test('ordinary members and unscoped routes retain the native guard',async()=>{for(const options of [{role:'researcher'},{required:false}]){const h=harness(options);assert.equal(await h.guard.canActivate(h.context),true);assert.equal(h.nativeCalls,1);assert.equal(h.reads,0);}});
