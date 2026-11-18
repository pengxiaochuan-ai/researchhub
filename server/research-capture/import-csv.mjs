import {researchError} from '../research-studies/contract.mjs';
const invalid=()=>researchError(400,'IMPORT_CSV_INVALID','CSV格式不符合模板，请核对引号、列名与每行列数。');
// Compare decimal values without another numeric conversion. Equivalent trailing zeros/exponents are harmless.
function decimalIdentity(value){
 const negative=value.startsWith('-'),[mantissa,exponent='0']=value.replace(/^[+-]/,'').toLowerCase().split('e'),fraction=mantissa.split('.')[1]?.length??0;
 const digits=mantissa.replace('.','').replace(/^0+/,'');if(!digits)return '0';const trimmed=digits.replace(/0+$/,'');
 return (negative?'-':'')+trimmed+'e'+(Number(exponent)-fraction+digits.length-trimmed.length);
}
// Bounded strict CSV decoding; field coercion is governed only by the fixed form schema.
export function parseCaptureCsv(value,fields){
 if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>256*1024||value.includes('\0')||!Array.isArray(fields)||fields.length>62)throw invalid();
 const text=value.replace(/^\uFEFF/,''),records=[];let cells=[],cell='',quoted=false,closed=false,line=1,startLine=1,touched=false;
 const finishCell=()=>{cells.push(cell);cell='';closed=false;if(cells.length>64)throw invalid();};
 const finishRow=()=>{finishCell();records.push({cells,rowNumber:startLine});cells=[];touched=false;if(records.length>101)throw invalid();};
 for(let i=0;i<text.length;i++){
  const c=text[i];touched=true;
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
   else{cell+=c;if(c==='\n'||c==='\r'&&text[i+1]!=='\n')line++;}continue;
  }
  if(c==='"'){if(cell||closed)throw invalid();quoted=true;continue;}
  if(c===','){finishCell();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();line++;startLine=line;continue;}
  if(closed)throw invalid();cell+=c;
 }
 if(quoted)throw invalid();if(touched||cells.length||cell||closed)finishRow();
 if(records.length<2)throw invalid();
 const headers=records.shift().cells,expected=['subject_code','visit_code',...fields.map(f=>f.key)];
 if(new Set(expected).size!==expected.length||headers.length!==expected.length||new Set(headers).size!==headers.length||headers.some(h=>!expected.includes(h)))throw invalid();
 const index=new Map(headers.map((h,i)=>[h,i])),seen=new Set(),errors=[],rows=[];
 for(const record of records){
  if(record.cells.length!==headers.length)throw invalid();
  const subjectCode=record.cells[index.get('subject_code')].trim(),visitCode=record.cells[index.get('visit_code')].trim(),pairs=[];
  const error=(code,fieldKey=null)=>errors.push({rowNumber:record.rowNumber,fieldKey,code});
  if(!subjectCode||subjectCode.length>160||!visitCode||visitCode.length>160)error('IMPORT_TARGET_REQUIRED');
  const target=JSON.stringify([subjectCode,visitCode]);if(seen.has(target))error('IMPORT_DUPLICATE_ROW');seen.add(target);
  for(const field of fields){
   const raw=record.cells[index.get(field.key)],trimmed=raw.trim();let decoded=raw;
   if(trimmed==='')decoded=null;
   else if(field.type==='number'||field.type==='integer'){
    const numeric=Number(trimmed);
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)||!Number.isFinite(numeric)||Number.isInteger(numeric)&&!Number.isSafeInteger(numeric)||field.type==='integer'&&!Number.isInteger(numeric)||decimalIdentity(trimmed)!==decimalIdentity(String(numeric))){error('IMPORT_VALUE_INVALID',field.key);decoded=null;}else decoded=numeric;
   }else if(field.type==='boolean'){
    if(trimmed!=='true'&&trimmed!=='false'){error('IMPORT_VALUE_INVALID',field.key);decoded=null;}else decoded=trimmed==='true';
   }else if(field.type==='select'){
    if(!field.options?.some(o=>(typeof o==='string'?o:o.value)===raw))error('IMPORT_VALUE_INVALID',field.key);
   }else if(field.type!=='text')throw invalid();
   pairs.push([field.key,decoded]);
  }
  rows.push({rowNumber:record.rowNumber,subjectCode,visitCode,answers:Object.fromEntries(pairs)});
 }
 return {rows,errors};
}
