import test from 'node:test';import assert from 'node:assert/strict';
import {createReportSourceService} from '../server/research-assets/report-source-service.mjs';
import {assetDigest} from '../scripts/research-assets-registration-contract.mjs';
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a',displayName:'研究者'},body='# 已确认报告',target={studyId:'s',reportId:'rh-formal-report-native',version:1,contentHash:assetDigest(body)},value={artifact:{...p,id:target.reportId,typeKey:'analysis_report',ownerAccountId:'a',status:'released',currentVersionNo:1,title:'报告'},version:{id:'v',versionNo:1,contentMd:body,contentHash:target.contentHash},basis:{studyId:'s',snapshotId:'snapshot'},source:{id:'run'}};
test('preview validates native source before exposing an unregistered candidate and makes no writes',async()=>{
 let queries=0;const service=createReportSourceService({withAccess:async(_u,permission,run)=>{assert.equal(permission,'artifact.read');return run({$queryRawUnsafe:async()=>{queries++;return[];}},p);},readSource:async()=>({value,target})});
 const v=await service.preview({},{});assert.equal(v.existing,null);assert.equal(v.contentHash,target.contentHash);assert.equal(queries,1);assert(!Object.hasOwn(v,'contentMd'));
});
test('native stale basis is never silently replaced or converted into registration success',async()=>{
 const error=Object.assign(Error('stale'),{status:409,code:'ANALYSIS_BASIS_STALE'}),service=createReportSourceService({withAccess:async(_u,_permission,run)=>run({$queryRawUnsafe:()=>assert.fail('must not reach write or discovery')},p),readSource:async()=>{throw error;}});
 await assert.rejects(service.register({}, {},{purpose:'x'}),e=>e===error);
});
