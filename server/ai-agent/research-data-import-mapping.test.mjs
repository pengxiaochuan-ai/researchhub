import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./research-data-import-mapping.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const preview=()=>({files:[{fileId:'file',format:'xlsx',fields:[{sheet:'基线',name:'subject_id',column:1},{sheet:'基线',name:'visit_code',column:2},{sheet:'基线',name:'value',column:3},{sheet:'基线',name:'completed',column:4}],rows:[{sheet:'基线',rowNumber:2,subjectCode:'P05-OWNER-A',visit:'BASELINE',issues:[],values:['P05-OWNER-A','BASELINE',0,false]}],rejectedRows:0}]});
test('general mappings use unique labels and convert units for both CSV and XLSX without changing raw cells',()=>{
 for(const format of ['csv','xlsx']){const p=preview();p.rulesVersion='general-tabular.v1';p.files[0].format=format;
 p.files[0].fields.forEach((f,i)=>f.name=['受试者编码','访视编码','体重(g)','完成'][i]);p.files[0].rows[0].values=['SYNTH-A','BASELINE','2500','否'];
 const result=api.compileDataMapping(p,[{key:'weight',label:'体重',type:'number',required:true,unit:'kg'},{key:'completed',label:'完成',type:'boolean',required:true}]);
 assert.deepEqual(result.rows[0].answers,{weight:2.5,completed:false});assert.equal(p.files[0].rows[0].values[2],'2500');assert.equal(result.transforms.find(t=>t.targetKey==='weight').conversionPower,-3);
 }
});
test('unconfigured numeric NA and incompatible units refuse the full general batch',()=>{
 for(const input of ['NA','Infinity']){const p=preview();p.rulesVersion='general-tabular.v1';p.files[0].rows[0].values[2]=input;assert.throws(()=>api.compileDataMapping(p,[{key:'value',label:'value',type:'number'},{key:'completed',label:'completed',type:'boolean'}]),e=>e.code==='DATA_IMPORT_INVALID_ROWS');}
});
test('exact mapped XLSX values preserve zero/false and physical row positions',()=>{assert.equal(typeof api.compileDataMapping,'function');const p=api.compileDataMapping(preview(),[{key:'value',type:'number',required:true},{key:'completed',type:'boolean',required:true}]);assert.equal(p.mode,'visit_form');assert.deepEqual(p.rows[0].answers,{value:0,completed:false});assert.equal(p.rows[0].source.rowNumber,2);assert.equal(p.rows[0].source.sheet,'基线');});
test('profile-only files create pseudonym rows, do not invent enrollment or visit fields',()=>{assert.equal(typeof api.compileDataMapping,'function');const p=preview();p.files[0].fields=[p.files[0].fields[0]];p.files[0].rows[0].values=['P05-OWNER-A'];const result=api.compileDataMapping(p,[]);assert.equal(result.mode,'subjects');assert.equal(result.rows[0].subjectCode,'P05-OWNER-A');assert.equal(result.rows[0].visitCode,null);});
test('unknown fields never become clinical fields through score/flag guessing',()=>{assert.equal(typeof api.compileDataMapping,'function');const p=preview();p.files[0].fields[2].name='score';assert.throws(()=>api.compileDataMapping(p,[{key:'value',type:'number',required:true},{key:'completed',type:'boolean',required:true}]),e=>e.code==='DATA_IMPORT_MAPPING_REQUIRED');});
test('duplicate targets, invalid rows and incomplete explicit mappings refuse the whole batch',()=>{assert.equal(typeof api.compileDataMapping,'function');for(const edit of [p=>p.files[0].rows.push(structuredClone(p.files[0].rows[0])),p=>p.files[0].rows[0].issues=['FORMULA_CELL']]){const p=preview();edit(p);assert.throws(()=>api.compileDataMapping(p,[{key:'value'},{key:'completed'}]));}});
test('explicit Study fields are checked against the real selected Study even when not mapped into the CRF',()=>{
 for(const header of ['study_id','研究编号'])for(const profileOnly of [false,true]){
  const p=preview();if(profileOnly){p.files[0].fields=[p.files[0].fields[0]];p.files[0].rows[0].values=['P05-OWNER-A'];}
  const column=p.files[0].fields.length+1;p.files[0].fields.push({sheet:'基线',name:header,column});p.files[0].rows[0].values.push('other-study');
  const fields=profileOnly?[]:[{key:'value',type:'number',required:true},{key:'completed',type:'boolean',required:true}];
  assert.throws(()=>api.compileDataMapping(p,fields,undefined,{studyId:'real-target'}),e=>e.code==='DATA_IMPORT_STUDY_MISMATCH');
  p.files[0].rows[0].values[column-1]='real-target';assert.equal(api.compileDataMapping(p,fields,undefined,{studyId:'real-target'}).rows[0].subjectCode,'P05-OWNER-A');
 }
});
test('explicit choice resolves equal labels without running the ambiguous automatic matcher',()=>{
 const p=preview();p.rulesVersion='general-tabular.v1';p.files[0].fields[2].name='测量(g)';
 const fields=[{key:'weight',label:'测量',unit:'kg',type:'number',required:true},{key:'otherWeight',label:'测量',unit:'kg',type:'number'},{key:'completed',label:'完成',type:'boolean',required:true}];
 p.files[0].rows[0].values[2]='2500';
 const mapping=p.files[0].fields.map((h,i)=>({fileId:'file',sheet:h.sheet,column:h.column,targetKey:['subjectCode','visitCode','weight','completed'][i]}));
 assert.deepEqual(api.compileDataMapping(p,fields,mapping).rows[0].answers,{weight:2.5,otherWeight:null,completed:false});
 assert.equal(api.compileDataMapping(p,fields,mapping).transforms.find(t=>t.targetKey==='weight').targetDisambiguator,'weight');
});
test('mapping choices bind actual columns, keep unique matches and expose competing columns for a choice',()=>{
 const p=preview();p.rulesVersion='general-tabular.v1';p.files[0].fields[2].name='测量(g)';
 const fields=[{key:'weight',label:'测量',unit:'kg',type:'number',required:true},{key:'otherWeight',label:'测量',unit:'kg',type:'number'},{key:'completed',label:'完成',type:'boolean',required:true}];
 assert.equal(typeof api.describeDataMapping,'function');const d=api.describeDataMapping(p,fields);
 assert.deepEqual(d.automatic.map(m=>m.targetKey),['subjectCode','visitCode','completed']);assert.equal(d.columns.length,1);assert.equal(d.columns[0].name,'测量(g)');assert.deepEqual(d.columns[0].targetKeys,['weight','otherWeight']);
 assert.equal(d.fields.find(f=>f.key==='weight').unit,'kg');assert.equal(d.requiredKeys.includes('weight'),true);
 p.files[0].fields[2].name='value';p.files[0].fields.push({sheet:'基线',column:5,name:'测量(g)'});p.files[0].rows[0].values.push('2500');
 const competition=api.describeDataMapping(p,[{key:'value',label:'测量',type:'number',unit:'g',required:true},{key:'completed',type:'boolean'}]);assert(competition.columns.some(c=>c.column===3));assert(competition.columns.some(c=>c.column===5));assert(!competition.automatic.some(m=>m.targetKey==='value'));
});
test('explicit mapping refuses reuse of a source column for two fields and foreign or malformed mappings',()=>{
 const p=preview();p.rulesVersion='general-tabular.v1';const fields=[{key:'value',type:'number',required:true},{key:'completed',type:'boolean'}];
 const base=p.files[0].fields.slice(0,3).map((h,i)=>({fileId:'file',sheet:h.sheet,column:h.column,targetKey:['subjectCode','visitCode','value'][i]}));
 for(const bad of [[...base,{...base[2],targetKey:'completed'}],[...base,{fileId:'other',sheet:'基线',column:4,targetKey:'completed'}],{},null])assert.throws(()=>api.compileDataMapping(p,fields,bad));
 assert.throws(()=>api.describeDataMapping({...p,files:[{...p.files[0],rejectedRows:1}]},fields),e=>e.code==='DATA_IMPORT_INVALID_ROWS');
});
