import {materialDigest} from './session-material-contract.mjs';
import {agentQuestionError} from '../../src/agent-question.js';
const fail=code=>{throw Object.assign(Error(code),{code,status:409});},present=x=>x!==null&&x!==undefined&&x!=='';
export const DATA_ANALYSIS_VERSION='hub-data-overview.v1';
/** Aggregate only a server-authorized, fixed import batch. Never accepts model
 * output, performs imputation, or declares clinical/data-release approval. */
export function buildResearchDataAnalysis(input,native){
 if(typeof native?.normalizeSchema!=='function'||typeof native?.validateAnswers!=='function')fail('DATA_ANALYSIS_NATIVE_REQUIRED');
 const {binding,import:operation,study,files,form,subjects,rows}=input??{};
 if(!binding?.tenantId||!binding.accountId||!binding.sessionId||binding.studyId!==study?.id||!operation?.id||!Array.isArray(subjects)||subjects.length>100||!Array.isArray(rows)||rows.length>100||!Array.isArray(files)||!files.length)fail('DATA_ANALYSIS_SOURCE_INVALID');
 const ids=new Set(subjects.map(s=>s.id));if(ids.size!==subjects.length||subjects.some(s=>!s.id||!s.subjectCode))fail('DATA_ANALYSIS_SOURCE_INVALID');
 const uniqueVisits=new Set(),uniqueResponses=new Set();
 for(const r of rows){if(!ids.has(r.subjectId)||!r.visitId||uniqueVisits.has(r.visitId)||!r.assignmentId||!r.responseId||uniqueResponses.has(r.responseId)||r.ref?.responseId!==r.responseId||!Number.isSafeInteger(r.ref.revisionNo)||!/^[a-f0-9]{64}$/.test(r.ref.contentHash??'')||!r.answers||Array.isArray(r.answers))fail('DATA_ANALYSIS_SOURCE_INVALID');uniqueVisits.add(r.visitId);uniqueResponses.add(r.responseId);}
 const schema=form?native.normalizeSchema(form.schema):{fields:[]};if(rows.length&&!form)fail('DATA_ANALYSIS_SOURCE_INVALID');
 let unknownFields=0;for(const r of rows)unknownFields+=Object.keys(r.answers).filter(k=>!schema.fields.some(f=>f.key===k)).length;
 const fields=schema.fields.map(field=>{
  const valid=[];let missing=0,invalid=0;
  for(const row of rows){const value=row.answers[field.key];if(!present(value)){missing++;continue;}
   try{native.validateAnswers({schemaVersion:'form-schema.v1',fields:[field]},{[field.key]:value});valid.push(value);}catch{invalid++;}
  }
  const base={key:field.key,label:field.label,type:field.type,...(typeof field.unit==='string'&&field.unit?{unit:field.unit}:{}),required:field.required===true,total:rows.length,nonMissing:rows.length-missing,missing,invalid,rangeConfigured:field.min!==undefined||field.max!==undefined};
  if(['number','integer'].includes(field.type)){const values=valid.filter(x=>typeof x==='number'&&Number.isFinite(x));base.numeric={count:values.length,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,mean:values.length?values.reduce((a,b)=>a+b/values.length,0):null,zeroCount:values.filter(x=>x===0).length};}
  if(field.type==='boolean')base.boolean={trueCount:valid.filter(x=>x===true).length,falseCount:valid.filter(x=>x===false).length};return base;
 });
 const sources=rows.length?rows.map((r,i)=>({id:'D'+(i+1),kind:'fixed-crf',subjectId:r.subjectId,subjectCode:subjects.find(s=>s.id===r.subjectId).subjectCode,visitId:r.visitId,visitCode:r.visitCode,visitStatus:r.visitStatus,visitVersion:r.visitVersion,enrollmentId:r.enrollmentId,visitPlanId:r.visitPlanId,assignmentId:r.assignmentId,formVersionId:form.id,responseVersion:r.responseVersion,ref:r.ref,source:r.source})):subjects.map((s,i)=>({id:'D'+(i+1),kind:'subject-profile',subjectId:s.id,subjectCode:s.subjectCode}));
 const requiredMissing=fields.filter(f=>f.required).reduce((n,f)=>n+f.missing,0),invalidValues=fields.reduce((n,f)=>n+f.invalid,0);
 const quality={status:!rows.length?'not-evaluated':requiredMissing||invalidValues||unknownFields?'needs-review':'checks-passed',requiredMissing,invalidValues,unknownFields,checked:['必填缺失','字段类型','固定表单已配置的取值范围/选项'],notEvaluated:['医学合理性','跨时点一致性','疗效与组间差异',...fields.filter(f=>['number','integer'].includes(f.type)&&!f.rangeConfigured).map(f=>f.label+'：未配置取值范围')],scope:'仅本批固定记录的已列规则，不代表研究整体质控放行'};
 const body={schema:DATA_ANALYSIS_VERSION,algorithm:'fixed-crf-descriptive.v1',binding,import:operation,study,files,form:form?{id:form.id,hash:form.hash,fields:schema.fields.map(({key,label,type,unit,required,min,max})=>({key,label,type,...(typeof unit==='string'&&unit?{unit}:{}),required:required===true,...(min===undefined?{}:{min}),...(max===undefined?{}:{max})}))}:null,counts:{subjects:subjects.length,visits:rows.length,responses:rows.length,completedVisits:rows.filter(r=>r.visitStatus==='completed').length},fields,quality,sources};
 return{...body,packHash:materialDigest(body)};
}
export function assertResearchDataAnalysis(pack){
 if(pack?.schema!==DATA_ANALYSIS_VERSION||!Array.isArray(pack.sources)||!Array.isArray(pack.fields)||!pack.counts||!pack.quality)fail('DATA_ANALYSIS_PACK_CHANGED');
 const {packHash,...body}=pack;if(materialDigest(body)!==packHash)fail('DATA_ANALYSIS_PACK_CHANGED');return pack;
}
export function researchDataModelInput(question,pack){
 assertResearchDataAnalysis(pack);if(agentQuestionError(question))fail('DATA_ANALYSIS_QUESTION_INVALID');
 return JSON.stringify({question:question.trim(),packHash:pack.packHash,scope:'本人本次固定导入记录；不代表全部研究数据',counts:pack.counts,fields:pack.fields,quality:pack.quality,sources:[{id:'R1',kind:'deterministic-batch-result',packHash:pack.packHash,sourceCount:pack.sources.length,visitCodes:[...new Set(pack.sources.map(s=>s.visitCode).filter(Boolean))]}]});
}
