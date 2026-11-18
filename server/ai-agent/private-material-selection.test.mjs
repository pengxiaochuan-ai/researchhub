import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./private-material-selection.mjs').catch(()=>({}));
const actor={tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project'};
const row={id:'material',version:2,state:'importing',deleted_at:null,tenant_id:'tenant',account_id:'owner',study_group_id:'group',research_project_id:'project',session_id:'session',purpose:'knowledge',kb_id:'kb',source_file_id:'file',import_task_id:'task',source_sha256:'a'.repeat(64),doc_id:null,doc_version:null,content_sha256:null};
test('enqueue snapshot fixes the upload identities, including parsing sources, without copying file content',()=>{
 assert.equal(typeof api.freezeMaterialSelection,'function');
 const s=api.freezeMaterialSelection(actor,'session',[row]);
 assert.equal(s.schema,'hub-private-selection.v1');assert.equal(s.materials[0].sourceFileId,'file');assert.equal(s.materials[0].docId,null);
 assert(!JSON.stringify(s).includes('contentMd'));assert.equal(api.assertMaterialSelection(s,actor,'session'),s);
 const jsonb=x=>Array.isArray(x)?x.map(jsonb):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,jsonb(x[k])])):x;
 assert.deepEqual(api.assertMaterialSelection(jsonb(s),actor,'session'),jsonb(s));
 assert.throws(()=>api.assertMaterialSelection(s,{...actor,accountId:'admin'},'session'));
 assert.throws(()=>api.assertMaterialSelection(s,actor,'other-session'));
 assert.throws(()=>api.assertMaterialSelection({...s,materials:[]},actor,'session'));
});
test('ready sources fix their exact original document version; warning/failed uploads are not silently evidence',()=>{
 const ready={...row,state:'ready',version:3,doc_id:'doc',doc_version:1,content_sha256:'b'.repeat(64)};
 const s=api.freezeMaterialSelection(actor,'session',[ready]);assert.equal(s.materials[0].contentSha256,ready.content_sha256);
 assert.throws(()=>api.freezeMaterialSelection(actor,'session',[{...row,account_id:'other'}]));
 assert.throws(()=>api.freezeMaterialSelection(actor,'session',[{...row,state:'blocked'}]),e=>e.code==='HUB_PRIVATE_NO_USABLE_MATERIAL');
 assert.equal(api.freezeMaterialSelection(actor,'session',[ready,{...row,id:'warning',state:'blocked'}]).materials.length,1);
 assert.throws(()=>api.freezeMaterialSelection(actor,'session',Array.from({length:21},(_,i)=>({...row,id:'m'+i}))),e=>e.code==='HUB_PRIVATE_SELECTION_LIMIT');
});
test('an explicitly captured empty upload set stays empty; a new file is never attached to an old command',()=>{
 const s=api.freezeMaterialSelection(actor,'session',[]);assert.deepEqual(s.materials,[]);assert.equal(api.assertMaterialSelection(s,actor,'session').materials.length,0);
});
