export const FULL_STUDY_SCHEMA='full-study-simulation-v2';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function fullStudyDefinition(config,{sapVersion,variableMapVersion,reason}){const c=config?.caseMetadata;if(!c||![c.caseId,c.protocolVersionId,sapVersion,variableMapVersion].every(id)||!reason?.trim())throw Error('请填写计划版本和核对理由。');return{schemaVersion:FULL_STUDY_SCHEMA,caseId:c.caseId,protocolVersionId:c.protocolVersionId,sapVersion,variableMapVersion,reason:reason.trim()};}
export function validFullStudyGroup(g,studyId){return g?.studyId===studyId&&id(g.id)&&g.runGroupId===g.id&&hash(g.stateHash)&&Number.isSafeInteger(g.remaining)&&g.remaining>=0&&Array.isArray(g.slices)&&typeof g.capabilities?.canReview==='boolean'&&typeof g.capabilities?.canCancel==='boolean';}
export function createFullStudyCommands({request,key=()=>crypto.randomUUID(),onPending=()=>{}}){let pending=null;async function execute(){const operation=pending;try{const value=await request(operation.path,{method:'POST',body:operation.body});if(pending===operation){pending=null;onPending(null);}return value;}catch(error){if(error.code==='FULL_STUDY_PROCESS_PENDING')error.unknown=true;if(!error.unknown&&pending===operation){pending=null;onPending(null);}throw error;}}return{pending:()=>pending,clear(){pending=null;onPending(null);},restore(value){if(value&&typeof value.path==='string'&&value.body?.requestKey){pending=value;onPending(value);}},async send(path,body){if(pending)throw Error('请先核对上次操作结果。');pending={path,body:{...structuredClone(body),requestKey:key()}};onPending(pending);return execute();},async retry(){if(!pending)throw Error('没有待核对的操作。');return execute();}};}
export async function processFullStudyGroup(initial,process,onProgress=()=>{},isCurrent=()=>true){let current=initial;if(!validFullStudyGroup(current,current?.studyId))throw Error('运行状态暂不可核对。');while(current.remaining>0){if(!isCurrent())throw Error('当前操作已停止，请重新核对。');if(current.capabilities.canProcessRun!==true)throw Error('当前暂无继续计算权限，请重新核对。');if(['blocked','failed','cancelled'].includes(current.status))throw Error('本次运行需处理失败后再继续。');const next=await process({expectedStateHash:current.stateHash,limit:fullStudyBatchLimit(current)});if(!isCurrent())throw Error('当前操作已停止，请重新核对。');if(!validFullStudyGroup(next,current.studyId)||next.id!==current.id)throw Error('运行结果不属于当前研究。');onProgress(next);if(next.remaining>=current.remaining)throw Error('本次未推进，请核对运行状态后再继续。');current=next;}return current;}
export function validFullStudyPlan(plan,studyId,planId){return plan?.studyId===studyId&&plan.planId===planId&&id(planId)&&plan.definition?.schemaVersion===FULL_STUDY_SCHEMA&&id(plan.definition.caseId)&&id(plan.definition.protocolVersionId)&&hash(plan.contentHash)&&['canSubmitPlan','canReviewPlan','canReleaseSnapshot'].every(k=>typeof plan.capabilities?.[k]==='boolean')&&Array.isArray(plan.snapshots)&&plan.snapshots.every(s=>id(s.snapshotId)&&hash(s.manifestHash))&&(plan.review===null||id(plan.review?.reviewId)&&Number.isSafeInteger(plan.review.sequence)&&['approved','revoked'].includes(plan.review.decision));}
export function validFullStudyPreview(value,plan){const m=value?.manifest;return value?.studyId===plan?.studyId&&value.planId===plan.planId&&hash(value.manifestHash)&&m?.schemaVersion==='full-study-simulation-root-v2'&&m.studyId===plan.studyId&&m.analysisPlan?.id===plan.planId&&m.analysisPlan.contentHash===plan.contentHash&&m.analysisPlan.reviewId===plan.review?.reviewId&&Array.isArray(m.slices)&&Number.isSafeInteger(value.evaluation?.blockingCount)&&value.evaluation.blockingCount>=0;}
export async function readFullStudyStage(request,permissionRequest,studyId){const data=await request('/research-studies/'+studyId+'/simulation/context');if(data.studyId!==studyId)throw Error('模拟阶段不属于当前研究。');if(!data.simulation)return{simulation:null,canAdvance:false};let canAdvance=false;try{const config=await permissionRequest('/research-studies/'+studyId+'/analysis/configuration');canAdvance=config.studyId===studyId&&config.schemaVersion===FULL_STUDY_SCHEMA&&config.capabilities?.canSubmitPlan===true;}catch(error){if(error.status===401||error.stale)throw error;}return{simulation:data.simulation,canAdvance};}

export function canStartFullStudyGroup(view,capabilities){return !!view?.snapshotId&&!view.group&&!view.sourceError&&capabilities?.canCreateRun===true;}
export const FULL_STUDY_SOURCE_MESSAGE='数据依据变化，请预览最新来源并重新放行';
const sourceErrors=new Set(['ANALYSIS_BASIS_STALE','ANALYSIS_SOURCE_CHANGED','ANALYSIS_SOURCE_NOT_REVIEWED','SOURCE_NOT_LOCKED','FULL_STUDY_VISIT_CHANGED','FULL_STUDY_SOURCE_NOT_LOCKED','FULL_STUDY_SOURCE_CHANGED','FULL_STUDY_FORM_CHANGED','FULL_STUDY_SCORE_ALGORITHM_CHANGED','FULL_STUDY_SLICE_CHANGED','FULL_STUDY_ENROLLMENT_CHANGED']);
export const isFullStudySourceError=error=>error?.status===409&&sourceErrors.has(error.code);
function latest(items=[]){return items.reduce((chosen,item)=>!chosen||(Date.parse(item.createdAt)||0)>(Date.parse(chosen.createdAt)||0)?item:chosen,null);}
export function selectFullStudySources({route={},selection=null,plans,runs,group,plan}){
 const chosen=selection??route;
 const explicitPlan=!!chosen.planId,explicitSnapshot=!!chosen.snapshotId;
 const runGroupId=Object.hasOwn(chosen,'runGroupId')?chosen.runGroupId:explicitPlan||explicitSnapshot||chosen.jobId?null:latest(runs?.items)?.id??null;
 const metadata=group??runs?.items?.find(g=>g.id===runGroupId);
 if(runGroupId&&metadata&&(chosen.planId&&chosen.planId!==metadata.planId||chosen.snapshotId&&chosen.snapshotId!==metadata.snapshotId))throw Error('运行与所选计划或快照不匹配，请从原来源重新进入。');
 return{runGroupId,planId:chosen.planId??metadata?.planId??latest(plans?.items)?.planId??null,snapshotId:chosen.snapshotId??metadata?.snapshotId??null};
}
async function embeddedFullStudySource(group,plan,selected,studyId){
 const value=group?.sourceSnapshot;if(value===undefined)return null;
 const mismatch=()=>Object.assign(Error('运行附带来源与当前研究、计划或快照不匹配，请重新核对。'),{status:409,code:'FULL_STUDY_EMBEDDED_SOURCE_MISMATCH'});
 if(value===null||typeof value!=='object'||Array.isArray(value))throw mismatch();
 const b=value.basis,m=value.manifest,q=value.qualityGate;
 for(const part of [b,m,q])if(part!==undefined&&part!==null&&(typeof part!=='object'||Array.isArray(part)))throw mismatch();
 const checks=[[group.studyId,studyId],[group.planId,selected.planId],[group.snapshotId,selected.snapshotId],[b?.studyId,studyId],[b?.planId,selected.planId],[b?.snapshotId,selected.snapshotId],[b?.manifestHash,group.manifestHash],[b?.planReviewId,plan?.review?.reviewId],[m?.studyId,studyId],[m?.schemaVersion,'full-study-simulation-root-v2'],[m?.analysisPlan?.id,selected.planId],[m?.analysisPlan?.reviewId,plan?.review?.reviewId],[m?.analysisPlan?.contentHash,plan?.contentHash],[q?.manifestHash,group.manifestHash],[q?.status,'released']];
 if(checks.some(([actual,expected])=>actual!==undefined&&actual!==expected)||m?.slices!==undefined&&!Array.isArray(m.slices)||b?.qualityGateId!==undefined&&!id(b.qualityGateId)||q?.id!==undefined&&!id(q.id)||b?.qualityGateVersion!==undefined&&b.qualityGateVersion!==1||q?.version!==undefined&&q.version!==1)throw mismatch();
 if(b?.qualityGateId!==undefined&&q?.id!==undefined&&b.qualityGateId!==q.id||b?.qualityGateVersion!==undefined&&q?.version!==undefined&&b.qualityGateVersion!==q.version)throw mismatch();
 if(checks.some(([actual])=>actual===undefined)||!b?.qualityGateId||!Number.isSafeInteger(b?.qualityGateVersion)||q?.id===undefined||q?.version===undefined||!Array.isArray(m?.slices))throw mismatch();
 if(!hash(group.manifestHash)||await fullStudyInputHash(m)!==group.manifestHash)throw mismatch();
 return value;
}
export async function readFullStudyView({request,base,studyId,route,selection=null,previous=null}){
 const [plans,runs]=await Promise.all([request(base+'/plans?limit=20'),request(base+'/runs')]);
 let selected=selectFullStudySources({route,selection,plans,runs}),group=null,snapshot=null,sourceError=null;
 const recover=error=>{if(!isFullStudySourceError(error))throw error;sourceError={code:error.code,message:FULL_STUDY_SOURCE_MESSAGE};};
 if(selected.runGroupId)try{group=await request(base+'/runs/'+selected.runGroupId);if(!validFullStudyGroup(group,studyId)||group.id!==selected.runGroupId)throw Error('整课题运行暂不可核对。');}catch(error){recover(error);}
 if(sourceError&&selected.runGroupId&&!runs.items?.some(g=>g.id===selected.runGroupId))throw Object.assign(Error('旧运行的所属计划暂不可核对，请从原计划重新进入。'),{status:409,code:sourceError.code});
 selected=selectFullStudySources({route,selection,plans,runs,group});
 const plan=selected.planId?await request(base+'/plans/'+selected.planId+'?limit=20'):null;
 if(plan&&!validFullStudyPlan(plan,studyId,selected.planId))throw Error('当前计划与研究不匹配，请重新核对。');
 if(sourceError&&!plan)throw Error('旧来源的分析计划暂不可核对。');
 selected=selectFullStudySources({route,selection,plans,runs,group,plan});
 if(selected.snapshotId&&!sourceError)try{snapshot=await embeddedFullStudySource(group,plan,selected,studyId)??await request(base+'/snapshots/'+selected.snapshotId);if(snapshot.basis?.studyId!==studyId||snapshot.basis?.snapshotId!==selected.snapshotId||snapshot.basis?.planId!==selected.planId||snapshot.manifest?.schemaVersion!=='full-study-simulation-root-v2')throw Error('快照不属于当前研究与计划。');}catch(error){recover(error);}
 return{plans,runs,plan,snapshotId:selected.snapshotId,snapshot:sourceError?null:snapshot,group:sourceError?null:group,selection:selected,sourceError,preview:!sourceError&&previous?.plan?.planId===plan?.planId?previous.preview:null};
}

const markerActions=['create','process','review','reviewStep','reviewOperation','planSubmit','planReview','snapshot','cancel','legacyReview'];
export const fullStudyBatchLimit=value=>value?.batching?.version==='full-study-batch-v1'&&value.batching.maxItems===3?3:1;
export const fullStudyProcessInput=m=>({expectedStateHash:m.expectedStateHash,limit:m.version===2?m.limit:1});
const markerKeys=['version','actor','authVersion','studyId','snapshotId','manifestHash','action','targetId','requestKey','operationId','parentKey','expectedStateHash','expectedSequence','planId','parentInputHash','inputHash'];
const canonicalInput=v=>Array.isArray(v)?v.map(canonicalInput):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonicalInput(v[k])])):v;
export async function fullStudyInputHash(body){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonicalInput(body)))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function createFullStudyMarker(scope,action,targetId,body,requestKey,extra={}){return{version:1,...(['process','reviewStep'].includes(action)&&body.limit===3?{version:2,limit:3}:{}),actor:scope.actor,authVersion:scope.authVersion,studyId:scope.studyId,snapshotId:scope.snapshotId??null,manifestHash:scope.manifestHash??null,action,targetId,requestKey,operationId:extra.operationId??null,parentKey:extra.parentKey??null,expectedStateHash:body.expectedStateHash??null,expectedSequence:body.expectedSequence??null,planId:scope.planId??null,parentInputHash:extra.parentInputHash??null,inputHash:await fullStudyInputHash(body)};}
export function validFullStudyMarker(m,scope){return !!m&&Object.keys(m).length===markerKeys.length+(m.version===2?1:0)&&Object.keys(m).every(k=>markerKeys.includes(k)||m.version===2&&k==='limit')&&(m.version===1||m.version===2&&m.limit===3&&id(m.snapshotId)&&hash(m.manifestHash)&&['process','reviewStep'].includes(m.action))&&m.actor===scope.actor&&m.authVersion===scope.authVersion&&m.studyId===scope.studyId&&id(m.actor)&&Number.isSafeInteger(m.authVersion)&&m.authVersion>=0&&id(m.studyId)&&id(m.targetId)&&id(m.requestKey)&&markerActions.includes(m.action)&&hash(m.inputHash)&&(m.snapshotId===null||id(m.snapshotId))&&(m.manifestHash===null||hash(m.manifestHash))&&(m.expectedSequence===null||Number.isSafeInteger(m.expectedSequence)&&m.expectedSequence>=0)&&(m.parentInputHash===null||hash(m.parentInputHash))&&(m.planId===null||id(m.planId))&&(m.expectedStateHash===null||hash(m.expectedStateHash))&&(m.operationId===null||id(m.operationId))&&(m.parentKey===null||id(m.parentKey))&&(!['reviewStep','reviewOperation'].includes(m.action)||id(m.operationId)&&id(m.parentKey));}
export function fullStudyRecoveryPath(m){const base='/research-studies/'+m.studyId+'/analysis';if(m.action==='create')return base+'/run-receipts/'+m.requestKey;if(m.action==='process')return base+'/runs/'+m.targetId+'/process-receipts/'+m.requestKey;if(m.action==='review')return base+'/runs/'+m.targetId+'/review-operation-receipts/'+m.requestKey;if(m.action==='reviewStep')return base+'/runs/'+m.targetId+'/review-operations/'+m.operationId+'/step-receipts/'+m.requestKey;if(m.action==='reviewOperation')return base+'/runs/'+m.targetId+'/review-operations/'+m.operationId;if(m.action==='legacyReview')return base+'/runs/'+m.targetId+'/review-receipts/'+m.requestKey;if(m.action==='cancel')return base+'/runs/'+m.targetId;const action={planSubmit:'full.analysis.plan.submit',planReview:'full.analysis.plan.review',snapshot:'full.analysis.release'}[m.action];if(!action)throw Error('原操作标记无效。');return base+'/receipts/'+m.requestKey+'?'+new URLSearchParams({action,targetId:m.targetId});}
export function validFullStudyReviewOperation(o,scope){const p=o?.progress;return o?.kind==='full-study-review-v1'&&o.studyId===scope.studyId&&(!scope.runGroupId||o.runGroupId===scope.runGroupId)&&(!scope.requestKey||o.requestKey===scope.requestKey)&&(!scope.operationId||o.operationId===scope.operationId)&&(!scope.snapshotId||o.snapshotId===scope.snapshotId)&&(!scope.manifestHash||o.manifestHash===scope.manifestHash)&&[o.operationId,o.runGroupId,o.requestKey,o.snapshotId].every(id)&&hash(o.manifestHash)&&hash(o.stateHash)&&['ready','processing','completed','blocked'].includes(o.status)&&['total','completed','remaining'].every(k=>Number.isSafeInteger(p?.[k])&&p[k]>=0)&&p.completed+p.remaining===p.total&&typeof o.canContinue==='boolean'&&(o.status!=='completed'||p.remaining===0&&!o.canContinue)&&o.receipt?.action==='full.analysis.review.start'&&o.receipt?.requestKey===o.requestKey&&o.receipt?.targetId===o.runGroupId;}
export async function processFullStudyReview(initial,process,onProgress=()=>{},isCurrent=()=>true){let current=initial;if(!validFullStudyReviewOperation(current,current??{}))throw Error('审核操作暂不可核对。');while(current.status==='ready'&&current.canContinue&&current.progress.remaining>0){if(!isCurrent())throw Object.assign(Error('身份或研究已变化。'),{stale:true});const next=await process({expectedStateHash:current.stateHash,limit:fullStudyBatchLimit(current)});if(!isCurrent())throw Object.assign(Error('身份或研究已变化。'),{stale:true});if(!validFullStudyReviewOperation(next,current)||next.progress.total!==current.progress.total||next.progress.completed<current.progress.completed)throw Object.assign(Error('审核结果与原操作不匹配。'),{unknown:true});onProgress(next);if(next.status==='ready'&&next.progress.completed===current.progress.completed)throw Object.assign(Error('本次未推进，请先核对审核进度。'),{unknown:true});current=next;}return current;}
export function validFullStudyProcessReceipt(r,m){return r?.studyId===m.studyId&&r.runGroupId===m.targetId&&r.requestKey===m.requestKey&&['processing','completed','failed'].includes(r.status)&&typeof r.executionConfirmed==='boolean'&&r.receipt?.requestKey===m.requestKey&&r.receipt?.action==='full.analysis.run.process'&&r.receipt?.targetId===m.targetId&&validFullStudyGroup(r.group,m.studyId)&&r.group.id===m.targetId&&(!m.snapshotId||r.group.snapshotId===m.snapshotId)&&(!m.manifestHash||r.group.manifestHash===m.manifestHash);}
export const fullStudyProcessProved=(r,m)=>m.version!==2&&validFullStudyProcessReceipt(r,m)&&r.executionConfirmed===true&&['completed','failed'].includes(r.status);

export function fullStudyReviewStepProved(value,m){return m.version!==2&&validFullStudyReviewOperation(value,{studyId:m.studyId,runGroupId:m.targetId,requestKey:m.parentKey,operationId:m.operationId,snapshotId:m.snapshotId,manifestHash:m.manifestHash})&&value.stepReceipt?.requestKey===m.requestKey&&value.stepReceipt?.executionConfirmed===true&&['completed','failed'].includes(value.stepReceipt?.status)&&id(value.stepReceipt?.runId);}
export async function readFullStudyRecovery(request,marker){return request(fullStudyRecoveryPath(marker),{method:'GET'});}
export const fullStudyMarkerKey=m=>'rh-full-study-pending:'+m.actor+':'+m.authVersion+':'+m.studyId;
export function readStoredFullStudyMarker(storage,scope){try{const saved=JSON.parse(storage.getItem(fullStudyMarkerKey(scope))||'null');return validFullStudyMarker(saved,scope)?saved:null;}catch{return null;}}

export async function readFullStudyReviewStepState(request,m){
 let value,attemptMissing=false;
 try{value=await readFullStudyRecovery(request,m);}catch(error){if(error.status!==404)throw error;attemptMissing=true;value=await readFullStudyRecovery(request,{...m,action:'reviewOperation'});}
 if(!validFullStudyReviewOperation(value,{studyId:m.studyId,runGroupId:m.targetId,requestKey:m.parentKey,operationId:m.operationId,snapshotId:m.snapshotId,manifestHash:m.manifestHash}))throw Object.assign(Error('原审核意图与当前回执不匹配。'),{unknown:true});
 return{operation:value,attemptMissing,stepProved:!attemptMissing&&(m.version===2?await fullStudyBatchProved(value,m):fullStudyReviewStepProved(value,m))};
}
export function archiveFullStudyMarker(storage,m,scope,reason){
 if(!validFullStudyMarker(m,scope)||!['source_changed','unproved_step'].includes(reason))throw Error('原身份的未决标记不可归档。');
 const record={marker:structuredClone(m),reason,archivedAt:new Date().toISOString(),executionProved:false},key=fullStudyMarkerKey(m)+':archive:'+m.action+':'+m.requestKey+':'+reason,value=JSON.stringify(record);
 try{storage.setItem(key,value);if(storage.getItem(key)!==value)throw Error('Archive was not retained.');}catch(cause){throw Object.assign(Error('无法保存归档，原标记仍保留，请稍后重试。'),{cause});}return record;
}
export const canPreviewFullStudySources=({verified,busy,approved,pending,sourceError})=>verified===true&&!busy&&approved===true&&(!pending||!!sourceError);

// A batch is proved only by its own fixed manifest and every native terminal result.
export async function fullStudyBatchProved(value,m){
 if(m?.version!==2||m.limit!==3||!['process','reviewStep'].includes(m.action))return false;
 const kind=m.action==='process'?'process':'review',r=value?.batchReceipt;
 if(!r||r.version!=='full-study-batch-v1'||r.kind!==kind||r.requestKey!==m.requestKey||r.studyId!==m.studyId||r.runGroupId!==m.targetId||r.snapshotId!==m.snapshotId||!id(r.snapshotId)||r.manifestHash!==m.manifestHash||!hash(r.manifestHash)||!hash(r.targetsHash)||!['completed','failed'].includes(r.status)||r.executionConfirmed!==true)return false;
 if(kind==='review'){if(value.stepReceipt!==undefined||r.operationId!==m.operationId||!validFullStudyReviewOperation(value,{studyId:m.studyId,runGroupId:m.targetId,requestKey:m.parentKey,operationId:m.operationId,snapshotId:m.snapshotId,manifestHash:m.manifestHash}))return false;}
 else if(Object.hasOwn(value,'group')){if(!validFullStudyProcessReceipt(value,m)||value.status!==r.status||value.executionConfirmed!==true)return false;}
 else if(!validFullStudyGroup(value,m.studyId)||value.id!==m.targetId||value.snapshotId!==m.snapshotId||value.manifestHash!==m.manifestHash)return false;
 const targetKeys=kind==='process'?['sliceId','methodKey','snapshotId']:['runId','methodKey','snapshotId','nativeKey','commandHash'];
 if(!Array.isArray(r.targets)||r.targets.length<1||r.targets.length>m.limit||!Array.isArray(r.items)||r.items.length!==r.targets.length)return false;
 const exact=(v,keys)=>v&&typeof v==='object'&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
 const runIds=new Set(),methodKeys=new Set(),snapshots=new Set(),nativeKeys=new Set(),sliceIds=new Set();let failed=false;
 for(let i=0;i<r.targets.length;i++){
  const t=r.targets[i],item=r.items[i],itemKeys=[...new Set([...targetKeys,'runId','status','executionConfirmed'])];
  if(!exact(t,targetKeys)||!targetKeys.every(k=>k==='commandHash'?hash(t[k]):id(t[k]))||!exact(item,itemKeys)||!targetKeys.every(k=>item[k]===t[k])||!id(item.runId)||!['completed','failed'].includes(item.status)||item.executionConfirmed!==true)return false;
  if(runIds.has(item.runId)||methodKeys.has(t.methodKey)||snapshots.has(t.snapshotId)||kind==='review'&&nativeKeys.has(t.nativeKey)||kind==='process'&&sliceIds.has(t.sliceId))return false;
  runIds.add(item.runId);methodKeys.add(t.methodKey);snapshots.add(t.snapshotId);if(kind==='review')nativeKeys.add(t.nativeKey);else sliceIds.add(t.sliceId);failed ||= item.status==='failed';
 }
 if(r.status!==(failed?'failed':'completed'))return false;
 try{return await fullStudyInputHash(r.targets)===r.targetsHash;}catch{return false;}
}

export async function fullStudyProcessResult(value,m){
 if(m.version===2){if(!await fullStudyBatchProved(value,m))throw Object.assign(Error('当前批次结果尚未确认，请核对原请求结果。'),{unknown:true});return Object.hasOwn(value,'group')?value.group:value;}
 if(!validFullStudyGroup(value,m.studyId)||value.id!==m.targetId)throw Object.assign(Error('运行结果与原操作不匹配。'),{unknown:true});return value;
}
export function fullStudyReviewTrackingMarker(value,m){
 const {limit,...saved}=m;
 return{...saved,version:1,action:'reviewOperation',requestKey:value.requestKey,parentKey:value.requestKey,operationId:value.operationId,expectedStateHash:null,inputHash:m.parentInputHash??m.inputHash,parentInputHash:null};
}

export const fullStudyDispatchedCount=group=>group.slices.filter(s=>s.methodRunId&&s.status!=='queued').length;
