import test from 'node:test';
import assert from 'node:assert/strict';

const api = await import('./session-material-contract.mjs').catch(error => {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const principal = {tenantId:'tenant_a',accountId:'account_a',studyGroupId:'group_a',researchProjectId:'project_a'};
const material = (id='material_a') => ({...principal,id,sessionId:'session_a',version:1,purpose:'knowledge',state:'ready',
  kbId:'base_a',kbVisibility:'private',kbOwnerAccountId:'account_a',kbTenantId:'tenant_a',kbStudyGroupId:'group_a',kbResearchProjectId:'project_a',
  sourceFileId:'source_a',sourceKbId:'base_a',sourceDocId:'doc_a',sourceTenantId:'tenant_a',sourceStudyGroupId:'group_a',sourceCreatedBy:'account_a',
  sourceSha256:'a'.repeat(64),docId:'doc_a',docKbId:'base_a',docTenantId:'tenant_a',docStudyGroupId:'group_a',docVersion:1,contentSha256:'b'.repeat(64),
  docStatus:'draft',reviewed:false,safetyLevel:'allow',trashedAt:null,deletedAt:null});
const snapshot = (records=[material()],refs=[{materialId:'material_a',version:1}]) =>
  api.freezePrivateMaterials({principal,sessionId:'session_a',refs,records});

test('material ref normalization is available and keeps at most twenty unique versioned refs',()=>{
  assert.equal(typeof api.normalizeMaterialRefs,'function');
  assert.deepEqual(api.normalizeMaterialRefs([{materialId:'z',version:1},{materialId:'a',version:2},{materialId:'z',version:1}]),
    [{materialId:'a',version:2},{materialId:'z',version:1}]);
});
test('missing refs mean no upload; malformed refs are never silently dropped',()=>{
  assert.deepEqual(api.normalizeMaterialRefs(undefined),[]);
  for(const refs of [null,{},[{materialId:'../other',version:1}],[{materialId:'a',version:0}],[{materialId:'a',version:1,storageKey:'private'}],
    Array.from({length:21},(_,i)=>({materialId:'m'+i,version:1}))])assert.throws(()=>api.normalizeMaterialRefs(refs),{code:'HUB_MATERIAL_REFS_INVALID'});
});
test('two versions of one material conflict instead of choosing the later version',()=>{
  assert.throws(()=>api.normalizeMaterialRefs([{materialId:'a',version:1},{materialId:'a',version:2}]),{code:'HUB_MATERIAL_REFS_INVALID'});
});
test('ref fields must be own keys, not inherited identifiers hidden behind unrelated keys',()=>{
  const inherited=Object.assign(Object.create({materialId:'a',version:1}),{foo:true,bar:true});
  assert.throws(()=>api.normalizeMaterialRefs([inherited]),{code:'HUB_MATERIAL_REFS_INVALID'});
});
test('owner can freeze an unreviewed private draft without publishing it',()=>{
  const record=material(),copy=structuredClone(record),frozen=snapshot([record]);
  assert.equal(frozen.schema,'hub-private-materials.v1');
  assert.equal(frozen.materials[0].docId,'doc_a');assert.equal(frozen.materials[0].docVersion,1);
  assert.deepEqual(record,copy);assert.equal(record.reviewed,false);assert.equal(record.docStatus,'draft');
  assert.equal(Object.hasOwn(frozen.materials[0],'storageKey'),false);
});
test('a role label is never a shortcut around account, tenant, project or session ownership',()=>{
  for(const field of ['accountId','tenantId','studyGroupId','researchProjectId','sessionId','kbOwnerAccountId','kbTenantId','kbStudyGroupId','kbResearchProjectId']){
    const record={...material(),[field]:'other',role:'tenant_admin'};
    assert.throws(()=>snapshot([record]),{code:'HUB_MATERIAL_UNAVAILABLE'});
  }
});
test('shared, blocked, unparsed, trashed and stale materials cannot enter a model snapshot',()=>{
  for(const change of [{kbVisibility:'tenant'},{kbVisibility:'official'},{safetyLevel:'blocked'},{safetyLevel:'warning'},
    {state:'parsing'},{purpose:'research_data'},{trashedAt:'2026-11-12'}, {version:2},{docVersion:0},{sourceSha256:'unknown'},
    {sourceFileId:null},{docId:null},{contentSha256:'x'.repeat(64)}])assert.throws(()=>snapshot([{...material(),...change}]),{code:'HUB_MATERIAL_UNAVAILABLE'});
});
test('source file and document must belong to the same current private base and owner scope',()=>{
  for(const field of ['sourceKbId','sourceDocId','sourceTenantId','sourceStudyGroupId','sourceCreatedBy','docKbId','docTenantId','docStudyGroupId'])
    assert.throws(()=>snapshot([{...material(),[field]:'other'}]),{code:'HUB_MATERIAL_UNAVAILABLE'});
});
test('missing or duplicate backend records fail closed and unrelated rows are not exposed',()=>{
  assert.throws(()=>snapshot([]),{code:'HUB_MATERIAL_UNAVAILABLE'});
  assert.throws(()=>snapshot([material(),material()]),{code:'HUB_MATERIAL_UNAVAILABLE'});
  assert.equal(snapshot([material(),material('unrequested')]).materials.length,1);
});
test('missing document or association deletion facts cannot be mistaken for explicitly active records',()=>{
  for(const field of ['trashedAt','deletedAt']){
    const absent=material();delete absent[field];
    assert.throws(()=>snapshot([absent]),{code:'HUB_MATERIAL_UNAVAILABLE'});
    assert.throws(()=>snapshot([{...material(),[field]:undefined}]),{code:'HUB_MATERIAL_UNAVAILABLE'});
  }
});
test('queued snapshot is detached from future record mutation and ref order is stable',()=>{
  const a=material(),b={...material('material_b'),sourceFileId:'source_b',sourceDocId:'doc_b',docId:'doc_b'};
  const refs=[{materialId:'material_b',version:1},{materialId:'material_a',version:1}];
  const one=snapshot([a,b],refs),two=snapshot([b,a],[...refs].reverse());
  assert.deepEqual(one,two);a.docVersion=99;a.sourceSha256='c'.repeat(64);
  assert.equal(one.materials[0].docVersion,1);assert.equal(one.materials[0].sourceSha256,'a'.repeat(64));
  assert(Object.isFrozen(one));assert(Object.isFrozen(one.materials));assert(Object.isFrozen(one.materials[0]));
});
