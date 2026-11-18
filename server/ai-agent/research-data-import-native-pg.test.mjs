import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';import {createResearchDataImportAccess} from './research-data-import-access.mjs';
const api=await import('../../scripts/ai-research-data-import-native.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const root='/Users/mac/aisciencesys/app/server/',require=createRequire(root+'package.json');require('ts-node').register({project:root+'tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'src/'+p+'.ts')[k];
const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),tenant='rh-kb-local-b0e2af9d-tenant',group='rh-kb-local-b0e2af9d-group',target={studyId:'rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090',studyGroupId:group,executionProjectId:'cmwcc7ft60002lua6zkvh0mxj'},user={tenantId:tenant,accountId:'rh-kb-local-b0e2af9d-owner',authVersion:5,role:'researcher',isTenantAdmin:false},source={sessionId:'cmweju2c70002lua2apggpflo',studyGroupId:group,researchProjectId:'rh-kb-local-b0e2af9d-project'};
test('P05 native adapter uses actual executing v2, fixed published form and narrow owner grant, ordinary filling still denies',async()=>{
 assert.equal(typeof api.createResearchDataImportNative,'function');
 await withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,tenant,group,target.executionProjectId,user.accountId);await load('common/worker-publication','lockAuthorizationMutation')(tx,tenant);
  const authority=createResearchDataImportAccess({authorizeRead:load('study-operations/formal-response-authority','authorizeFormalResponse')}),native=api.createResearchDataImportNative({load,authority});
  const info=await native.targetInTx(tx,user,target);assert.equal(info.protocol.versionNumber,2);assert.equal(info.protocol.status,'executing');assert.equal(info.form.id,'cmwcc7fux0002lux0dxq7ukdx');assert(info.fields.some(f=>f.key==='completed'));
  const allowed=await authority.currentInTx(tx,user,target,source,{scopeKey:'p05-import-20261113',capability:'profile.create'});assert.equal(allowed.permissionRef.kind,'study_grant');
  await assert.rejects(load('study-operations/formal-response-authority','authorizeFormalResponse')(tx,user,group,target.executionProjectId,'form.fill'),e=>e.getStatus?.()===403);
  await assert.rejects(native.resourceInTx(tx,user,target,source,{scopeKey:'p05-import-20261113',permissionRef:allowed.permissionRef,info},{kind:'correct',assignmentId:'none'}),e=>e.code==='DATA_IMPORT_ACTION_FORBIDDEN');
 },{readOnly:true});
});
