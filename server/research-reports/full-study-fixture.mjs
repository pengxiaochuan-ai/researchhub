// Test-only accepted-Worker fixtures. These are not evidence of real Worker execution.
export function reportBundle(){
 const arms=['MDD_TARGET','MDD_NON_TARGET','HEALTHY_REFERENCE'],visits=['V1','V2','V3','V4'];
 const variables=[{key:'phq9_total',label:'PHQ-9原始合计',armCodes:arms,logicalVisits:visits},{key:'fang_total',label:'表5临床赋分',armCodes:arms.slice(0,2),logicalVisits:visits},{key:'hamd17_total',label:'HAMD-17模拟合计',armCodes:arms.slice(0,2),logicalVisits:['V1','V3','V4']}].map(v=>({...v,formVersionId:v.key+'-form',fieldKey:'total',valueType:'number',unit:'分',source:'score_total'}));
 const caseMetadata={schemaVersion:'full-study-simulation-case-v1',studyId:'study',caseId:'case',scope:{tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},protocolVersionId:'protocol',protocolHash:'c'.repeat(64),policyId:'policy',policyHash:'d'.repeat(64),baseDate:'2026-11-13',subjects:arms.flatMap((armCode,i)=>[1,2].map(n=>({id:'subject-'+i+'-'+n,armCode}))),variables,generator:{version:'synthetic-generator-v1',seed:'test-seed',manifestHash:'e'.repeat(64)},assumptions:['健康仅V1为模拟假设','数据均为合成预处理特征与合成评分']};
 const basis={type:'study-analysis-snapshot',studyId:'study',snapshotId:'root-snapshot',manifestHash:'a'.repeat(64),planId:'plan',qualityGateId:'gate',qualityGateVersion:1};
 const slices=[];
 for(const armCode of arms)for(const logicalVisit of visits)for(const variable of variables)for(const kind of logicalVisit!=='V1'&&armCode!=='HEALTHY_REFERENCE'?['timepoint','paired_change']:['timepoint']){
  const sliceId='slice-'+kind+'-'+armCode+'-'+logicalVisit+'-'+variable.key;
  const eligible=variable.armCodes.includes(armCode)&&variable.logicalVisits.includes(logicalVisit)&&(armCode!=='HEALTHY_REFERENCE'||logicalVisit==='V1')?2:0;
  const noValues=armCode==='MDD_TARGET'&&logicalVisit==='V3'&&variable.key==='hamd17_total';
  const single=armCode==='MDD_NON_TARGET'&&logicalVisit==='V4'&&variable.key==='fang_total';
  const valid=eligible?(noValues?0:single?1:2):0;
  const denominators={population:2,eligible,valid,missing:eligible-valid,notCollected:noValues?1:0,notApplicable:2-eligible,incompleteScore:eligible-valid-(noValues?1:0),reasons:noValues?{source_code_9:1,not_collected:1}:single?{review_required:1}:{}};
  const sources=caseMetadata.subjects.filter(s=>s.armCode===armCode).slice(0,eligible).map((s,i)=>({subjectId:s.id,status:i<valid?'valid':noValues?(i===0?'source_code_9':'not_collected'):'review_required',...(kind==='paired_change'?{baselineRef:{responseId:'baseline-response',assignmentId:'baseline-assignment',revisionNo:1,contentHash:'1'.repeat(64)}}:{}),followupRef:{responseId:'followup-response',assignmentId:'followup-assignment',revisionNo:1,contentHash:'2'.repeat(64)},derivationVersion:kind==='paired_change'?'paired-followup-minus-baseline-v1':null}));
  const slice={sliceId,kind,armCode,logicalVisit,baselineVisit:kind==='paired_change'?'V1':null,variable,denominators,sources,status:!eligible?'not_applicable':!valid?'no_valid_data':'confirmed'};
  if(valid){
   const sliceBasis={...basis,snapshotId:'snapshot-'+sliceId,manifestHash:'b'.repeat(64)};
   const value=armCode==='MDD_NON_TARGET'&&variable.key==='phq9_total'&&logicalVisit==='V1'?1/3:0;
   const column={type:'number',total:valid,observed:valid,missing:0,status:valid===1?'single_observation':'available',min:value,max:value,mean:value,median:value,sampleStdDev:valid===1?null:0};
   const outputs={manifestHash:sliceBasis.manifestHash,rowCount:valid,statisticalUnit:'subject',columns:{[variable.key]:column}},numericEvidence=[{name:'rowCount',value:valid,assumptions:['manifestHash:'+sliceBasis.manifestHash]},...Object.entries(column).filter(([,v])=>typeof v==='number').map(([key,value])=>({name:'columns.'+variable.key+'.'+key,value,assumptions:['manifestHash:'+sliceBasis.manifestHash]}))];
   const actualRun={id:'run-'+sliceId,skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'descriptive-v1',inputHash:'f'.repeat(64),inputSummary:{studyId:'study',snapshotId:sliceBasis.snapshotId},status:'completed',reviewStatus:'confirmed',environment:{llm:false,workerVersion:'t19-1'},dataSources:{analysisBasis:sliceBasis},artifactRefs:{outputs},numericEvidence};
   Object.assign(slice,{methodRunId:actualRun.id,executorVersion:actualRun.executorVersion,outputs,numericEvidence,basis:sliceBasis,actualRun});
  }
  slices.push(slice);
 }
 return {schemaVersion:'full-study-confirmed-runs-v2',studyId:'study',planId:'plan',snapshotId:basis.snapshotId,manifestHash:basis.manifestHash,runGroupId:'full-run-group',basis,caseMetadata,slices,quality:{modalities:{schemaVersion:'full-study-modality-metadata-v1',status:'recorded_metadata_only',fileCount:1,requirementCount:1,statusCounts:{uploaded:1},files:[{id:'file',status:'uploaded',contentHash:null}],requirements:[{id:'requirement',status:'satisfied'}]}}};
}
