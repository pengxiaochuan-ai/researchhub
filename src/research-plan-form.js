export function validateResearchPico(values){
  const labels={question:'核心研究问题',p:'P 人群',i:'I 干预',c:'C 对照',o:'O 结局'};
  const errors={};
  for(const[key,label]of Object.entries(labels))if(typeof values[key]!=='string'||!values[key].trim()||values[key].length>500||/^(待确认|未知|尚未|未确定|不清楚)[。！!]?$/u.test(values[key].trim()))errors[key]=`请明确${label}，不以“待确认”代替字段。`;
  if(!errors.question&&!/[?？]$/.test(values.question.trim()))errors.question='核心研究问题请以问号结尾。';
  return{valid:!Object.keys(errors).length,errors,firstInvalid:Object.keys(errors)[0]};
}
export function isResearchPlanDirty(pico,editor,baseline){
  return Object.keys(baseline.pico).some(k=>(pico[k]??'')!==(baseline.pico[k]??''))||editor!==baseline.editor;
}
export function keepResearchPlanEditBase(dirty,version,incoming){
  return dirty&&incoming.sourceStatus==='current'&&incoming.version!==version;
}
export function canGenerateResearchPlan(plan){return plan?.quota?.canStart===true;}
