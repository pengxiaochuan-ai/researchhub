import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHash as hash} from '../research-studies/contract.mjs';
import {createExecutionJobPresenter} from './execution-job-view.mjs';

function fixture(){
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project',studyId:'study'},nativeScope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},reader={...nativeScope,accountId:'admin-reader',authVersion:5};
 const operator={agentId:'agent',skillId:'skill',skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'descriptive-v1',configurationHash:'a'.repeat(64)};
 const targets=['needs_input','running','failed',null].map((status,i)=>({targetId:'slice-'+i,sliceId:'slice-'+i,snapshotId:'snapshot-'+i,methodKey:'method-key-'+i,runId:status?'run-'+i:null,inputHash:status?hash({i}):null}));
 const row={id:'job',tenant_id:'tenant',study_group_id:'group',research_project_id:'project',study_id:'study',actor_id:'researcher-author',actor_auth_version:0,status:'running',branch:'full',snapshot_id:'root-snapshot',plan_id:'plan',manifest_hash:'b'.repeat(64),operator_ref:operator,operator_hash:hash(operator),checkpoint:{version:1,targets,runGroupId:'run-group',pending:null,finishedClaimIds:[]},created_at:new Date('2026-11-18T00:00:00Z'),cancellation_id:null,error_code:null,lease_token:'PRIVATE_JOB_TOKEN',lease_owner:'PRIVATE_JOB_OWNER'};
 const runs=targets.filter(t=>t.runId).map((t,i)=>({runId:t.runId,...nativeScope,accountId:row.actor_id,agentId:operator.agentId,skillKey:'descriptive-statistics',skillVersion:1,executorVersion:operator.executorVersion,sessionId:'session',studyId:'study',snapshotId:t.snapshotId,methodKey:t.methodKey,inputHash:t.inputHash,status:['needs_input','running','failed'][i],claim:i===0?'native-claim':null,marker:{version:1,jobId:row.id,targetId:t.targetId,bindingHash:hash({jobId:row.id,targetId:t.targetId,scope:nativeScope,studyId:'study',snapshotId:t.snapshotId,methodKey:t.methodKey,operator})},outputs:{privateClinicalValue:'NOT_PUBLIC'}}));
 const h={scope,reader,row,runs,publications:[{id:'publish-audit',runId:'run-0',claim:'native-claim'}],permissionCalls:0,metadataReads:0,publicationReads:0,available:true,permissionError:null};
 h.options={hash,availability:()=>h.available,authorizeCancellationInTransaction:async(_tx,u,s,r)=>{h.permissionCalls++;assert.equal(u.accountId,reader.accountId);assert.deepEqual(s,scope);assert.equal(r,row);if(h.permissionError)throw h.permissionError;},repository:{nativeMetadata:async(_tx,s,ids)=>{h.metadataReads++;assert.deepEqual(s,nativeScope);return h.runs.filter(r=>ids.includes(r.runId));},publicationProofs:async(_tx,s,u,ids)=>{h.publicationReads++;assert.deepEqual(s,nativeScope);assert.equal(u,row.actor_id);return h.publications.filter(p=>ids.includes(p.runId));}}};
 h.present=()=>createExecutionJobPresenter(h.options)({},reader,scope,row);return h;
}
test('progress uses original author publications, preserves needs_input, and exposes no execution secrets or values',async()=>{
 const h=fixture(),v=await h.present();assert.deepEqual(v.progress,{total:4,published:1,unfinished:2,failed:1,cancelled:0,needsInput:1});assert.deepEqual(v.capabilities,{canRequestCancellation:true});assert.equal(v.serviceAvailable,true);assert.equal(v.issue,null);assert.equal(h.permissionCalls,1);assert.equal(h.metadataReads,1);assert.equal(h.publicationReads,1);for(const text of ['PRIVATE_JOB_TOKEN','PRIVATE_JOB_OWNER','NOT_PUBLIC','configurationHash','native-claim'])assert(!JSON.stringify(v).includes(text));
});
test('a queued job needs no Run, remains stoppable while the consumer is unavailable, and never invents publication',async()=>{
 const h=fixture();h.row.branch='ordinary';h.row.checkpoint.targets=[{targetId:'ordinary',snapshotId:'root-snapshot',methodKey:'root-native-key',runId:null,inputHash:null}];h.row.checkpoint.runGroupId=null;h.row.status='queued';h.available=false;h.runs=[];const v=await h.present();assert.deepEqual(v.progress,{total:1,published:0,unfinished:1,failed:0,cancelled:0,needsInput:0});assert.equal(v.serviceAvailable,false);assert.equal(v.capabilities.canRequestCancellation,true);assert.equal(h.metadataReads,0);assert.equal(h.publicationReads,0);
});
test('read permission does not grant cancellation; database failures are not disguised as a denied permission',async()=>{
 const h=fixture();h.permissionError=Object.assign(Error('denied'),{status:403});assert.equal((await h.present()).capabilities.canRequestCancellation,false);h.permissionError=Object.assign(Error('database failed'),{code:'P2010'});await assert.rejects(h.present(),e=>e.code==='P2010');
});
test('missing Run, wrong scope, copied marker, wrong claim, and duplicate publication fail closed',async()=>{
 const mutations=[h=>h.runs.pop(),h=>h.runs[0].researchProjectId='other',h=>h.runs[0].marker.targetId='other',h=>h.publications[0].claim='wrong-claim',h=>h.publications.push({...h.publications[0],id:'duplicate'}),h=>h.publications=[]];
 for(const mutate of mutations){const h=fixture();mutate(h);await assert.rejects(h.present(),e=>e.status===409&&e.code==='ANALYSIS_JOB_PROGRESS_CHANGED');}
});
test('terminal facts do not advertise a second stop and untrusted error text is replaced with a safe reason',async()=>{
 const h=fixture();h.row.status='blocked';h.row.error_code='password=DO_NOT_EXPOSE';const v=await h.present();assert.equal(v.capabilities.canRequestCancellation,false);assert.equal(h.permissionCalls,0);assert.equal(v.issue.code,'ANALYSIS_JOB_NOT_COMPLETED');assert(!JSON.stringify(v).includes('DO_NOT_EXPOSE'));assert.equal(v.progress.unfinished,2);
});
test('cross-Study presentation and nonboolean service availability are refused',async()=>{
 const h=fixture();await assert.rejects(createExecutionJobPresenter(h.options)({},h.reader,{...h.scope,studyId:'other'},h.row),e=>e.status===409);h.available=undefined;await assert.rejects(h.present(),e=>e.status===503);assert.equal(h.permissionCalls,0);
});
test('unbound target identifiers and a missing Native marker cannot be counted as valid progress',async()=>{
 for(const change of [h=>h.row.checkpoint.targets[3].targetId='invalid/id',h=>h.row.checkpoint.targets[3]=null,h=>delete h.runs[0].marker]){
  const h=fixture();change(h);await assert.rejects(h.present(),e=>e.status===409&&e.code==='ANALYSIS_JOB_PROGRESS_CHANGED');
 }
});
