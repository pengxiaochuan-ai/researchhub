import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateResearchIdentitySchema} from '../../scripts/research-identity-schema.mjs';

const names=['researchProfile','researchProfileVersion','researchProfileEstablishedAt','researchProfileLastMutation'];
const columns=names.map((name,index)=>({name,type:['jsonb','integer','timestamp with time zone','jsonb'][index],nullable:true,default:null}));
test('only all-absent fields and no receipt are admitted as a first migration',()=>{
  assert.equal(evaluateResearchIdentitySchema({columns:[],receipt:null,originalColumnsValid:true},'known'),'new');
  assert.throws(()=>evaluateResearchIdentitySchema({columns:[],receipt:null,originalColumnsValid:false},'known'),/IDENTITY_SCHEMA_BASELINE/);
});
test('partial fields, changed types and unrecorded preexisting additions are rejected',()=>{
  for(const state of [{columns:columns.slice(0,2),receipt:null},{columns,receipt:null},{columns:columns.map(c=>c.name===names[0]?{...c,type:'text'}:c),receipt:{version:1,sha256:'known',catalogHash:'catalog'}}]){
    assert.throws(()=>evaluateResearchIdentitySchema({...state,originalColumnsValid:true,catalogHash:'catalog'},'known'),/IDENTITY_SCHEMA_/);
  }
});
test('exact recorded fields can be reopened but changed schema receipts cannot',()=>{
  const state={columns,originalColumnsValid:true,receipt:{version:1,sha256:'known',catalogHash:'catalog'},catalogHash:'catalog'};
  assert.equal(evaluateResearchIdentitySchema(state,'known'),'existing');
  assert.throws(()=>evaluateResearchIdentitySchema({...state,catalogHash:'drift'},'known'),/IDENTITY_SCHEMA_/);
  assert.throws(()=>evaluateResearchIdentitySchema(state,'different'),/IDENTITY_SCHEMA_/);
});
