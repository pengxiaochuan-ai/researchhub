import assert from 'node:assert/strict';
import {hashText} from './knowledge-ai-contract.mjs';

export const SYNTHETIC_SCHEMA='rh-synthetic-quality.v1';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const datasetHash=data=>hashText(JSON.stringify(canonical(data)));
export function generateSyntheticDataset(seed){
 assert.ok(Number.isSafeInteger(seed)&&seed>=1&&seed<=999999,'SYNTHETIC_SEED_INVALID');
 const subjects=Array.from({length:8},(_,i)=>({id:'SYN-'+String(i+1).padStart(3,'0'),age:24+parseInt(hashText(seed+':'+i).slice(0,4),16)%37,group:i%2?'B':'A'}));
 const visits=subjects.flatMap((s,i)=>[0,1].map(t=>({id:`V-${String(i+1).padStart(3,'0')}-T${t}`,subjectId:s.id,code:'T'+t,sequence:t,completedAt:`2026-01-0${t+2}T00:00:00.000Z`})));
 const measurements=visits.map(v=>({id:v.id.replace('V-','M-'),subjectId:v.subjectId,visitCode:v.code,collectedAt:v.completedAt}));
 // Deliberate software fixture defects; never a clinical sampling model.
 subjects[0].age=null;subjects[3].age=null;subjects[1].age=201;subjects[2].group='B';
 visits[7].completedAt='2026-01-01T00:00:00.000Z';measurements[9].collectedAt=measurements[8].collectedAt;
 return{schema:SYNTHETIC_SCHEMA,seed,anchorTime:'2026-01-20T00:00:00.000Z',subjects,visits,measurements};
}
export function qualitySourceRows(data){
 assert.equal(data.schema,SYNTHETIC_SCHEMA,'SYNTHETIC_SCHEMA_INVALID');
 return{now:new Date(data.anchorTime),subjects:data.subjects.map(s=>({...s,sex:'software-fixture'})),enrollments:data.subjects.map((s,i)=>({subjectId:s.id,armCode:i%2?'B':'A',status:'synthetic'})),visits:data.visits.map(v=>({subjectId:v.subjectId,status:'completed',targetDate:v.completedAt,actualCompletedAt:v.completedAt,visitPlan:{sequence:v.sequence,code:v.code}})),scaleResults:data.measurements.map(m=>({subjectId:m.subjectId,collectedAt:m.collectedAt,total:null,scale:{code:'SYNTHETIC_TEST_NOT_CLINICAL_SCALE'}}))};
}
const editable={subjects:['age','group'],visits:['completedAt'],measurements:['collectedAt']};
function validDate(value){try{return typeof value==='string'&&/^202[0-9]-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(value)&&new Date(value).toISOString()===value;}catch{return false;}}
export function reviseSyntheticDataset(data,edits,reason){
 assert.ok(typeof reason==='string'&&reason.trim().length>=8&&reason.length<=500,'SYNTHETIC_REASON_REQUIRED');
 assert.ok(Array.isArray(edits)&&edits.length>=1&&edits.length<=20,'SYNTHETIC_EDITS_INVALID');
 const next=structuredClone(data),seen=new Set(),changes=[];
 for(const edit of edits){
  assert.ok(edit&&Object.keys(edit).length===4&&['table','rowId','field','value'].every(k=>Object.hasOwn(edit,k)),'SYNTHETIC_EDITS_INVALID');
  const{table,rowId,field,value}=edit,key=[table,rowId,field].join(':');
  assert.ok(editable[table]?.includes(field)&&typeof rowId==='string'&&!seen.has(key),'SYNTHETIC_CELL_INVALID');seen.add(key);
  const row=next[table].find(r=>r.id===rowId);assert.ok(row,'SYNTHETIC_ROW_FORBIDDEN');
  assert.ok(field==='age'?value===null||Number.isInteger(value)&&value>=-10&&value<=300:field==='group'?['A','B'].includes(value):validDate(value),'SYNTHETIC_VALUE_INVALID');
  if(row[field]===value)continue;changes.push({table,rowId,field,before:row[field],after:value});row[field]=value;
 }
 assert.ok(changes.length,'SYNTHETIC_NO_CHANGE');return{dataset:next,changes,reason:reason.trim()};
}
export function assertSyntheticBinding(binding,current){
 assert.ok(current.sourceStatus==='current'&&['planId','version','contentHash','picoHash'].every(k=>binding[k]===current[k]),'SYNTHETIC_BINDING_CHANGED');
}
// Locators are display-only pointers into the exact input snapshot, never new QC results.
export function locateSyntheticFinding(data,finding){
 const pointers=[];const add=(table,row,field)=>pointers.push({table,rowId:row.id,field});
 if(finding.code.startsWith('MISSING_RATE')&&finding.anchors?.fieldKey==='age')data.subjects.filter(s=>s.age===null).forEach(s=>add('subjects',s,'age'));
 if(finding.code.startsWith('RANGE_')&&finding.anchors?.fieldKey==='age')data.subjects.filter(s=>s.age!==null&&(s.age<0||s.age>120)).forEach(s=>add('subjects',s,'age'));
 if(finding.code==='LEAKAGE_MULTI_GROUP')data.subjects.filter((s,i)=>s.group!==(i%2?'B':'A')).forEach(s=>add('subjects',s,'group'));
 if(finding.code==='TIME_ORDER_BLOCKING')for(const s of data.subjects){let previous='';for(const v of data.visits.filter(v=>v.subjectId===s.id).sort((a,b)=>a.sequence-b.sequence)){if(previous&&v.completedAt<previous)add('visits',v,'completedAt');previous=v.completedAt;}}
 if(finding.code==='DUPLICATE_KEY'){const seen=new Set();for(const m of data.measurements){const key=m.subjectId+':'+m.collectedAt;if(seen.has(key))add('measurements',m,'collectedAt');seen.add(key);}}
 return pointers;
}
