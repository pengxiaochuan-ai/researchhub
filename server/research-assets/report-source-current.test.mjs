import test from 'node:test';
import assert from 'node:assert/strict';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {assertCurrentReportAsset} from './report-source-service.mjs';
const md='Explicit synthetic fixed native report';
const target={reportId:'rh-formal-report-known',version:1,contentHash:assetDigest(md)};
const p={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',accountId:'admin'};
const r={workingVersionNo:2,ownerAccountId:'admin',deletedAt:null};
const policy={sourceValid:true,sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:target.reportId,version:1,contentHash:target.contentHash}],artifactVersionId:'fixed-v2',contentHash:target.contentHash};
const tx={$queryRawUnsafe:async()=>[],researchArtifactVersion:{findFirst:async({where})=>{assert.deepEqual(where,{id:'fixed-v2',artifactId:'rhab-test',tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',versionNo:2});return {contentMd:md,contentHash:target.contentHash};}}};
test('report receipt requires current exact single native source binding and actual fixed body',async()=>{
 await assertCurrentReportAsset(tx,p,'rhab-test',r,policy,target);
 for(const patch of [{sourceKind:'author',sourceBindings:[]},{sourceBindings:[{...policy.sourceBindings[0],id:'other'}]},{sourceBindings:[{...policy.sourceBindings[0],version:2}]},{sourceBindings:[{...policy.sourceBindings[0],contentHash:'b'.repeat(64)}]},{sourceBindings:[...policy.sourceBindings,...policy.sourceBindings]},{contentHash:'b'.repeat(64)},{sourceValid:false}])await assert.rejects(async()=>assertCurrentReportAsset(tx,p,'rhab-test',r,{...policy,...patch},target),e=>e.code==='ASSET_CATALOG_REPORT_SOURCE_ASSET_CHANGED');
 for(const body of [null,{contentMd:md+' altered',contentHash:target.contentHash},{contentMd:md,contentHash:'b'.repeat(64)}])await assert.rejects(async()=>assertCurrentReportAsset({...tx,researchArtifactVersion:{findFirst:async()=>body}},p,'rhab-test',r,policy,target),e=>e.status===409);
});
