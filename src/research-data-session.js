export const DATA_REQUEST_MARKER='research-data-v1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export const researchDataRequestAllowed=(method,path)=>researchDataImportRequestAllowed(method,path)||method==='GET'&&(/^\/sessions\/[A-Za-z0-9_-]+\/research-data(?:\?limit=(?:[1-9]|[1-4][0-9]|50)(?:&cursor=[A-Za-z0-9_-]+)?)?$/.test(path)||/^\/sessions\/[A-Za-z0-9_-]+\/(?:research-data|data-preflights)\/receipts\/[A-Za-z0-9_-]+$/.test(path)||/^\/sessions\/[A-Za-z0-9_-]+\/data-preflights$/.test(path))||method==='POST'&&(/^\/sessions\/[A-Za-z0-9_-]+\/(?:research-data|data-preflights)$/.test(path)||/^\/sessions\/[A-Za-z0-9_-]+\/data-preflights\/[A-Za-z0-9_-]+\/cancellation$/.test(path));
export function assertResearchDataPage(value){if(!value||!Array.isArray(value.items)||value.items.length>50||value.nextCursor!==null&&!id(value.nextCursor)||value.items.some(x=>x.kind!=='research-data'||!id(x.id)||!Number.isSafeInteger(x.version)||x.version<1||typeof x.name!=='string'||!['staged','ready','rejected','invalid'].includes(x.state)))throw Error('研究数据状态无法核对，请重新获取。');return value;}
export function assertDataPlan(value){if(value===null)return null;if(!value||!id(value.id)||!Number.isSafeInteger(value.version)||value.version<1||!['previewed','cancelled','invalid'].includes(value.state)||!Array.isArray(value.files)||!value.files.length||value.files.length>20||value.files.some(f=>!id(f?.id)||!Number.isSafeInteger(f.version)||f.version<1)||value.result?.schema!=='hub-research-data-summary.v1'||value.result.confirmationReady!==false||!Array.isArray(value.result.files))throw Error('预检状态无法核对，请重新获取。');return value;}
const labels={MAPPING_REQUIRED:'标准字段映射需要确认',NO_IMPORT_DESTINATION:'当前没有可导入的研究',STUDY_SELECTION_REQUIRED:'需要选择关联研究',VISIT_BINDING_REQUIRED:'访视对应关系需要确认',DIRECT_IDENTIFIER_COLUMNS:'含直接身份字段，请先去标识化',UNNAMED_COLUMN:'有列缺少表头',DUPLICATE_HEADERS:'有重复表头',SUBJECT_COLUMN_REQUIRED:'需要明确被试编号列',SUBJECT_CODE_INVALID:'被试编号需要核对',FORMULA_CELL:'含公式，需提供原始观测值',STUDY_MISMATCH:'记录的研究与所选研究不符',DUPLICATE_SUBJECT_VISIT:'同一被试和访视存在重复记录',AMBIGUOUS_BINDING_COLUMNS:'被试、访视或研究列存在歧义'};
export const researchDataIssueLabel=code=>labels[code]??'该项需要核对';
export const researchDataCell=value=>value===null||value===undefined?'未提供':String(value);
export function researchDataColumnDescription(field){
 const types={number:'数值',boolean:'是／否',text:'文字',mixed:'类型混合，需核对',empty:'暂无观测值'},p=field.profile;
 return[field.unit?`单位：${field.unit}`:'',p?`${types[p.type]??'类型待核对'}；已记录${p.nonMissing}项，空值${p.missing}项`:''].filter(Boolean).join('；');
}
export const researchDataMappingDescription=m=>`${m.sourceLabel} → ${m.targetLabel}${m.targetDisambiguator?` · ${m.targetDisambiguator}`:''}${m.targetUnit?`（${m.targetUnit}）`:''}${m.conversionPower?'，按单位换算':''}`;
import {researchDataImportRequestAllowed as legacyImportAllowed} from './research-data-import-session.js';
import {profileImportRequestAllowed} from './subject-profile-import-session.js';
const researchDataImportRequestAllowed=(method,path)=>legacyImportAllowed(method,path)||profileImportRequestAllowed(method,path);
