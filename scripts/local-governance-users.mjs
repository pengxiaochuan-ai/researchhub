import {readFileSync} from 'node:fs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createGovernanceUsers} from '../server/governance-users/service.mjs';
import {createGovernanceUsersController} from '../server/governance-users/controller.mjs';
export function createLocalGovernanceUsers({root,ids,env,load,require}){
 const fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-p2/fixture.json','utf8'));
 if(fixture.tenantId!==ids.tenant||!fixture.studyPrepared||fixture.accounts.length!==2)throw Error('P2_FIXTURE_NOT_READY');
 const member=fixture.accounts.find(a=>a.kind==='member');if(!member?.id)throw Error('P2_FIXTURE_NOT_READY');
 const lock=load('common/worker-publication','lockAuthorizationMutation');
 const bind=(tx,tenant)=>({withTenantTransaction:(t,_g,_p,fn)=>{if(t!==tenant)throw Error('P2_BOUND_TENANT_REJECTED');return fn(tx);}});
 const service=createGovernanceUsers({
  transact:(p,fn)=>{if(p?.tenantId!==ids.tenant)throw Object.assign(Error('当前账号无权执行此操作。'),{status:403});return withFixtureTransaction(env,'app',async tx=>{await lock(tx,p.tenantId,{includeOfficial:true});return fn(tx);});},
  legacyUpdate:(tx,user,id,dto)=>new(load('accounts/accounts.service','AccountsService'))(bind(tx,user.tenantId)).update(user,id,dto),
  legacyChangeMember:(tx,user,id,input)=>new(load('pi-governance/pi-governance.service','PiGovernanceService'))(bind(tx,user.tenantId)).changeMember(user,id,input),
  canMutate:(kind,id)=>kind==='account'?id===member.id:id===fixture.projectId,
  assertMutationScope:(kind,id)=>{if(kind==='account'?id!==member.id:id!==fixture.projectId)throw Object.assign(Error('当前对象仅支持查看，请选择可维护的对象。'),{status:403,code:'HUB_USERS_OBJECT_READONLY'});},
 });
 return{Controller:createGovernanceUsersController({require,service,origin:'http://127.0.0.1:19501'}),service,fixture:{tenantId:fixture.tenantId,groupId:fixture.groupId,projectId:fixture.projectId,readerRoleId:'wp02-invite-3a7f7604-reader'}};
}
