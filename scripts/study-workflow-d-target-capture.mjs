// Reusable preservation helper; generated evidence is kept outside version control.
// Synthetic target evidence capture only. No I/O at import, no mutation methods.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureWF04Protection} from './study-workflow-wf04-preserve.mjs';
import {captureWF05Protection} from './study-workflow-wf05-preserve.mjs';
import {wf07SupplementTables} from './study-workflow-wf07-qa.mjs';
import {readProtection,compareProtection} from './visit-workflow-preserve.mjs';
const root='/Users/mac/aisciencesys/',evidence=root+'researchhub/docs/testing/evidence/study-workflow-simplification-2026-11-17/';
export async function captureDTargetProtection(h,{phase,registeredActors}={}){
 assert(['before','after'].includes(phase));
 const cases=JSON.parse(readFileSync(evidence+'wf04/execution-manifest-v2.json')).cases,originalScience=JSON.parse(readFileSync(root+'.tmp/study-workflow-simplification-2026-11-17/wf04/protection-before-v2.json')).science;
 const strict=await captureWF05Protection({h,cases,originalScience,readProtection,compareProtection,registeredActors,phase,clock:()=>new Date(),dependencies:{captureWF04Protection},env:{STUDY_WORKFLOW_WF05_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'}});
 const rest=await h.read(async tx=>{
  const seven={},extra={};for(const d of wf07SupplementTables)seven[d.table]=await tx.$queryRawUnsafe(d.sql,h.runtime.ids.tenant);
  for(const table of ['agent_access','skill_assignment'])extra['public.'+table]=await tx.$queryRawUnsafe('SELECT id,md5(row_to_json(t)::text) AS hash FROM public.'+table+' t WHERE "tenantId"=$1 ORDER BY id',h.runtime.ids.tenant);
  extra['rh_analysis.execution_job']=await tx.$queryRaw`SELECT id,md5(row_to_json(t)::text) AS hash FROM rh_analysis.execution_job t WHERE tenant_id=${h.runtime.ids.tenant} ORDER BY id`;
  return{seven,extra};
 });return{strict,...rest};
}
