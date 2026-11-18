import {createHash} from 'node:crypto';
import {researchError} from '../research-studies/contract.mjs';
export const FORMAL_REPORT_PREFIX='rh-formal-report-';
export const REPORT_SCHEMA='formal-analysis-report-v1';
export const PRESENTATION_SCHEMA='formal-report-presentation-v1';
export const reportDigest=value=>createHash('sha256').update(value).digest('hex');
export function canonicalReportJson(value){
 if(value===null||value===undefined)return 'null';
 if(value instanceof Date)return JSON.stringify(value.toISOString());
 if(Array.isArray(value))return '['+value.map(canonicalReportJson).join(',')+']';
 if(typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonicalReportJson(value[k])).join(',')+'}';
 if(typeof value==='number'&&!Number.isFinite(value))throw researchError(409,'REPORT_SOURCE_INVALID','分析运行的固定来源或数值证据不完整，请重新核对。');
 return JSON.stringify(value);
}
const fail=()=>{throw researchError(409,'REPORT_SOURCE_INVALID','分析运行的固定来源或数值证据不完整，请重新核对。');};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
const label={total:'总数',observed:'有记录数',missing:'缺失数',min:'最小值',max:'最大值',mean:'均值',median:'中位数',sampleStdDev:'样本标准差',trueCount:'是',falseCount:'否'};
const escape=x=>String(x).replace(/[\r\n\u0000-\u001f|`<>]/g,' ');
// Preserve meaningful schema punctuation while preventing raw HTML/table/code delimiters.
const display=x=>String(x).replace(/[\r\n\u0000-\u001f]/g,' ').replace(/[&<>|`]/g,c=>c==='&'?'&amp;':'&#'+c.charCodeAt(0)+';');
export function assertT17Presentation(presentation,columns){
 if(!exact(presentation,['schemaVersion','variables'])||presentation.schemaVersion!==PRESENTATION_SCHEMA||!Array.isArray(presentation.variables)||!presentation.variables.length||presentation.variables.length>30)fail();
 const keys=new Set();
 for(const v of presentation.variables){
  if(!exact(v,['key','formVersionId','fieldKey','label','valueType','unit','formDefinitionHash'])||!['key','formVersionId'].every(k=>typeof v[k]==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v[k]))||keys.has(v.key)||typeof v.fieldKey!=='string'||!v.fieldKey.trim()||v.fieldKey.length>1000||typeof v.label!=='string'||!v.label.trim()||v.label.length>1000||!['number','integer','boolean'].includes(v.valueType)||!(v.unit===null||typeof v.unit==='string'&&v.unit.trim()&&v.unit.length<=160)||!/^[a-f0-9]{64}$/.test(v.formDefinitionHash))fail();
  if(columns&&columns[v.key]?.type!==(v.valueType==='integer'?'number':v.valueType))fail();keys.add(v.key);
 }
 if(columns&&(keys.size!==Object.keys(columns).length||Object.keys(columns).some(k=>!keys.has(k))))fail();
}
function withPresentation(legacy,run,basis,presentation){
 const outputs=run.artifactRefs.outputs;assertT17Presentation(presentation,outputs.columns);
 const lines=['> 通用合成研究数据，仅用于科研流程软件验证。','','## 分析范围','','统计单位：受试者。仅提供汇总统计，不含个体行数据。','受试者数：'+String(outputs.rowCount),''],appendix=['## 可复核附录','','受试者数固定结果路径：`rowCount`',''];
 for(const v of presentation.variables){
  const column=outputs.columns[v.key],stats=column.type==='number'?['min','max','mean','median','sampleStdDev']:['trueCount','falseCount'];
  lines.push('## '+display(v.label),'','单位：'+(v.unit===null?'未声明':display(v.unit)),'','| 指标 | 结果 |','| --- | --- |');
  appendix.push('### '+display(v.label)+'（'+display(v.key)+'）','','变量标识：'+display(v.key),'表单字段：'+display(v.fieldKey),'字段类型：'+display(v.valueType),'单位：'+(v.unit===null?'未声明':display(v.unit)),'固定表单版本：'+display(v.formVersionId),'表单定义摘要：'+v.formDefinitionHash,'','| 指标 | 固定结果路径 |','| --- | --- |');
  for(const stat of ['total','observed','missing',...stats]){lines.push('| '+label[stat]+' | '+(column[stat]===null?'不可估计':String(column[stat]))+' |');appendix.push('| '+label[stat]+' | `columns.'+v.key+'.'+stat+'` |');}
  lines.push('');appendix.push('');
 }
 const contentMd=[...lines,...appendix,'### 运行与依据','','- 方法运行：'+escape(run.id),'- 算子版本：'+escape(run.executorVersion),'- 分析快照：'+escape(basis.snapshotId),'- 分析依据摘要：'+escape(basis.manifestHash),'- 本文数值逐项复制确定性计算结果；缺失与不可估计结果保留。'].join('\n');
 const sealed=JSON.parse(canonicalReportJson(presentation)),sources=[legacy.sources[0],{...legacy.sources[1],snapshot:{...legacy.sources[1].snapshot,presentation:sealed}}];
 return {...legacy,contentMd,contentBlocks:[{...legacy.contentBlocks[0],presentation:sealed}],contentHash:reportDigest(contentMd),sourceSnapshotHash:reportDigest(canonicalReportJson(sources)),sources};
}
/** Copy exact accepted Worker results. This template never calculates statistics. */
export function buildT17Report(run,basis,title,presentation){
 const outputs=run?.artifactRefs?.outputs;
 if(run?.skillKey!=='descriptive-statistics'||run.executorVersion!=='descriptive-v1'||!Number.isSafeInteger(run.skillVersion)||run.skillVersion<1||!/^[a-f0-9]{64}$/.test(run.inputHash)||run.status!=='completed'||run.reviewStatus!=='confirmed'||run.environment?.llm!==false||run.environment?.workerVersion!=='t19-1'||canonicalReportJson(run.dataSources?.analysisBasis)!==canonicalReportJson(basis)||!exact(outputs,['manifestHash','rowCount','statisticalUnit','columns'])||outputs.manifestHash!==basis.manifestHash||outputs.statisticalUnit!=='subject'||!Number.isSafeInteger(outputs.rowCount)||outputs.rowCount<1||!object(outputs.columns)||Object.keys(outputs.columns).length<1||Object.keys(outputs.columns).length>30||!Array.isArray(run.numericEvidence))fail();
 const numbers=new Map([['rowCount',outputs.rowCount]]),lines=[];
 for(const[key,column]of Object.entries(outputs.columns)){
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(key))fail();
  const stats=column.type==='number'?['min','max','mean','median','sampleStdDev']:column.type==='boolean'?['trueCount','falseCount']:null;
  if(!stats||!exact(column,['type','total','observed','missing','status',...stats])||!['available','single_observation','all_missing'].includes(column.status)||!['total','observed','missing'].every(k=>Number.isSafeInteger(column[k])&&column[k]>=0)||column.total!==outputs.rowCount||column.observed+column.missing!==column.total)fail();
  lines.push('## '+escape(key),'','| 指标 | 结果 | 固定结果路径 |','| --- | --- | --- |');
  for(const stat of ['total','observed','missing',...stats]){
   const value=column[stat],path='columns.'+key+'.'+stat;
   if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))fail();
   if(value===null&&!stats.includes(stat))fail();
   if(value!==null)numbers.set(path,value);
   lines.push('| '+label[stat]+' | '+(value===null?'不可估计':String(value))+' | `'+path+'` |');
  }
  lines.push('');
 }
 const seen=new Set();
 for(const evidence of run.numericEvidence){if(!object(evidence)||typeof evidence.name!=='string'||seen.has(evidence.name)||!numbers.has(evidence.name)||numbers.get(evidence.name)!==evidence.value||!Array.isArray(evidence.assumptions)||!evidence.assumptions.includes('manifestHash:'+basis.manifestHash))fail();seen.add(evidence.name);}
 if(seen.size!==numbers.size)fail();
 const contentMd=['> 通用合成研究数据，仅用于科研流程软件验证。','','## 分析范围','','统计单位：受试者。仅提供汇总统计，不含个体行数据。','受试者数：'+String(outputs.rowCount)+'（固定结果路径：`rowCount`）','',...lines,'## 可复核来源','','- 方法运行：'+escape(run.id),'- 算子版本：'+escape(run.executorVersion),'- 分析快照：'+escape(basis.snapshotId),'- 分析依据摘要：'+escape(basis.manifestHash),'- 本文数值逐项复制确定性计算结果；缺失与不可估计结果保留。'].join('\n');
 const sources=[{sourceType:'research_method_run',sourceId:run.id,sourceVersion:run.executorVersion,snapshot:{schemaVersion:REPORT_SCHEMA,runId:run.id,inputHash:run.inputHash,skillVersion:run.skillVersion,analysisBasis:basis,outputs,numericEvidence:run.numericEvidence}},{sourceType:'data_snapshot',sourceId:basis.snapshotId,sourceVersion:basis.manifestHash,snapshot:{schemaVersion:REPORT_SCHEMA,analysisBasis:basis}}];
 const legacy={title,contentMd,contentBlocks:[{type:'formal_analysis',schemaVersion:REPORT_SCHEMA,analysisBasis:basis,runId:run.id}],contentHash:reportDigest(contentMd),sourceSnapshotHash:reportDigest(canonicalReportJson(sources)),sources};
 return presentation===undefined?legacy:withPresentation(legacy,run,basis,presentation);
}
