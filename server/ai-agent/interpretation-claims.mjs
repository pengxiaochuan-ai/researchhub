// Narrow, explainable contradictions, not a general semantic truth checker.
// Source absence alone never proves that a whole paper lacks results.
export function interpretationClaimIssues(text,packs){
 const issues=new Set();
 const protocol=p=>{
  const evidence=p.fragments.map(f=>f.text).join(' ');
  return /protocol/i.test(p.source?.title??'')&&/results? (?:are|is) not available|no participant outcomes? (?:have|has) been collected|will (?:be enrolled|be recruited)/i.test(evidence);
 };
 const primaryNegative=p=>p.fragments.some(f=>/primary (?:outcome|endpoint)[^.!?\n]{0,220}(?:no (?:statistically )?significant difference|not (?:significantly )?superior)|no (?:statistically )?significant difference[^.!?\n]{0,220}primary (?:outcome|endpoint)/i.test(f.text));
 const allProtocol=packs.length>0&&packs.every(protocol),allPrimaryNegative=packs.length>0&&packs.every(primaryNegative);
 for(const clause of text.split(/[，；。！？\n]/u)){
  if(/未|无|不能|尚|不支持|不足以|不代表|是否|能否|拟|计划|将|可能|假设|待验证/.test(clause))continue;
  const global=/均|全部|所有|各篇|都/.test(clause);
  if((allProtocol||global&&packs.some(protocol))&&/研究已完成|已完成研究|结果显示|研究证实|证实|证明|已验证|显著有效|治疗有效|疗效明确/.test(clause))issues.add('PROTOCOL_RESULTS_CONTRADICTION');
  if((allPrimaryNegative||global&&packs.some(primaryNegative))&&/主要结局|主要终点|主终点/.test(clause)&&/显著优于|显著改善|显著有效|证实.*有效/.test(clause))issues.add('PRIMARY_OUTCOME_CONTRADICTION');
 }
 return[...issues];
}
