import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sealResearchAssetVersion} from './research-assets-read-contract.mjs';
const {createResearchAssetsReader}=await import('./local-research-assets-read.mjs').catch(error=>{
 if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return{};
});
const user={tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',accountId:'u1',authVersion:1};
function fixture(){
 const artifact={id:'a1',tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',ownerAccountId:'u1',createdBy:'u1',status:'draft',typeKey:'research_report',deletedAt:null,currentVersionNo:2,idempotencyKey:'rh-research-asset:local-20261112:u1:protocol',title:'现在的标题'};
 const versions=[1,2].map(versionNo=>{
  const contentMd=versionNo===1?'早期合成正文':'修订后的合成正文';
  return{tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',artifactId:'a1',versionNo,contentMd,contentBlocks:[sealResearchAssetVersion({registrationKey:artifact.idempotencyKey,assetKind:'protocol',versionNo,ownerAccountId:'u1',tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',metadata:{title:versionNo===1?'早期标题':'修订标题',summary:'合成摘要',purpose:'合成演练',limitations:'不能用于临床',author:'合成作者'},source:{kind:'author_declared_synthetic',label:'作者整理合成材料'},contentMd})],createdBy:'u1',createdAt:new Date('2026-11-12T00:00:00Z'),changeSummary:'人工说明'};
 });return{artifact,versions};
}
function harness(){
 const f=fixture(),queries=[];let auth=true,locks=0;
 const tx={researchArtifact:{findFirst:async q=>{queries.push(['artifact',q]);return f.artifact;}},researchArtifactVersion:{findFirst:async q=>{queries.push(['version',q]);return f.versions.find(v=>v.versionNo===q.where.versionNo);},findMany:async q=>{queries.push(['history',q]);return [...f.versions].reverse().slice(0,q.take).map(({versionNo,createdAt,changeSummary})=>({versionNo,createdAt,changeSummary}));}}};
 assert.equal(typeof createResearchAssetsReader,'function');
 const reader=createResearchAssetsReader({withScope:async(u,permission,run)=>{assert.equal(u,user);assert.equal(permission,'artifact.read');locks++;if(!auth)throw Object.assign(new Error('当前授权失效'),{status:403});return run(tx);}});
 return{reader,f,queries,get locks(){return locks;},revoke:()=>{auth=false;}};
}
test('one current-authorized transaction returns only the requested owned version and bounded metadata history',async()=>{
 const h=harness(),out=await h.reader.read(user,'a1','1');
 assert.equal(h.locks,1);assert.equal(out.title,'早期标题');assert.equal(out.contentMd,'早期合成正文');
 assert.deepEqual(out.versions.map(v=>v.version),[2,1]);assert.equal(out.hasMoreVersions,false);
 assert.equal(out.versions.some(v=>'contentMd' in v||'contentBlocks' in v),false);
 const a=h.queries.find(([k])=>k==='artifact')[1];
 assert.equal(a.where.ownerAccountId,'u1');assert.equal(a.where.createdBy,'u1');assert.equal(a.where.tenantId,'t1');assert.equal(a.where.researchProjectId,'p1');assert.equal(a.where.status,'draft');
 for(const [,q]of h.queries.filter(([k])=>k==='version')){assert.equal(q.where.artifactId,'a1');assert.equal(q.where.studyGroupId,'g1');assert.equal(q.where.tenantId,'t1');}
 const history=h.queries.find(([k])=>k==='history')[1];assert.equal(history.take,51);assert.equal(history.select.contentMd,undefined);
});
test('head corruption blocks history, but unknown versions never fall back to the latest',async()=>{
 const h=harness();assert.equal((await h.reader.read(user,'a1')).title,'修订标题');
 await assert.rejects(h.reader.read(user,'a1','3'),e=>e.status===404);
 h.f.versions[1].contentMd='头版已被篡改';
 await assert.rejects(h.reader.read(user,'a1','1'),e=>e.code==='RESEARCH_ASSET_CONTEXT_INVALID');
});
test('wrong objects, parent rows and type changes fail closed even if storage returns them',async()=>{
 const h=harness();h.f.artifact.id='different';
 await assert.rejects(h.reader.read(user,'a1'),e=>e.status===404);
 const other=harness();other.f.versions[0].researchProjectId='foreign';
 await assert.rejects(other.reader.read(user,'a1','1'),e=>e.code==='RESEARCH_ASSET_CONTEXT_INVALID');
 const changed=harness(),v=changed.f.versions[0];
 v.contentBlocks=[sealResearchAssetVersion({...v.contentBlocks[0],assetKind:'dataset',contentMd:v.contentMd})];
 await assert.rejects(changed.reader.read(user,'a1','1'),e=>e.code==='RESEARCH_ASSET_CONTEXT_INVALID');
});
test('current authorization is checked again on every read and revocation does not return cached content',async()=>{
 const h=harness();await h.reader.read(user,'a1');h.revoke();
 const count=h.queries.length;await assert.rejects(h.reader.read(user,'a1'),e=>e.status===403);
 assert.equal(h.queries.length,count);assert.equal(h.locks,2);
});
