import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
export const ARTICLE_NUMERIC_POLICY='rh-article-numeric-evidence.v1';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=()=>{throw Object.assign(Error('ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED'),{code:'ARTICLE_AI_NUMERIC_EVIDENCE_REJECTED',status:422});};
export function hasArticleQuantity(text){
 const scalar=text.replace(/一致|一般|进一步|一方面|另一方面|统一|唯一|同一|不一|一些|一定程度/gu,'');
 if(/(?:评分|得分|总分|分数|样本量|人数|年龄|基线|结局|均值|中位数|标准差|效应量)[^。；;!?！？\n]{0,18}[零〇一二两三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾佰仟半]+/u.test(scalar))return true;
 return /\p{N}/u.test(text)||/[零〇一二两三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾佰仟半]+(?:余|多|个)?(?:名|例|人|位|岁|周|天|日|月|年|分|次|成|倍|组|项|类|毫|秒|小时|分钟|星期|礼拜|阶段|疗程|百分|样本)/u.test(text)||/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|percent|percentage|twice|thrice|double|doubled|doubling|triple|halved|halving|half|(?:two|three|four|five|six|seven|eight|nine|ten)[- ]?fold)\b/i.test(text)||/翻倍|翻番|倍增|加倍|成倍|减半|折半|对半|一半/.test(text);
}
export function buildArticleNumericFacts(pack){
 return (pack.fragments??[]).filter(f=>f.complete===true&&['body','abstract'].includes(f.field)&&typeof f.text==='string'&&f.text.length<=1200&&hasArticleQuantity(f.text)).map(f=>{
  const data={policyVersion:ARTICLE_NUMERIC_POLICY,binding:pack.binding,packHash:pack.packHash,fragmentId:f.id,field:f.field,offset:f.offset,length:f.text.length,textHash:hash(f.text),text:f.text};
  return{id:'numeric-'+hash(JSON.stringify(data)).slice(0,24),...data};
 });
}
export function verifyArticleNumericEvidence(receipts,pack){
 if(!Array.isArray(receipts)||receipts.length>2||new Set(receipts.map(r=>r?.id)).size!==receipts.length)fail();
 const facts=buildArticleNumericFacts(pack);
 for(const r of receipts)if(!facts.some(f=>isDeepStrictEqual(f,r)))fail();
 return receipts;
}
export function renderArticleNumericFact(fact){
 // Escape source Markdown rather than executing any links/images/HTML in it.
 const quote=fact.text.replace(/([\\`*_{}\[\]()#+!|<>])/g,'\\$1').replace(/\r?\n/g,'\n> ');
 return '原文数值依据（原文引用，非独立验证）：\n\n> '+quote+'\n\n[1]';
}
export function stripVerifiedNumericEvidence(text,receipts,pack){
 verifyArticleNumericEvidence(receipts,pack);
 for(const r of receipts){const block=renderArticleNumericFact(r);if(!text.includes(block))fail();text=text.split(block).join('');}
 return text;
}
export function stripSourcedCaseCount(text,pack){
 const title=pack.source?.title??'',evidence=(pack.fragments??[]).map(f=>f.text).join('\n');
 if(pack.coverage?.articleType!=='case-report'||!/(?:^|:\s*)a (?:single[- ]patient )?case report\s*$/i.test(title)||!/\b(?:the|one|single) patient\b|该患者|本例患者/i.test(evidence))return text;
 if([...text.matchAll(/一(?:例|名)(?=[^，。；;:：\n]{0,36}(?:患者|病人))/gu)].length!==1)return text;
 return text.replace(/(^|[。\n])((?:(?:本文|本研究|本篇)(?:为|是)?)?(?:单病例报告|病例报告)[，,:：]\s*(?:描述|报告|记录|涉及)(?:了)?)一(?:例|名)(?=[^，。；;:：\n]{0,36}(?:患者|病人))/gu,'$1$2');
}
export function stripSourcedFollowupDuration(text,pack){
 const numericEvidence=[];
 if(pack.coverage?.articleType!=='case-report')return{text,numericEvidence};
 const words=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'],digits='零一二三四五六七八九';
 const chinese=n=>n<10?digits[n]:(n<20?'十':digits[Math.floor(n/10)]+'十')+(n%10?digits[n%10]:'');
 for(const fact of buildArticleNumericFacts(pack)){
  // A matching sentence must not override another sentence assigning it to
  // prior literature or explicitly denying its applicability to this case.
  // Ambiguous contexts remain quotation-only; this is not cross-sentence NLP.
  if(/\b(?:previous|prior|earlier|another)\b|\bother (?:case|study|report|patient)s?\b|\b(?:literature|quoted|quotation)\b|\b(?:does|do|did|is|was|were) not (?:apply|applicable|performed|observed)\b|\bnot (?:this|the current|our) (?:case|patient|study)\b/i.test(fact.text))continue;
  // First supported source grammar is a whole affirmative limitation sentence,
  // not a token search: never borrow a range tail, negated time, or prior study.
  for(const sentence of new Intl.Segmenter('en',{granularity:'sentence'}).segment(fact.text)){
   const m=sentence.segment.trim().match(/^(?:(?:First|Second|Third|Fourth|Fifth|Finally),\s*)?The short (\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[ -]week follow-up limits conclusions regarding long-term efficacy stability\.$/i);if(!m)continue;
   const value=/^\d+$/.test(m[1])?Number(m[1]):words.indexOf(m[1].toLowerCase());if(value<1||value>99)continue;
   // Only this explicit role and complete clause are supported. No rounding,
   // treatment-duration reuse, range, negation, unit conversion or new arithmetic.
   const claim=new RegExp('(^|[,，。；;!?！？\\n])\\s*随访(?:期)?(?:仅为|仅|为|了)?(?:'+value+'|'+chinese(value)+')(?:个)?周(?=[,，。；;!?！？\\s]|$)','gu');
   let matched=false;text=text.replace(claim,(_all,prefix)=>{matched=true;return prefix;});
   if(matched&&!numericEvidence.some(f=>f.id===fact.id))numericEvidence.push(fact);
  }
 }
 return{text,numericEvidence};
}
