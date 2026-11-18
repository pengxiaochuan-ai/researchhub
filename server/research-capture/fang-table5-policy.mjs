export const FANG_TABLE5_ALGORITHM='fang-2023-table5-v1';
export const FANG_TABLE5_SOURCE_SHA256='5e34d90ff887e801d3635ecfb2e216227b5510c540302082694d352ee6def3f1';
// PDF p3 / printed p1776 / Table 5 final present/absent columns, in source order.
export const FANG_TABLE5_ITEMS=Object.freeze([
 ['main_distension_pain','胀满（闷）或胀痛或窜痛（胸胁、少腹、乳房等）','主症',4],
 ['main_depressed_emotion','情志抑郁','主症',3],
 ['secondary_irritability','急躁易怒','次症',2],
 ['secondary_sighing','太息','次症',3],
 ['secondary_globus','咽部异物感','次症',4],
 ['secondary_irregular_menses','月经不调','次症',5],
 ['secondary_dysmenorrhea','痛经','次症',5],
 ['secondary_emotional_trigger','遇情志不遂时易诱发或加重','次症',2],
 ['tongue_pale_red','舌质淡红','舌象',5],
 ['tongue_thin_white_coating','苔薄白','舌象',2],
 ['pulse_wiry','脉弦','脉象',6],
 ['pulse_deep_wiry','脉沉弦','脉象',5],
].map(([key,label,dimension,presentScore])=>Object.freeze({key,label,dimension,presentScore})));
const categories=['tongue_category','pulse_category'];
const itemStates=['present','absent','not_applicable','uncertain'],categoryStates=['met','not_met','uncertain'];
const missing=value=>value===null||value===undefined||value==='';
const fail=code=>{throw new Error(code);};
const text=value=>typeof value==='string'&&Boolean(value.trim());
function confirmedPolicy(policy){
 if(!policy||policy.status!=='confirmed'||policy.categoryMode!=='explicit_reviewed_categories'||policy.pulseCooccurrence!=='review_required'||policy.inapplicable!=='incomplete_no_total'||!text(policy.reviewedBy)||!text(policy.reviewedAt))return false;
 const time=new Date(policy.reviewedAt);return Number.isFinite(time.getTime())&&time.toISOString()===policy.reviewedAt;
}
function validateSchema(schema){
 const fields=schema?.fields,expected=[...FANG_TABLE5_ITEMS.map(item=>item.key),...categories];
 if(!Array.isArray(fields)||fields.length!==expected.length||fields.some(field=>!field||typeof field!=='object')||new Set(fields.map(field=>field.key)).size!==expected.length)fail('FORM_SCHEMA_TABLE5_INVALID');
 for(const key of expected){
  const field=fields.find(f=>f.key===key),states=categories.includes(key)?categoryStates:itemStates;
  if(field?.type!=='select'||!Array.isArray(field.options))fail('FORM_SCHEMA_TABLE5_INVALID');
  const values=field.options.map(option=>typeof option==='string'?option:option?.value);
  if(values.length!==states.length||new Set(values).size!==states.length||values.some(value=>!states.includes(value)))fail('FORM_SCHEMA_TABLE5_INVALID');
 }
 return expected;
}

/**
 * Source weights are fixed; project operating policy must be explicitly reviewed.
 * This function does not approve that policy or authorize publication/capture.
 * Form completeness and score completeness intentionally differ: an explicitly
 * uncertain/N-A observation can be retained as a revision without inventing a score.
 */
export function scoreFangTable5(schema,scoring,answers){
 if(scoring?.sourceSha256!==FANG_TABLE5_SOURCE_SHA256)fail('FORM_SCORING_SOURCE_MISMATCH');
 if(scoring.algorithm!==FANG_TABLE5_ALGORITHM)fail('FORM_SCORING_ALGORITHM_UNSUPPORTED');
 const expected=validateSchema(schema);
 if(!answers||typeof answers!=='object'||Array.isArray(answers))fail('FORM_ANSWERS_INVALID');
 if(Object.keys(answers).some(key=>!expected.includes(key)))fail('FORM_ANSWER_UNKNOWN_FIELD');
 for(const key of expected)if(!missing(answers[key])&&!(categories.includes(key)?categoryStates:itemStates).includes(answers[key]))fail('FORM_ANSWER_INVALID_OPTION');
 const missingCount=expected.filter(key=>missing(answers[key])).length;
 const unresolvedItems=expected.filter(key=>categories.includes(key)?!['met','not_met'].includes(answers[key]):!['present','absent'].includes(answers[key])).map(key=>({key,status:missing(answers[key])?'missing':answers[key]}));
 const dualPulse=answers.pulse_wiry==='present'&&answers.pulse_deep_wiry==='present';
 const policyConfirmed=confirmedPolicy(scoring.projectPolicy);
 const processingStatus=!policyConfirmed?'awaiting_policy':dualPulse?'review_required':unresolvedItems.length?'incomplete_data':'scored';
 const scoreComplete=processingStatus==='scored';
 const total=scoreComplete?FANG_TABLE5_ITEMS.reduce((sum,item)=>sum+(answers[item.key]==='present'?item.presentScore:0),0):null;
 const composition=scoreComplete?{
  primary:FANG_TABLE5_ITEMS.filter(item=>item.dimension==='主症').every(item=>answers[item.key]==='present'),
  secondary:FANG_TABLE5_ITEMS.some(item=>item.dimension==='次症'&&answers[item.key]==='present'),
  tongueOrPulse:categories.some(key=>answers[key]==='met'),
 }:null;
 const thresholdMet=scoreComplete?total>=20:null;
 const diagnosis=scoreComplete?thresholdMet&&Object.values(composition).every(Boolean):null;
 return {algorithm:FANG_TABLE5_ALGORITHM,total,scoredCount:FANG_TABLE5_ITEMS.filter(item=>['present','absent'].includes(answers[item.key])).length,missingCount,missingRequired:missingCount,complete:missingCount===0,scoreComplete,processingStatus,unresolvedItems,policyConfirmed,pulseReviewRequired:dualPulse,thresholdMet,composition,diagnosis,classification:diagnosis===null?null:diagnosis?'positive':'negative',sourceSha256:FANG_TABLE5_SOURCE_SHA256};
}
