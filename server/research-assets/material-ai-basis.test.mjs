import test from'node:test';import assert from'node:assert/strict';import{assetDigest}from'../../scripts/research-assets-registration-contract.mjs';import{deriveMaterialBasis,revalidateMaterialBasis,createMaterialAiBasisService}from'./material-ai-basis.mjs';
const p={tenantId:'t',studyGroupId:'g',researchProjectId:'p'},ref={studyId:'study',reportId:'report',version:1};
const source=()=>({artifact:{...p,id:ref.reportId,typeKey:'analysis_report',status:'released'},version:{id:'version',versionNo:1,contentMd:'# synthetic',contentHash:assetDigest('# synthetic')},basis:{studyId:'study',snapshotId:'snapshot'},source:{id:'run'}});
test('material identity derives only from a verified native source, not caller permission flags',()=>{
 const a=deriveMaterialBasis(p,ref,source());assert.match(a.basisKey,/^rhmab-[a-f0-9]{64}$/);
 for(const changed of [{artifact:{...source().artifact,status:'draft'}},{version:{...source().version,contentMd:'tampered'}},{basis:{...source().basis,studyId:'other'}},{artifact:{...source().artifact,tenantId:'other'}}])assert.throws(()=>deriveMaterialBasis(p,ref,{...source(),...changed}),e=>e.code==='ASSET_CATALOG_MATERIAL_AI_SOURCE_INVALID');
 assert.notEqual(deriveMaterialBasis(p,ref,{...source(),source:{id:'new-run'}}).materialManifestHash,a.materialManifestHash);
});
test('current revalidation locks the actual basis and refuses a revoked or absent basis',async()=>{
 const calls=[],c={basisReference:'rhmabe-event',materialBasisHash:'b'.repeat(64)},a={studyId:'study',sourceReportId:'report',sourceReportVersion:1,contentHash:'a'.repeat(64)};
 const tx={$queryRawUnsafe:async(sql,...values)=>{calls.push(sql);if(sql.includes('SELECT basis_key'))return[{basis_key:'rhmab-'+'c'.repeat(64)}];if(sql.includes('material_basis_matches'))return[{allowed:false}];return[];}};
 await assert.rejects(revalidateMaterialBasis(tx,p,a,c),e=>e.code==='ASSET_CATALOG_MATERIAL_AI_BASIS_REQUIRED');assert(calls.findIndex(s=>s.includes('advisory'))<calls.findIndex(s=>s.includes('material_basis_matches')));
 await assert.rejects(revalidateMaterialBasis(tx,p,a,{...c,basisReference:'browser-says-yes'}),e=>e.code==='ASSET_CATALOG_MATERIAL_AI_BASIS_REQUIRED');
});
test('review interface never accepts a browser body/hash/boolean as source proof',()=>{
 const service=createMaterialAiBasisService({withAccess:()=>assert.fail('must reject before access'),readNativeReport:()=>assert.fail('must not read')});
 const input={expectedRevision:0,reason:'Synthetic evidence reviewed',requestKey:'request_0001',rightsEvidence:'Synthetic only',evidenceRef:'synthetic'};
 for(const extra of [{material_ai_allowed:true},{contentHash:'a'.repeat(64)},{contentMd:'arbitrary'}])assert.throws(()=>service.approve({},ref,{...input,...extra}),e=>e.code==='ASSET_CATALOG_INPUT_INVALID');
});
