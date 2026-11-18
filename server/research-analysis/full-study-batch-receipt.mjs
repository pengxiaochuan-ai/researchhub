import {fullStudyHash,fail} from './full-study-projection.mjs';
export const BATCH_VERSION='full-study-batch-v1';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fields={process:['sliceId','methodKey','snapshotId'],review:['runId','methodKey','snapshotId','nativeKey','commandHash']};
export function batchTargets(kind,targets,expectedHash){
 const keys=fields[kind];if(!keys||!Array.isArray(targets)||targets.length<1||targets.length>3||targets.some(t=>!t||Object.keys(t).length!==keys.length||keys.some(k=>!Object.hasOwn(t,k)||(k==='commandHash'?!hash(t[k]):!id(t[k]))))||new Set(targets.map(t=>t.methodKey)).size!==targets.length||new Set(targets.map(t=>t.snapshotId)).size!==targets.length||kind==='review'&&new Set(targets.map(t=>t.runId)).size!==targets.length||expectedHash!==undefined&&fullStudyHash(targets)!==expectedHash)fail('FULL_STUDY_BATCH_CHANGED');
 return structuredClone(targets);
}
export function batchReceipt(kind,scope,targets,items){
 targets=batchTargets(kind,targets);
 if(!['studyId','runGroupId','snapshotId','requestKey'].every(k=>id(scope[k]))||!hash(scope.manifestHash)||kind==='review'&&!id(scope.operationId)||!Array.isArray(items)||items.length!==targets.length)fail('FULL_STUDY_BATCH_CHANGED');
 for(let i=0;i<targets.length;i++){const t=targets[i],x=items[i];if(!x||Object.keys(t).some(k=>x[k]!==t[k])||x.runId!==null&&!id(x.runId)||typeof x.executionConfirmed!=='boolean'||!['processing','completed','failed'].includes(x.status)||x.executionConfirmed&&(!x.runId||x.status==='processing')||!x.executionConfirmed&&x.status==='completed')fail('FULL_STUDY_BATCH_CHANGED');}
 const confirmed=items.every(x=>x.executionConfirmed),status=confirmed?items.some(x=>x.status==='failed')?'failed':'completed':'processing';
 return{version:BATCH_VERSION,kind,...scope,targets,targetsHash:fullStudyHash(targets),items:structuredClone(items),status,executionConfirmed:confirmed};
}
