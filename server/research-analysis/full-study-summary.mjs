import {fail} from './full-study-projection.mjs';

/** Read published deterministic values for review; never changes their confirmation state. */
export function fullStudyRunSummary(run,slice,binding,studyId){
 if(!run||!['needs_review','completed'].includes(run.status))return null;
 const outputs=run.artifactRefs?.outputs,basis=run.dataSources?.analysisBasis,column=outputs?.columns?.[slice.variable.key];
 if(run.skillKey!=='descriptive-statistics'||run.executorVersion!=='descriptive-v1'||run.environment?.llm!==false||run.inputSummary?.studyId!==studyId||run.inputSummary?.snapshotId!==binding?.snapshotId||basis?.snapshotId!==binding?.snapshotId||outputs?.manifestHash!==basis?.manifestHash||outputs?.statisticalUnit!=='subject'||outputs.rowCount!==slice.denominators.valid||Object.keys(outputs.columns??{}).length!==1||column?.type!=='number'||column.status!==(column.observed===1?'single_observation':'available')||column.total!==outputs.rowCount||column.observed!==outputs.rowCount||column.missing!==0)fail('FULL_STUDY_METHOD_OUTPUT_CHANGED');
 const numbers=[['rowCount',outputs.rowCount],...['total','observed','missing','min','max','mean','median','sampleStdDev'].map(k=>['columns.'+slice.variable.key+'.'+k,column[k]])];
 for(const [path,value]of numbers){
  if(value===null&&path.endsWith('.sampleStdDev')&&column.observed===1)continue;
  if(typeof value!=='number'||!Number.isFinite(value)||!run.numericEvidence?.some(e=>e.name===path&&Object.is(e.value,value)&&e.assumptions?.includes('manifestHash:'+outputs.manifestHash)))fail('FULL_STUDY_METHOD_OUTPUT_CHANGED');
 }
 return structuredClone(Object.fromEntries(['type','status','total','observed','missing','min','max','mean','median','sampleStdDev'].map(k=>[k,column[k]])));
}
