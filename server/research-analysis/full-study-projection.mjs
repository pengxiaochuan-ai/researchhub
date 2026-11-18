import {createHash} from 'node:crypto';
import {researchError} from '../research-studies/contract.mjs';
export const FULL_SCHEMA='full-study-simulation-v2',ARMS=['MDD_TARGET','MDD_NON_TARGET','HEALTHY_REFERENCE'],VISITS=['V1','V2','V3','V4'];
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const fail=(code='FULL_STUDY_INVALID')=>{throw researchError(409,code,'本次模拟计划、数据来源或使用范围不可核对，请重新核对。');};
const canonical=x=>x instanceof Date?JSON.stringify(x.toISOString()):x===null?'null':Array.isArray(x)?'['+x.map(canonical).join(',')+']':typeof x==='object'?'{'+Object.keys(x).filter(k=>x[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
export const fullStudyHash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function validateFullStudyCase(c){
 if(c?.schemaVersion!=='full-study-simulation-case-v1'||![c.caseId,c.studyId,c.protocolVersionId,c.policyId].every(id)||!['tenantId','studyGroupId','researchProjectId'].every(k=>id(c.scope?.[k]))||![c.protocolHash,c.policyHash,c.generator?.manifestHash].every(hex)||typeof c.generator?.version!=='string'||!(typeof c.generator?.seed==='string'||Number.isSafeInteger(c.generator?.seed))||!Array.isArray(c.subjects)||c.subjects.length!==6||new Set(c.subjects.map(s=>s.id)).size!==6||c.subjects.some(s=>!id(s.id)||!ARMS.includes(s.armCode))||ARMS.some(a=>c.subjects.filter(s=>s.armCode===a).length!==2))fail('FULL_STUDY_ADMISSION_INVALID');
 const codes=['V1_PATIENT','V1_HEALTHY','V2','V3','V4'];if(!Array.isArray(c.visitPlans)||c.visitPlans.length!==5||new Set(c.visitPlans.map(v=>v.id)).size!==5||codes.some(code=>c.visitPlans.filter(v=>v.code===code).length!==1)||c.visitPlans.some(v=>!id(v.id)||v.logicalVisit!==(v.code.startsWith('V1')?'V1':v.code)||!Array.isArray(v.armCodes)||fullStudyHash([...v.armCodes].sort())!==fullStudyHash((v.code==='V1_HEALTHY'?ARMS.slice(2):ARMS.slice(0,2)).sort())))fail('FULL_STUDY_VISIT_MAP_INVALID');
 if(!Array.isArray(c.forms)||!c.forms.length||new Set(c.forms.map(f=>f.id)).size!==c.forms.length||c.forms.some(f=>!id(f.id)||!hex(f.schemaHash)||!hex(f.scoringHash))||!Array.isArray(c.variables)||!c.variables.length||c.variables.length>100||new Set(c.variables.map(v=>v.key)).size!==c.variables.length)fail('FULL_STUDY_VARIABLES_INVALID');
 for(const v of c.variables)if(!id(v.key)||v.key==='__proto__'||!c.forms.some(f=>f.id===v.formVersionId)||typeof v.fieldKey!=='string'||!v.fieldKey||typeof v.label!=='string'||!v.label.trim()||!['number','integer','boolean'].includes(v.valueType)||!['answer','score_total','score_classification'].includes(v.source)||!Array.isArray(v.logicalVisits)||!v.logicalVisits.length||v.logicalVisits.some(x=>!VISITS.includes(x))||!Array.isArray(v.armCodes)||!v.armCodes.length||v.armCodes.some(x=>!ARMS.includes(x))||!(v.unit===null||typeof v.unit==='string'))fail('FULL_STUDY_VARIABLES_INVALID');
 return JSON.parse(JSON.stringify(Object.fromEntries(['schemaVersion','caseId','studyId','scope','protocolVersionId','protocolHash','policyId','policyHash','baseDate','subjects','visitPlans','forms','variables','generator','assumptions','outcomes'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]]))));
}
export function scoreCell(variable,revision){
 const score=revision?.score??{};let value,status='valid';
 if(variable.source==='score_total'){
  if(revision.scoreAlgorithm!=='numeric-sum-v1'&&score.unresolvedItems?.length)return{value:null,status:score.unresolvedItems.find(i=>i.status==='source_code_9')?.status??score.unresolvedItems[0].status??'incomplete_score'};
  if(score.pulseReviewRequired)return{value:null,status:'pulse_review_required'};
  if(score.processingStatus&&score.processingStatus!=='scored')return{value:null,status:score.processingStatus};
  if(revision.scoreAlgorithm!=='numeric-sum-v1'&&score.processingStatus!=='scored')return{value:null,status:'incomplete_score'};
  if(score.scoreComplete===false||score.scoreComplete===undefined&&!(revision.scoreAlgorithm==='numeric-sum-v1'&&score.complete===true))return{value:null,status:'incomplete_score'};value=score.total;
 }else if(variable.source==='score_classification'){
  if(score.scoreComplete!==true||score.processingStatus!=='scored'||!['positive','negative'].includes(score.classification))return{value:null,status:score.processingStatus??'incomplete_score'};value=score.classification==='positive';
 }else{
  const answers=revision?.answers??{};if(!Object.hasOwn(answers,variable.fieldKey))return{value:null,status:'not_recorded'};value=answers[variable.fieldKey];if(value===null)return{value:null,status:'null'};if(value==='')return{value:null,status:'blank'};
 }
 if(variable.valueType==='boolean'?typeof value!=='boolean':typeof value!=='number'||!Number.isFinite(value)||variable.valueType==='integer'&&!Number.isSafeInteger(value))return{value:null,status:'invalid_value'};
 return{value,status};
}
const applicable=(v,s,visit)=>v.armCodes.includes(s.armCode)&&v.logicalVisits.includes(visit)&&(s.armCode!=='HEALTHY_REFERENCE'||visit==='V1');
export function buildFullStudySlices(c,observations){
 validateFullStudyCase(c);const keyed=new Map();for(const row of observations){if(!c.subjects.some(s=>s.id===row.subjectId&&s.armCode===row.armCode)||!VISITS.includes(row.logicalVisit)||keyed.has(row.subjectId+':'+row.logicalVisit))fail('FULL_STUDY_OBSERVATION_INVALID');keyed.set(row.subjectId+':'+row.logicalVisit,row);}
 const slices=[];
 for(const armCode of ARMS)for(const logicalVisit of VISITS)for(const variable of c.variables)for(const kind of logicalVisit!=='V1'&&armCode!=='HEALTHY_REFERENCE'&&variable.valueType!=='boolean'?['timepoint','paired_change']:['timepoint']){
  const selected=c.subjects.filter(s=>s.armCode===armCode),denominators={population:selected.length,eligible:0,valid:0,missing:0,notCollected:0,notApplicable:0,incompleteScore:0,reasons:{}},rows=[],sources=[];
  for(const subject of selected){
   if(!applicable(variable,subject,logicalVisit)||kind==='paired_change'&&!applicable(variable,subject,'V1')){denominators.notApplicable++;continue;}denominators.eligible++;
   const followup=keyed.get(subject.id+':'+logicalVisit)?.cells?.[variable.key]??{value:null,status:'not_collected'},baseline=kind==='paired_change'?(keyed.get(subject.id+':V1')?.cells?.[variable.key]??{value:null,status:'not_collected'}):null;
   const invalid=[baseline,followup].filter(Boolean).find(x=>x.status!=='valid');
   if(invalid){denominators.missing++;denominators.reasons[invalid.status]=(denominators.reasons[invalid.status]??0)+1;if(invalid.status==='not_collected')denominators.notCollected++;if(!['not_collected','not_recorded','null','blank'].includes(invalid.status))denominators.incompleteScore++;sources.push({subjectId:subject.id,status:invalid.status,...(baseline?{baselineRef:baseline.source?.ref??null}:{}),followupRef:followup.source?.ref??null});continue;}
   const value=kind==='paired_change'?followup.value-baseline.value:followup.value;if(typeof value==='number'&&!Number.isFinite(value))fail('FULL_STUDY_NUMERIC_RANGE');
   const source=kind==='paired_change'?{derivationVersion:'paired-followup-minus-baseline-v1',baseline:baseline.source,followup:followup.source}:followup.source;
   rows.push({subjectId:subject.id,cells:[{key:variable.key,value,missing:null,source}]});sources.push({subjectId:subject.id,status:'valid',...(baseline?{baselineRef:baseline.source.ref}:{}),followupRef:followup.source.ref,derivationVersion:kind==='paired_change'?'paired-followup-minus-baseline-v1':null});denominators.valid++;
  }
  slices.push({sliceId:'slice-'+kind+'-'+armCode+'-'+logicalVisit+'-'+variable.key,kind,armCode,logicalVisit,baselineVisit:kind==='paired_change'?'V1':null,variable,denominators,status:!denominators.eligible?'not_applicable':!rows.length?'no_valid_data':'ready',rows,sources});
 }
 return slices;
}
