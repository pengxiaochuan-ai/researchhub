import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const DATASET_VERSION='MCA-2024-12-31';
export const SOURCE_URL='https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html';
export const SOURCE_SHA256='d4669f6c81091287127147720bad0f3c3465e9e2a2dcc7e887893cc787a23431';
export const referenceError=(code='REFERENCE_INVALID_INPUT',status=400)=>Object.assign(new Error(status===400?'请选择同一版本中有效的省份和城市／地区。':'省市字典暂不可用，请保留输入后重试。'),{code,status});
export const referenceHash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const invalid=()=>{throw referenceError();};
export function extractDivisions(raw){
 if(referenceHash(raw)!==SOURCE_SHA256)throw referenceError('REFERENCE_SOURCE_MISMATCH',503);
 const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').trim(),items=[];
 for(const row of raw.toString().matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1])),i=cells.findIndex(x=>/^\d{6}$/.test(x));
  if(i>=0){const code=cells[i],sourceName=cells[i+1];if(!sourceName)invalid();items.push({code,name:sourceName.replace(/[*＊]+$/,'').trim(),sourceName,level:code.endsWith('0000')?1:code.endsWith('00')?2:3,parentCode:null});}
 }
 const codes=new Set(items.map(x=>x.code));if(items.length!==3213||codes.size!==3213||items.filter(x=>x.level===1).length!==34)throw referenceError('REFERENCE_SOURCE_MISMATCH',503);
 for(const row of items)if(row.level!==1){const prefecture=row.code.slice(0,4)+'00';row.parentCode=row.level===3&&codes.has(prefecture)?prefecture:row.code.slice(0,2)+'0000';if(!codes.has(row.parentCode))invalid();}
 return items.sort((a,b)=>a.code.localeCompare(b.code));
}
export const REFERENCE_ROWS=extractDivisions(readFileSync(new URL('../../docs/reference/china-administrative-divisions/mca-2024.html',import.meta.url)));
const municipalities=new Set(['110000','120000','310000','500000']);
export function divisionOptions(rows,parentCode){
 if(parentCode===undefined)return rows.filter(x=>x.level===1);
 const parent=rows.find(x=>x.code===parentCode&&x.level===1);if(!parent)invalid();
 if(municipalities.has(parentCode))return [parent];
 return rows.filter(x=>x.parentCode===parentCode);
}
export function validateLocation(rows,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','provinceCode','cityCode'].includes(k))||value.version!==DATASET_VERSION||typeof value.provinceCode!=='string'||value.cityCode!==null&&typeof value.cityCode!=='string')invalid();
 const province=rows.find(x=>x.code===value.provinceCode&&x.level===1);if(!province)invalid();const choices=divisionOptions(rows,province.code),city=value.cityCode===null?null:choices.find(x=>x.code===value.cityCode);if(value.cityCode!==null&&!city)invalid();
 return {location:{version:DATASET_VERSION,provinceCode:province.code,cityCode:city?.code??null},region:province.name,city:city?.name??(choices.length?'':province.name)};
}
export async function readDivisionRows(tx){
 const rows=await tx.$queryRaw`SELECT code::text AS code,name,source_name AS "sourceName",level,parent_code::text AS "parentCode",dataset_version AS version,source_url AS url,source_sha256::text AS sha FROM rh_reference.administrative_division ORDER BY code`;
 const data=rows.map(({version,url,sha,...r})=>r);
 if(rows.some(r=>r.version!==DATASET_VERSION||r.url!==SOURCE_URL||r.sha!==SOURCE_SHA256)||referenceHash(data)!==referenceHash(REFERENCE_ROWS))throw referenceError('REFERENCE_DATA_MISMATCH',503);
 return data;
}
export async function resolveLocation(tx,value){return validateLocation(await readDivisionRows(tx),value);}
export async function listDivisions(tx,parentCode){
 const rows=await readDivisionRows(tx),items=divisionOptions(rows,parentCode).map(({code,name,level,parentCode})=>({code,name,level,parentCode}));
 return {version:DATASET_VERSION,source:{url:SOURCE_URL,sha256:SOURCE_SHA256,asOf:'2024-12-31'},items,provinceOnly:parentCode!==undefined&&!items.length};
}
