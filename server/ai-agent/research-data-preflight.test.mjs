import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createNativeResearchDataPreflight,selectImportDestination} from '../../scripts/ai-research-data-preflight.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const load=(path,name)=>require(new URL('../../../app/server/src/'+path+'.ts',import.meta.url).pathname)[name];
const XLSX=require('xlsx'),engine=createNativeResearchDataPreflight({load,require});
test('new general-table rules expose source units and profiles while legacy snapshots stay byte-identical',()=>{
 const f={fileId:'general-file',filename:'general.csv',buffer:Buffer.from('受试者编码,访视编码,观察值(g),完成\nSYNTH-A,BASELINE,0,false\nSYNTH-B,BASELINE,2500,true\n')};
 const p={tenantId:'t',accountId:'a',authVersion:1,sessionId:'s'};
 const old=engine.preview(p,{files:[f],destinations:[]});
 const fresh=engine.preview(p,{files:[f],destinations:[],rulesVersion:'general-tabular.v1'});
 assert.equal(fresh.rulesVersion,'general-tabular.v1');assert.equal(fresh.files[0].fields[2].unit,'g');assert.equal(fresh.files[0].fields[2].profile.zeroCount,1);assert.equal(fresh.files[0].rejectedRows,0);
 assert.deepEqual(engine.preview(p,{files:[f],destinations:[],rulesVersion:'legacy.v1'}),old);
 assert.throws(()=>engine.preview(p,{files:[f],destinations:[],rulesVersion:'future'}));
});
test('general normalized identity detection rejects fullwidth name columns before delivering raw rows',()=>{
 const buffer=Buffer.from('受试者编码,ｎａｍｅ\nSYNTH-A,SYNTHETIC-IDENTIFIER\n');const p=engine.preview({tenantId:'t',accountId:'a',authVersion:1,sessionId:'s'},{files:[{fileId:'f',filename:'general.csv',buffer}],destinations:[],rulesVersion:'general-tabular.v1'});
 assert(p.files[0].rows[0].issues.includes('DIRECT_IDENTIFIER_COLUMNS'));assert.deepEqual(p.files[0].rows[0].values,[]);
});
test('general duplicate headers use the same NFKC normalization as mapping',()=>{
 const buffer=Buffer.from('subject_id,value,ｖａｌｕｅ\nSYNTH-A,0,1\n');const p=engine.preview({tenantId:'t',accountId:'a',authVersion:1,sessionId:'s'},{files:[{fileId:'f',filename:'general.csv',buffer}],destinations:[],rulesVersion:'general-tabular.v1'});assert(p.files[0].rows[0].issues.includes('DUPLICATE_HEADERS'));
});
const principal={tenantId:'synthetic-t',accountId:'synthetic-owner',authVersion:1,sessionId:'synthetic-session'};
const dest=(id,canImport=true)=>({studyId:id,tenantId:principal.tenantId,studyGroupId:'g',executionProjectId:'p-'+id,version:1,canImport});
const xlsx=(rows,edit=()=>{})=>{const sheet=XLSX.utils.aoa_to_sheet(rows);edit(sheet);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'Synthetic');return{fileId:'synthetic-xlsx',filename:'synthetic.xlsx',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})};};
const csv=text=>({fileId:'synthetic-csv',filename:'synthetic.csv',buffer:Buffer.from(text)});
const preview=files=>engine.preview(principal,{files,destinations:[dest('s1')]});
test('the existing CRF CSV subject_code header is a pseudonym column, while two identity columns remain ambiguous',()=>{
 const p=preview([csv('subject_code,visit_code,value,completed\nS01,BASELINE,0,false\n')]);assert.equal(p.files[0].rejectedRows,0);assert.equal(p.files[0].rows[0].subjectCode,'S01');assert.equal(p.files[0].rows[0].visit,'BASELINE');
 assert.equal(preview([csv('subject_id,subject_code,value\nS01,S02,0\n')]).files[0].rejectedRows,1);
});
test('native CSV and XLSX inspection retain zero, false, missing and real row/column positions',()=>{
 const a=preview([xlsx([['subject_id','score','flag','unknown_unit'],['S01',0,false,null],['S02',null,true,'quux']])]);
 assert.equal(a.files[0].rows[0].values[1],0);assert.equal(a.files[0].rows[0].values[2],false);assert.equal(a.files[0].rows[0].values[3],null);assert.equal(a.files[0].rows[0].rowNumber,2);assert.equal(a.files[0].fields[1].column,2);assert.equal(a.files[0].fields[3].unit,null);
 const b=preview([csv('subject_id,score,flag\nS01,0,false\nS02,,true\n')]);assert.deepEqual(b.files[0].rows[0].values,['S01','0','false']);assert.equal(b.files[0].rows[1].values[1],null);
 assert.equal(a.destination.studyId,'s1');assert.equal(a.confirmationReady,false);assert(a.issues.includes('MAPPING_REQUIRED'));
});
test('a pseudonym ID is not automatically a direct identifier, but name columns require de-identification',()=>{
 assert.equal(preview([csv('subject_id,score\nS01,0\n')]).files[0].rejectedRows,0);
 const p=preview([csv('subject_id,姓名,score\nS01,Synthetic Person,0\n')]);assert.equal(p.files[0].rejectedRows,1);assert(p.files[0].issues.includes('DIRECT_IDENTIFIER_COLUMNS'));
});
test('blank/duplicate headers, invalid identities and formulas are exceptions, never silently filled or evaluated',()=>{
 const a=preview([xlsx([['subject_id','score','score'],['S01',0,1]])]);assert(a.files[0].issues.includes('DUPLICATE_HEADERS'));
 const b=preview([xlsx([['subject_id',null,'score'],['S01','orphan',0]])]);assert(b.files[0].issues.includes('UNNAMED_COLUMN'));assert.equal(b.files[0].fields[2].column,3);
 const c=preview([xlsx([['subject_id','score'],['S01',0],['bad subject',1],['S02',2]],s=>{s.B2.f='1+1';})]);assert.equal(c.files[0].rejectedRows,2);assert(c.files[0].rows[0].issues.includes('FORMULA_CELL'));assert(c.files[0].rows[1].issues.includes('SUBJECT_CODE_INVALID'));
});
test('readable Study/admin claims do not become import destinations; multiple choices are not first-project defaults',()=>{
 assert.equal(selectImportDestination(principal,[dest('read-only',false)],{}).destination,null);
 assert.equal(selectImportDestination({...principal,role:'tenant_admin'},[dest('read-only',false)],{}).destination,null);
 assert.equal(selectImportDestination(principal,[dest('s1'),dest('s2')],{}).destination,null);
 assert.equal(selectImportDestination(principal,[dest('s1'),dest('s2')],{trustedStudyId:'s2'}).destination.studyId,'s2');
 assert.throws(()=>selectImportDestination(principal,[dest('s1')],{targetStudyId:'missing'}),e=>e.code==='DATA_PREFLIGHT_DESTINATION_UNAVAILABLE');
 assert.throws(()=>selectImportDestination(principal,[{...dest('s1'),tenantId:'other'}],{targetStudyId:'s1'}),e=>e.code==='DATA_PREFLIGHT_DESTINATION_UNAVAILABLE');
});
test('same pseudonym is scoped to the selected Study, conflicting source Study is rejected, target change changes hash',()=>{
 const files=[csv('subject_id,study_id,score\nS01,s1,0\nS01,s2,1\n')];
 const a=engine.preview(principal,{files,destinations:[dest('s1'),dest('s2')],targetStudyId:'s1'});
 const b=engine.preview(principal,{files,destinations:[dest('s1'),dest('s2')],targetStudyId:'s2'});
 assert.equal(a.files[0].rejectedRows,1);assert(a.files[0].rows[1].issues.includes('STUDY_MISMATCH'));assert(b.files[0].rows[0].issues.includes('STUDY_MISMATCH'));assert.notEqual(a.previewHash,b.previewHash);
});
test('changed bytes/auth version change the fixed preview hash; identical calls have no random/new side effects',()=>{
 const input={files:[csv('subject_id,score\nS01,0\n')],destinations:[dest('s1')]};
 const a=engine.preview(principal,input);assert.deepEqual(engine.preview(principal,input),a);
 assert.notEqual(engine.preview({...principal,authVersion:2},input).previewHash,a.previewHash);
 assert.notEqual(preview([csv('subject_id,score\nS01,1\n')]).previewHash,a.previewHash);
 assert.equal(a.modelCalls,0);assert.equal(a.operatorCalls,0);assert.equal(a.formalWrites,0);
});
test('visit hints and duplicate subject/visit rows remain explicit, not new visits or overwritten records',()=>{
 const a=preview([csv('subject_id,visit,score\nS01,baseline,0\nS01,baseline,1\n')]);
 assert(a.issues.includes('VISIT_BINDING_REQUIRED'));assert(a.files[0].rows[1].issues.includes('DUPLICATE_SUBJECT_VISIT'));assert.equal(a.confirmationReady,false);
});
test('invalid signature/unsafe extension/capacity reject complete input rather than pretending a truncated preview is complete',()=>{
 assert.throws(()=>preview([{...csv('subject_id,score\nS01,1\n'),filename:'synthetic.pdf'}]));
 assert.throws(()=>preview([csv('subject_id,score\n'+Array.from({length:10001},(_,i)=>'S'+i+',0').join('\n'))]),e=>e.code==='DATA_PREFLIGHT_CAPACITY');
 assert.throws(()=>preview(Array.from({length:21},(_,i)=>({...csv('subject_id,score\nS01,0'),fileId:'s'+i}))),e=>e.code==='DATA_PREFLIGHT_INPUT');
});
test('a combined over-capacity batch returns a definite capacity refusal so the original pending key can be cleared',()=>{
 const file=csv('subject_id,score\n'+Array.from({length:6000},(_,i)=>'S'+i+',0').join('\n'));
 assert.throws(()=>preview([file,{...file,fileId:'second-file'}]),e=>e.code==='DATA_PREFLIGHT_CAPACITY'&&e.status===413);
});
test('a false XLSX signature is a definite file input rejection, not an unknown service failure',()=>{
 assert.throws(()=>preview([{...csv('SYNTHETIC-NOT-AN-XLSX'),filename:'bad-synthetic.xlsx'}]),e=>e.code==='DATA_PREFLIGHT_FORMAT'&&e.status===400);
});
test('an incomplete first header is reported without promoting a data row into headers or losing its values',()=>{
 const p=preview([csv('subject_id,\nS01,0\nS02,1\n')]);assert.equal(p.files[0].rowsRead,2);assert.equal(p.files[0].rows[0].subjectCode,'S01');assert(p.files[0].issues.includes('UNNAMED_COLUMN'));
});
test('a wrong-study or formula row cannot poison a later eligible row with the same identity',()=>{
 const p=preview([csv('subject_id,study_id,score\nS01,s2,0\nS01,s1,1\n')]);assert.deepEqual(p.files[0].rows[1].issues,[]);
});
test('sheet-local exceptions do not leak to a later normal sheet',()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['subject_id',null,'score'],['S01','orphan',0]]),'bad');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['subject_id','score'],['S02',1]]),'good');
 const p=preview([{fileId:'two-sheets',filename:'synthetic.xlsx',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})}]);assert.deepEqual(p.files[0].rows.find(r=>r.sheet==='good').issues,[]);
});
test('effective identity/next-action flags agree, retaining the original classifier only as diagnostics',()=>{
 const p=preview([csv('subject_id,score\nS01,0\n')]);assert.equal(p.files[0].classification.directIdentifierColumnDetected,false);assert.notEqual(p.files[0].triage.nextAction,'DE_IDENTIFY_AND_MAP_SUBJECTS');assert.equal(p.files[0].legacyClassification.directIdentifierColumnDetected,true);
});
