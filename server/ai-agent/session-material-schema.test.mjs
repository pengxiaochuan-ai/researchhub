import test from 'node:test';
import assert from 'node:assert/strict';

const schema=await import('../../scripts/ai-session-material-schema.mjs').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND')return null;
  throw error;
});

test('material migration rejects all but the named synthetic target before any connection',()=>{
  assert.ok(schema,'approved additive material migration is not implemented');
  assert.throws(()=>schema.assertMaterialDatabase({WP01_TEST_DB_NAME:'aisci'}),/MATERIAL_TARGET_REJECTED/);
  assert.throws(()=>schema.assertMaterialDatabase({WP01_TEST_DB_NAME:'wp01_test_other'}),/MATERIAL_TARGET_REJECTED/);
});

test('material migration accepts only an empty extension or the exact verified receipt',()=>{
  assert.ok(schema,'approved additive material migration is not implemented');
  const empty={exists:false,objects:[],receipt:null};
  assert.equal(schema.materialSchemaMode(empty,'sql-hash'),'new');
  assert.throws(()=>schema.materialSchemaMode({...empty,objects:['unexpected_table']},'sql-hash'),/MATERIAL_SCHEMA_CONFLICT/);
  const existing={exists:true,objects:['session_materials','check_session_material'],catalogHash:'catalog-hash',receipt:{version:1,sqlHash:'sql-hash',catalogHash:'catalog-hash'}};
  assert.equal(schema.materialSchemaMode(existing,'sql-hash'),'existing');
  assert.throws(()=>schema.materialSchemaMode({...existing,catalogHash:'changed-policy'},'sql-hash'),/MATERIAL_SCHEMA_CONFLICT/);
  assert.throws(()=>schema.materialSchemaMode(existing,'other-sql'),/MATERIAL_SCHEMA_CONFLICT/);
  assert.throws(()=>schema.materialSchemaMode({...existing,receipt:null},'sql-hash'),/MATERIAL_SCHEMA_CONFLICT/);
});
