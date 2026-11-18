import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateDirectorySchema,directorySchemaHash} from '../../scripts/directory-schema.mjs';
test('directory schema admission only allows a fresh namespace or exact three-table fingerprint',()=>{
 assert.equal(evaluateDirectorySchema({objects:[],receipt:null},directorySchemaHash),'new');
 const state={objects:['assertion','decision','entity'],fingerprint:'catalog-sha',receipt:{version:1,sha256:directorySchemaHash,fingerprint:'catalog-sha'}};
 assert.equal(evaluateDirectorySchema(state,directorySchemaHash),'existing');
 for(const bad of [{...state,objects:['entity']},{...state,receipt:null},{...state,fingerprint:'changed'},{...state,receipt:{...state.receipt,sha256:'other'}}])assert.throws(()=>evaluateDirectorySchema(bad,directorySchemaHash));
});
