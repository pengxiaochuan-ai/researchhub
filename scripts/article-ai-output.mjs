// Single-purpose boundary; legacy stored answers are never reprocessed here.
import {createHash} from 'node:crypto';
import {agentQuestionError} from '../src/agent-question.js';
import {ARTICLE_NUMERIC_POLICY,buildArticleNumericFacts,verifyArticleNumericEvidence,renderArticleNumericFact,stripVerifiedNumericEvidence,stripSourcedCaseCount,stripSourcedFollowupDuration,hasArticleQuantity} from './article-numeric-evidence.mjs';
export {buildArticleNumericFacts} from './article-numeric-evidence.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code,status:422});};
export function articleOutputInstructions(pack){
  if(pack?.policyVersion!=='rh-article-evidence-v2')fail('ARTICLE_AI_POLICY_REJECTED');
  if(!pack.fragments?.length||pack.fragments.some(f=>f.complete!==true))fail('ARTICLE_AI_EVIDENCE_INCOMPLETE');
  return '【单篇定性解释】只写研究类型、作者定性观察、适用范围、测量与因果局限。禁止自行计算、推算或自由改写科学数值；原文数值由系统绑定完整语境逐字引用，不以数字相同代替语义核验。保留作者的弱推荐、适用人群、治疗阶段、残余症状和不确定性；作者报告不等于Hub已独立核验。不得把主观量表或睡眠日记称作已证实的客观监测。缺章节仅指本次包没有选入，综述无需假定有独立Results；不要向用户索要本站已提供的片段。合法引用编号不等于支持度合格，每个实质结论仍须有原片段依据，不从残句、标题或其他论文补结论。';
}
export function assertArticleQualitativeAnswer(text,pack,{numericEvidence=[]}={}){
  articleOutputInstructions(pack);
  if(typeof text!=='string'||!text.trim())fail('ARTICLE_AI_OUTPUT_INVALID');
  let prose=stripVerifiedNumericEvidence(text,numericEvidence,pack).normalize('NFKC').replace(/\[1\]/g,'').replace(/^\s*\d+[.)、]\s+/gm,'');
  const identifiers=[pack.binding.articleVersion,pack.binding.recordId,pack.binding.recordId?.slice(4),pack.source?.doi,
    ...pack.fragments.map(f=>f.id)].filter(Boolean).sort((a,b)=>b.length-a.length);
  for(const value of identifiers)prose=prose.split(value).join('');
  const supported=stripSourcedFollowupDuration(stripSourcedCaseCount(prose,pack),pack);
  if(hasArticleQuantity(supported.text))fail('ARTICLE_AI_NUMERIC_REJECTED');
  const evidence=pack.fragments.map(f=>f.text).join('\n');
  // Treatment completion is not medication withdrawal. Do not silently repair a model claim.
  if(/停药后|停用(?:药物|催眠药|安眠药)后|(?:after|following) (?:drug|medication|hypnotic) (?:cessation|discontinuation|withdrawal)/i.test(prose)&&/\btreatment cessation\b/i.test(evidence)&&!/\b(?:drug|medication|hypnotic) (?:cessation|discontinuation|withdrawal)\b/i.test(evidence))fail('ARTICLE_AI_MEDICATION_CESSATION_REJECTED');
  for(const [claim,support] of [[/弱推荐|有条件推荐|\b(?:weak|conditional) recommendation\b/i,/\b(?:weak|conditional) recommendation\b|弱推荐|有条件推荐/i],[/强推荐|强烈推荐|\bstrong recommendation\b/i,/\bstrong recommendation\b|强推荐|强烈推荐/i]]){
    if(claim.test(prose)&&!support.test(evidence))fail('ARTICLE_AI_RECOMMENDATION_REJECTED');
  }
  return supported.numericEvidence;
}

const sections={researchType:'结论',observations:'依据与来源',limitations:'局限与下一步',relevance:'研究参考价值'};
function modelInstructions(pack){return articleOutputInstructions(pack)+'\n【方法与归因】区分叙述性综述本身的方法与其引用的底层研究。若原文仅说新兴疗法部分采用选择性搜寻且非系统检索，不能扩大成全篇证据均来自选择性综述或所有疗法未系统检索。涉及指南用“综述转述指南”明确二手归因，不暗示已独立核验指南。treatment cessation只能译作治疗或干预结束，不能译作停药；原文未用催眠药不能编造撤药。病例中作者的安全有效表述仅归因于该病例观察，不能形成一般人群的安全性、疗效或临床适应证结论。研究参考价值仅作后续研究设计线索，不能直接建议临床实施。\n【输出契约】只返回JSON对象，且恰有researchType、observations、limitations、relevance四个字段，每个字段含text与fragmentIds，可选numericFactIds。text为简短中文定性解释（建议不超过180字）；fragmentIds为明确支撑本段的本包片段ID数组。不要在text写引用编号、片段ID或Markdown链接，由系统渲染。text以定性解释为主，禁止自由写年龄、评分、疗程、比例等数量；唯一额外时长转述限单病例所选片段含完整肯定句The short N-week follow-up limits conclusions regarding long-term efficacy stability.（可有First等前缀，N为1–99整数或one–twelve）时，可原样表述同值的完整子句“随访仅N周”，系统会核对随访角色/周单位并附原文，不得替换为治疗、其他时点/数值/单位/范围或近似值；当前文章明确为单病例报告且所选片段有患者依据时，仅在researchType用“本文为单病例报告，描述一例…患者”或“一名…患者”的病例类型句式，其他段不复述人数，不能推断其他样本数。需要展示原文数值时，从输入numericFacts选择numericFactIds，每段最多一个、全篇最多两个不同依据；ID所属fragmentId必须同时在本段fragmentIds。后端直接引用完整原文语境，text不要抄数字、逐字引用、换算或重新解释数量关系；没有适用依据就不填numericFactIds。不要给病例自定强/弱推荐等级；仅在所引片段明确出现该推荐等级时，才可归因转述并保留人群和治疗阶段。只要本段选择的片段出现weak recommendation，text必须明确写“弱推荐”，不能仅用“潜在获益／证据有限／可用于临床”替代，缺失即拒绝；strong recommendation同理。不得把“无对照、探索性”换算成“弱推荐”。每段都选真实片段，无依据就写“本次选段不足以支持”，不能从另一篇或标题补结论。';}
function modelData(question,pack){
  articleOutputInstructions(pack);
  if(agentQuestionError(question)||pack.fragments.length>6||pack.fragments.some(f=>typeof f.text!=='string'||!f.text.length||f.text.length>1200)||pack.fragments.reduce((n,f)=>n+f.text.length,0)>6000)fail('ARTICLE_MODEL_INPUT_INVALID');
  return{question:question.trim(),article:{binding:pack.binding,packHash:pack.packHash,title:pack.source?.title,coverage:pack.coverage,omissions:pack.omissions},fragments:pack.fragments.map(({id,field,role,locator,text})=>({id,field,role,locator,text})),numericPolicyVersion:ARTICLE_NUMERIC_POLICY,numericFacts:buildArticleNumericFacts(pack)};
}
export function articleModelMessages(system,question,pack){
  if(typeof system!=='string')fail('ARTICLE_MODEL_INPUT_INVALID');
  return[{role:'system',content:system+'\n'+modelInstructions(pack)},{role:'user',content:JSON.stringify(modelData(question,pack))}];
}
export function articleModelInputProof(messages,pack,question){
  if(!Array.isArray(messages)||messages.length!==2||messages[0]?.role!=='system'||typeof messages[0].content!=='string'||!messages[0].content.endsWith(modelInstructions(pack))||messages[1]?.role!=='user'||messages[1].content!==JSON.stringify(modelData(question,pack)))fail('ARTICLE_MODEL_INPUT_CHANGED');
  return{schema:'rh-article-model-input.v2',policyVersion:pack.policyVersion,numericPolicyVersion:ARTICLE_NUMERIC_POLICY,numericFactsHash:hash(JSON.stringify(buildArticleNumericFacts(pack))),packHash:pack.packHash,questionHash:hash(question.trim()),messagesHash:hash(JSON.stringify(messages)),fragments:pack.fragments.map(f=>({id:f.id,textHash:hash(f.text)}))};
}
export function parseArticleModelResponse(raw,pack){
  let value;try{value=JSON.parse(raw);}catch{fail('ARTICLE_AI_JSON_INVALID');}
  const keys=v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().join(','):'';
  if(keys(value)!==Object.keys(sections).sort().join(','))fail('ARTICLE_AI_SCHEMA_REJECTED');
  const facts=buildArticleNumericFacts(pack),numericEvidence=[];
  const text=Object.entries(sections).map(([key,title])=>{
    const part=value[key];
    if(!['fragmentIds,text','fragmentIds,numericFactIds,text'].includes(keys(part))||typeof part.text!=='string'||!part.text.trim()||part.text.length>600||!Array.isArray(part.fragmentIds)||!part.fragmentIds.length||part.fragmentIds.length>6||new Set(part.fragmentIds).size!==part.fragmentIds.length||part.fragmentIds.some(id=>!pack.fragments.some(f=>f.id===id))||/\[[^\]]*\]|fragment-|https?:|<[^>]*>/.test(part.text))fail('ARTICLE_AI_SCHEMA_REJECTED');
    const chosen=pack.fragments.filter(f=>part.fragmentIds.includes(f.id));
    const sourced=assertArticleQualitativeAnswer(part.text,{...pack,fragments:chosen});
    for(const [source,claim]of [[/\b(?:weak|conditional) recommendation\b|弱推荐|有条件推荐/i,/弱推荐|有条件推荐|\b(?:weak|conditional) recommendation\b/i],[/\bstrong recommendation\b|强推荐|强烈推荐/i,/强推荐|强烈推荐|\bstrong recommendation\b/i]])if(chosen.some(f=>source.test(f.text))&&!claim.test(part.text))fail('ARTICLE_AI_RECOMMENDATION_MISSING');
    const selected=Object.hasOwn(part,'numericFactIds')?part.numericFactIds:[];
    if(!Array.isArray(selected)||selected.length>1)fail('ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED');
    const ids=[...new Set([...selected,...sourced.map(f=>f.id)])];if(ids.length>1)fail('ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED');
    const blocks=[];for(const id of ids){const fact=facts.find(f=>f.id===id&&part.fragmentIds.includes(f.fragmentId));if(!fact)fail('ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED');if(!numericEvidence.some(f=>f.id===id)){numericEvidence.push(fact);blocks.push(renderArticleNumericFact(fact));}}
    return'## '+title+'\n\n'+part.text.trim()+'\n\n依据片段：'+part.fragmentIds.join('、')+' [1]'+(blocks.length?'\n\n'+blocks.join('\n\n'):'');
  }).join('\n\n');
  verifyArticleNumericEvidence(numericEvidence,pack);return{text,numericEvidence};
}
export function renderArticleModelResponse(raw,pack){return parseArticleModelResponse(raw,pack).text;}
