// Frozen quality facts only: never pass CRF answers or allow model-written patches.
import assert from 'node:assert/strict';
import {edcDigest,exactEdcFields,syntheticDataBasis,syntheticQualityCurrent} from './synthetic-edc-contract.mjs';
import {preparationModelConfig} from './research-execution-preparation-contract.mjs';
const families=['researchPlan','researchDesign','researchExecutionPreparation','researchSyntheticEdc'];
const keys=['planId','parentRootVersionNo','preparationRevisionNo','configHash','picoConfirmationHash','sourcesHash','basis','ownerAccountId','tenantId','studyGroupId','researchProjectId','sessionId','kbId','collectionId','dataRevision','dataHash','qualityId','findingsHash','selectedIdsHash'];
const check=(v,code='EDC_AI_INVALID')=>assert.ok(v,code);
export function syntheticEdcTask(payload){
 check(families.filter(k=>payload?.[k]!==undefined).length<=1,'EDC_TASK_MIXED');if(payload?.researchSyntheticEdc===undefined)return null;
 const t=payload.researchSyntheticEdc;exactEdcFields(t,['kind','binding']);check(t.kind==='quality_explanation');exactEdcFields(t.binding,keys);
 for(const k of keys){const v=t.binding[k];if(['parentRootVersionNo','preparationRevisionNo'].includes(k))check(Number.isSafeInteger(v)&&v>0);else if(k==='dataRevision')check(Number.isSafeInteger(v)&&v>=0);else if(k==='basis'){exactEdcFields(v,['artifactId','versionNo','contentHash','picoConfirmationHash','sourcesHash']);check(typeof v.artifactId==='string'&&Number.isSafeInteger(v.versionNo)&&v.versionNo>0&&['contentHash','picoConfirmationHash','sourcesHash'].every(k=>typeof v[k]==='string'&&v[k].length>0));}else check(typeof v==='string'&&v.length>0&&v.length<=160);}
 return t;
}
export function bindSyntheticEdcTask(payload,binding){const next={...payload,researchSyntheticEdc:{kind:'quality_explanation',binding}};syntheticEdcTask(next);return next;}
export function selectSyntheticFindings(b,ids){
 check(syntheticQualityCurrent(b),'EDC_QUALITY_STALE');check(Array.isArray(ids)&&ids.length>=1&&ids.length<=6&&new Set(ids).size===ids.length,'EDC_FINDINGS_INVALID');
 return ids.map(id=>{const f=b.quality.findings.find(f=>f.findingId===id);check(f,'EDC_FINDINGS_INVALID');return f;});
}
export function syntheticExplanationBinding(collectionId,b,ids){
 selectSyntheticFindings(b,ids);
 return{...b.binding,collectionId,...syntheticDataBasis(b),qualityId:b.quality.id,findingsHash:b.quality.findingsHash,selectedIdsHash:edcDigest(ids)};
}
// Reuse WP05's tested numeric redactor, including Chinese scientific quantities.
const masked=(config,text)=>preparationModelConfig({...config,notes:String(text).slice(0,1000)}).notes;
export function syntheticExplanationInput(b,ids,pico){
 const kinds={D01:'required_missing',D02:'manual_range_review',D03:'unfinished_record'};
 return{researchIntent:Object.fromEntries(Object.entries(pico??{}).filter(([,v])=>typeof v==='string').map(([k,v])=>[k,masked(b.config,v)])),config:preparationModelConfig(b.config),findings:selectSyntheticFindings(b,ids).map(f=>({findingId:f.findingId,kind:kinds[f.ruleKey],location:{recordId:f.recordId,subjectKey:f.subjectKey,visitKey:f.visitKey,formKey:f.formKey,fieldKey:f.fieldKey}}))};
}
export function parseSyntheticExplanation(value,trusted){
 check(typeof value==='string'&&value.length<=16000);const p=JSON.parse(value);exactEdcFields(p,['items']);check(Array.isArray(p.items)&&p.items.length>0&&p.items.length<=6);const seen=new Set(),all=[];
 const items=p.items.map(i=>{
  exactEdcFields(i,['findingId','explanation','question','sourceRefs']);check(trusted.findingIds.includes(i.findingId)&&!seen.has(i.findingId),'EDC_FINDINGS_INVALID');seen.add(i.findingId);
  check(typeof i.explanation==='string'&&i.explanation.trim().length>0&&i.explanation.length<=600&&typeof i.question==='string'&&i.question.length<=600);
  check(!i.question.trim()||/[?？](?:\s*\[[1-9]\d*\])*\s*$/.test(i.question),'EDC_QUESTION_INVALID');
  check(Array.isArray(i.sourceRefs)&&i.sourceRefs.length<=6&&new Set(i.sourceRefs).size===i.sourceRefs.length&&i.sourceRefs.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=trusted.sources.length),'EDC_CITATION_INVALID');
  const prose=i.explanation+'\n'+i.question,brackets=[...prose.matchAll(/[\[［][^\]］]*[\]］]/g)].map(m=>m[0]);check(brackets.every(s=>/^\[[1-9]\d*\]$/.test(s)),'EDC_CITATION_INVALID');
  const refs=[...new Set(brackets.map(s=>Number(s.slice(1,-1))))].sort((a,b)=>a-b);check(edcDigest(refs)===edcDigest([...i.sourceRefs].sort((a,b)=>a-b)),'EDC_CITATION_INVALID');all.push(...refs);
  check(refs.length>0||!/材料|资料|文献|片段|研究结果|证据|报告|显示|指出/.test(prose),'EDC_CITATION_REQUIRED');
  const technical=[i.findingId,...(trusted.findings??[]).filter(f=>f.findingId===i.findingId||!f.findingId).flatMap(f=>[f.recordId,f.subjectKey,f.visitKey,f.formKey,f.fieldKey])].filter(v=>typeof v==='string'&&/[A-Za-z]/.test(v)&&/\d/.test(v)&&/^[A-Za-z0-9_-]+$/.test(v));
  const narratives=[i.explanation,i.question].map(s=>{let t=s.replace(/\[[1-9]\d*\]/g,'');for(const id of technical)t=t.replace(new RegExp('(?<![A-Za-z0-9_-])'+id+'(?![A-Za-z0-9_-])','g'),'TECHNICAL_ID');return t;});check(narratives.every(t=>masked(trusted.config,t)===t),'EDC_NUMERIC_UNGROUNDED');const narrative=narratives.join('\n');
  check(!/忽略.{0,12}(规则|约束|指令)|执行(?:命令|脚本)|(?:请|立即|直接|自动).{0,8}(?:写入|修改|覆盖|删除|发布|审批|导出)/.test(narrative),'EDC_INSTRUCTION_REJECTED');
  return{...i,explanation:i.explanation.trim(),question:i.question.trim()};
 });check(all.length>0,'EDC_CITATION_REQUIRED');return{items};
}
