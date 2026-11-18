import {parseCaptureCsv} from '../research-capture/import-csv.mjs';
import {GENERAL_TABULAR_RULES,bindingColumn,matchDataField,dataFieldCandidates,decodeMappedValue,mappingDescription} from './research-data-tabular.mjs';
const fail=(code='DATA_IMPORT_MAPPING_REQUIRED')=>{throw Object.assign(Error(code),{code,status:409});};
const normalized=x=>String(x??'').trim().toLowerCase().replace(/[\s_-]/g,'');
const subject=new Set(['subjectid','subjectcode','participantid','被试编号','受试者编号','sid']),visit=new Set(['visit','visitcode','访视','访视编号']);
const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const groupKey=m=>JSON.stringify([m.fileId,m.sheet,m.targetKey]);
/** A read-only choice description. Source identity/row errors stay blocking. */
export function describeDataMapping(preview,fields){
 if(preview?.rulesVersion!==GENERAL_TABULAR_RULES)return null;
 if(!preview.files?.length||!Array.isArray(fields))fail();
 if(preview.files.some(f=>f.rejectedRows||f.rows.some(r=>r.issues.length)))fail('DATA_IMPORT_INVALID_ROWS');
 const mode=preview.files.some(f=>f.fields.some(h=>bindingColumn(h.name)==='visitCode'))?'visit_form':'subjects';
 if(mode!=='visit_form')return null;
 const columns=preview.files.flatMap(f=>f.fields.filter(h=>bindingColumn(h.name)!=='studyId').map(h=>{
  const binding=bindingColumn(h.name),matches=binding?[binding]:dataFieldCandidates(h.name,fields).map(f=>f.key);
  return{fileId:f.fileId,sheet:h.sheet,column:h.column,name:h.name,targetKeys:matches,binding:Boolean(binding)};
 }));
 const counts=new Map();for(const c of columns)if(c.targetKeys.length===1){const k=groupKey({...c,targetKey:c.targetKeys[0]});counts.set(k,(counts.get(k)??0)+1);}
 const automatic=columns.filter(c=>c.targetKeys.length===1&&counts.get(groupKey({...c,targetKey:c.targetKeys[0]}))===1).map(({fileId,sheet,column,targetKeys})=>({fileId,sheet,column,targetKey:targetKeys[0]}));
 const unresolved=columns.filter(c=>!automatic.some(m=>m.fileId===c.fileId&&m.sheet===c.sheet&&m.column===c.column)).map(({binding,...c})=>({...c,targetKeys:(c.targetKeys.length?c.targetKeys:fields.map(f=>f.key)).filter(key=>!automatic.some(m=>m.fileId===c.fileId&&m.sheet===c.sheet&&m.targetKey===key))}));
 if(!unresolved.length)return null;
 return{mode,automatic,columns:unresolved,fields:fields.map(f=>({key:f.key,label:f.label??f.key,type:f.type,required:Boolean(f.required),unit:f.unit??null})),requiredKeys:['subjectCode','visitCode',...fields.filter(f=>f.required).map(f=>f.key)]};
}
/** Only mapping, never inference of diagnosis, units, groups or visits. */
export function compileDataMapping(preview,fields,explicit,{studyId}={}){
 if(!preview?.files?.length||!Array.isArray(fields))fail();
 const general=preview.rulesVersion===GENERAL_TABULAR_RULES;
 const mode=preview.files.some(f=>f.fields.some(h=>general?bindingColumn(h.name)==='visitCode':visit.has(normalized(h.name))))?'visit_form':'subjects';
 const known=new Set(['subjectCode',...(mode==='visit_form'?['visitCode',...fields.map(f=>f.key)]:[])]);
 const automatic=()=>preview.files.flatMap(f=>f.fields.flatMap(h=>{const name=normalized(h.name),key=general?(bindingColumn(h.name)??matchDataField(h.name,fields)?.key):subject.has(name)?'subjectCode':visit.has(name)?'visitCode':fields.find(k=>k.key===h.name)?.key;return key&&known.has(key)?[{fileId:f.fileId,sheet:h.sheet,column:h.column,targetKey:key}]:[];}));
 const mapping=explicit===undefined?automatic():explicit;
 if(!Array.isArray(mapping)||!mapping.length||mapping.length>10000||mapping.some(m=>!m||!known.has(m.targetKey)))fail();
 const sources=new Set();for(const m of mapping){const key=JSON.stringify([m.fileId,m.sheet,m.column]);if(sources.has(key))fail();sources.add(key);}
 const rows=[],seen=new Set(),unmapped=[];
 for(const file of preview.files){
  if(file.rejectedRows||file.rows.some(r=>r.issues.length))fail('DATA_IMPORT_INVALID_ROWS');
  for(const row of file.rows){
   // Source Study columns are provenance, even when deliberately not written
   // into a CRF. A target choice must never silently override a source Study.
   for(const field of file.fields.filter(h=>h.sheet===row.sheet&&(general?bindingColumn(h.name)==='studyId':['studyid','研究编号'].includes(normalized(h.name))))){
    const sourceStudy=String(row.values[field.column-1]??'').trim();if(sourceStudy&&sourceStudy!==studyId)fail('DATA_IMPORT_STUDY_MISMATCH');
   }
   const mapped=mapping.filter(m=>m.fileId===file.fileId&&m.sheet===row.sheet),keys=new Set(mapped.map(m=>m.targetKey));
   if(keys.size!==mapped.length||!keys.has('subjectCode')||mode==='visit_form'&&(!keys.has('visitCode')||fields.some(f=>f.required&&!keys.has(f.key))))fail();
   for(const m of mapped)if(!file.fields.some(f=>f.sheet===m.sheet&&f.column===m.column)||Object.keys(m).sort().join(',')!=='column,fileId,sheet,targetKey')fail();
   const raw=Object.fromEntries(mapped.map(m=>[m.targetKey,row.values[m.column-1]])),subjectCode=String(raw.subjectCode??'').trim(),visitCode=mode==='visit_form'?String(raw.visitCode??'').trim():null;
   if(!/^[A-Za-z0-9_-]{1,64}$/.test(subjectCode)||mode==='visit_form'&&!visitCode)fail();
   const identity=JSON.stringify([subjectCode,visitCode]);if(seen.has(identity))fail('DATA_IMPORT_DUPLICATE_TARGET');seen.add(identity);
   let answers=Object.fromEntries(fields.map(f=>[f.key,Object.hasOwn(raw,f.key)?raw[f.key]:null]));
   if(mode==='visit_form'&&general)answers=Object.fromEntries(fields.map(field=>{const m=mapped.find(m=>m.targetKey===field.key),header=m&&file.fields.find(h=>h.sheet===m.sheet&&h.column===m.column);return[field.key,m?decodeMappedValue(raw[field.key],header.name,field):null];}));
   if(mode==='visit_form'&&(file.format==='csv'||general)){
    const csv=[['subject_code','visit_code',...fields.map(f=>f.key)],[subjectCode,visitCode,...fields.map(f=>answers[f.key])]].map(r=>r.map(csvCell).join(',')).join('\n');
    const parsed=parseCaptureCsv(csv,fields);if(parsed.errors.length)fail('DATA_IMPORT_INVALID_ROWS');answers=parsed.rows[0].answers;
   }
   rows.push({rowNumber:rows.length+2,subjectCode,visitCode,answers:mode==='subjects'?{}:answers,source:{fileId:file.fileId,sheet:row.sheet,rowNumber:row.rowNumber}});
  }
  unmapped.push(...file.fields.filter(h=>!mapping.some(m=>m.fileId===file.fileId&&m.sheet===h.sheet&&m.column===h.column)).map(h=>({fileId:file.fileId,...h})));
 }
 if(!rows.length||rows.length>100||mapping.some(m=>!preview.files.some(f=>f.fileId===m.fileId&&f.fields.some(h=>h.sheet===m.sheet&&h.column===m.column))))fail('DATA_IMPORT_CAPACITY');
 return{mode,mapping,rows,unmapped,...(general?{transforms:mapping.flatMap(m=>{const f=fields.find(f=>f.key===m.targetKey),h=preview.files.find(f=>f.fileId===m.fileId)?.fields.find(h=>h.sheet===m.sheet&&h.column===m.column);return f?[{fileId:m.fileId,sheet:m.sheet,column:m.column,...mappingDescription(h.name,f,fields)}]:[];})}:{})};
}
