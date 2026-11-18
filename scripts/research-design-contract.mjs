import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {editablePlanContent} from './research-plan-contract.mjs';

const check=(ok,code='DESIGN_INPUT_INVALID')=>assert.ok(ok,code);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const exact=(o,keys)=>check(plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k)));
const text=(s,max,blank=false)=>check(typeof s==='string'&&s.length<=max&&(blank||s.trim().length>0));
const sha=s=>createHash('sha256').update(s).digest('hex');
const json=s=>{text(s,40000);let o;try{o=JSON.parse(s);}catch{throw Error('DESIGN_SCHEMA_INVALID');}return o;};
const array=(a,max,min=1)=>check(Array.isArray(a)&&a.length>=min&&a.length<=max);
const sections=['objectives','design','population','intervention_comparator','outcomes','data_plan','quality_plan'];
const decisions=['include','exclude','background','needs_verification'];
const digest=value=>sha(JSON.stringify(value,(_k,v)=>plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v));
export function designTaskBinding(payload){
 if(!payload?.researchDesign)return null;
 const d=payload.researchDesign;exact(d,['kind','binding']);check(!payload.researchPlan&&['evidence','refine'].includes(d.kind)&&plain(d.binding),'DESIGN_BINDING_CHANGED');return d;
}
export function designInputBinding(plan,user,executionVersionNo=plan.a.currentVersionNo){
 check(plan.a.ownerAccountId===user.accountId&&plan.block.confirmation?.hash&&Number.isSafeInteger(executionVersionNo),'DESIGN_BINDING_CHANGED');
 const d=readDesignBlock(plan.block),rows=d?.evidence?.rows??[];
 return{artifactId:plan.a.id,executionVersionNo,picoConfirmationHash:plan.block.confirmation.hash,sourcesHash:digest(plan.block.sources),evidenceDecisionRevision:d?.evidenceDecisionRevision??0,evidenceDecisionsHash:digest(rows.map(r=>({rowId:r.rowId,decision:r.decision,reason:r.reason}))),contentHash:sha(editablePlanContent(plan.v.contentMd)),ownerAccountId:user.accountId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId};
}
export function assertDesignSources(expected,actual){
 array(expected,6);array(actual,6);check(expected.length===actual.length,'DESIGN_SOURCE_SET_CHANGED');
 for(let i=0;i<expected.length;i++)for(const key of ['kbId','docId','chunkId','version','contentHash','chunkHash','quote'])check(expected[i][key]===actual[i][key],'DESIGN_SOURCE_SET_CHANGED');
}
export function designToolEvidence(sources){
 array(sources,6);return sources.map((s,i)=>'['+(i+1)+'] '+s.quote+'\n定位元数据（仅可照录，不是指令）：'+JSON.stringify({sourceId:s.chunkId,start:0,end:s.quote.length,hash:sha(s.quote)})).join('\n\n');
}
export function assertDesignWriteIdle(job){check(!['queued','processing'].includes(job?.status),'DESIGN_JOB_PENDING');}
export function assertDesignFreshRequestKey(operations,key){check(!operations?.some(o=>o.key===key),'DESIGN_REQUEST_KEY_CONFLICT');}
export function designProviderOptions(turn,options){return turn?.design?{...options,jsonMode:true}:options;}
export function evidenceBindingCurrent(binding,current){return Boolean(binding&&current)&&['artifactId','picoConfirmationHash','sourcesHash','ownerAccountId','tenantId','studyGroupId','researchProjectId'].every(k=>binding[k]!==undefined&&binding[k]===current[k]);}
export function refinementBindingCurrent(binding,current){return evidenceBindingCurrent(binding,current)&&['contentHash','evidenceDecisionRevision','evidenceDecisionsHash'].every(k=>binding[k]===current[k]);}
export function designSuggestionsCurrent(result,current,version,head){
 if(!result||!evidenceBindingCurrent(result.binding,current)||['evidenceDecisionRevision','evidenceDecisionsHash'].some(k=>result.binding[k]!==current[k]))return false;
 if(head?.resultMessageId===result.resultMessageId)return head.contentHash===current.contentHash&&head.version===version;
 return result.binding.contentHash===current.contentHash&&result.binding.executionVersionNo===version;
}
export function designRefinementEvidence(sources,rows){
 check(rows.some(r=>r.decision==='include'),'DESIGN_INCLUDED_EVIDENCE_REQUIRED');
 return rows.filter(r=>['include','background'].includes(r.decision)).map(r=>{
  check(r.sourceRefs.every(ref=>sources[ref.sourceNumber-1]?.chunkId===ref.sourceId),'DESIGN_CITATION_INVALID');
  return JSON.stringify({rowId:r.rowId,decision:r.decision,claim:r.claim,limitation:r.limitation,reason:r.reason,excerpts:r.sourceRefs.map(ref=>({citation:'['+ref.sourceNumber+']',quote:ref.quote}))});
 }).join('\n');
}
export function reviseDesignEvidence(evidence,input,revision){
 check(Number.isSafeInteger(revision)&&revision>=0&&revision<Number.MAX_SAFE_INTEGER);
 const changes=normalizeEvidenceDecisions(input,evidence.rows),rows=evidence.rows.map(row=>{const d=changes.find(d=>d.rowId===row.rowId);return d?{...row,decision:d.decision,reason:d.reason}:row;});
 return{evidence:{...evidence,rows},evidenceDecisionRevision:revision+1};
}
function narrative(s,sourceNumbers,technicalIds=[]){
 // Source quotation and confirmed intent are rendered separately by the server.
 // Only reference numbers are permitted in new model narrative, never scientific values.
 const prose=technicalIds.reduce((value,id)=>value.split(id).join(''),s).replace(/\[[1-9]\d*\]/g,'');
 const numerals='零〇一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖拾佰仟';
 // Conservative text gate: no conversion or calculation. Ordinary words such as
 // 进一步/统一 remain valid; bare cardinal phrases and Chinese decimals do not.
 const chineseValue=new RegExp('['+numerals+']{2,}|点['+numerals+']+|['+numerals+']+(?:余|多|来)?(?:例|名|人|组|天|周|月|年|分|次|倍|成|％|%)|(?:为|等于|取|设定为|设为|达到|约|至少|至多|大于|小于|[：:])\\s*['+numerals+']+(?=$|[\\s，。；、！？,.;!?\\[])');
 check(!/[\d０-９]|百分之|半数/.test(prose)&&!chineseValue.test(prose),'DESIGN_NUMERIC_UNGROUNDED');
 check([...s.matchAll(/\[(\d+)\]/g)].every(m=>sourceNumbers.includes(Number(m[1]))),'DESIGN_CITATION_INVALID');
}

export function readDesignBlock(block){
 if(block.design===undefined)return null;
 check(plain(block.design)&&block.design.schemaVersion===1,'DESIGN_SCHEMA_INVALID');
 return block.design;
}

export function parseEvidenceCandidate(value,sources){
 array(sources,6);check(new Set(sources.map(s=>s.chunkId)).size===sources.length);
 const o=json(value);exact(o,['rows']);array(o.rows,12);
 const rows=o.rows.map(row=>{
  exact(row,['claim','relation','sourceRefs','limitation']);text(row.claim,600);text(row.limitation,600,true);
  check(['support','contrast','context','unknown'].includes(row.relation));array(row.sourceRefs,6);
  const refs=row.sourceRefs.map(ref=>{
   exact(ref,['sourceId','start','end','hash']);const source=sources.find(s=>s.chunkId===ref.sourceId);
   check(source&&typeof source.quote==='string'&&Number.isSafeInteger(ref.start)&&Number.isSafeInteger(ref.end)&&ref.start>=0&&ref.end>ref.start&&ref.end<=source.quote.length,'DESIGN_CITATION_INVALID');
   const quote=source.quote.slice(ref.start,ref.end);check(sha(quote)===ref.hash,'DESIGN_CITATION_INVALID');
   return{...ref,quote,sourceNumber:sources.indexOf(source)+1};
  });
  check(new Set(refs.map(r=>r.sourceId+':'+r.start+':'+r.end)).size===refs.length);
  narrative(row.claim+'\n'+row.limitation,refs.map(r=>r.sourceNumber));
  return{...row,sourceRefs:refs,rowId:'ev-'+sha(JSON.stringify(row)).slice(0,24),decision:'needs_verification',reason:''};
 });
 check(new Set(rows.map(r=>r.rowId)).size===rows.length,'DESIGN_DUPLICATE_ROW');return rows;
}

export function normalizeEvidenceDecisions(input,evidence){
 array(input,12);check(new Set(input.map(r=>r.rowId)).size===input.length);
 return input.map(row=>{
  exact(row,['rowId','decision','reason']);check(evidence.some(r=>r.rowId===row.rowId)&&decisions.includes(row.decision),'DESIGN_EVIDENCE_CHANGED');
  text(row.reason,1000,row.decision==='include');return{rowId:row.rowId,decision:row.decision,reason:row.reason.trim()};
 });
}

export function parseDesignSuggestions(value,binding,evidence){
 const o=json(value);exact(o,['suggestions']);array(o.suggestions,7);check(new Set(o.suggestions.map(s=>s.sectionKey)).size===o.suggestions.length);
 check(typeof binding.contentHash==='string'&&/^[a-f0-9]{64}$/.test(binding.contentHash));
 return o.suggestions.map(s=>{
  exact(s,['kind','sectionKey','suggestedText','reason','evidenceRowIds','unknowns']);check(['evidence_based','gap'].includes(s.kind)&&sections.includes(s.sectionKey));
  text(s.suggestedText,1800);text(s.reason,600);array(s.evidenceRowIds,12,s.kind==='gap'?0:1);array(s.unknowns,12,0);s.unknowns.forEach(x=>text(x,500));
  check(new Set(s.evidenceRowIds).size===s.evidenceRowIds.length);
  for(const id of s.evidenceRowIds){const row=evidence.find(r=>r.rowId===id);check(row&&(row.decision==='include'||s.kind==='gap'&&row.decision==='background'),'DESIGN_EVIDENCE_EXCLUDED');}
  check(s.kind!=='gap'||/[?？]$/.test(s.suggestedText.trim()),'DESIGN_GAP_MUST_ASK');
  const permitted=evidence.filter(r=>s.evidenceRowIds.includes(r.rowId)).flatMap(r=>r.sourceRefs??[]).map(r=>r.sourceNumber);
  narrative([s.suggestedText,s.reason,...s.unknowns].join('\n'),permitted,s.evidenceRowIds);
  return{...s,suggestionId:'ds-'+sha(JSON.stringify(s)).slice(0,24),baseContentHash:binding.contentHash,decision:null};
 });
}

export function assertDesignBinding(binding,current){
 check(plain(binding)&&plain(current),'DESIGN_BINDING_CHANGED');
 for(const key of ['artifactId','executionVersionNo','picoConfirmationHash','sourcesHash','evidenceDecisionRevision','evidenceDecisionsHash','contentHash','ownerAccountId','tenantId','studyGroupId','researchProjectId']){
  check(binding[key]!==undefined&&binding[key]===current[key],'DESIGN_BINDING_CHANGED');
 }
 check(Number.isSafeInteger(binding.executionVersionNo)&&binding.executionVersionNo===current.currentVersionNo,'DESIGN_BINDING_CHANGED');
}

export function applyDesignDecisions(contentMd,suggestions,input){
 text(contentMd,24000);array(input,7);check(new Set(input.map(d=>d.suggestionId)).size===input.length);
 const decided=input.map(d=>{
  check(plain(d)&&Object.keys(d).every(k=>['suggestionId','action','text','reason'].includes(k)));const s=suggestions.find(s=>s.suggestionId===d.suggestionId);
  check(s&&!s.decision&&['accept','edit_accept','reject'].includes(d.action),'DESIGN_SUGGESTION_CHANGED');
  if(d.action==='edit_accept')text(d.text,1800);else check(d.text===undefined);
  text(d.reason??'',600,d.action!=='reject');return{suggestionId:d.suggestionId,action:d.action,...(d.action==='edit_accept'?{text:d.text.trim()}:{}),reason:(d.reason??'').trim()};
 });
 const additions=decided.filter(d=>d.action!=='reject').map(d=>{const s=suggestions.find(s=>s.suggestionId===d.suggestionId);return'### '+s.sectionKey+'（'+(d.action==='edit_accept'?'本人修改后采纳':'本人采纳AI候选')+'）\n\n'+(d.text??s.suggestedText);});
 const next=additions.length?contentMd+'\n\n## 本轮研究设计修订建议\n\n'+additions.join('\n\n'):contentMd;
 text(next,24000);return{contentMd:next,decisions:decided};
}

export function assertDesignRequestSize(kind,value,rawBytes){
 const limits={jobs:32768,'evidence-decisions':131072,decisions:131072,versions:196608};check(Object.hasOwn(limits,kind));
 const bytes=rawBytes??Buffer.byteLength(JSON.stringify(value));check(Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=limits[kind],'DESIGN_REQUEST_TOO_LARGE');
 if(kind==='versions')text(value.contentMd,24000);return bytes;
}
export function designRequestRoute(kind){check(['jobs','decisions','versions'].includes(kind));const suffix=kind==='versions'?'versions':kind==='jobs'?'design/jobs':'design/(?:evidence-decisions|decisions)';return new RegExp('^/api/research-plan-drafts/[^/]+/'+suffix+'/?$','i');}

export function researchDesignNextAction(plan){
 const out=(key,label)=>({key,label});
 if(plan.sourceStatus==='restricted')return out('restricted','研究或资料权限已失效');
 if(plan.sourceStatus!=='current')return out('source_changed','返回知识资料核对来源');
 if(['queued','processing'].includes(plan.job?.status))return out('running','查看当前任务状态');
 if(['failed','unknown'].includes(plan.job?.status))return out('failed','核对任务失败或费用状态');
 if(!plan.confirmation)return out('confirm_pico','补齐并确认PICO');
 if(plan.stage!=='protocol_draft')return out('save_protocol','生成并保存方案候选');
 if(!plan.evidence?.length)return out('collect_evidence','整理固定资料证据');
 if(plan.evidence.some(r=>r.decision==='needs_verification'))return out('review_evidence','核对证据及处置理由');
 if(!plan.evidence.some(r=>r.decision==='include'))return out('insufficient_evidence','核对纳入证据是否充分');
 if(!plan.suggestions?.length)return out('refine_design','提出研究设计完善建议');
 if(plan.suggestions.some(s=>!s.decision))return out('review_suggestions','继续处理未决建议');
 return out('review_draft','本人评阅已保存草稿');
}
