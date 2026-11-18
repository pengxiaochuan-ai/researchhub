import {test} from 'node:test';
import assert from 'node:assert/strict';

const contract=await import('./research-assets-read-contract.mjs').catch(error=>{
 if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;
 return{};
});
const user={tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',accountId:'u1',authVersion:1};
const artifact={id:'asset1',...user,ownerAccountId:'u1',createdBy:'u1',typeKey:'research_report',status:'draft',deletedAt:null,currentVersionNo:2,idempotencyKey:'rh-research-asset:local-20261112:u1:protocol',title:'当前标题不能覆盖历史'};
function fixture(kind='protocol',versionNo=1){
 assert.equal(typeof contract.sealResearchAssetVersion,'function');
 const contentMd='作者编写的合成材料，不含真实研究结果。';
 const block=contract.sealResearchAssetVersion({registrationKey:artifact.idempotencyKey,assetKind:kind,versionNo,ownerAccountId:'u1',tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',metadata:{title:'原始标题',summary:'合成演练摘要',purpose:'方法学讨论',limitations:'不能用于临床结论',author:'合成科研人员'},source:{kind:'author_declared_synthetic',label:'作者整理的合成演练材料'},contentMd});
 return{artifactId:'asset1',tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',versionNo,contentMd,contentBlocks:[block],createdBy:'u1',createdAt:new Date('2026-11-12T00:00:00Z'),changeSummary:'人工整理'};
}
test('five asset kinds keep the selected immutable title and body instead of mutable head metadata',()=>{
 for(const kind of ['protocol','dataset','instrument','analysis','publication']){
  const out=contract.presentResearchAssetVersion({artifact,version:fixture(kind),user});
  assert.equal(out.schemaVersion,'rh-research-asset-detail.v1');
  assert.equal(out.kind,kind);assert.equal(out.title,'原始标题');
  assert.equal(out.version,1);assert.equal(out.currentVersion,2);assert.equal(out.isHistorical,true);
  assert.equal(out.status,'draft');assert.equal(out.source.kind,'author_declared_synthetic');
  assert.equal(out.contentMd,'作者编写的合成材料，不含真实研究结果。');
  assert.equal(out.ownerAccountId,'u1');assert.equal(out.readOnly,true);
  assert.equal('idempotencyKey' in out,false);assert.equal('seal' in out,false);
 }
});
test('body, metadata, marker, version and real parent corruption never delivers content',()=>{
 const mutations=[v=>v.contentMd+='篡改',v=>v.contentBlocks[0].metadata.title='伪造',v=>v.contentBlocks[0].type='rh-crf-method-asset.v1',v=>v.versionNo=2,v=>v.artifactId='another',v=>v.studyGroupId='g2',v=>v.createdBy='u2',v=>v.contentBlocks.push(structuredClone(v.contentBlocks[0]))];
 for(const mutate of mutations){const version=fixture();mutate(version);assert.throws(()=>contract.presentResearchAssetVersion({artifact,version,user}),error=>error.code==='RESEARCH_ASSET_CONTEXT_INVALID'&&error.status===409);}
});
test('foreign, deleted, formal and legacy artifact families are indistinguishable from unknown',()=>{
 for(const delta of [{ownerAccountId:'u2'},{createdBy:'u2'},{tenantId:'t2'},{researchProjectId:'p2'},{status:'released'},{deletedAt:new Date()},{typeKey:'protocol_draft'},{idempotencyKey:'rh-method-asset:old'},{id:'rh-formal-report-1'}]){
  assert.throws(()=>contract.presentResearchAssetVersion({artifact:{...artifact,...delta},version:fixture(),user}),error=>error.status===404&&error.code==='RESEARCH_ASSET_NOT_FOUND');
 }
});
test('JSONB key reordering preserves the seal while unsupported types or misleading source claims are rejected',()=>{
 const version=fixture(),b=version.contentBlocks[0];
 version.contentBlocks=[Object.fromEntries(Object.entries(b).reverse().map(([k,v])=>[k,k==='metadata'?Object.fromEntries(Object.entries(v).reverse()):v]))];
 assert.equal(contract.presentResearchAssetVersion({artifact,version,user}).title,'原始标题');
 for(const delta of [{assetKind:'clinical_result'},{source:{kind:'reviewed',label:'已审核'}}]){
  assert.throws(()=>contract.sealResearchAssetVersion({...b,...delta,contentMd:version.contentMd}),error=>error.code==='RESEARCH_ASSET_INPUT_INVALID');
 }
});
test('route identity and version reject duplicate, noncanonical and unsafe values',()=>{
 assert.equal(typeof contract.readResearchAssetRequest,'function');
 assert.deepEqual(contract.readResearchAssetRequest('asset1','2'),{id:'asset1',versionNo:2});
 assert.deepEqual(contract.readResearchAssetRequest('asset1'),{id:'asset1',versionNo:undefined});
 for(const [id,v] of [['../asset1','1'],['asset1',['1','2']],['asset1','01'],['asset1','0'],['asset1',2],['asset1','9007199254740992'],[null,'1']])assert.throws(()=>contract.readResearchAssetRequest(id,v),error=>error.status===400);
});
