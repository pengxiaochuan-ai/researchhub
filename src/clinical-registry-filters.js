export const emptyClinicalFilters=()=>({studyType:'',disease:'',intervention:''});
export const clinicalFilterIdentity=identity=>['checking','unavailable'].includes(identity?.status)?null:
  `${identity?.mode||'real'}:${identity?.id||'anonymous'}`;
const reported=value=>typeof value==='string'&&value.trim().length>0;
const summary=item=>item.studySummaryStatus==='approved'?item.studySummary:null;
const interventions=item=>(summary(item)?.interventions||[]).map(x=>x.intervention?.value).filter(reported);
export function clinicalRegistryOptions(items){
  const values={studyType:new Set(),disease:new Set(),intervention:new Set()};
  for(const item of items){
    const type=summary(item)?.studyType?.value;
    if(reported(type))values.studyType.add(type);
    if(reported(item.sourceTargetCondition))values.disease.add(item.sourceTargetCondition);
    for(const value of interventions(item))values.intervention.add(value);
  }
  return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,[...value]]));
}
export function reconcileClinicalFilters(filters,options){
  return Object.fromEntries(Object.keys(emptyClinicalFilters()).map(key=>[key,options[key].includes(filters[key])?filters[key]:'']));
}
export function filterClinicalRegistries(items,{query='',studyType='',disease='',intervention=''}={}){
  const q=query.trim().toLocaleLowerCase();
  return items.filter(item=>(!studyType||summary(item)?.studyType?.value===studyType)&&
    (!disease||item.sourceTargetCondition===disease)&&(!intervention||interventions(item).includes(intervention))&&
    [item.title,item.externalKey,item.sourceTargetCondition,item.sourceName].some(value=>String(value??'').toLocaleLowerCase().includes(q)));
}
