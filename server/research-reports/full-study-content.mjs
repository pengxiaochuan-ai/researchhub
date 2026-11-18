import {researchError} from '../research-studies/contract.mjs';
import {buildT17Report,canonicalReportJson,reportDigest} from '../research-analysis/t17-report-content.mjs';

export const FULL_STUDY_REPORT_SCHEMA='full-study-report-v2';
export const FULL_STUDY_PRESENTATION_SCHEMA='full-study-report-presentation-v2';
const arms=['MDD_TARGET','MDD_NON_TARGET','HEALTHY_REFERENCE'],visits=['V1','V2','V3','V4'];
const armLabels={MDD_TARGET:'抑郁目标证候组',MDD_NON_TARGET:'抑郁非目标证候组',HEALTHY_REFERENCE:'健康参照组'};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=()=>{throw researchError(409,'REPORT_SOURCE_INVALID','整课题报告的固定切片、运行或数值证据不可核对。');};
const clone=value=>JSON.parse(canonicalReportJson(value));
const display=value=>String(value).replace(/[\r\n\u0000-\u001f]/g,' ').replace(/[&<>|`]/g,c=>c==='&'?'&amp;':'&#'+c.charCodeAt(0)+';');
const number=value=>value===null?'不可估计':String(value); // Exact Worker number, without rounding.
const same=(a,b)=>canonicalReportJson(a)===canonicalReportJson(b);
const ref=value=>value&&id(value.responseId)&&id(value.assignmentId)&&Number.isSafeInteger(value.revisionNo)&&value.revisionNo>0&&hex(value.contentHash);
const reasonLabel={source_code_9:'特殊9不计分',not_collected:'未采集',not_recorded:'未记录',missing:'漏答',null:'未填写',blank:'空白',not_applicable:'不适用',uncertain:'无法判断',review_required:'待复核',pulse_review_required:'脉象待复核',awaiting_policy:'待规则确认',incomplete_data:'资料不完整',incomplete_score:'无完整评分'};

function validateSlice(slice,bundle,variable){
 const d=slice.denominators;
 if(!id(slice.sliceId)||!['timepoint','paired_change'].includes(slice.kind)||!arms.includes(slice.armCode)||!visits.includes(slice.logicalVisit)||!same(slice.variable,variable)||slice.baselineVisit!==(slice.kind==='paired_change'?'V1':null)||!d||!['population','eligible','valid','missing','notCollected','notApplicable','incompleteScore'].every(key=>Number.isSafeInteger(d[key])&&d[key]>=0))fail();
 const selected=bundle.caseMetadata.subjects.filter(subject=>subject.armCode===slice.armCode);
 if(d.population!==selected.length||d.eligible+d.notApplicable!==d.population||d.valid+d.missing!==d.eligible||d.notCollected>d.missing||d.incompleteScore>d.missing||!d.reasons||Object.values(d.reasons).some(n=>!Number.isSafeInteger(n)||n<0)||Object.values(d.reasons).reduce((sum,n)=>sum+n,0)!==d.missing||!Array.isArray(slice.sources)||slice.sources.length!==d.eligible||new Set(slice.sources.map(source=>source.subjectId)).size!==slice.sources.length||slice.sources.some(source=>!selected.some(subject=>subject.id===source.subjectId))||slice.sources.filter(source=>source.status==='valid').length!==d.valid)fail();
 for(const source of slice.sources)if(source.status==='valid'&&(!ref(source.followupRef)||slice.kind==='paired_change'&&(!ref(source.baselineRef)||source.derivationVersion!=='paired-followup-minus-baseline-v1')))fail();
 if(!d.valid){if(slice.status!==(d.eligible?'no_valid_data':'not_applicable')||slice.actualRun||slice.methodRunId)fail();return null;}
 if(slice.status!=='confirmed'||!slice.actualRun||slice.methodRunId!==slice.actualRun.id||slice.actualRun.inputSummary?.studyId!==bundle.studyId||slice.actualRun.inputSummary?.snapshotId!==slice.basis?.snapshotId||!same(slice.outputs,slice.actualRun.artifactRefs?.outputs)||!same(slice.numericEvidence,slice.actualRun.numericEvidence))fail();
 const verified=buildT17Report(slice.actualRun,slice.basis,'固定切片核对');
 const outputs=slice.actualRun.artifactRefs.outputs,column=outputs.columns[variable.key];
 if(Object.keys(outputs.columns).length!==1||!column||column.type!=='number'||outputs.rowCount!==d.valid||column.observed!==d.valid||column.missing!==0)fail();
 return {column,source:verified.sources[0]};
}

/** Copy accepted child Worker output only. Counts originate in the fixed root manifest. */
export function buildFullStudyReport(bundle,basis,title){
 if(bundle?.schemaVersion!=='full-study-confirmed-runs-v2'||!id(bundle.runGroupId)||!id(bundle.studyId)||!id(bundle.snapshotId)||!hex(bundle.manifestHash)||!same(bundle.basis,basis)||basis?.studyId!==bundle.studyId||basis.snapshotId!==bundle.snapshotId||basis.manifestHash!==bundle.manifestHash||basis.planId!==bundle.planId||bundle.caseMetadata?.studyId!==bundle.studyId||!Array.isArray(bundle.caseMetadata.subjects)||bundle.caseMetadata.subjects.length!==6||new Set(bundle.caseMetadata.subjects.map(subject=>subject.id)).size!==6||arms.some(arm=>bundle.caseMetadata.subjects.filter(subject=>subject.armCode===arm).length!==2)||!Array.isArray(bundle.caseMetadata.assumptions)||bundle.caseMetadata.assumptions.some(value=>typeof value!=='string'||!value.trim())||typeof title!=='string'||!title.trim())fail();
 const variables=bundle.caseMetadata.variables;
 if(!Array.isArray(variables)||variables.length!==3||new Set(variables.map(variable=>variable.key)).size!==3||variables.some(variable=>!id(variable.key)||variable.source!=='score_total'||!['number','integer'].includes(variable.valueType)||typeof variable.label!=='string'||!variable.label.trim())||!Array.isArray(bundle.slices))fail();
 const expected=[];
 for(const armCode of arms)for(const logicalVisit of visits)for(const variable of variables)for(const kind of logicalVisit!=='V1'&&armCode!=='HEALTHY_REFERENCE'?['timepoint','paired_change']:['timepoint'])expected.push([armCode,logicalVisit,variable.key,kind].join(':'));
 const key=slice=>[slice.armCode,slice.logicalVisit,slice.variable?.key,slice.kind].join(':');
 if(bundle.slices.length!==expected.length||new Set(bundle.slices.map(key)).size!==expected.length||new Set(bundle.slices.map(slice=>slice.sliceId)).size!==expected.length||bundle.slices.some(slice=>!expected.includes(key(slice))))fail();
 const checked=new Map(),methodSources=[];
 for(const slice of bundle.slices){const verified=validateSlice(slice,bundle,variables.find(variable=>variable.key===slice.variable?.key));checked.set(slice.sliceId,verified);if(verified)methodSources.push(verified.source);}
 if(new Set(methodSources.map(source=>source.sourceId)).size!==methodSources.length)fail();
 const lines=['> 合成数据模拟验收，仅用于科研流程软件验证。','','## 研究场景','','基于舌象—语音—神经影像多模态特征融合的抑郁症肝郁气滞证客观辨识研究。','六例是软件覆盖用例数，不是临床样本量；名义访视为0、14、28、56日，未表示已完成八周真实随访。','健康参照仅基线，不进入患者主证候阴性组或效度分母。','范围为三个量表合计的组别/时点描述、患者配对变化及模态登记完整性；五主症源规则未齐，未执行敏感性分析。','配对Δ = 同一被试后续值 − 基线值；固定双端修订，派生版本为paired-followup-minus-baseline-v1。','数字逐项复制已确认Worker原值，采用JavaScript String(number)的最短可回读表示，不四舍五入；空值明确为不可估计。','','## 模拟假设','',...bundle.caseMetadata.assumptions.map(value=>'- '+display(value)),''];
 const tables=[];
 const table=(header,rows)=>{tables.push({header,rows});lines.push('| '+header.join(' | ')+' |','| '+header.map(()=>'---').join(' | ')+' |',...rows.map(row=>'| '+row.join(' | ')+' |'),'');};
 for(const variable of variables)for(const kind of ['timepoint','paired_change']){
  const slices=bundle.slices.filter(slice=>slice.variable.key===variable.key&&slice.kind===kind);
  lines.push('## '+display(variable.label)+' · '+(kind==='timepoint'?'组别与时点':'患者配对变化'),'','单位：'+display(variable.unit??'未声明'),'');
  table(['组别/时点','有效/适用','均值','中位数','样本标准差','最小–最大'],slices.map(slice=>{
   const c=checked.get(slice.sliceId)?.column,empty=slice.status==='not_applicable'?'不适用':'无有效值';
   return [display(armLabels[slice.armCode]+' / '+slice.logicalVisit),String(slice.denominators.valid)+'/'+String(slice.denominators.eligible),c?number(c.mean):empty,c?number(c.median):empty,c?number(c.sampleStdDev):empty,c?number(c.min)+' – '+number(c.max):empty];
  }));
  for(const slice of slices){const d=slice.denominators,reasons=Object.entries(d.reasons).map(([reason,count])=>display(reasonLabel[reason]??reason)+'：'+String(count));lines.push(display(armLabels[slice.armCode]+' / '+slice.logicalVisit)+'：人群'+String(d.population)+'；适用'+String(d.eligible)+'；有效'+String(d.valid)+'；缺失'+String(d.missing)+'；未采集'+String(d.notCollected)+'；无完整评分'+String(d.incompleteScore)+'；结构性不适用'+String(d.notApplicable)+(reasons.length?'；原因：'+reasons.join('、'):'')+'。');}
  lines.push('');
 }
 lines.push('## 模态来源登记','','模态仅呈现合成预处理文件及其登记/处理元数据；uploaded或履约状态不表示临床质量通过，未声称原始舌图、录音或EEG提取完成。');
 const modalities=bundle.quality?.modalities;
 if(modalities){
  if(modalities.schemaVersion!=='full-study-modality-metadata-v1'||modalities.status!=='recorded_metadata_only'||!Number.isSafeInteger(modalities.fileCount)||modalities.fileCount<0||!Number.isSafeInteger(modalities.requirementCount)||modalities.requirementCount<0||!modalities.statusCounts||Object.values(modalities.statusCounts).some(n=>!Number.isSafeInteger(n)||n<0))fail();
  table(['根快照登记项','原记录值'],[['文件记录数',String(modalities.fileCount)],['非表单履约记录数',String(modalities.requirementCount)],...Object.entries(modalities.statusCounts).map(([status,count])=>['文件状态 '+display(status),String(count)])]);
 }else lines.push('当前固定来源没有模态登记计数，未补填。','');
 lines.push('## 可复核来源','','整课题运行组：'+display(bundle.runGroupId),'根快照：'+display(bundle.snapshotId),'根依据摘要：'+bundle.manifestHash,'');
 for(const slice of bundle.slices){
  lines.push('### '+display(slice.sliceId),'状态：'+display(slice.status));
  if(slice.actualRun)lines.push('方法运行：'+display(slice.actualRun.id),'切片快照：'+display(slice.basis.snapshotId),'切片依据摘要：'+slice.basis.manifestHash);
  else lines.push('本切片为'+(slice.status==='not_applicable'?'结构性不适用':'无有效值')+'，没有创建方法运行或统计数值。');
  if(slice.kind==='paired_change')for(const source of slice.sources)lines.push('基线修订摘要：'+(source.baselineRef?.contentHash??'无可用来源')+'；后续修订摘要：'+(source.followupRef?.contentHash??'无可用来源')+'；来源状态：'+display(source.status));
  lines.push('');
 }
 const sliceSources=bundle.slices.map(({sliceId,kind,armCode,logicalVisit,baselineVisit,variable,denominators,status,methodRunId,basis,sources})=>({sliceId,kind,armCode,logicalVisit,baselineVisit,variable,denominators,status,methodRunId:methodRunId??null,analysisBasis:basis??null,sources}));
 const root={sourceType:'data_snapshot',sourceId:bundle.snapshotId,sourceVersion:bundle.manifestHash,snapshot:{schemaVersion:FULL_STUDY_REPORT_SCHEMA,analysisBasis:basis,runGroupId:bundle.runGroupId,caseMetadata:bundle.caseMetadata,quality:bundle.quality??null,slices:sliceSources}};
 const sources=clone([...methodSources,root]),presentation={schemaVersion:FULL_STUDY_PRESENTATION_SCHEMA,numberFormat:'ECMAScript String(number), no rounding',tables};
 const contentMd=lines.join('\n');
 return {title,contentMd,contentBlocks:[{type:'full_study_analysis',schemaVersion:FULL_STUDY_REPORT_SCHEMA,analysisBasis:clone(basis),runGroupId:bundle.runGroupId,presentation}],contentHash:reportDigest(contentMd),sourceSnapshotHash:reportDigest(canonicalReportJson(sources)),sources};
}
