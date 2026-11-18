import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchStudiesService} from './commands.mjs';
const principal={tenantId:'tenant-a',accountId:'account-a',authVersion:0};
function setup(legacyHints){
 const group={id:'group-a',tenantId:'tenant-a',status:'active',name:'研究组'},project={id:'project-a',tenantId:'tenant-a',studyGroupId:'group-a',status:'active',name:'已授权研究'};
 const membership={tenantId:'tenant-a',studyGroupId:'group-a',status:'active',role:{tenantId:'tenant-a',status:'active',menuPermissions:['knowledge','workbench','artifacts'],buttonPermissions:['chat.use','artifact.read']}};
 const member={tenantId:'tenant-a',studyGroupId:'group-a',researchProjectId:'project-a',status:'active'};
 const tx={account:{findFirst:async q=>q.select?{displayName:'本人',tenant:{name:'机构'}}:{id:'account-a',tenantId:'tenant-a',status:'active',authVersion:0,role:'researcher',isTenantAdmin:false,tenant:{status:'active'}}},studyGroup:{findFirst:async()=>group},researchProject:{findFirst:async()=>project},studyGroupMembership:{findFirst:async()=>membership},researchProjectMembership:{findFirst:async()=>member},$executeRaw:async()=>1};
 const service=createResearchStudiesService({prisma:{withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx)},scope:{product:'researchhub',allowedTenantIds:['tenant-a']},lockAuthorization:async()=>{},createResearchProject:async()=>{throw Error('not a write test');},legacyHints});return{service,group,project,membership};
}
test('production legacy detail defaults design hint false',async()=>{
 const{service}=setup();assert.equal((await service.executionDetail(principal,'project-a',{studyGroupId:'group-a'})).project.canOpenDesignWorkspace,false);
});
test('injected legacy design hint receives current transaction objects and preserves true result',async()=>{
 let received;const{service,group,project,membership}=setup(scope=>{received=scope;return{canOpenDesignWorkspace:true};});
 const result=await service.executionDetail(principal,'project-a',{studyGroupId:'group-a'});assert.equal(result.project.canOpenDesignWorkspace,true);assert.equal(received.user.accountId,principal.accountId);assert.equal(received.group,group);assert.equal(received.project,project);assert.equal(received.membership,membership);
});
