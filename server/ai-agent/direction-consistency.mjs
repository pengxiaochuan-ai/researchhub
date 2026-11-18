import {routeDigest} from './skill-routing.mjs';

// A narrow contradiction check, not a study-design classifier or an evidence grade.
export const DIRECTION_POLICY_VERSION='hub-direction-consistency.v3';
const sentenceParts=text=>[...String(text).matchAll(/[^。！？!?\n]+[。！？!?\n]*|[。！？!?\n]+/g)].map(m=>({text:m[0],offset:m.index}));
const sourceParts=source=>['title','text'].flatMap(field=>{
 const value=String(source[field]??'');
 // English full stops are sentence boundaries here, never decimal separators.
 return [...value.matchAll(/(?:[^.!?\n]|\.(?=\d))+(?:\.(?!\d)|[!?\n]|$)/g)].map(m=>({field,offset:m.index,text:m[0]}));
});
const review=/\b(?:systematic|narrative|scoping|literature|umbrella) review\b|\bmeta[- ]analys[ie]s\b|系统综述|叙述性综述|荟萃分析/i;
const protocol=/\b(?:study|trial) protocol\b|\bprotocol (?:for|of|paper)\b|研究方案|试验方案/i;
const selfProtocol=/\bthis (?:paper|article|study|report) (?:is|presents|describes|reports) (?:a |the )?(?:study |trial )?protocol\b|\bthis (?:study|trial) protocol\b|本文(?:为|介绍|描述).{0,8}(?:研究|试验)方案/i;
const nonrandom=/\bnon[- ]?randomi[sz]ed\b|\bnot randomi[sz]ed\b|非随机/i;
const trialTitle=/\brandomi[sz]ed\b[^.]{0,70}\b(?:trial|study)\b|随机对照试验/i;
const assigned=/\b(?:were|was)\s+(?:randomly assigned|randomi[sz]ed)\b|\b(?:conducted|completed)\s+(?:a\s+)?randomi[sz]ed\b|(?:随机分配|随机分组|随机对照试验)/i;
const followNegative=/\b(?:no follow[- ]?up (?:was|were) (?:performed|conducted)|did not (?:perform|conduct) follow[- ]?up)\b|未开展随访|未进行随访/i;
const followReported=/\b(?:at|during|after|and|plus|,)\s+(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-](?:day|week|month|year)s?\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)[\s-](?:day|week|month|year)\s+follow[- ]?up\b|(?:第|后|及|和)\s*[一二三四五六七八九十\d]+\s*(?:周|月|年)/i;
const measured=/\b(?:assessed|measured|collected|evaluated|recorded|completed|wore|followed|follow[- ]?up)\b|\bcomplete\s+(?:(?:an?|the)\s+)?(?:online\s+)?(?:surveys?|questionnaires?)\b|随访|评估|测量|采集/i;
const uncertainSurvey=/\b(?:did not|never|(?:were|was) not (?:invited|asked) to|no participants|(?:might|may|could|would)(?: be (?:invited|asked) to)?|(?:plan(?:ned|s)?|intend(?:ed|s)?) to)\s+complete(?:d)?\s+(?:(?:an?|the)\s+)?(?:online\s+)?(?:surveys?|questionnaires?)\b/i;
const planned=/\bwill\b|\bplanned\b|拟开展|将进行/i;
export function buildDirectionFacts(sources){
 const catalog=sources.map(source=>{
  const parts=sourceParts(source),title=String(source.title??'');
  let design='uncertain';
  if(protocol.test(title)||parts.some(p=>p.field==='text'&&selfProtocol.test(p.text)))design='protocol';
  else if(review.test(title))design='review';
  else if(nonrandom.test(title))design='nonrandomized';
  else if(trialTitle.test(title))design='randomized-trial';
  else if(parts.some(p=>p.field==='text'&&!planned.test(p.text)&&!nonrandom.test(p.text)&&assigned.test(p.text)))design='randomized-trial';
  const negative=parts.filter(p=>followNegative.test(p.text)),reported=parts.filter(p=>!planned.test(p.text)&&!uncertainSurvey.test(p.text)&&!followNegative.test(p.text)&&measured.test(p.text)&&followReported.test(p.text));
  const quotes=parts.filter(p=>(p.field==='title'&&design!=='uncertain')||selfProtocol.test(p.text)||(!planned.test(p.text)&&assigned.test(p.text))||negative.includes(p)||reported.includes(p)).map(p=>({...p,hash:routeDigest(p)}));
  return{id:source.id,sourceHash:routeDigest(source),design:{kind:design},followUp:{state:design==='protocol'?'not-mentioned':reported.length?'reported':negative.length?'not-performed':'not-mentioned'},quotes};
 });
 return{version:DIRECTION_POLICY_VERSION,sources:catalog,hash:routeDigest(catalog)};
}
const caution=/^(?:\s*)(?:并非|并不是|不能|不可|不应|不足以|尚不能|无法|未必|难以|没有足够依据|本次(?:材料|证据|检索)(?:仍)?不足)/;
const proposal=/^\s*(?:建议|可考虑|可以考虑|未来(?:应|可)|下一步|需(?:要)?(?:进一步|开展|扩展|扩大|核对)|应(?:进一步|开展|核对))/;
const randomizedClaim=/随机(?:对照)?(?:试验|研究)|随机分组|\bRCTs?\b|randomi[sz]ed (?:controlled )?(?:trial|study)/i;
const causal=/^\s*(?:因此|所以|故而|因而|据此|由此|从而|进而|这(?:也)?(?:说明|证明|意味着))/;

// Raw propositions are checked before any legacy numeric-clause removal.
export function checkDirectionText(text,{facts,sourceIds,sourceLabels}){
 if(typeof text!=='string'||!text.trim()||text.length>1800||/https?:|www\.|\]\(/i.test(text))throw Error('HUB_LITERATURE_OUTPUT_INVALID');
 const labels=[...sourceLabels.entries()],issues=[],retained=[];let previousWithheld=false;
 for(const part of sentenceParts(text)){
  const sentence=part.text,trim=sentence.trim();
  let code,checked=facts.sources;
  if(previousWithheld&&causal.test(trim))code='DEPENDENT_CONCLUSION_WITHHELD';
  // Commas are used to CHECK subjects and premises, never to remove half a
  // proposition. If any part conflicts, the whole sentence is withheld.
  for(const assertion of code?[]:sentence.split(/[，,；;]/).flatMap(s=>s.split(/(?:因为|但(?:是)?|然而)/))){
   if(caution.test(assertion)||proposal.test(assertion))continue;
   const mentioned=labels.filter(([id,label])=>new RegExp('(?:'+id+'\\b|'+label+')').test(assertion)).map(([id])=>id);
   const local=facts.sources.filter(s=>(mentioned.length?mentioned:sourceIds).includes(s.id));
   const fieldWide=/(?:本|整个|该|这一)领域|所有(?:相关)?研究|既有研究均/.test(assertion);
   const absoluteGap=/(?:尚无|没有|缺乏|空白|首次|唯一|均未|都未)/.test(assertion);
   const only=/(?:仅(?:有|为|[HP]\d+|文献|一|这)|只有|唯一)/.test(assertion);
   if(randomizedClaim.test(assertion)&&only&&facts.sources.filter(s=>s.design.kind==='randomized-trial').length>1){
    // Explicit "所引两篇中" is a local assertion; unqualified exclusivity is global.
    if(/(?:所引|所引用|上述引用|本方向引用)/.test(sentence))checked=facts.sources.filter(s=>sourceIds.includes(s.id));
    if(checked.filter(s=>s.design.kind==='randomized-trial').length>1)code='DESIGN_EXCLUSIVITY_CONTRADICTION';
   }
   const conflicting=local.filter(s=>['review','protocol','nonrandomized'].includes(s.design.kind)).filter(s=>{
    const label=sourceLabels.get(s.id),subject=assertion.match(new RegExp('(?:'+s.id+'\\b|'+label+')(?:是|为|属于|采用了)(?:一项|一篇|的)?([^，；。]{0,24})'))?.[1];
    return subject&&randomizedClaim.test(subject)&&!review.test(subject)&&!protocol.test(subject)&&!nonrandom.test(subject);
   });
   if(!code&&conflicting.length){code='DESIGN_SOURCE_CONTRADICTION';checked=conflicting;}
   if(!code&&randomizedClaim.test(assertion)&&/(?:尚无|没有|均非|均未|全无)[^，；。]{0,12}(?:随机|RCT)/i.test(assertion)&&facts.sources.some(s=>s.design.kind==='randomized-trial'))code='DESIGN_ABSENCE_CONTRADICTION';
   const reportingUnknown=/(?:未说明|未报告|未提供|未提及|未提到)(?:具体)?随访时长|(?:未报告|未提供|未说明|未提及|未提到)更长期(?:随访|效果|结局)/.test(assertion);
   if(!code&&reportingUnknown&&!/更长期/.test(assertion)&&local.some(s=>s.followUp.state==='reported')){code='FOLLOW_UP_REPORTING_CONTRADICTION';checked=local;}
   const followAbsence=!reportingUnknown&&/(?:未提供|未报告|未进行|未开展|未比较|未提及|未提到|没有|无|缺乏|尚无|未纳入|未涉及)[^。！？]{0,16}(?:随访|长期效果|长期结局|长期评估)/.test(assertion);
   let supportedAbsence=false;
   if(!code&&followAbsence){
    checked=mentioned.length?local:facts.sources.filter(s=>sourceIds.includes(s.id));
    code=checked.some(s=>s.followUp.state==='reported')?'FOLLOW_UP_OVERGENERALIZED':'FOLLOW_UP_ABSENCE_UNSUPPORTED';
    // Explicit absence quoted by the original is allowed; mere silence is not.
    if(!/长期/.test(assertion)&&checked.length&&checked.every(s=>s.followUp.state==='not-performed')){code=undefined;supportedAbsence=true;}
   }
   if(!code&&fieldWide&&absoluteGap)code='FIELD_WIDE_GAP_UNSUPPORTED';
   if(!code&&/(?:随访|随访时间|随访期)(?:均|普遍|仍|都|较|过|很)?(?:短|长|不足|充分)/.test(assertion))code='FOLLOW_UP_DURATION_UNQUALIFIED';
   if(!code&&!supportedAbsence&&/(?:未|没有)(?:系统|直接|单独|同时|充分)?(?:比较|分析|测量|开展|探讨)|缺乏[^。！？]{0,32}(?:研究|方案|比较|证据|随访)/.test(assertion))code='RESEARCH_GAP_UNSUPPORTED';
   if(code)break;
  }
  if(code){issues.push({code,action:'withheld',text:sentence,offset:part.offset,checkedSourceIds:checked.map(s=>s.id),quoteHashes:checked.flatMap(s=>s.quotes.map(q=>q.hash))});previousWithheld=true;}
  else{retained.push(sentence);if(trim)previousWithheld=false;}
 }
 const delivered=retained.join('').trim();
 return{text:delivered,issues,originalHash:routeDigest(text),deliveredHash:routeDigest(delivered),factsHash:facts.hash,sourceIds:[...sourceIds]};
}
