import {classifyArticleNumbers} from './article-response-numbers.mjs';
// This is deliberately not a general claim rewriter. Never remove a condition,
// contrary finding or result qualifier in order to manufacture a stronger claim.
const dependent=/但|然而|却|不过|虽然|尽管|即使|如果|若|除非|只有|仅当|否则|前提|取决于|依赖于|是否|能否|条件是|只要|一旦|尚待|因此|所以|从而|因而|由于|因为|分别|相反|而非|并非|并不|不是|未(?:发现|见|达|证实|排除)|不(?:显著|支持|成立|代表)|无显著|无统计|不能|无法排除|不足以/;
const unfinished=/(?:与|和|及|为|是|包括|采用|使用|比较|显示|提示|发现|根据|通过|可能)$/;
// Positive, source-backed descriptors only. Unknown qualitative prose is not
// classified as safe just because it lacks a recognized result word or number.
function descriptor(clause,pack){
 const design=clause.match(/^本研究(?:为|是)(单中心)?随机对照试验(?:（RCT）|\(RCT\))?$/);
 const source=design?design[1]?/^This single-center RCT was approved by [^.!?]+[.!?]/i:/^This (?:single-center )?RCT was approved by [^.!?]+[.!?]/i:
  /^(?:(?:原文明确局限[：:])?所有结局均为主观量表|缺乏客观或生物标志物终点)$/.test(clause)?/^This study has several limitations\.\s+First, all outcome measures were subjective scales and lacked objective or biomarker-based endpoints\./i:null;
 if(!source)return null;
 const f=pack.fragments.find(f=>{const match=source.exec(f.text);return match&&!/\b(?:no|not|never|incorrect|false|prior|previous|hypothetical|quoted)\b/i.test(match[0]);});return f?.id??null;
}
export function articleQualitativePrefix(sentence,pack){
 if(dependent.test(sentence))return null;
 const pairs={'(':')','（':'）','[':']','【':'】','“':'”','‘':'’','「':'」','『':'』','"':'"',"'":"'"},closing=new Set(Object.values(pairs)),stack=[],cuts=[];
 for(let i=0;i<sentence.length;i++){
  const c=sentence[i];if((c==='"'||c==="'")&&stack.at(-1)===c){stack.pop();continue;}
  if(pairs[c])stack.push(pairs[c]);else if(closing.has(c)){if(stack.pop()!==c)return null;}
  else if(!stack.length&&/[，,；;]/.test(c))cuts.push(i);
 }
 if(stack.length)return null;
 let start=0,last=0;const fragmentIds=[];
 for(const end of [...cuts,sentence.length]){
  const clause=sentence.slice(start,end).trim();
  const fragmentId=descriptor(clause,pack);
  if(!clause||!fragmentId||unfinished.test(clause.replace(/[。！？\s]+$/,''))||classifyArticleNumbers(clause,pack).unverified)break;
  fragmentIds.push(fragmentId);
  last=end;start=end+1;
 }
 if(!last||last===sentence.length)return null;
 const original=sentence.slice(0,last).trim();
 if(!/\p{L}/u.test(original))return null;
 return {text:original.replace(/[，,；;。！？\s]+$/,'')+'。',cutAt:last,fragmentIds:[...new Set(fragmentIds)]};
}
