export const GENERAL_TABULAR_RULES='general-tabular.v1';
const fail=code=>{throw Object.assign(Error(code),{code,status:409});};
export const normalizedColumn=x=>String(x??'').normalize('NFKC').trim().toLowerCase().replace(/[\s_-]/g,'');
const aliases={subjectCode:['subjectid','subjectcode','participantid','participantcode','被试编号','被试编码','受试者编号','受试者编码','被试id','受试者id','sid'],visitCode:['visit','visitcode','visitid','访视','访视编号','访视编码'],studyId:['studyid','studycode','研究编号','课题编号']};
export const bindingColumn=name=>Object.entries(aliases).find(([,items])=>items.includes(normalizedColumn(name)))?.[0]??null;
export function parseColumnHeader(value){
 const name=String(value??'').trim(),match=name.match(/^(.*?)\s*[（(\[【]([^()（）\[\]【】]+)[）)\]】]\s*$/);
 const suffix=match?.[2]?.trim(),declared=suffix&&(unitOf(suffix)||/^(?:mmol\/L|mol\/L|mg\/dL|mmHg|bpm|%|℃|°C|分|岁|年|月|周|天|次\/分|次\/分钟|min|h|d)$/.test(suffix));
 return{name,label:declared?match[1].trim()||name:name,unit:declared?suffix:null};
}
// Explicit physical dimensions only; no analyte-specific or affine conversions.
const units=[['mass',-6,['µg','μg','ug']],['mass',-3,['mg']],['mass',0,['g','克']],['mass',3,['kg','千克','公斤']],['length',-3,['mm','毫米']],['length',-2,['cm','厘米']],['length',0,['m','米']],['time',-3,['ms','毫秒']],['time',0,['s','秒']],['volume',-6,['µL','μL','uL']],['volume',-3,['mL','ml','毫升']],['volume',0,['L','l','升']]];
const unitOf=u=>units.find(([, ,names])=>names.includes(u));
function unitRule(header,field){
 const source=parseColumnHeader(header),target=parseColumnHeader(field.label??field.key),declared=field.unit==null?null:String(field.unit).trim()||null;
 if(declared&&target.unit&&declared!==target.unit)fail('DATA_IMPORT_UNIT_REQUIRED');
 const from=source.unit,to=declared??target.unit;
 if(!from&&!to)return{from:null,to:null,power:0};
 if(!from)fail('DATA_IMPORT_UNIT_REQUIRED');
 if(!to)fail('DATA_IMPORT_UNIT_REQUIRED');
 if(from===to)return{from,to,power:0};
 const a=unitOf(from),b=unitOf(to);if(!a||!b||a[0]!==b[0])fail('DATA_IMPORT_UNIT_REQUIRED');
 return{from,to,power:a[1]-b[1]};
}
export function dataFieldCandidates(header,fields){
 const {label}=parseColumnHeader(header),name=normalizedColumn(label);
 const exact=fields.filter(f=>f.key===label);if(exact.length)return exact;
 const keys=fields.filter(f=>normalizedColumn(f.key)===name);if(keys.length)return keys;
 return fields.filter(f=>normalizedColumn(parseColumnHeader(f.label??'').label)===name);
}
export function matchDataField(header,fields){const matches=dataFieldCandidates(header,fields);if(matches.length>1)fail('DATA_IMPORT_MAPPING_REQUIRED');return matches[0]??null;}
// Normalize a decimal as coefficient/exponent; comparison catches JS precision
// loss before scientific data reaches the native Form parser.
function decimal(value){
 const s=String(value).trim();if(s.length>100||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))fail('DATA_IMPORT_INVALID_ROWS');
 const [mantissa,e='0']=s.toLowerCase().split('e'),exp=Number(e);if(!Number.isSafeInteger(exp)||Math.abs(exp)>308)fail('DATA_IMPORT_INVALID_ROWS');
 const negative=mantissa.startsWith('-'),unsigned=mantissa.replace(/^[+-]/,''),fraction=unsigned.split('.')[1]?.length??0;
 let digits=unsigned.replace('.','').replace(/^0+/,'')||'0',power=exp-fraction;
 while(digits.length>1&&digits.endsWith('0')){digits=digits.slice(0,-1);power++;}
 return{digits,negative:negative&&digits!=='0',power:digits==='0'?0:power};
}
function numeric(value,power=0){
 if(typeof value!=='number'&&typeof value!=='string')fail('DATA_IMPORT_INVALID_ROWS');
 const d=decimal(value);d.power=d.digits==='0'?0:d.power+power;
 const n=Number(`${d.negative?'-':''}${d.digits}e${d.power}`);
 if(!Number.isFinite(n)||Number.isInteger(n)&&!Number.isSafeInteger(n)||JSON.stringify(decimal(String(n)))!==JSON.stringify(d))fail('DATA_IMPORT_INVALID_ROWS');return n;
}
export function describeColumn(values){
 let missing=0,zeroCount=0,falseCount=0;const types=new Set();
 for(const v of values){if(v==null||typeof v==='string'&&!v.trim()){missing++;continue;}
  const scalar=typeof v==='string'?v.trim():v;
  if(scalar===false||scalar==='false'||scalar==='否')falseCount++;
  if(typeof scalar==='boolean'||['true','false','是','否'].includes(scalar)){types.add('boolean');continue;}
  try{const n=numeric(v);types.add('number');if(n===0)zeroCount++;}catch{types.add('text');}
 }
 return{type:types.size>1?'mixed':[...types][0]??'empty',missing,nonMissing:values.length-missing,zeroCount,falseCount};
}
export function mappingDescription(header,field,fields=[]){const r=unitRule(header,field);return{sourceLabel:String(header),targetKey:field.key,targetLabel:field.label??field.key,sourceUnit:r.from,targetUnit:r.to,conversionPower:r.power,...(fields.filter(f=>(f.label??f.key)===(field.label??field.key)).length>1?{targetDisambiguator:field.key}:{})};}
export function decodeMappedValue(value,header,field){
 const rule=unitRule(header,field);if(value==null||typeof value==='string'&&!value.trim())return null;
 if(field.type==='number'||field.type==='integer'){const n=numeric(value,rule.power);if(field.type==='integer'&&!Number.isInteger(n))fail('DATA_IMPORT_INVALID_ROWS');return n;}
 if(rule.power||rule.from&&rule.from!==rule.to)fail('DATA_IMPORT_UNIT_REQUIRED');
 if(field.type==='boolean'){const v=typeof value==='string'?value.trim():value;if(v===true||v==='true'||v==='是')return true;if(v===false||v==='false'||v==='否')return false;fail('DATA_IMPORT_INVALID_ROWS');}
 if(field.type==='select'){
  const raw=String(value),options=field.options??[];if(options.some(o=>(typeof o==='string'?o:o.value)===raw))return raw;
  const matches=options.filter(o=>typeof o==='object'&&o.label===raw);if(matches.length===1)return matches[0].value;fail('DATA_IMPORT_INVALID_ROWS');
 }
 if(field.type==='text')return String(value);fail('DATA_IMPORT_INVALID_ROWS');
}
