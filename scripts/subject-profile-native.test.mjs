import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const load=(p,k)=>require(new URL('../../app/server/src/'+p+'.ts',import.meta.url).pathname)[k];
const api=await import('./subject-profile-native.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const workbook=(sheets)=>{const XLSX=require('xlsx'),wb=XLSX.utils.book_new();for(const [name,rows]of sheets)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);return XLSX.write(wb,{type:'buffer',bookType:'xlsx'});};
const headers=['被试编号','首发年龄','发作次数','家族史','是否服药'];
const create=()=>{assert.equal(typeof api.createNativeSubjectProfileAdapter,'function');return api.createNativeSubjectProfileAdapter({load,root:new URL('../../',import.meta.url).pathname});};
test('native profile inspection preserves zero/false and exposes only pseudonym record bindings',async()=>{
 const adapter=create(),buffer=workbook([['基本信息',[headers,['合成身份甲',20,0,false,false],['合成身份乙',21,1,true,false]]]]);
 const choice=await adapter.inspect(buffer,{});assert.equal(choice.kind,'mapping_required');assert.equal(choice.records.length,2);assert.equal(choice.records[0].sourceSubjectCode,null);
 const p=await adapter.inspect(buffer,{recordBindings:[{recordNumber:1,subjectCode:'SYNTH-A'},{recordNumber:2,subjectCode:'SYNTH-B'}]});
 assert.equal(p.kind,'ready');assert.equal(p.rows[0].values.episodeCount,0);assert.equal(p.rows[0].values.familyHistory,false);assert.equal(p.rows[1].values.onMedication,false);
 assert(!JSON.stringify(p).includes('合成身份'));assert.match(adapter.revision,/^[a-f0-9]{64}$/);
});
test('native route inspection uses the actual first XLSX entry, refuses eye routing and preserves explicit sheet choice',async()=>{
 const adapter=create(),buffer=workbook([['眼动',[['Recording timestamp','Sensor','Gaze X','Gaze Y'],[1,'Eye Tracker',1,2]]],['档案',[headers,['SYNTH-A',20,0,false,false]]]]);
 await assert.rejects(adapter.inspect(buffer,{sheetName:'档案'}),{code:'PROFILE_IMPORT_ROUTE_UNSUPPORTED'});
 const multi=workbook([['甲',[headers,['SYNTH-A',20,0,false,false]]],['乙',[headers,['SYNTH-B',21,1,true,false]]]]);
 assert.equal((await adapter.inspect(multi,{})).kind,'sheet_required');
 assert.equal((await adapter.inspect(multi,{sheetName:'乙'})).rows[0].subjectCode,'SYNTH-B');
});
test('native profile adapter rejects duplicate destinations, unsupported raw identity mappings and invalid nonempty values',async()=>{
 const adapter=create();
 await assert.rejects(adapter.inspect(workbook([['档案',[headers,['same',20,0,false,false],['same',21,1,false,false]]]]),{recordBindings:[{recordNumber:1,subjectCode:'A'},{recordNumber:2,subjectCode:'B'}]}),{code:'PROFILE_IMPORT_IDENTITY_AMBIGUOUS'});
 await assert.rejects(adapter.inspect(workbook([['档案',[headers,['A',20,'invalid',false,false]]]]),{}),{code:'PROFILE_IMPORT_FIELD_INVALID'});
 await assert.rejects(adapter.inspect(workbook([['档案',[headers,['A',20,0,false,false],['A',21,1,false,false]]]]),{}),{code:'PROFILE_IMPORT_DUPLICATE_SUBJECT'});
});
test('profile import refuses formula cached values and a conflicting source Study',async()=>{
 const adapter=create(),XLSX=require('xlsx'),wb=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([headers,['A',21,1,false,false]]);sheet.B2={t:'n',f:'20+1',v:21};XLSX.utils.book_append_sheet(wb,sheet,'档案');
 await assert.rejects(adapter.inspect(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{}),{code:'PROFILE_IMPORT_FORMULA_UNSUPPORTED'});
 await assert.rejects(adapter.inspect(workbook([['档案',[[...headers,'研究编号'],['A',21,1,false,false,'other-study']]]]),{targetStudyId:'study'}),{code:'DATA_IMPORT_STUDY_MISMATCH'});
});
test('all native profile aliases enter the profile guard, including headers the old Worker cannot route',async()=>{
 const adapter=create(),english=workbook([['Profile',[[ 'Subject ID','Onset age'],['A',21]]]]);
 assert.equal(await adapter.detectProfileCandidate(english),true);
 await assert.rejects(adapter.inspect(english,{}),{code:'PROFILE_IMPORT_ROUTE_UNSUPPORTED'});
 assert.equal(await adapter.detectProfileCandidate(workbook([['Data',[[ 'subject_id','score'],['A',21]]]])),false);
 assert.equal(await adapter.detectProfileCandidate(workbook([['CRF',[[ 'subject_id','visit_code','education'],['A','V1','college']]]])),false);
});
