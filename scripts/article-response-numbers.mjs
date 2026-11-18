// Classify only what has an explicit, selected source counterpart. A match is
// lexical/relational evidence, never proof that a whole scientific claim is true.
import {hasArticleQuantity,stripSourcedCaseCount,stripSourcedFollowupDuration} from './article-numeric-evidence.mjs';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const types=[['RCT','(?:randomized controlled (?:study|trial)|RCT)'],['随机对照研究','randomized controlled (?:study|trial)'],['随机对照试验','randomized controlled (?:study|trial)'],['meta分析','meta-analysis'],['荟萃分析','meta-analysis'],['系统综述','systematic review'],['队列研究','cohort study']];
const numberWords=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const chinese=['','一','二','三','四','五','六','七','八','九','十','十一','十二'];
export function classifyArticleNumbers(text,pack){
 let remainder=text.normalize('NFKC'),unmatchedCount=false;const checks=[],fragments=pack.fragments??[];
 remainder=remainder.replace(/[A-Za-z][A-Za-z0-9\p{Script=Greek}/+−-]*/gu,token=>{
  if(!/\d/.test(token))return token;
  const f=fragments.find(f=>new RegExp('(?<![A-Za-z0-9\\p{Script=Greek}/+−-])'+escape(token)+'(?![A-Za-z0-9\\p{Script=Greek}/+−-])','u').test(f.text.normalize('NFKC')));
  if(!f)return token;checks.push({kind:'term',value:token,fragmentId:f.id});return'';
 });
 remainder=remainder.replace(/(?:([一二两三四五六七八九十\d]+)(?:项|篇))?\b((?:18|19|20|21)\d{2})年(?:的)?(?:([一二两三四五六七八九十\d]+)(?:项|篇))?(meta分析|荟萃分析|系统综述|RCT|随机对照研究|随机对照试验|队列研究)/giu,(all,before,year,after,type)=>{
  if(before&&after){unmatchedCount=true;return all;}const count=before??after;
  const sourceType=types.find(([name])=>name.toLowerCase()===type.toLowerCase())?.[1];
  const f=sourceType&&fragments.find(f=>{const m=new RegExp('\\b'+year+'[ -]+(?:'+sourceType+')\\b','i').exec(f.text);return m&&!/\b(?:no|not|without|neither|planned|proposed|hypothetical)\b/i.test(f.text.slice(Math.max(0,m.index-48),m.index));});
  if(!f)return all;
  if(count){const at=f.text.indexOf(year),prefix=f.text.slice(Math.max(0,at-24),at);if(!['一','1'].includes(count)||!/\b(?:a|one|1)\s*$/i.test(prefix)){unmatchedCount=true;return all;}checks.push({kind:'study-count',value:'1',object:type,fragmentId:f.id});}
  checks.push({kind:'citation-year',value:year,object:type,fragmentId:f.id});return'';
 });
 remainder=remainder.replace(/([一二两三四五六七八九十\d]+)(?:项|篇)(RCT|随机对照研究|随机对照试验|meta分析|荟萃分析|系统综述|队列研究)/giu,(all,count,type)=>{
  const n=/^\d+$/.test(count)?Number(count):count==='两'?2:chinese.indexOf(count),sourceType=types.find(([name])=>name.toLowerCase()===type.toLowerCase())?.[1];
  if(n<1||n>12||!sourceType){unmatchedCount=true;return all;}
  const expression=new RegExp('(?<![A-Za-z0-9-])(?:'+n+'|'+numberWords[n]+') '+sourceType+' (?:found|showed|reported|demonstrated)\\b','i');
  const f=fragments.find(f=>{const match=expression.exec(f.text);if(!match)return false;const prefix=f.text.slice(Math.max(0,match.index-48),match.index);return !/\b(?:no|not|neither|planned|proposed)\b|\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:[- ]and)?[- ]*$/i.test(prefix);});
  if(!f){unmatchedCount=true;return all;}checks.push({kind:'study-count',value:String(n),object:type,fragmentId:f.id});return type;
 });
 const caseFree=stripSourcedCaseCount(remainder,pack);if(caseFree!==remainder)checks.push({kind:'case-count',value:'1'});
 const followup=stripSourcedFollowupDuration(caseFree,pack);if(followup.text!==caseFree)checks.push({kind:'followup-duration',fragmentId:followup.numericEvidence[0]?.fragmentId});
 return{unverified:unmatchedCount||hasArticleQuantity(followup.text),checks,numericEvidence:followup.numericEvidence};
}
