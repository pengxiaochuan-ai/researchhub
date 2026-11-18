// A narrow adapter for already-validated synthetic packets, never a Study quality gate.
import assert from 'node:assert/strict';
import {edcDigest,syntheticDataBasis,syntheticQualityCurrent} from './synthetic-edc-contract.mjs';
import {normalizePreparationConfig} from './research-execution-preparation-contract.mjs';

export const CRF_METHOD_MARKER='rh-synthetic-crf-method.v1';
export const CRF_METHOD_PREFIX='rh-crf-method-20261025:';
export const CRF_METHOD_ADAPTER='crf-quality-adapter.v1';
const check=(ok,code='CRF_METHOD_INPUT_INVALID')=>assert.ok(ok,code);
const size=(value,max)=>check(Buffer.byteLength(JSON.stringify(value))<=max,'CRF_METHOD_CAPACITY');
const states=['missing','not_measured','not_applicable'];
export function crfMethodInterrupted(run,instanceId,interruptedIds){return ['queued','validating','running'].includes(run.status)&&(run.environment?.instanceId!==instanceId||interruptedIds.has(run.id));}

/** packet is the server-validated EDC block; packetVersion is its actual immutable DB version. */
export function buildCrfMethodInput(packet,quality,packetVersion){
 const b=packet,{seal,...unsigned}=b;check(seal===edcDigest(unsigned),'CRF_METHOD_PACKET_INVALID');
 check(b.type==='rh-synthetic-edc.v1'&&b.ownerAccountId===b.binding?.ownerAccountId);
 const config=normalizePreparationConfig(b.config);check(edcDigest(config)===b.binding.configHash);
 check(b.subjects.length>=3&&b.subjects.length<=5&&new Set(b.subjects.map(s=>s.key)).size===b.subjects.length);
 check(b.selectedVisitKeys.length===2&&new Set(b.selectedVisitKeys).size===2&&b.selectedVisitKeys.every(k=>config.visits.some(v=>v.key===k)));
 check(config.form.schema.fields.length>=1&&config.form.schema.fields.length<=12&&b.records.length===b.subjects.length*2);
 check(syntheticQualityCurrent(b)&&quality?.id===b.quality.id&&edcDigest(quality)===edcDigest(b.quality),'CRF_METHOD_QUALITY_STALE');
 check(packetVersion&&['collectionId','versionId'].every(k=>typeof packetVersion[k]==='string'&&packetVersion[k].length>0)&&Number.isSafeInteger(packetVersion.versionNo)&&packetVersion.versionNo>0);
 const pair=new Set();for(const r of b.records){const k=r.syntheticSubjectKey+':'+r.visitKey;check(!pair.has(k)&&b.subjects.some(s=>s.key===r.syntheticSubjectKey)&&b.selectedVisitKeys.includes(r.visitKey)&&r.formKey===config.form.key);pair.add(k);}
 const variables=[],groups=[];
 for(const visitKey of b.selectedVisitKeys)for(const field of config.form.schema.fields){
  const rows=b.records.filter(r=>r.visitKey===visitKey),entries=rows.map(r=>r.answers[field.key]);
  check(entries.length===b.subjects.length&&entries.every(e=>e&&['value',...states].includes(e.state)));
  const variable='crf_'+edcDigest({visitKey,fieldKey:field.key}).slice(0,24),missingStates=Object.fromEntries(states.map(s=>[s,entries.filter(e=>e.state===s).length])),nMissing=entries.filter(e=>e.state!=='value').length;
  const numeric=['number','integer'].includes(field.type),v={name:variable,n:rows.length,nMissing};
  if(numeric){const values=entries.filter(e=>e.state==='value').map(e=>e.value);check(values.every(x=>typeof x==='number'&&Number.isFinite(x)&&(field.type!=='integer'||Number.isInteger(x))));if(values.length){v.min=Math.min(...values);v.max=Math.max(...values);}for(const [k,to]of[['min','expectedMin'],['max','expectedMax']])if(Object.hasOwn(field,k)){check(Number.isFinite(field[k]));v[to]=field[k];}}
  variables.push(v);groups.push({evidenceId:'crfg_'+edcDigest({visitKey,fieldKey:field.key}).slice(0,24),variable,visitKey,visitLabel:config.visits.find(v=>v.key===visitKey).name,fieldKey:field.key,fieldLabel:field.label,fieldType:field.type,unit:config.mappings.find(m=>m.fieldKey===field.key&&m.visitKeys.includes(visitKey))?.unit??'',n:rows.length,nMissing,missingStates,rangeSource:numeric&&(Object.hasOwn(v,'expectedMin')||Object.hasOwn(v,'expectedMax'))?'explicit_manual_config':'not_configured',rangeLocations:numeric?rows.filter(r=>{const e=r.answers[field.key];return e.state==='value'&&((v.expectedMin!==undefined&&e.value<v.expectedMin)||(v.expectedMax!==undefined&&e.value>v.expectedMax));}).map(r=>r.recordId):[]});
 }
 const coverage={scope:'own_synthetic_packet',included:['missing-rate','range-check','own_packet_counts'],notExamined:['enrollment','scales','files','time_order','leakage','duplicate_timestamp','group_balance','repeated_measure_inference','study_completeness','analysis_release'],rangeRule:'explicit_manual_config_only'};
 const manifest={manifestVersion:'t19-1',autoRepairRequested:false,scope:{nSubjects:b.subjects.length,nEnrollments:0,nVisits:b.records.length,nScaleResults:0,nFiles:0,nPhotos:0},variables,repeatedMeasures:[],timeOrder:{nVisitsOutOfOrder:0,nFutureCompletedAt:0},leakage:{nSubjectsInMultipleGroups:0,nTrainValOverlapHint:0,splitDeclared:false},files:[],analyticsSnapshot:{nFeatureRows:0,snapshotHash:edcDigest(syntheticDataBasis(b))},locatorHints:{},acceptanceLiveCounts:{protocolVersionCount:0,terminologyEntryCount:0,scaleDefinitionCount:0,sampleSizeRunCount:0,qualityRunCount:0,questionnaireSubmittedCount:0,h5InvitationCount:0}};
 size(manifest,60*1024);
 const manifestHash=edcDigest(manifest),snapshot={marker:CRF_METHOD_MARKER,adapterVersion:CRF_METHOD_ADAPTER,...packetVersion,ownerAccountId:b.ownerAccountId,planId:b.binding.planId,binding:structuredClone(b.binding),dataBasis:syntheticDataBasis(b),quality:{id:quality.id,findingsHash:quality.findingsHash,rulesVersion:quality.rulesVersion},responseRevisions:b.records.map(r=>({recordId:r.recordId,responseRevision:r.responseRevision})).sort((a,b)=>a.recordId.localeCompare(b.recordId)),groups,manifest,manifestHash,coverage};
 size({localCrfMethod:snapshot},128*1024);return{snapshot,manifest,inputHash:edcDigest({localCrfMethod:snapshot}),manifestHash,coverage};
}

/** Receives the original Worker's validated response, not a synthetic/mock computation. */
export function projectCrfMethodResult(snapshot,response){
 check(snapshot.marker===CRF_METHOD_MARKER&&snapshot.adapterVersion===CRF_METHOD_ADAPTER&&snapshot.manifestHash===edcDigest(snapshot.manifest),'CRF_METHOD_SNAPSHOT_INVALID');
 const r=response,o=r.outputs;size(r,128*1024);
 check(r.schemaVersion==='research-methods-worker.v1'&&r.executorKey==='research-data-quality'&&r.executorVersion==='t19-1'&&r.workerVersion==='t19-1'&&r.ok===true&&r.status==='accepted'&&r.error===null,'CRF_METHOD_WORKER_REJECTED');
 check(o?.implemented===true&&o.manifestVersion==='t19-1'&&o.llm===false&&o.autoRepaired===false&&o.simulation===false,'CRF_METHOD_WORKER_POLICY');
 check(Array.isArray(r.numericEvidence)&&Array.isArray(o.findings),'CRF_METHOD_WORKER_INVALID');
 const ignored={n_enrollments:'completeness-count',n_scale_results:'completeness-count',n_files:'completeness-count',n_photos:'completeness-count',duplicate_same_timestamp:'duplicate-key',max_repeats:'repeated-measure',visits_out_of_order:'time-order',visits_future_completed:'time-order',multi_group_subjects:'leakage-risk',train_val_overlap_hint:'leakage-risk',files_missing_hash:'file-hash-presence',files_missing_device:'file-device-meta',files_missing_sampling:'file-sampling-meta',files_missing_lineage:'file-lineage'};
 const expected=new Map([['n_subjects',{operator:'completeness-count',value:snapshot.manifest.scope.nSubjects}],['n_visits',{operator:'completeness-count',value:snapshot.manifest.scope.nVisits}]]);
 for(const v of snapshot.manifest.variables){
  expected.set('missing_rate:'+v.name,{operator:'missing-rate',value:Number((v.nMissing/v.n).toFixed(6))});
  if(v.min!==undefined&&v.expectedMin!==undefined&&v.min<v.expectedMin)expected.set('range_min:'+v.name,{operator:'range-check',value:v.min});
  if(v.max!==undefined&&v.expectedMax!==undefined&&v.max>v.expectedMax)expected.set('range_max:'+v.name,{operator:'range-check',value:v.max});
 }
 const evidence=new Map();for(const e of r.numericEvidence){
  check(typeof e.name==='string'&&!evidence.has(e.name)&&typeof e.value==='number'&&Number.isFinite(e.value)&&e.operatorVersion==='t19-1','CRF_METHOD_NUMERIC_INVALID');
  const want=expected.get(e.name);check(want?e.operator===want.operator&&e.value===want.value:ignored[e.name]===e.operator&&e.value===0,'CRF_METHOD_NUMERIC_MISMATCH');
  evidence.set(e.name,{name:e.name,value:e.value,operator:e.operator,operatorVersion:e.operatorVersion});
 }
 for(const name of expected.keys())check(evidence.has(name),'CRF_METHOD_NUMERIC_MISSING');
 const rangeFindings=o.findings.filter(f=>f.operator==='range-check');
 const wantedRange=[...expected.keys()].filter(k=>k.startsWith('range_'));check(rangeFindings.length===wantedRange.length,'CRF_METHOD_RANGE_MISMATCH');
 for(const name of wantedRange){const lower=name.startsWith('range_min:'),variable=name.slice(name.indexOf(':')+1),v=snapshot.manifest.variables.find(v=>v.name===variable),found=rangeFindings.filter(f=>f.code===(lower?'RANGE_BELOW_MIN':'RANGE_ABOVE_MAX')&&f.anchors?.fieldKey===variable&&f.anchors[lower?'expectedMin':'expectedMax']===v[lower?'expectedMin':'expectedMax']);check(found.length===1,'CRF_METHOD_RANGE_MISMATCH');}
 const evidenceGroups=snapshot.groups.map(g=>{
  const v=snapshot.manifest.variables.find(v=>v.name===g.variable),rate=evidence.get('missing_rate:'+g.variable),rangeObservations=['min','max'].flatMap(side=>{const e=evidence.get('range_'+side+':'+g.variable);return e?[{side,value:e.value,configuredBound:v[side==='min'?'expectedMin':'expectedMax'],numericEvidence:e}]:[];});
  const {variable,...location}=g;return{...structuredClone(location),missingRate:rate.value,numericEvidence:[rate,...rangeObservations.map(x=>x.numericEvidence)],rangeObservations};
 });
 const result={schema:'rh-synthetic-crf-method-result.v1',executor:'research-data-quality',workerVersion:'t19-1',adapterVersion:CRF_METHOD_ADAPTER,manifestHash:snapshot.manifestHash,packetCounts:{syntheticSubjects:evidence.get('n_subjects').value,syntheticVisitRecords:evidence.get('n_visits').value},coverage:structuredClone(snapshot.coverage),evidenceGroups};
 size(result,64*1024);return{result,resultHash:edcDigest(result)};
}
/** Side-by-side observations only; never compute inference from repeated visits. */
export function compareCrfMethodRuns(left,right){
 check(left.id!==right.id&&left.ownerAccountId&&left.ownerAccountId===right.ownerAccountId&&left.collectionId===right.collectionId&&['current','stale'].includes(left.sourceStatus)&&['current','stale'].includes(right.sourceStatus),'CRF_METHOD_COMPARISON_INVALID');
 check(left.result&&right.result&&left.input?.binding?.researchProjectId===right.input?.binding?.researchProjectId&&left.input?.dataBasis?.configHash&&left.input.dataBasis.configHash===right.input?.dataBasis?.configHash&&left.result.adapterVersion&&left.result.adapterVersion===right.result.adapterVersion,'CRF_METHOD_COMPARISON_INVALID');
 const key=g=>g.visitKey+':'+g.fieldKey,a=left.result.evidenceGroups,b=right.result.evidenceGroups;check(Array.isArray(a)&&Array.isArray(b)&&a.length<=24&&a.length===b.length&&new Set(a.map(key)).size===a.length&&new Set(b.map(key)).size===b.length&&a.every(g=>b.some(h=>key(h)===key(g))),'CRF_METHOD_COMPARISON_INVALID');
 const summary=v=>({id:v.id,sourceStatus:v.sourceStatus,inputRevision:{packetVersionNo:v.input.versionNo??null,dataRevision:v.input.dataBasis.dataRevision??null,inputHash:v.inputHash??null}});
 return{left:summary(left),right:summary(right),rows:a.map(g=>({visitKey:g.visitKey,fieldKey:g.fieldKey,left:g,right:b.find(h=>key(h)===key(g))}))};
}
