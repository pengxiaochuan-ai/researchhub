import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./research-data-tabular.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('source headers preserve raw labels and expose declared units and binding aliases',()=>{
 assert.equal(typeof api.parseColumnHeader,'function');assert.deepEqual(api.parseColumnHeader('体重（kg）'),{name:'体重（kg）',label:'体重',unit:'kg'});
 assert.equal(api.bindingColumn('受试者编码'),'subjectCode');assert.equal(api.bindingColumn('Visit Code'),'visitCode');assert.equal(api.bindingColumn('课题编号'),'studyId');assert.equal(api.bindingColumn('姓名'),null);
 assert.deepEqual(api.parseColumnHeader('评分（治疗后）'),{name:'评分（治疗后）',label:'评分（治疗后）',unit:null});
 assert.equal(api.matchDataField('评分',[{key:'after',label:'评分（治疗后）'}]),null);
});
test('column profiles distinguish zero false blank text and incompatible numeric notation',()=>{
 const p=api.describeColumn([0,4,null,'',false,'NA']);assert.equal(p.missing,2);assert.equal(p.nonMissing,4);assert.equal(p.zeroCount,1);assert.equal(p.falseCount,1);assert.equal(p.type,'mixed');
 assert.equal(api.describeColumn(['1','2.5',null]).type,'number');assert.equal(api.describeColumn([true,'false']).type,'boolean');
});
test('mapping uses exact keys then unique normalized labels and refuses ambiguous labels',()=>{
 const fields=[{key:'weight',label:'体重',type:'number',unit:'kg'},{key:'score',label:'得分',type:'number'}];
 assert.equal(api.matchDataField('体重(g)',fields)?.key,'weight');assert.equal(api.matchDataField('WEIGHT',fields)?.key,'weight');assert.equal(api.matchDataField('unknown',fields),null);
 assert.throws(()=>api.matchDataField('得分',[...fields,{key:'other',label:'得分'}]),e=>e.code==='DATA_IMPORT_MAPPING_REQUIRED');
});
test('unit conversion is deterministic within a declared dimension and never guesses missing target units',()=>{
 assert.equal(api.decodeMappedValue('2500','体重(g)',{key:'weight',label:'体重',type:'number',unit:'kg'}),2.5);
 assert.equal(api.decodeMappedValue(0,'体重(g)',{key:'weight',label:'体重',type:'number',unit:'kg'}),0);
 assert.equal(api.decodeMappedValue('0.1','时间(s)',{key:'time',label:'时间',type:'number',unit:'ms'}),100);
 for(const [src,f]of [['体重(kg)',{label:'体重',type:'number'}],['体重(m)',{label:'体重',type:'number',unit:'kg'}],['血糖(mg/dL)',{label:'血糖',type:'number',unit:'mmol/L'}]])assert.throws(()=>api.decodeMappedValue('1',src,f),e=>e.code==='DATA_IMPORT_UNIT_REQUIRED');
 assert.equal(api.decodeMappedValue('1.2','血糖(mmol/L)',{label:'血糖',type:'number',unit:'mmol/L'}),1.2);
 assert.throws(()=>api.decodeMappedValue('1','体重(kg)',{label:'体重(g)',type:'number',unit:'kg'}),e=>e.code==='DATA_IMPORT_UNIT_REQUIRED');
 assert.throws(()=>api.decodeMappedValue('1','体重',{key:'weight',label:'体重',type:'number',unit:'kg'}),e=>e.code==='DATA_IMPORT_UNIT_REQUIRED');
});
test('strict scalar decoding preserves raw data and refuses nonfinite, precision loss, invalid booleans and unconfigured NA markers',()=>{
 const f={key:'v',label:'值',type:'number'};for(const s of ['NaN','Infinity','1,000','NA','9007199254740993','0.1234567890123456789'])assert.throws(()=>api.decodeMappedValue(s,'值',f));
 assert.equal(api.decodeMappedValue('', '值',f),null);assert.equal(api.decodeMappedValue('false','完成',{type:'boolean',label:'完成'}),false);assert.equal(api.decodeMappedValue('否','完成',{type:'boolean',label:'完成'}),false);
 assert.throws(()=>api.decodeMappedValue('0','完成',{type:'boolean',label:'完成'}));assert.throws(()=>api.decodeMappedValue('2.5','值',{...f,type:'integer'}));
 assert.equal(api.decodeMappedValue(' false ','完成',{type:'boolean',label:'完成'}),false);assert.equal(api.describeColumn([' false ',' true ']).type,'boolean');assert.equal(api.describeColumn([' false ']).falseCount,1);
});
