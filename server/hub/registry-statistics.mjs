// Input must come from the existing current, approved PUBLIC registry projection.
// No raw extraction, caller supplied scope or member-only record is aggregated.
const text=value=>typeof value==='string'?value.trim():'';
const reported=field=>field?.status==='reported'?text(field.value):'';
const byLabel=(a,b)=>a.label<b.label?-1:a.label>b.label?1:0;
function yearOf(field){
 const date=reported(field);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
 const parsed=new Date(date+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date.slice(0,4):'';
}
function shape(row){
 const fields=row.statisticsFields?.status==='approved'?row.statisticsFields:null;
 return {documentId:row.documentId,externalKey:row.externalKey,title:row.title,reviewVersion:row.reviewVersion,
  year:row.registrationSummaryStatus==='approved'?yearOf(row.registrationSummary?.registeredOn):'',
  disease:text(row.sourceTargetCondition),design:reported(fields?.design),
  interventions:[...new Set((fields?.interventions??[]).map(reported).filter(Boolean))].sort()};
}
function dimension(records,values,year=false){
 const groups=new Map();let missing=0;
 for(const row of records){const labels=values(row);if(!labels.length){missing++;continue;}
  for(const label of labels){if(!groups.has(label))groups.set(label,new Set());groups.get(label).add(row.documentId);}
 }
 let cumulative=0;
 return{groups:[...groups].map(([label,ids])=>({label,count:ids.size,recordIds:[...ids].sort()})).sort(byLabel).map(group=>year?{...group,cumulative:cumulative+=group.count}:group),missing};
}
export function projectRegistrationStatistics(items){
 const keys=new Map();
 for(const row of items){
  if(row?.documentType!=='clinical_registry'||row.visibility!=='public'||!/^rhed-[a-f0-9]{40}$/.test(row.documentId??'')||!text(row.externalKey))continue;
  const value=shape(row);if(!keys.has(value.externalKey))keys.set(value.externalKey,[]);keys.get(value.externalKey).push(value);
 }
 const selected=[],records=new Map();let conflictedRegistrations=0;
 for(const [externalKey,rows]of keys){
  const distinct=new Map(rows.map(row=>[JSON.stringify(row),row]));
  for(const row of distinct.values()){
   const ref={documentId:row.documentId,externalKey,title:row.title,reviewVersion:row.reviewVersion},previous=records.get(row.documentId);
   records.set(row.documentId,previous&&(previous.conflicted||JSON.stringify(previous)!==JSON.stringify(ref))?{documentId:row.documentId,externalKey,title:'来源记录版本存在冲突',reviewVersion:null,conflicted:true}:ref);
  }
  if(distinct.size===1)selected.push(distinct.values().next().value);
  else{conflictedRegistrations++;selected.push({externalKey,year:'',disease:'',design:'',interventions:[]});}
 }
 return{scope:'CURRENT_HUB_APPROVED_PUBLIC_INDEXED',total:keys.size,conflictedRegistrations,
  dimensions:{year:dimension(selected,row=>row.year?[row.year]:[],true),disease:dimension(selected,row=>row.disease?[row.disease]:[]),design:dimension(selected,row=>row.design?[row.design]:[]),intervention:dimension(selected,row=>row.interventions)},
  records:[...records.values()].sort((a,b)=>a.documentId<b.documentId?-1:a.documentId>b.documentId?1:0)};
}
