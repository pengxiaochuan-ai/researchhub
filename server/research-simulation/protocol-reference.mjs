import {requestHash} from '../research-studies/contract.mjs';
import {presentProtocol} from '../research-execution/protocols.mjs';
const sameScope=(row,s)=>['tenantId','studyGroupId','researchProjectId'].every(k=>row?.[k]===s[k]);
const issue=()=>({code:'FORM_SCORE_OUTCOME_UNREGISTERED',message:'模拟核对指标的总分来源未绑定到固定表单，请重新核对。'});

/** Adds a fixed form-score source only for the admitted simulation case. */
export function createSimulationProtocolReferences({legacy,resolveCase,protocolHash=p=>presentProtocol(p).revision}){
 async function checkProtocolFixedReferences(tx,s,protocol){
  const base=await legacy.checkProtocolFixedReferences(tx,s,protocol),c=await resolveCase(tx,s);
  if(!c)return base;
  const refs=[...(protocol.primaryOutcomes??[]).map(r=>({...r,role:'primary'})),...(protocol.secondaryOutcomes??[]).map(r=>({...r,role:'secondary'}))];
  let valid=protocol.id===c.protocolVersionId&&protocolHash(protocol)===c.protocolHash&&Array.isArray(c.outcomes)&&refs.length===c.outcomes.length&&refs.length>0;
  if(valid){
   const rows=await tx.outcomeDefinition.findMany({where:{...s,id:{in:refs.map(r=>r.outcomeDefinitionId)}}}),forms=await tx.formVersion.findMany({where:{...s,id:{in:c.forms.map(f=>f.id)}}});
   valid=refs.every(ref=>{
    const registered=c.outcomes.find(x=>x.id===ref.outcomeDefinitionId&&x.versionNumber===ref.versionNumber&&x.role===ref.role),row=rows.find(x=>x.id===ref.outcomeDefinitionId),v=registered&&c.variables.find(x=>x.key===registered.variableKey&&x.source==='score_total'),form=v&&forms.find(x=>x.id===v.formVersionId),fixed=form&&c.forms.find(x=>x.id===form.id),plan=protocol.visitPlans?.find(x=>x.code===row?.timepointCode);
    return registered&&row&&v&&form&&fixed&&sameScope(row,s)&&sameScope(form,s)&&row.status==='published'&&row.publishedAt&&row.versionNumber===ref.versionNumber&&row.role===ref.role&&row.sourceType==='form_score'&&row.scoreKey===v.key&&row.unit===v.unit&&requestHash(form.schema)===fixed.schemaHash&&requestHash(form.scoring??null)===fixed.scoringHash&&plan?.requirements?.filter(r=>r.kind==='form_response'&&r.config?.formVersionId===v.formVersionId).length===1;
   });
  }
  if(!valid)return{ready:false,issues:[...base.issues,issue()]};
  // Every actual unsupported source above is now checked as the explicit new type.
  // All other legacy material/version failures remain blocking.
  const issues=base.issues.filter(x=>x.code!=='OUTCOME_SOURCE_UNSUPPORTED');return{ready:issues.length===0,issues};
 }
 return{...legacy,checkProtocolFixedReferences};
}
