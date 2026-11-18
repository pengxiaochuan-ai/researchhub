import {researchError} from '../research-studies/contract.mjs';
import {sliceManifest as nativeSliceManifest} from './full-study-analysis.mjs';
import {assertApprovedInTransaction} from '../admission/service.mjs';

const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const changed=()=>{throw researchError(409,'ANALYSIS_JOB_BINDING_CHANGED','原分析来源或授权绑定不可核对。');};
const unavailable=()=>{throw researchError(503,'ANALYSIS_JOB_AUTHORITY_UNAVAILABLE','当前后台分析权限暂不可核对。');};
export const executionJobAuthorityRepository=Object.freeze({
 children:(tx,s,studyId,planId,rootSnapshotId)=>tx.$queryRaw`SELECT id,review_id,manifest,manifest_hash FROM rh_analysis.snapshot WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId} AND plan_id=${planId} AND manifest->>'rootSnapshotId'=${rootSnapshotId} ORDER BY id`,
});

/** Raw services from one trusted factory; never the public dispatch proxy. */
export function createExecutionJobAuthority({ordinary,full,hash,sliceManifest=nativeSliceManifest}={}){
 if(![ordinary,full].every(b=>typeof b?.analysis?.assertCurrent==='function'&&typeof b?.core?.authorize==='function'&&typeof b?.methods?.authorizeDescriptiveJobOperatorInTransaction==='function')||typeof full.isTarget!=='function'||typeof hash!=='function'||typeof sliceManifest!=='function')unavailable();
 function selected(actor,s){
  const scope={tenantId:s?.tenantId,studyGroupId:s?.studyGroupId,researchProjectId:s?.researchProjectId};if(!Object.values(scope).every(identifier)||!identifier(s?.studyId)||!identifier(actor?.accountId)||actor.tenantId!==scope.tenantId||!Number.isSafeInteger(actor.authVersion)||actor.authVersion<0)changed();
  const target=full.isTarget(s.studyId);if(typeof target!=='boolean')unavailable();return{scope,branch:target?full:ordinary,kind:target?'full':'ordinary'};
 }
 return Object.freeze({
  async resolveFixedBasisInTransaction(tx,actor,s,snapshotId){
   const{scope,branch,kind}=selected(actor,s);if(!identifier(snapshotId))changed();const current=await branch.analysis.assertCurrent(tx,actor,scope,s.studyId,snapshotId,'snapshot'),b=current?.basis,m=current?.manifest;
   if(!b||!m||b.studyId!==s.studyId||b.snapshotId!==snapshotId||![b.planId,b.planReviewId].every(identifier)||!digest(b.manifestHash)||m.studyId!==s.studyId||!m.scope||hash(m.scope)!==hash(scope)||hash(m)!==b.manifestHash)changed();
   if(m.schemaVersion==='full-study-simulation-slice-v2')throw researchError(409,'ANALYSIS_JOB_FULL_ROOT_REQUIRED','请返回整课题分析，单项切片不能独立发起后台任务。');
   const basis={branch:kind,snapshotId,planId:b.planId,reviewId:b.planReviewId,manifestHash:b.manifestHash};
   if(kind==='ordinary'){if(m.schemaVersion!=='t15-formal-projection-v1')changed();return basis;}
   if(m.schemaVersion!=='full-study-simulation-root-v2'||!Array.isArray(m.slices))changed();const ready=m.slices.filter(v=>v.status==='ready');
   if(!ready.length)throw researchError(409,'ANALYSIS_JOB_NO_READY_TARGETS','当前放行记录没有适用的可计算目标。');
   if(ready.some(v=>!identifier(v.sliceId))||new Set(ready.map(v=>v.sliceId)).size!==ready.length)changed();
   const children=await executionJobAuthorityRepository.children(tx,scope,s.studyId,b.planId,snapshotId);if(!Array.isArray(children)||children.length!==ready.length)changed();
   const slices=ready.map(slice=>{const rows=children.filter(row=>row.manifest?.sliceId===slice.sliceId);if(rows.length!==1)changed();const row=rows[0],expected=sliceManifest(m,slice,{rootSnapshotId:snapshotId,rootManifestHash:b.manifestHash});if(!identifier(row.id)||row.id===snapshotId||row.review_id!==b.planReviewId||!digest(row.manifest_hash)||hash(row.manifest)!==row.manifest_hash||hash(expected)!==row.manifest_hash)changed();return{sliceId:slice.sliceId,snapshotId:row.id};});
   if(new Set(slices.map(v=>v.snapshotId)).size!==slices.length)changed();return{...basis,slices};
  },
  async authorizeOperatorInTransaction(tx,actor,s){const{scope,branch}=selected(actor,s),user=actor.studyGroupId===scope.studyGroupId&&actor.researchProjectId===scope.researchProjectId?actor:{...actor,...scope};return branch.methods.authorizeDescriptiveJobOperatorInTransaction(tx,user);},
  async authorizeCancellationInTransaction(tx,actor,s,row){
   const{scope,branch,kind}=selected(actor,s);if(!row||row.tenant_id!==scope.tenantId||row.study_group_id!==scope.studyGroupId||row.research_project_id!==scope.researchProjectId||row.study_id!==s.studyId||row.branch!==kind||!row.operator_ref)changed();
   const current=await branch.core.authorize(tx,actor,scope,s.studyId);if(!current||current.accountId!==actor.accountId||current.authVersion!==actor.authVersion||Object.entries(scope).some(([k,v])=>current[k]!==v))throw researchError(401,'AUTH_SESSION_EXPIRED','当前身份已变化，请重新登录后查看原任务。');
   const ref=await branch.methods.authorizeDescriptiveJobOperatorInTransaction(tx,current,row.operator_ref);if(!ref||hash(ref)!==hash(row.operator_ref))changed();return current;
  },
 });
}

/** Job fence/stamp first, current Hub admission second, within the identical physical tx. */
export function guardJobAdmission(adapter,assertApproved=assertApprovedInTransaction){
 if(!['beforeLocks','verify','beforeDispatch','bind','outcome'].every(k=>typeof adapter?.[k]==='function')||typeof adapter?.capabilities?.read!=='function'||typeof assertApproved!=='function')unavailable();
 return Object.freeze({capabilities:adapter.capabilities,async beforeLocks(tx,user,operation){const result=await adapter.beforeLocks(tx,user,operation);await assertApproved(tx,user);return result;},verify:adapter.verify,beforeDispatch:adapter.beforeDispatch,bind:adapter.bind,outcome:adapter.outcome});
}
