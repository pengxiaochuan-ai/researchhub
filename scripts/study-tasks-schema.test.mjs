import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateStudyTaskSchema} from './study-tasks-schema.mjs';

test('schema_refuses_partial_version',()=>{
  assert.throws(()=>evaluateStudyTaskSchema({tables:['context'],receipt:null},'a'.repeat(64)),/S08_SCHEMA_PARTIAL/);
});
test('schema_refuses_third_table_wrong_fingerprint_and_disabled_rls',()=>{
  const current={tables:['context','operation'],receipt:{version:2,sha256:'a'.repeat(64)},secured:true};
  assert.equal(evaluateStudyTaskSchema(current,'a'.repeat(64)),'existing');
  assert.throws(()=>evaluateStudyTaskSchema({...current,tables:['context','operation','extra']},'a'.repeat(64)),/S08_SCHEMA_PARTIAL/);
  assert.throws(()=>evaluateStudyTaskSchema(current,'b'.repeat(64)),/S08_SCHEMA_VERSION_CONFLICT/);
  assert.throws(()=>evaluateStudyTaskSchema({...current,secured:false},'a'.repeat(64)),/S08_SCHEMA_GUARDS_MISSING/);
});
test('schema_new_target_is_distinct_from_missing_receipt_or_orphaned_receipt',()=>{
  assert.equal(evaluateStudyTaskSchema({tables:[],receipt:null},'a'.repeat(64)),'new');
  assert.throws(()=>evaluateStudyTaskSchema({tables:['context','operation'],receipt:null,secured:true},'a'.repeat(64)),/S08_SCHEMA_VERSION_CONFLICT/);
  assert.throws(()=>evaluateStudyTaskSchema({tables:[],receipt:{version:1,sha256:'a'.repeat(64)}},'a'.repeat(64)),/S08_SCHEMA_PARTIAL/);
});
