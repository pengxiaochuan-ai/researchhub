import test from'node:test';import assert from'node:assert/strict';import{assertMediaBindingProtection as check}from'../scripts/ai-session-media-ingest-protection.mjs';
const make=()=>({before:{processing_task:[],processing_status:[],usage_record:[],token_quota_reservation:[],media:[],modality_file:[],subject_visit:[{id:'v',digest:'original'}]},after:{processing_task:[],processing_status:[],usage_record:[],token_quota_reservation:[],media:[],modality_file:[{id:'f1'},{id:'f2'}],subject_visit:[{id:'v',digest:'changed'}]},anchor:{rows:[{table:'subject_visit',id:'v',project:'other',digest:'anchor'}]},currentProjects:{'subject_visit/v':'other'},targetProjectId:'target',registeredFileIds:['f1','f2']});
test('protection records only the named outside changes and requires their current real parent',()=>{
 const input=make();assert.equal(check(input).length,1);input.currentProjects['subject_visit/v']='target';assert.throws(()=>check(input),/Outside row parent changed/);
});
test('protection refuses a new worker, usage, reservation, original or extra ModalityFile even when old row hashes match',()=>{
 for(const table of ['processing_task','processing_status','usage_record','token_quota_reservation','media','modality_file']){const input=make();input.after[table].push({id:'unexpected'});assert.throws(()=>check(input));}
});
