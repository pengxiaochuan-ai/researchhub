// This adapter is instantiated only by the registered v2 synthetic-study composition.
import {researchError,validateMutation} from '../server/research-studies/contract.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
import {prepareFullStudyWorkbench} from './full-study-workbench-prepare.mjs';

const skillKey='descriptive-statistics';
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const scopeOf=user=>({tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId});
const bad=()=>researchError(400,'FULL_STUDY_BATCH_INPUT_INVALID','请核对本批次的运行和来源。');
const invariant=()=>researchError(503,'FULL_STUDY_BATCH_NATIVE_UNAVAILABLE','当前分析批次暂不可执行。');
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return{promise,resolve,reject};};

// These errors positively identify invalid scientific sources. Authorization,
// database failures and ordinary row/version conflicts must not mark a run stale.
const sourceFaults=new Set(['ANALYSIS_BASIS_STALE','FULL_STUDY_CASE_CHANGED','FULL_STUDY_PROTOCOL_CHANGED',
 'FULL_STUDY_POLICY_CHANGED','FULL_STUDY_SUBJECT_CHANGED','FULL_STUDY_FORM_CHANGED','FULL_STUDY_ENROLLMENT_CHANGED',
 'FULL_STUDY_VISIT_CHANGED','FULL_STUDY_ASSIGNMENT_DUPLICATE','FULL_STUDY_SOURCE_NOT_LOCKED','FULL_STUDY_SOURCE_CHANGED',
 'FULL_STUDY_SCORE_ALGORITHM_CHANGED','FULL_STUDY_PLAN_CHANGED','FULL_STUDY_PLAN_NOT_APPROVED','FULL_STUDY_SLICE_CHANGED',
 'PARTICIPATION_CAPTURE_BLOCKED','PROTOCOL_BINDING_CHANGED','FORM_REVISION_INTEGRITY_INVALID','FORM_LEGACY_UNVERSIONED',
 'FULL_STUDY_NUMERIC_RANGE','FULL_STUDY_OBSERVATION_INVALID','FULL_STUDY_VISIT_MAP_INVALID','FULL_STUDY_VARIABLES_INVALID']);
const errorCode=e=>e?.getResponse?.()?.code??e?.code;
const qualityFaults=new Set(['QUALITY_GATE_REQUIRED','QUALITY_GATE_STALE','QUALITY_GATE_BLOCKED']);
const explicitSourceError=e=>e?.name==='QualityGateError'&&qualityFaults.has(e.code)
 ||sourceFaults.has(errorCode(e))&&(e?.getStatus?.()??e?.status)===409;

function validate(user,items,context,snapshotOf,keyOf){
 if(!user||!Object.values(scopeOf(user)).every(identifier)||!identifier(user.accountId)||!Number.isSafeInteger(user.authVersion)
    ||!identifier(context?.studyId)||!identifier(context.rootSnapshotId)||!Array.isArray(items)||items.length<1||items.length>3)throw bad();
 const snapshots=items.map(snapshotOf),keys=items.map(keyOf);
 if(![...snapshots,...keys].every(identifier)||snapshots.includes(context.rootSnapshotId)
    ||new Set(snapshots).size!==items.length||new Set(keys).size!==items.length)throw bad();
 return snapshots;
}

// Each child gets its own native instance, basis-error set, and temporary resolver.
// The ordinary instance keeps its real transaction for the native failure cleanup.
function childFor(methods){
 const original=methods.descriptiveRuns();
 const child=Object.create(original);
 child.resolver=()=>{if(!child.activeResolver)throw invariant();return child.activeResolver;};
 // Keep the real independent transaction, original trusted adapter and the
 // fourth Job-context argument. Never bind cleanup to a finished shared tx.
 child.markBasisBlocked=(user,row,claim,jobContext)=>original.markBasisBlocked(user,row,claim,jobContext);
 return {original,child};
}
async function inGuard(slot,resolver,tx,callback,physical=tx,phase){
 let active=true;
 const mapped=tx===physical?resolver:{async assertCurrent(actual,user,scope,study,id,currentPhase){
  if(!active||actual!==physical||currentPhase!==phase)throw invariant();
  return resolver.assertCurrent(tx,user,scope,study,id,currentPhase);
 }};
 slot.child.activeResolver=mapped;
 try{return await callback(tx);}
 finally{active=false;slot.child.activeResolver=null;}
}
function joinTransaction(user,tx,child){return async(actual,callback,operation)=>{
 if(actual!==user)throw invariant();
 if(operation)await child.beforeLocks(tx,user,operation);
 return callback(tx);
};}

const jobOperation=(context,kind)=>({kind,scope:context.scope,studyId:context.target.studyId,snapshotId:context.target.snapshotId,methodKey:context.target.methodKey,context});

export function createFullStudyMethodsBatch(methods,options){
 const {withBatchResolver}=options;
 async function stage(slots,user,context,phase,callback,beforeGuard,operation){
  let entered=false, scopeChecked=!beforeGuard;
  try{
   return await slots[0].original.transaction(user,async physical=>{
    if(beforeGuard){await beforeGuard(physical);scopeChecked=true;}
    return withBatchResolver(physical,user,scopeOf(user),
    context.studyId,context.rootSnapshotId,slots.map(s=>s.snapshotId),phase,async(resolver,guardedTx,current)=>{
     entered=true;
     return callback(resolver,guardedTx,current,physical);
    });
   },operation);
  }catch(error){
   // A failed root invalidates every member. A failure within one child's
   // live check only belongs to that child. Native current also records 403
   // and transient errors in its WeakSet, so remove those before native cleanup.
   for(const {child} of slots){
    if(scopeChecked&&!entered&&explicitSourceError(error))child.basisErrors.add(error);
    else if(!explicitSourceError(error)&&errorCode(error)!=='METHOD_RUN_CHANGED')child.basisErrors.delete(error);
   }
   throw error;
  }
 }
 function slotsFor(items,snapshots){
  const slots=items.map((item,i)=>({...childFor(methods),item,snapshotId:snapshots[i]}));
  if(new Set(slots.map(s=>s.original)).size!==slots.length)throw invariant();
  return slots;
 }

 // Original execute calls transaction twice: dispatch, then (after its Worker)
 // publish. Each slot offers exactly one callback for each physical commit.
 // Error/early return also signals the coordinator so a sibling cannot hang.
 async function executeNew(slots,user,context,publication){
  let receipt;
  const phases=['dispatch','publish'];
  for(const slot of slots){
   slot.arrivals=phases.map(deferred);
   let count=0;
   slot.child.transaction=(actual,callback,operation)=>{
    if(actual!==user||count>=phases.length)throw invariant();
    const reply=deferred();
    slot.arrivals[count++].resolve({callback,reply,operation});
    return reply.promise;
   };
   slot.finished=Promise.resolve().then(()=>slot.jobContext?slot.child.resumeJob(user,slot.jobContext):slot.original.execute.call(slot.child,user,slot.created)).then(value=>{
    if(count!==phases.length)throw invariant();
    return {value};
   }).catch(error=>{
    for(const arrival of slot.arrivals.slice(count))arrival.resolve({error});
    return {error};
   });
  }
  for(const [index,phase] of phases.entries()){
   const requests=await Promise.all(slots.map(slot=>slot.arrivals[index].promise));
   try{
    const missing=requests.find(r=>Object.hasOwn(r,'error'));if(missing)throw missing.error;
    const publish=phase==='publish'?publication:null;
    const committed=await stage(slots,user,context,phase,async(resolver,tx,current,physical)=>{
     const values=[];
     for(const [i,request] of requests.entries()){
      const slot=slots[i],nativeTx=slot.original.deps?.jobAdapter?physical:tx;
      if(request.operation)await slot.child.beforeLocks(physical,user,request.operation);
      values.push(await inGuard(slot,resolver,tx,()=>request.callback(nativeTx),nativeTx,phase));
     }
     if(context.jobContexts&&phase==='publish'&&typeof publication?.finishInTransaction==='function')await publication.finishInTransaction(physical,current);
     if(!context.jobContexts&&publish&&values.every(row=>row.status==='needs_review')){
      const proof=await publish.provePublication(resolver,tx,current);
      if(proof?.executionConfirmed!==true)throw invariant();
      return {values,proof};
     }
     return {values};
    },publish?.authorizePublication,requests[0].operation);
    if(committed.proof)receipt=committed.proof;
    // No native continuation or Worker sees a callback result until commit.
    requests.forEach((r,i)=>r.reply.resolve(committed.values[i]));
   }catch(error){
    for(const request of requests)request.reply?.reject(error);
    await Promise.all(slots.map(s=>s.finished));
    throw error;
   }
  }
  const outcomes=await Promise.all(slots.map(s=>s.finished));
  for(const [i,outcome] of outcomes.entries()){if(Object.hasOwn(outcome,'error'))throw outcome.error;slots[i].result=outcome.value;}
  return receipt;
 }
 async function createWorkbenchBatch(user,items,context,publication){
   const snapshots=validate(user,items,context,d=>d?.input?.snapshotId,d=>d?.idempotencyKey);
   if(items.some(d=>d.skillKey!==skillKey||d.input.studyId!==context.studyId))throw bad();
   const slots=slotsFor(items,snapshots);
   await stage(slots,user,context,'snapshot',async(resolver,tx,_current,physical)=>{
    for(const slot of slots){
     const {child,item}=slot;
     const nativeTx=slot.original.deps?.jobAdapter?physical:tx;
     child.transaction=joinTransaction(user,nativeTx,child);
     child.execute=async(actual,row)=>{
      if(actual!==user||slot.created||row?.status!=='queued'||row.idempotencyKey!==item.idempotencyKey||row.inputSummary?.snapshotId!==slot.snapshotId)throw invariant();
      slot.created=row;
      return row;
     };
     slot.result=await inGuard(slot,resolver,tx,async()=>{
      const identity=await prepareFullStudyWorkbench(child,user,item,options);
      const result=await child.create(user,{...item,...identity});
      if(Boolean(slot.created)===result.idempotent)throw invariant();
      return result.run;
     },nativeTx,'snapshot');
    }
   });
   const created=slots.filter(slot=>slot.created);
   const receipt=created.length?await executeNew(created,user,context,created.length===slots.length?publication:null):undefined;
   const runs=slots.map(slot=>slot.result);
   if(!publication)return runs;
   if(receipt)return {kind:'published',receipt};
   if(created.length!==slots.length)return {kind:'existing'};
   if(runs.some(row=>row.status==='failed'))return {kind:'failed'};
   throw invariant();
 }
 function jobSlots(user,contexts,frame){
  const snapshots=validate(user,contexts,frame,c=>c?.target?.snapshotId,c=>c?.target?.methodKey);
  if(user.authVersion<0||contexts.some(c=>!c.capability||c.target.studyId!==frame.studyId||fullStudyHash(c.scope)!==fullStudyHash(scopeOf(user))||c.capability!==contexts[0].capability||fullStudyHash(c.operator)!==fullStudyHash(contexts[0].operator)))throw bad();
  return slotsFor(contexts,snapshots).map(slot=>({...slot,jobContext:slot.item}));
 }
 return {
  async prepareJobBatchInTransaction(tx,user,contexts,frame){
   const slots=jobSlots(user,contexts,frame);await slots[0].child.beforeLocks(tx,user,jobOperation(contexts[0],'prepare'));
   return withBatchResolver(tx,user,scopeOf(user),frame.studyId,frame.rootSnapshotId,slots.map(s=>s.snapshotId),'snapshot',async(resolver,view)=>{
    const values=[];for(const slot of slots)values.push(await inGuard(slot,resolver,view,()=>slot.child.prepareJobInTransaction(tx,user,slot.jobContext),tx,'snapshot'));return values;
   });
  },
  async resumeJobBatch(user,contexts,frame,publication){
   const slots=jobSlots(user,contexts,frame);await executeNew(slots,user,{...frame,jobContexts:contexts},publication);return slots.map(slot=>slot.result);
  },
  async settleJobBatchInTransaction(tx,user,contexts,purpose){
   // Settlement does not project source values or construct a Run. Each public
   // native entry rechecks current authority, exact binding and the same fence.
   const values=[];for(const context of contexts)values.push(await methods.settleDescriptiveJobInTransaction(tx,user,context,purpose));return values;
  },
  createBatchFromWorkbench:(user,items,context)=>createWorkbenchBatch(user,items,context),
  async createBatchAndProve(user,items,context,publication){
   if(typeof publication?.authorizePublication!=='function'||typeof publication.provePublication!=='function')throw invariant();
   return createWorkbenchBatch(user,items,context,publication);
  },
  async reviewBatch(user,rows,command,context){
   const snapshots=validate(user,rows,context,r=>r?.inputSummary?.snapshotId,r=>r?.id);
   validateMutation(command);
   if(rows.some(r=>r.skillKey!==skillKey||r.inputSummary.studyId!==context.studyId
    ||Object.entries(scopeOf(user)).some(([k,v])=>r[k]!==v)))throw bad();
   const slots=slotsFor(rows,snapshots);
   return stage(slots,user,context,'publish',async(resolver,tx)=>{
    const results=[];
    for(const slot of slots){
     slot.child.transaction=joinTransaction(user,tx,slot.child);
     const requestKey='full-review-'+fullStudyHash({requestKey:command.requestKey,runId:slot.item.id});
     results.push(await inGuard(slot,resolver,tx,()=>slot.child.review(user,slot.item,{...command,requestKey})));
    }
    return results;
   });
  }
 };
}
