// Actual bounded role checks against this synthetic run; no authorised mutation is sent.
import assert from 'node:assert/strict';
import {openHarness,json,save,privateDir,evidenceDir} from './full-study-runtime.mjs';
const h=await openHarness(),b=json(privateDir+'bootstrap.json'),ident=json(privateDir+'identities.json'),j=json(privateDir+'analysis-corrected-journal.json');
assert(j.runGroupId&&j.snapshotId);
const A='/research-studies/'+b.study.id+'/analysis',groupPath=A+'/runs/'+j.runGroupId;
try{
 const before=await h.read(tx=>tx.auditLog.count({where:{...b.scope,action:'researchhub.full.analysis.run.cancel',target:j.runGroupId}}));
 await h.loginActor(ident.accounts.manager);
 const group=await h.get(groupPath);
 assert.equal(group.id,j.runGroupId);assert.equal(group.snapshotId,j.snapshotId);assert(group.slices.some(s=>s.summary));
 assert.deepEqual(group.capabilities,{canReview:false,canCancel:false,canProcessRun:false});
 const cancel=await h.request(groupPath+'/cancel',{method:'POST',body:{},status:403});
 assert.equal(cancel.value.code,'FULL_STUDY_RUN_ACTOR_CHANGED');
 await h.loginActor(ident.accounts.reviewer);
 const phase=await h.request(A+'/snapshots/'+j.snapshotId+'?phase=export',{status:403});
 assert.equal(phase.value.code,'FULL_STUDY_FORBIDDEN');
 const after=await h.read(tx=>tx.auditLog.count({where:{...b.scope,action:'researchhub.full.analysis.run.cancel',target:j.runGroupId}}));assert.equal(after,before);
 save(evidenceDir+'analysis-reader-capability-result.json',{passed:true,studyId:b.study.id,runGroupId:j.runGroupId,observedGroupStatus:group.status,readerActor:ident.accounts.manager.id,capabilities:group.capabilities,actualSummaryCount:group.slices.filter(s=>s.summary).length,nonActorCancelCode:cancel.value.code,publicPhaseCannotGrantExport:phase.value.code,cancelAuditsBefore:before,cancelAuditsAfter:after,network:h.network,at:new Date().toISOString()});
 console.log(JSON.stringify({passed:true,actualSummaryCount:group.slices.filter(s=>s.summary).length,capabilities:group.capabilities,cancelAuditUnchanged:true}));
}catch(e){save(evidenceDir+'analysis-reader-capability-final-failure.json',{message:String(e.message),network:h.network,at:new Date().toISOString()});throw e;}
