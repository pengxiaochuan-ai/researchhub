// Pure comparison/entry guards only. No fixture, PG, target, credential or file I/O is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseMutableColumns,normalizedProtocolTargets,captureWF03Protection,compareWF03Protection} from './study-workflow-wf03-preserve.mjs';
const windows={STUDY_WORKFLOW_WF03_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
const scienceCompare=(a,b)=>assert.deepEqual(b,a,'ORIGINAL_SCIENCE_CHANGED');
const row=(id,extra={})=>({id,hash:'full-'+id,...extra});
const scoped=(protocolId,extra={})=>({studyGroupId:'group-'+protocolId,researchProjectId:'project-'+protocolId,...extra});
function snapshots(){
 const before={schema:1,task:'WF03',phase:'before',tenantId:'synthetic-tenant',targetProtocolIds:['A','B','D'],readOnly:true,wf02AdmissionVerified:true,science:{word:{hash:'original-word'},runsHash:'original-science'},
  immutable:{'public.account':[row('account')],'public.form_version':[row('fixed-form')],'public.visit_plan':[row('fixed-plan')],'rh_research.study_binding':[row('study-binding')]},
  protocols:['A','B','D',...Array.from({length:24},(_,i)=>'source-'+i)].map(id=>row(id,{stableHash:'stable-'+id,status:['A','B','D'].includes(id)?'draft':'executing',...scoped(id)})),
  append:{'public.study_execution_policy_version':[row('old-policy',{protocolId:'source-0',...scoped('source-0')})],'public.protocol_release_check':[row('old-check',{protocolId:'source-0',...scoped('source-0')})],'public.protocol_release_check_finding':[row('old-finding',{checkId:'old-check',...scoped('source-0')})],
   'public.remediation_case':[row('old-case',{sourceType:'protocol_release_finding',sourceId:'source-0',affectedId:'source-0',affectedType:'study_protocol',...scoped('source-0')})],'public.remediation_attempt':[row('old-attempt',{caseId:'old-case',...scoped('source-0')})],'public.remediation_event':[row('old-event',{caseId:'old-case',...scoped('source-0')})],
   'rh_research.operation':[row('wf02-import',{protocolId:'A',action:'protocol.template.import'})],'public.audit_log':[row('wf02-audit',{target:'A',action:'researchhub.protocol.template.import'})]}};
 const after=structuredClone(before);after.phase='after';after.wf02AdmissionVerified=false;Object.assign(after.protocols[0],{hash:'changed-native-release-row',status:'executing'});
 after.append['public.study_execution_policy_version'].push(row('new-policy',{protocolId:'A',...scoped('A')}));after.append['public.protocol_release_check'].push(row('new-check',{protocolId:'A',...scoped('A')}));after.append['public.protocol_release_check_finding'].push(row('new-finding',{checkId:'new-check',...scoped('A')}));
 after.append['public.remediation_case'].push(row('new-case',{sourceType:'protocol_release_finding',sourceId:'A',affectedId:'A',affectedType:'study_protocol',...scoped('A')}));for(const table of ['public.remediation_attempt','public.remediation_event'])after.append[table].push(row('new-'+table,{caseId:'new-case',...scoped('A')}));
 after.append['rh_research.operation'].push(row('wf03-operation',{protocolId:'A',action:'protocol.approve'}));after.append['public.audit_log'].push(row('new-core-audit',{target:'A',action:'study_protocol_approve'}),row('auth-audit',{target:'account',action:'auth-login'}));return{before,after};
}
const compare=(before,after)=>compareWF03Protection(before,after,{compareProtection:scienceCompare});
test('target normalization requires exactly three distinct A/B/D IDs; release whitelist is exact',()=>{
 assert.deepEqual(normalizedProtocolTargets({A:'pa',B:'pb',D:'pd'}),['pa','pb','pd']);assert.deepEqual(normalizedProtocolTargets(['pd','pa','pb']),['pa','pb','pd']);
 for(const ids of [{A:'a',B:'b',C:'c'},['a','b','b'],['a','b','c','d']])assert.throws(()=>normalizedProtocolTargets(ids));
 assert.deepEqual(releaseMutableColumns,['status','approvedBy','lockedAt','approvedPolicyVersionId','approvedPolicyHash','effectiveFrom','effectiveTo','supersededById','updatedAt']);
});
test('capture refuses missing window or accepted admission before any root h.read/science callback',async()=>{
 let calls=0;const h={runtime:{ids:{tenant:'synthetic-tenant'}},read:()=>{calls++;}};
 await assert.rejects(captureWF03Protection(h,['A','B','D'],{env:{}}),/ROOT_WF03/);
 await assert.rejects(captureWF03Protection(h,['A','B','D'],{env:windows,originalScience:{},readProtection:()=>{calls++;},compareProtection:()=>{calls++;}}),/ADMISSION_REQUIRED/);assert.equal(calls,0);
});
test('only named target release changes and correctly linked new rows pass; source 24 stays full-row protected',async()=>{
 const {before,after}=snapshots(),result=await compare(before,after);assert.equal(result.passed,true);assert.equal(result.protectedNonTargetProtocols,24);assert.equal(result.addedCounts['public.audit_log'],2);assert.equal(result.newOperations.length,1);assert.equal(result.newOperations[0].targetId,'A');assert.equal(result.globalAuditDeltaIsBusinessCount,false);assert.equal(result.businessOperationBudgetVerified,false);
});
test('source full hash, target stable hash, protocol count and immutable full row/count drift all fail',async()=>{
 for(const change of [a=>a.protocols.find(p=>p.id==='source-0').hash='changed-source',a=>a.protocols[0].stableHash='changed-science',a=>a.protocols.push(row('extra-protocol')),a=>a.protocols.splice(4,1),a=>a.immutable['public.form_version'][0].hash='changed',a=>a.immutable['public.form_version'].push(row('new-form')),a=>a.immutable['public.account'].push(row('new-account')),a=>a.immutable['rh_research.study_binding']=[]]){const {before,after}=snapshots();change(after);await assert.rejects(compare(before,after));}
});
test('all existing policy/check/finding/remediation/operation/audit rows remain immutable',async()=>{
 for(const table of Object.keys(snapshots().before.append))for(const deleted of [false,true]){const {before,after}=snapshots();if(deleted)after.append[table].shift();else after.append[table][0].hash='changed-old-row';await assert.rejects(compare(before,after));}
});
test('new policies/checks/operations cannot escape current targets and new findings need real target check',async()=>{
 for(const change of [a=>a.append['public.study_execution_policy_version'][1].protocolId='source-0',a=>a.append['public.protocol_release_check'][1].protocolId='source-0',a=>a.append['rh_research.operation'][1].protocolId='source-0',a=>a.append['public.protocol_release_check_finding'][1].checkId='old-check',a=>a.append['public.protocol_release_check_finding'][1].checkId='missing',a=>a.append['public.study_execution_policy_version'][1].researchProjectId='other-project']){const {before,after}=snapshots();change(after);await assert.rejects(compare(before,after));}
});
test('new remediation chains must identify the same target Protocol and matching scope',async()=>{
 for(const change of [a=>a.append['public.remediation_case'][1].sourceType='other-source',a=>a.append['public.remediation_case'][1].affectedId='source-0',a=>a.append['public.remediation_case'][1].sourceId='source-0',a=>a.append['public.remediation_attempt'][1].caseId='old-case',a=>a.append['public.remediation_event'][1].caseId='missing',a=>a.append['public.remediation_event'][1].studyGroupId='other-group']){const {before,after}=snapshots();change(after);await assert.rejects(compare(before,after));}
});
test('unadmitted/rolled baselines, changed targets and original scientific/Word drift are rejected',async()=>{
 for(const change of [b=>b.wf02AdmissionVerified=false,b=>b.phase='after']){const {before,after}=snapshots();change(before);await assert.rejects(compare(before,after));}
 for(const change of [a=>a.targetProtocolIds=['A','B','source-0'],a=>a.science.word.hash='changed-word']){const {before,after}=snapshots();change(after);await assert.rejects(compare(before,after));}
});
