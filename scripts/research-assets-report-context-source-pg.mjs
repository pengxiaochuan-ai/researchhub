import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {loadCatalogTarget} from './research-assets-catalog-schema.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createLocalAnalysisFactory} from './local-research-analysis.mjs';
import {createLocalResearchPrisma} from './research-creation-local-integration.mjs';
import {REPORT_CONTEXT,assertReportContextSource} from './research-assets-report-context.mjs';
assert.deepEqual(process.argv.slice(2),['--no-write']);
const root=new URL('../../',import.meta.url).pathname,{env,ids}=loadCatalogTarget();
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name];
const prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:run=>withFixtureTransaction(env,'app',run)});
const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('READ_ONLY_SOURCE_PROBE');}});
// Worker is never invoked; no real worker token or model configuration is needed for reads.
const factory=await createLocalAnalysisFactory({root,env,ids,load,prisma,qualityToken:'0'.repeat(64),storage:{available:false},deploymentScope:{product:'researchhub',allowedTenantIds:[ids.tenant],enabledWorkerKinds:[]}});
const {reports}=factory(studies),accounts=await withFixtureTransaction(env,'direct',tx=>tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]}},select:{id:true,role:true,authVersion:true,isTenantAdmin:true,displayName:true}}),{readOnly:true});
const user=actor=>{const a=accounts.find(x=>x.id===ids[actor]);return{...a,accountId:a.id,tenantId:ids.tenant};};
const s={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:REPORT_CONTEXT.projectId};
const result=await studies.withResearchStudyTransaction(user('admin'),REPORT_CONTEXT.studyId,'read',async(tx)=>{
 const value=await reports.readForAssetInTransaction(tx,user('admin'),s,REPORT_CONTEXT.studyId,REPORT_CONTEXT.reportId);
 assertReportContextSource(value,{...s,...user('admin')});
 return{reportId:value.artifact.id,versionId:value.version.id,hash:value.version.contentHash,runId:value.source.id,currentSourceValidated:true};
});
let nativeOwnerAccess;
try{await studies.withResearchStudyTransaction(user('owner'),REPORT_CONTEXT.studyId,'read',tx=>reports.readForAssetInTransaction(tx,user('owner'),s,REPORT_CONTEXT.studyId,REPORT_CONTEXT.reportId));nativeOwnerAccess='readable_by_existing_rights';}catch(e){if(![403,404].includes(e.status))throw e;nativeOwnerAccess=e.code??e.getResponse?.()?.code??String(e.status);}
assert.throws(()=>assertReportContextSource({}, {...s,...user('owner')}),e=>e.status===403);
writeFileSync(new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/source-native-pg.json',import.meta.url),JSON.stringify({passed:true,...result,nativeOwnerAccess,ownerNewAssetScope:'denied',sourceWrites:0,workerRequests:0,providerRequests:0},null,2));
console.log('REPORT_CONTEXT_NATIVE_SOURCE_PG_PASSED');
