import {acceptWebAnswer,webCandidateAnswer,SMART_POLICY_HASH} from './smart-search-contract.mjs';
import {routeDigest} from './skill-routing.mjs';

const invalid=()=>{throw Error('SMART_OUTPUT_INVALID');};
const normalize=text=>text.normalize('NFC').replace(/\s+/gu,' ').trim();
const keys=(value,wanted)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===wanted;
function attributionIssue(text,selected){
 // Negation applies only to its own authorization mention, not the whole sentence.
 const authorization=text.replace(/(?:不代表|不等于|不能(?:据此)?(?:确认|证明|推断)|无法(?:确认|证明|判断)|尚未(?:确认|核实)|未能确认|没有证据(?:证明|表明))[^，,。；;\n授权]{0,48}(?:授权|授權)(?:关系)?/giu,'').replace(/未(?:获(?:得)?|经|被)[^，,。；;\n授权]{0,24}授权/gu,'').replace(/\bnot\s+(?:authorized|authorised)\b/giu,'');
 if(/授权|授權|authori[sz](?:ed|ation)|endorsed\s+by/iu.test(authorization))return'authorization-unverified';
 const official='(?:(?:WHO|世界卫生组织)\\s*(?:的)?\\s*(?:官方(?:网页|页面|网站|资料|来源)?|官网)|official\\s+(?:(?:webpage|website|page)\\s+(?:of|from)\\s+)?(?:WHO|World Health Organization))';
 const publisher=text.replace(new RegExp('(?:不是|并非|不属于|不代表(?:成为)?|不能确认为|不能视为|not\\s+(?:an?\\s+)?)\\s*'+official,'giu'),'');
 if(new RegExp(official,'iu').test(publisher)&&selected.some(s=>{const h=new URL(s.url).hostname;return h!=='who.int'&&!h.endsWith('.who.int');}))return'publisher-misattributed';
 return null;
}
const quoteDisplay=text=>text.replace(/https?:\/\/[^\s)]+/gu,'（链接见来源）').replace(/[\[\]]/gu,c=>c==='['?'［':'］').replace(/[\\`*_<>]/gu,'').replace(/\s+/gu,' ').trim();

// Exact excerpt matching establishes provenance, not general semantic entailment.
// Narrow blinding/authorization checks cover the two observed attribution bugs.
export function acceptGroundedAnswer(raw,sources,filterText=text=>text){
 let value;try{value=JSON.parse(raw);}catch{invalid();}
 if(!keys(value,'claims,limitations')||!Array.isArray(value.claims)||!value.claims.length||value.claims.length>8||typeof value.limitations!=='string'||!value.limitations.trim()||value.limitations.length>1200)invalid();
 const receipt=[],blocks=[],cited=new Set();
 for(const claim of value.claims){
  if(!keys(claim,'kind,quotes,sourceIds,text')||!['source_fact','ai_inference'].includes(claim.kind)||typeof claim.text!=='string'||!claim.text.trim()||claim.text.length>1800||!Array.isArray(claim.sourceIds)||!claim.sourceIds.length||new Set(claim.sourceIds).size!==claim.sourceIds.length||claim.sourceIds.some(id=>!sources.some(s=>s.id===id&&s.text?.trim()))||!Array.isArray(claim.quotes)||claim.quotes.length>5)invalid();
  // Keep the original URL/reference validation even if this paragraph is withheld.
  acceptWebAnswer(JSON.stringify({answer:claim.text,sourceIds:claim.sourceIds,limitations:'当前固定网页选段。'}),sources);
  const selected=claim.sourceIds.map(id=>sources.find(s=>s.id===id));
  let reason=attributionIssue(claim.text,selected),quotes=[];
  for(const q of claim.quotes){
   if(!keys(q,'sourceId,text')||typeof q.text!=='string'||normalize(q.text).length<12||q.text.length>600||!claim.sourceIds.includes(q.sourceId)||!normalize(sources.find(s=>s.id===q.sourceId).text).includes(normalize(q.text))){reason??='excerpt-missing';continue;}
   quotes.push({sourceId:q.sourceId,text:q.text});
  }
  if(claim.sourceIds.some(id=>!quotes.some(q=>q.sourceId===id)))reason??='excerpt-missing';
  if(claim.kind==='source_fact'&&/盲法|双盲|\bblind(?:ing|ed)?\b|\bmask(?:ing|ed)\b/iu.test(claim.text)&&!quotes.some(q=>/盲法|双盲|\bblind(?:ing|ed)?\b|\bmask(?:ing|ed)\b/iu.test(q.text)))reason??='blinding-not-in-excerpt';
  // Preserve rejected proposals for deterministic replay; only valid quotes render.
  receipt.push({...claim,status:reason?'withheld':'delivered',...(reason?{reason}:{})});
  if(reason)continue;
  claim.sourceIds.forEach(id=>cited.add(id));
  const text=filterText(claim.text);
  blocks.push(`**${claim.kind==='source_fact'?'原文事实':'AI推论（非原文结论）'}**：${text} ${claim.sourceIds.map(id=>`[${id}]`).join(' ')}\n\n${quotes.map(q=>`> ${claim.kind==='source_fact'?'原文依据':'推论所依据的原文'}：“${quoteDisplay(q.text)}” [${q.sourceId}]`).join('\n> \n')}`);
 }
 if(!sources.some(s=>s.coverage==='webpage-excerpt'&&s.text?.trim()))return{...webCandidateAnswer(sources),grounding:{schema:'hub-web-grounding.v2',claims:receipt}};
 const withheld=receipt.filter(c=>c.status==='withheld');
 if(withheld.length)blocks.push('部分表述因当前选段依据不足，未作为事实或推论交付。'+(withheld.some(c=>c.reason==='authorization-unverified'||c.reason==='publisher-misattributed')?'当前来源不足以确认授权关系；目录收录不代表获得授权或成为WHO官方网页。':''));
 // A wholly unsupported response stays readable as an explicit no-delivery result,
 // not a false successful scientific explanation and not a fabricated inference.
 if(!cited.size)sources.filter(s=>s.text?.trim()).forEach(s=>cited.add(s.id));
 // Free-form limitations are not a second, ungrounded answer channel.
 const limits='本次仅依据固定网页选段'+(sources.some(s=>s.coverage==='search-snippet')?'及搜索摘要':'')+'，不等于全文审阅。AI推论属于一般研究解释或建议，不是来源已经证实的结论。'+(attributionIssue(value.limitations,sources)?'当前来源不足以确认授权关系或统一官方归属。':'');
 const result=acceptWebAnswer(JSON.stringify({answer:blocks.join('\n\n'),sourceIds:[...cited],limitations:filterText(limits)}),sources);
 const grounding={schema:'hub-web-grounding.v2',claims:receipt,limitations:limits};
 return{...result,grounding,validation:{...result.validation,schema:'hub-smart-answer.v2',grounding,groundingHash:routeDigest(grounding),...(cited.size&&withheld.length===receipt.length?{status:'no-supported-claims'}:{})}};
}

export function assertGroundingReceipt(output,sources){
 if(output?.schema!=='hub-smart-answer.v2'||output.policyHash!==SMART_POLICY_HASH||output.groundingHash!==routeDigest(output.grounding))invalid();
 const {claims,limitations}=output.grounding??{};
 const recreated=acceptGroundedAnswer(JSON.stringify({claims:claims?.map(({status,reason,...c})=>c),limitations}),sources);
 if(routeDigest(recreated.grounding)!==output.groundingHash)invalid();
 return output;
}
