import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {authorizeBusinessAssetStudy} from '../server/research-assets/business-access.mjs';import {createBusinessAssetRegistration} from '../server/research-assets/business-registration.mjs';
import {BUSINESS_LOCAL_MEMBER,createBusinessLocalBudget,createBusinessLocalEventBudget,projectBusinessLocalActions} from '../server/research-assets/business-local.mjs';
import {loadCatalogRecords,createAssetCatalogReader} from './local-research-assets-catalog-read.mjs';import {createAssetGovernance,validateAssetGovernance} from './local-research-assets-governance.mjs';import {createAssetLifecycle} from './local-research-assets-lifecycle.mjs';import {memberInput,memberKinds} from './research-assets-business-member-data.mjs';
assert.deepEqual(process.argv.slice(2),['--rollback-only']);const{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const rollback=Error('EXPECTED_MEMBER_ASSET_ROLLBACK');let complete=false;const created=[];
try{await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('wp01:official',0))");await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",'wp01:tenant:'+ids.tenant);
 const accounts=await tx.account.findMany({where:{tenantId:ids.tenant,id:{in:[BUSINESS_LOCAL_MEMBER,ids.admin]}}});assert.equal(accounts.length,2);
 const user=id=>{const a=accounts.find(a=>a.id===id);return{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:a.id,role:a.role,authVersion:a.authVersion};};
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 const withAccess=async(u,permission,run)=>{for(const[k,v]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project],['app.account_id',u.accountId],['app.auth_version',String(u.authVersion)]])await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)',k,v);return run(tx,await authorizeBusinessAssetStudy({tx,user:u,scope:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project},permission}));};
 const loadRecords=async(tx,p,s)=>projectBusinessLocalActions(await loadCatalogRecords(tx,p,s,{family:'business'}),p),service=createBusinessAssetRegistration({withAccess,syntheticOnly:true,beforeCommit:createBusinessLocalBudget(ids)}),reader=createAssetCatalogReader({withAccess,loadRecords}),lifecycle=createAssetLifecycle({withAccess,loadRecords,family:'business',beforeCommit:createBusinessLocalEventBudget(ids),auditOptions:{syntheticOnly:true}}),governance=createAssetGovernance({ids,withAccess,loadRecords,validate:v=>validateAssetGovernance(v,{ids,family:'business'}),permissionFor:v=>v.action==='submit'?'artifact.edit':'artifact.review',beforeCommit:createBusinessLocalEventBudget(ids),auditOptions:{syntheticOnly:true}}),member=user(BUSINESS_LOCAL_MEMBER),admin=user(ids.admin);
 for(let i=0;i<6;i++){
  const input=memberInput(ids,i),v1=await service.register(member,input);assert.deepEqual(await service.register(member,input),v1);created.push(v1.assetId);
  const revised={...input,contentMd:input.contentMd+'\n\n修订：补齐合成说明。',baseVersion:1,expectedRevision:1,requestKey:input.requestKey+'-v2'};assert.equal((await service.revise(member,v1.assetId,revised)).revision,2);
  assert.equal((await reader.detail(member,v1.assetId,1)).contentMd,input.contentMd);
  const execute=async(s,u,action,extra={})=>{const o=await s.options(u,v1.assetId,2);return s.execute(u,v1.assetId,{action,version:2,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,contentHash:o.contentHash,policyHash:o.policyHash,requestKey:input.requestKey+'-'+action,...(action==='submit'?{}:{reason:'本轮合成资产核对'}),...extra});};
  assert.equal((await execute(lifecycle,member,'trash')).revision,3);assert.equal((await execute(lifecycle,member,'restore')).revision,4);assert.equal((await execute(governance,member,'submit')).revision,5);
  assert.equal((await execute(governance,admin,'review',{conclusion:'approved',contentChecked:true,rightsChecked:true,selfReviewAcknowledged:false})).revision,6);
 }
 const rows=await reader.catalog(member,{});assert.equal(rows.stats.all,6);assert.equal(rows.stats.protocol,2);for(const kind of ['dataset','instrument','analysis','publication'])assert.equal(rows.stats[kind],1);
 await assert.rejects(service.register(member,{...memberInput(ids,0),requestKey:'c1-member-over-budget'}),e=>e.status===409);
 await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');complete=true;throw rollback;
});}catch(e){if(e!==rollback)throw e;}
assert(complete);const result={passed:true,at:new Date().toISOString(),predictedAssets:6,kinds:memberKinds,predictedVersions:12,predictedEvents:36,persistentAssets:0,persistentVersions:0,persistentEvents:0,mode:'real-app-role-rollback',modelCalls:0};writeFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/business-member-assets-prediction.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
