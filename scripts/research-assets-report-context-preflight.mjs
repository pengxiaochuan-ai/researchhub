// Read-only admission probe. Never initializes fixtures or modifies business state.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

assert.deepEqual(process.argv.slice(2),['--readonly']);
const source={projectId:'cmwczp5hk0003lud9lsla5b75',studyId:'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d',
 reportId:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe',version:1,
 hash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b'};
const {env,ids}=loadCatalogTarget();
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const result=await withFixtureTransaction(env,'direct',async tx=>{
 await bindCatalogContext(tx,ids,ids.admin);
 const [mode]=await tx.$queryRawUnsafe('SHOW transaction_read_only');
 assert.equal(mode.transaction_read_only,'on');
 const r=await tx.researchArtifact.findFirst({where:{id:source.reportId,tenantId:ids.tenant,studyGroupId:ids.group,
  researchProjectId:source.projectId,ownerAccountId:ids.admin,deletedAt:null},
  select:{id:true,status:true,currentVersionNo:true,versions:{where:{versionNo:source.version},
   select:{id:true,versionNo:true,contentHash:true,contentMd:true,contentBlocks:true,sources:{select:{sourceType:true,sourceId:true}}}}}});
 assert(r);assert.equal(r.status,'released');assert.equal(r.currentVersionNo,source.version);assert.equal(r.versions.length,1);
 const v=r.versions[0],b=v.contentBlocks[0];
 assert.equal(v.contentHash,source.hash);assert.equal(createHash('sha256').update(v.contentMd).digest('hex'),source.hash);
 assert.equal(v.contentBlocks.length,1);assert.equal(b.schemaVersion,'formal-analysis-report-v1');
 assert.equal(b.analysisBasis.studyId,source.studyId);assert.equal(b.analysisBasis.purposeKey,'synthetic-research-only');
 assert(v.sources.some(s=>s.sourceType==='research_method_run'&&s.sourceId===b.runId));
 const counts=await tx.$queryRawUnsafe('SELECT research_project_id,count(*)::int AS count FROM rh_asset.asset_registry WHERE tenant_id=$1 AND study_group_id=$2 GROUP BY research_project_id ORDER BY research_project_id',ids.tenant,ids.group);
 assert.equal(counts.find(c=>c.research_project_id===ids.project)?.count,26);
 assert.equal(counts.find(c=>c.research_project_id===source.projectId)?.count??0,0);
 const accounts=await tx.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]}},select:{id:true,role:true,authVersion:true,status:true},orderBy:{id:'asc'}});
 assert.equal(accounts.length,2);assert(accounts.every(a=>a.status==='active'));assert.equal(accounts.find(a=>a.id===ids.admin).role,'tenant_admin');
 return{source:{...source,versionId:v.id,runId:b.runId},counts,accounts,
  reportMetadataAndContentIntegrity:true,currentBusinessSourceAuthorization:'not_yet_verified',
  businessWrites:0,providerRequests:0,admission:'requires_RC01_RC05_confirmation'};
},{readOnly:true});
const evidence=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url);
mkdirSync(evidence,{recursive:true});
writeFileSync(new URL('preflight.json',evidence),JSON.stringify({at:new Date().toISOString(),...result},null,2)+'\n');
console.log('REPORT_CONTEXT_READONLY_METADATA_PASSED; current source authorization and new scope still gated');
