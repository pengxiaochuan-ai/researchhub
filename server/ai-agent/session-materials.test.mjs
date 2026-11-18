import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./session-materials.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('material upload identity is content-bound and does not persist original filenames',()=>{
  assert.ok(api,'session materials implementation is missing');
  const inspected={sha256:'a'.repeat(64),extension:'txt',contentType:'text/plain',storageFilename:'knowledge_aaaaaaaaaaaaaaaa.txt'};
  const first=api.materialUploadIdentity(inspected,15),same=api.materialUploadIdentity({...inspected,originalname:'sensitive-name.txt'},15);
  assert.equal(first,same);assert.notEqual(first,api.materialUploadIdentity(inspected,16));
  assert.throws(()=>api.materialUploadIdentity({...inspected,extension:'csv'},15),/HUB_MATERIAL_FORMAT_UNAVAILABLE/);
  assert.throws(()=>api.materialUploadIdentity(inspected,0),/HUB_MATERIAL_FILE_INVALID/);
});
test('material status projection hides storage paths and fails closed on missing parents',()=>{
  assert.ok(api,'session materials implementation is missing');
  const row={id:'material',state:'importing',version:2,deleted_at:null,kb_id:'base',source_file_id:'source',import_task_id:'task',doc_id:null,created_at:new Date(0)};
  const native={source:{id:'source',kbId:'base',filename:'knowledge_safe.txt'},task:{id:'task',sourceFileId:'source',status:'processing',stage:'parsing',progress:50},doc:null};
  assert.deepEqual(api.projectSessionMaterial(row,native),{id:'material',version:2,state:'importing',stage:'parsing',name:'knowledge_safe.txt',progress:50,kbId:'base',docId:null,available:false,createdAt:new Date(0).toISOString()});
  const missing=api.projectSessionMaterial(row,{source:null,task:null,doc:null});assert.equal(missing.available,false);assert.equal(missing.state,'failed');
  const removed=api.projectSessionMaterial({...row,deleted_at:new Date(0)},native);assert.equal(removed.state,'removed');assert.equal(removed.available,false);
  assert(!JSON.stringify(missing).includes('storageKey'));
});
test('unavailable material never exposes the current title or links of a changed private parent',()=>{
  const row={id:'material',state:'failed',version:3,deleted_at:null,kb_id:'changed-base',source_file_id:'source',import_task_id:'task',doc_id:'changed-doc',created_at:new Date(0)};
  const result=api.projectSessionMaterial(row,{source:{filename:'source.txt'},task:{stage:'complete',progress:100},doc:{title:'Another owners private title'}});
  assert.equal(result.name,'资料不可用');assert.equal(result.kbId,null);assert.equal(result.docId,null);
});
test('blocked tasks distinguish an actionable native identity decision from permanent isolation',()=>{
 const row={id:'material',state:'blocked',version:3,deleted_at:null,kb_id:'base',source_file_id:'source',import_task_id:'task',doc_id:null,created_at:new Date(0)};
 const parents={source:{filename:'knowledge_safe.txt'},task:{id:'task',status:'blocked',stage:'awaiting_confirmation',errorCode:'DIRECT_IDENTIFIER_CONFIRMATION_REQUIRED'},doc:null};
 const pending=api.projectSessionMaterial(row,parents);
 assert.equal(pending.decisionRequired,true);assert.equal(pending.importTaskId,'task');assert.equal(pending.available,false);
 const discarded=api.projectSessionMaterial(row,{...parents,task:{...parents.task,stage:'discarded',errorCode:'DIRECT_IDENTIFIER_DISCARDED'}});
 assert.equal(discarded.decisionRequired,false);assert.equal(discarded.importTaskId,null);
});
