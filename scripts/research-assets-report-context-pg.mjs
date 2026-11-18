import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalResearchPrisma} from './research-creation-local-integration.mjs';
import {createLocalAnalysisFactory} from './local-research-analysis.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createCatalogAccess} from './research-assets-catalog-access.mjs';
import {createAssetCatalogReader} from './local-research-assets-catalog-read.mjs';
import {createAssetGovernance} from './local-research-assets-governance.mjs';
import {createReportAssetContext,assertReportContextPolicy} from './local-research-assets-report-context.mjs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
const args=process.argv.slice(2),phase=args.length===3&&args[1]==='--case'?args[2]:'create';
assert(args[0]==='--rollback-only'&&(['create','revise','approve'].includes(phase))&&(args.length===1||args.length===3));
const root=new URL('../../',import.meta.url).pathname,{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name];
const checks=[];
await assert.rejects(()=>withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);assert.equal(await tx.researchArtifact.count({where:{id:c.assetId}}),0,'NEW_SLOT_ALREADY_USED');
 const a=await tx.account.findUnique({where:{id:ids.admin}}),u={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:c.projectId,accountId:a.id,role:a.role,authVersion:a.authVersion,isTenantAdmin:true};
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 const prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:run=>run(tx)});
 const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('NO_SOURCE_MUTATION');}});
 const factory=await createLocalAnalysisFactory({root,env,ids,load,prisma,qualityToken:'0'.repeat(64),storage:{available:false},deploymentScope:{product:'researchhub',allowedTenantIds:[ids.tenant],enabledWorkerKinds:[]}});factory(studies);
 const withAccess=createCatalogAccess({ids:{...ids,project:c.projectId},transaction:(user,run)=>studies.withResearchStudyTransaction(user,c.studyId,'read',run)});
 const context=createReportAssetContext({ids,withAccess,assertSources:assertReportContextPolicy}),governance=createAssetGovernance({ids,withAccess,assertSources:assertReportContextPolicy}),reader=createAssetCatalogReader({withAccess,assertSources:assertReportContextPolicy});
 const notes={purpose:'合成方法报告追溯引用',limitations:'历史合成结果，不用于新研究结论',rightsEvidence:'本人原创合成材料，限本Study私有登记与审核',requestKey:'rc-pg-create-20261116'};
 assert.equal((await context.preview(u)).existing,null);
 const created=await context.register(u,notes);assert.equal(created.assetId,c.assetId);
 if(phase==='create'){
  assert.deepEqual(await context.register(u,notes),created);
  await assert.rejects(()=>context.register(u,{...notes,purpose:'改变输入'}),e=>e.status===409);
  assert.equal((await context.register(u,{...notes,requestKey:'rc-pg-other-key-20261116'})).assetId,c.assetId);
  checks.push('actual fixed report registered once; same-key replay; changed input rejected; different key same source returns same object');
 }
 async function act(action,extra={}){const r=await tx.researchArtifact.findUnique({where:{id:c.assetId},select:{currentVersionNo:true}}),o=await governance.options(u,c.assetId,r.currentVersionNo);return governance.execute(u,c.assetId,{action,version:o.version,expectedRevision:o.expectedRevision,contentHash:o.contentHash,policyHash:o.policyHash,identityRevision:o.identityRevision,requestKey:'rc-pg-'+action+'-'+checks.length,...extra});}
 if(phase==='revise'){
  await act('submit');const returned=await act('review',{conclusion:'changes_requested',reason:'补充历史结果用途限制',contentChecked:true,rightsChecked:true,selfReviewAcknowledged:true});
  await context.revise(u,{...notes,limitations:'补充：不复制原始数据，不作为新研究结果',requestKey:'rc-pg-revise-20261116',baseVersion:1,expectedRevision:returned.revision});
  const v=await tx.researchArtifactVersion.findMany({where:{artifactId:c.assetId},select:{versionNo:true,contentHash:true}});assert.equal(v.length,2);assert(v.every(x=>x.contentHash===c.hash));checks.push('native submit/return/revision CAS creates v2 without changing the source or scientific values');
 }
 if(phase==='approve'){
  await act('submit');await act('review',{conclusion:'approved',reason:'已核对固定来源和合成用途，本人审核留痕',contentChecked:true,rightsChecked:true,selfReviewAcknowledged:true});
  const [r]=await tx.$queryRawUnsafe('SELECT working_state,release_state,released_version_no FROM rh_asset.asset_registry WHERE asset_id=$1',c.assetId);assert.equal(r.working_state,'approved');assert.equal(r.release_state,'unreleased');assert.equal(r.released_version_no,null);checks.push('native approval remains private and unpublished');
 }
 const list=await reader.catalog(u,{});assert.equal(list.total,1);assert.equal(list.items[0].scope,'private');
 await assert.rejects(()=>context.preview({...u,accountId:ids.owner,role:'researcher',isTenantAdmin:false}),e=>[403,404].includes(e.status??e.getStatus?.()));
 checks.push('actual catalog reads the fixed native report; owner does not enter this new asset scope');
 await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');checks.push('native deferred constraints checked; all writes rolled back');
 throw Error('REPORT_CONTEXT_TEST_ROLLBACK');
}),/REPORT_CONTEXT_TEST_ROLLBACK/);
await withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);assert.equal(await tx.researchArtifact.count({where:{id:c.assetId}}),0);},{readOnly:true});
writeFileSync(new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/pg-rollback-'+phase+'.json',import.meta.url),JSON.stringify({passed:true,checks,persistentNewAssets:0,providerRequests:0},null,2));
console.log('REPORT_CONTEXT_PG_ROLLBACK_PASSED');
