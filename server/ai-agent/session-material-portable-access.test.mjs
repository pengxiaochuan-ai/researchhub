import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
const native=runtimeDependencies().load;

function harness({admin=false,revoked=false,missingParent=false,tools=['file.read'],assignments=[{scopeKey:'*',enabled:true}],missingSession=false}={}){
 const user={tenantId:'hub',studyGroupId:'another-study',researchProjectId:'another-project',accountId:'ordinary-user',authVersion:3};
 const account={id:user.accountId,tenantId:'hub',authVersion:revoked?4:3,status:'active',role:admin?'tenant_admin':'researcher',isTenantAdmin:admin,tenant:{status:'active'}};
 const role={menuPermissions:['knowledge','workbench'],buttonPermissions:['knowledge.edit','chat.use']};
 const tx={$queryRawUnsafe:async()=>[],account:{findFirst:async()=>account},studyGroup:{findFirst:async()=>missingParent?null:{id:user.studyGroupId}},researchProject:{findFirst:async()=>missingParent?null:{id:user.researchProjectId}},studyGroupMembership:{findFirst:async()=>admin?null:{role}},researchProjectMembership:{findFirst:async()=>admin?null:{id:'member'}},session:{findFirst:async()=>({tenantId:'hub',studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,agent:{status:'active',type:'research'},contextKey:'hub:lingshu-xinyu'})},agentConfig:{findFirst:async()=>({tools})},agentAccess:{findMany:async()=>[{enabled:true}]}};
 tx.agentAccess.findMany=async({where})=>{assert.equal(where.tenantId,'hub');assert.deepEqual(where.scopeKey.in,['*',user.accountId]);return assignments;};
 const findSession=tx.session.findFirst;tx.session.findFirst=async({where})=>{assert.equal(where.accountId,user.accountId);assert.equal(where.tenantId,user.tenantId);assert.equal(where.studyGroupId,user.studyGroupId);assert.equal(where.researchProjectId,user.researchProjectId);return missingSession?null:findSession();};
 tx.studyGroup.findFirst=async({where})=>{assert.deepEqual(where,{id:user.studyGroupId,tenantId:user.tenantId,status:'active'});return missingParent?null:{id:user.studyGroupId};};
 tx.researchProject.findFirst=async({where})=>{assert.deepEqual(where,{id:user.researchProjectId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,status:'active'});return missingParent?null:{id:user.researchProjectId};};
 const load=(path,name)=>name==='lockAuthorizationMutation'?async()=>{}:native(path,name);
 return{user,access:createLocalMaterialAccess({ids:{tenant:'hub'},load,transaction:(_user,fn)=>fn(tx)})};
}
test('material access uses real current membership instead of fixture account and Study IDs',async()=>{
 const {user,access}=harness();assert.equal(await access.transaction(user,'session',async(_tx,current)=>current.accountId),'ordinary-user');
});
test('tenant admin needs real active parents but no duplicate Study membership',async()=>{
 const {user,access}=harness({admin:true});assert.equal(await access.transaction(user,'session',async(_tx,current)=>current.isTenantAdmin),true);
});
for(const options of [{revoked:true},{missingParent:true},{tools:[]},{assignments:[]},{assignments:[{scopeKey:'*',enabled:true},{scopeKey:'ordinary-user',enabled:false}]},{missingSession:true}])test('current identity, real parents and configured tools remain mandatory '+JSON.stringify(options),async()=>{
 const {user,access}=harness(options);await assert.rejects(access.transaction(user,'session',async()=>assert.fail('must not execute')));
});
