import test from 'node:test';import assert from 'node:assert/strict';import {parseCaptureCsv} from './import-csv.mjs';
const fields=[{key:'value',type:'number'},{key:'completed',type:'boolean'},{key:'note',type:'text'}];
test('CSV preserves typed zero false missing and quoted multiline text with physical row numbers',()=>{
 const parsed=parseCaptureCsv('\uFEFFsubject_code,visit_code,value,completed,note\r\nSYNTHETIC-1,BASELINE,0,false,"first, line\nsecond ""quoted"""\r\nSYNTHETIC-2,BASELINE,,true,\r\n',fields);
 assert.equal(parsed.errors.length,0);assert.equal(parsed.rows[0].rowNumber,2);assert.equal(parsed.rows[0].answers.value,0);assert.equal(parsed.rows[0].answers.completed,false);assert.equal(parsed.rows[0].answers.note,'first, line\nsecond "quoted"');assert.equal(parsed.rows[1].rowNumber,4);assert.equal(parsed.rows[1].answers.value,null);
});
test('CSV rejects malformed quotes duplicate headers unknown columns and inconsistent row widths',()=>{
 for(const csv of ['subject_code,visit_code,value,completed,note\nS,B,0,false,"unterminated','subject_code,visit_code,value,value,note\nS,B,0,0,x','subject_code,visit_code,value,completed,extra\nS,B,0,false,x','subject_code,visit_code,value,completed,note\nS,B,0,false'])assert.throws(()=>parseCaptureCsv(csv,fields),e=>e.status===400);
});
test('CSV reports invalid values and duplicate targets instead of coercing or skipping rows',()=>{
 const parsed=parseCaptureCsv('subject_code,visit_code,value,completed,note\nS,B,0,false,x\nS,B,2,true,y\nT,B,0x10,yes,z',fields);assert.equal(parsed.rows.length,3);assert(parsed.errors.some(e=>e.code==='IMPORT_DUPLICATE_ROW'));assert(parsed.errors.some(e=>e.fieldKey==='value'));assert(parsed.errors.some(e=>e.fieldKey==='completed'));
});
test('CSV refuses numeric underflow and precision loss instead of changing a scientific value',()=>{
 for(const value of ['1e-999','9007199254740993','9007199254740991.1','0.10000000000000001']){const parsed=parseCaptureCsv('subject_code,visit_code,value,completed,note\nS,B,'+value+',false,x',fields);assert(parsed.errors.some(e=>e.fieldKey==='value'),value);}
 for(const value of ['0','0e-999','1.2300','1.23e-7','-0.10000000000000002'])assert.deepEqual(parseCaptureCsv('subject_code,visit_code,value,completed,note\nS,B,'+value+',false,x',fields).errors,[],value);
});
