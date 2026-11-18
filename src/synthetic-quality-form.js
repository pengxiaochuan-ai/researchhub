export function syntheticRunUrl(href,runId){
 const url=new URL(href);
 url.searchParams.set('syntheticRunId',runId);
 url.searchParams.delete('syntheticReportVersion');
 return url;
}
export function reconcileSyntheticPlan(href,previousVersion,currentVersion){
 const url=new URL(href),changed=previousVersion!==currentVersion;if(changed){url.searchParams.delete('syntheticRunId');url.searchParams.delete('syntheticReportVersion');}return{changed,href:url.href};
}
export function validateSyntheticEdits(dataset,cells,reason,allowRetry=false){
 const edits=[],errors={};
 for(const[key,text]of Object.entries(cells)){
  const[table,rowId,field]=key.split(':'),row=dataset[table]?.find(r=>r.id===rowId);
  if(!row||!(table==='subjects'?['age','group']:table==='visits'?['completedAt']:table==='measurements'?['collectedAt']:[]).includes(field)){errors[key]="该字段不在本次合成修改范围";continue;}
  let value=text;if(field==='age')value=text.trim()===''?null:/^-?\d+$/.test(text)?Number(text):NaN;
  let valid=field==='age'?value===null||Number.isInteger(value)&&value>=-10&&value<=300:field==='group'?['A','B'].includes(value):false;
  if(['completedAt','collectedAt'].includes(field))try{valid=/^202[0-9]-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(value)&&new Date(value).toISOString()===value;}catch{}
  if(!valid)errors[key]=field==='age'?'请填写-10至300的整数，缺失可留空（仅合成数据检查范围）':'请使用固定分组或完整有效ISO时间，例如2026-01-03T00:00:00.000Z';
  else if(value!==row[field])edits.push({table,rowId,field,value});
 }
 if(typeof reason!=='string'||reason.trim().length<8||reason.length>500)errors.reason='请填写8–500字的人工修改或显式重试原因。';
 if(!edits.length&&!allowRetry&&!Object.keys(errors).length)errors.reason='请先实际修改至少一个合成单元格，不创建重复版本。';
 return{valid:!Object.keys(errors).length,firstInvalid:Object.keys(errors)[0],errors,edits,reason:reason.trim()};
}
