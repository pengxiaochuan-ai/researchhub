import {researchError} from '../research-studies/contract.mjs';
import {fullStudyHash} from './full-study-projection.mjs';

const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const sameScope=(a,b)=>scopeKeys.every(k=>a?.[k]===b[k]);
const identity=u=>({tenantId:u?.tenantId,accountId:u?.accountId,authVersion:u?.authVersion});
const sameActor=(a,b)=>['tenantId','accountId','authVersion'].every(k=>a?.[k]===b[k]);
const reject=(suffix,message='批次核验上下文不匹配，请重新核对原请求。')=>{throw researchError(409,'FULL_STUDY_BATCH_'+suffix,message);};
const reads=new Set(['findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','findMany','count','aggregate','groupBy']);
const writeFields={
 session:new Set(['tenantId','studyGroupId','researchProjectId','accountId','agentId','title','channel','contextKey','roleSnapshot']),
 auditLog:new Set(['id','tenantId','studyGroupId','researchProjectId','accountId','action','target','meta']),
 researchMethodReview:new Set(['tenantId','studyGroupId','researchProjectId','runId','reviewerAccountId','reviewRole','conclusion','comment','version']),
 researchMethodRun:new Set(['tenantId','studyGroupId','researchProjectId','sessionId','agentId','accountId','skillKey','skillVersion','executorName','executorVersion','idempotencyKey','status','reviewStatus','stage','inputSummary','requestHash','inputHash','algorithmParams','dataSources','environment','warnings','progressPercent','startedAt','completedAt','numericEvidence','citations','limits','nextSteps','artifactRefs','errorCode','errorMessage']),
};
const writes={session:new Set(['create']),auditLog:new Set(['create','createMany']),researchMethodReview:new Set(['create']),researchMethodRun:new Set(['create','update'])};
function allowedWrite(model,method,args){
 if(!writes[model]?.has(method)||args.length!==1||!args[0]||typeof args[0]!=='object'||Object.keys(args[0]).some(k=>!['where','data'].includes(k)))return false;
 const rows=Array.isArray(args[0].data)?args[0].data:[args[0].data];
 return rows.length>0&&rows.every(data=>data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).every(k=>writeFields[model].has(k)));
}
function sqlText(args){
 const first=args[0];
 if(Array.isArray(first)&&Array.isArray(first.raw)&&first.length===args.length&&first.every(x=>typeof x==='string'))return first.join('?');
 if(args.length===1&&first&&Array.isArray(first.strings)&&Array.isArray(first.values)&&first.strings.length===first.values.length+1&&first.strings.every(x=>typeof x==='string'))return first.strings.join('?');
 return null;
}
function safeRaw(method,args,s){
 const sql=sqlText(args);if(!sql)return false;
 if(method==='$executeRaw')return sql==='SELECT pg_advisory_xact_lock(hashtextextended(?,0))'&&args.length===2&&['wp01:official','wp01:tenant:'+s.tenantId].includes(args[1]);
 if(method!=='$queryRaw'||!/^\s*SELECT\b/i.test(sql)||/;|--|\/\*|\b(?:INSERT|INTO|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY|VACUUM|REFRESH|RESET|SET)\b/i.test(sql))return false;
 if(/(?:\.|\")\s*[A-Za-z_][A-Za-z0-9_]*"?\s*\(/.test(sql))return false;
 for(const cast of sql.matchAll(/::\s*([^\s,;)]+)/g))if(!['text','text[]'].includes(cast[1]))return false;
 if(/\b(?:pg_advisory_xact_lock|hashtextextended)\s*\(/i.test(sql))return /^SELECT pg_advisory_xact_lock\(hashtextextended\(\?,0\)\)(?:::text(?: AS locked)?)?$/.test(sql)&&args.length===2&&typeof args[1]==='string'&&args[1].startsWith(s.tenantId+':');
 if(/\bUPDATE\b/i.test(sql.replace(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b/gi,'')))return false;
 for(const m of sql.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*"?\s*\(/g))if(!['ANY','ALL','IN','EXISTS','AND','OR','NOT','SELECT'].includes(m[1].toUpperCase()))return false;
 return true;
}
function protectedTransaction(tx,s,assertActive){
 const models=new Map();
 return new Proxy(Object.create(null),{get(_target,key){
  assertActive();if(typeof key!=='string'||key==='then')return undefined;
  if(key.startsWith('$'))return(...args)=>{assertActive();if(!safeRaw(key,args,s))reject('SOURCE_WRITE_FORBIDDEN');return tx[key](...args);};
  const model=tx[key];if(!model||typeof model!=='object')reject('SOURCE_WRITE_FORBIDDEN');
  if(!models.has(key))models.set(key,new Proxy(Object.create(null),{get(_model,method){
   assertActive();if(typeof method!=='string'||method==='then')return undefined;
   const fn=model[method];if(typeof fn!=='function')reject('SOURCE_WRITE_FORBIDDEN');
   return(...args)=>{assertActive();if(!reads.has(method)&&!allowedWrite(key,method,args))reject('SOURCE_WRITE_FORBIDDEN');return fn.apply(model,args);};
  }}));
  return models.get(key);
 }});
}

// Shared physical-transaction source protection. Never exported as a raw frame.
function createProtectedRootFrame({authorize,validateCase,assertCurrent}){
 if(![authorize,validateCase,assertCurrent].every(x=>typeof x==='function'))throw Error('FULL_STUDY_BATCH_SOURCE_DEPENDENCIES_REQUIRED');
 return async function withProtectedRoot(tx,u,scope,studyId,rootId,phase,callback){
  if(!tx||typeof tx.$queryRaw!=='function'||!scope||!scopeKeys.every(k=>identifier(scope[k]))||!identifier(u?.accountId)||u.tenantId!==scope.tenantId||!Number.isSafeInteger(u.authVersion)||u.authVersion<0||![studyId,rootId].every(identifier)||!['snapshot','dispatch','publish','export'].includes(phase)||typeof callback!=='function')reject('CONTEXT_INVALID');
  const s=Object.fromEntries(scopeKeys.map(k=>[k,scope[k]])),actor=identity(u),proof=new Map();let active=true;
  const assertActive=()=>{if(!active)reject('CONTEXT_EXPIRED','本次批次核验上下文已结束。');},view=protectedTransaction(tx,s,assertActive);
  try{
   await authorize(view,{...u,...actor},s,studyId,false,phase);
   const c=await validateCase(view,s,studyId);
   if(!sameScope(c?.scope,s)||!Array.isArray(c.subjects)||!c.subjects.length||!c.subjects.every(x=>identifier(x?.id))||new Set(c.subjects.map(x=>x.id)).size!==c.subjects.length)reject('SOURCE_UNPROTECTED');
   const subjects=c.subjects.map(x=>x.id).sort();
   // Root relation includes all task states/skills and has no task-scope filter.
   // Lock a safe superset: all visible tasks on this case's nondeleted bound files.
   const locked=await view.$queryRaw`SELECT t.id FROM public.processing_task t JOIN public.modality_file f ON f.id=t."modalityFileId" JOIN public.subject s ON s.id=f."subjectId" WHERE f."tenantId"=${s.tenantId} AND s."tenantId"=${s.tenantId} AND s."studyGroupId"=${s.studyGroupId} AND s."researchProjectId"=${s.researchProjectId} AND f."deletedAt" IS NULL AND f."subjectVisitId" IS NOT NULL AND f."subjectId"=ANY(${subjects}::text[]) ORDER BY t.id FOR SHARE OF t`;
   if(!Array.isArray(locked)||!locked.every(x=>identifier(x?.id)))reject('SOURCE_UNPROTECTED');
   // Existing task rows precede file locks, matching native task -> file order.
   // FOR UPDATE conflicts with FK KEY SHARE for any new task bound to a file,
   // even when the task's separate subject FK points elsewhere.
   const lockedFiles=await view.$queryRaw`SELECT f.id FROM public.modality_file f JOIN public.subject s ON s.id=f."subjectId" WHERE f."tenantId"=${s.tenantId} AND s."tenantId"=${s.tenantId} AND s."studyGroupId"=${s.studyGroupId} AND s."researchProjectId"=${s.researchProjectId} AND f."deletedAt" IS NULL AND f."subjectVisitId" IS NOT NULL AND f."subjectId"=ANY(${subjects}::text[]) ORDER BY f.id FOR UPDATE OF f`;
   if(!Array.isArray(lockedFiles)||!lockedFiles.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===1&&identifier(x.id))||new Set(lockedFiles.map(x=>x.id)).size!==lockedFiles.length)reject('SOURCE_UNPROTECTED');
   const lockedFileIds=new Set(lockedFiles.map(x=>x.id)),lockedIds=new Set(locked.map(x=>x.id)),root=await assertCurrent(view,{...u,...actor},s,studyId,rootId,phase,proof);
   if(root?.basis?.studyId!==studyId||root.basis.snapshotId!==rootId||root.manifest?.schemaVersion!=='full-study-simulation-root-v2'||root.manifest.studyId!==studyId||!sameScope(root.manifest.scope,s)||!root.manifest.caseMetadata||fullStudyHash(root.manifest.caseMetadata)!==fullStudyHash(c))reject('SOURCE_UNPROTECTED');
   const files=root.manifest.quality?.modalities?.files;
   if(!Array.isArray(files)||files.some(f=>!identifier(f?.id)||!lockedFileIds.has(f.id)||!Array.isArray(f.processing)||f.processing.some(t=>!identifier(t?.id)||!lockedIds.has(t.id))))reject('SOURCE_UNPROTECTED');
   return await callback({view,root,proof,assertActive,s,actor});
  }finally{active=false;proof.clear();}
 };
}

/** Trusted v2 stage only. Existing child-only API and protected writes unchanged. */
export function createFullStudyBatchSource(deps){
 const frame=createProtectedRootFrame(deps),{assertCurrent}=deps;
 return async function withBatchResolver(tx,u,scope,studyId,rootId,targetIds,phase,callback){
  if(!Array.isArray(targetIds)||targetIds.length<1||targetIds.length>3||!targetIds.every(identifier)||targetIds.includes(rootId)||new Set(targetIds).size!==targetIds.length||typeof callback!=='function')reject('CONTEXT_INVALID');
  const targets=new Set(targetIds);
  return frame(tx,u,scope,studyId,rootId,phase,async({view,root,proof,assertActive,s,actor})=>{
   const resolver=Object.freeze({async assertCurrent(currentTx,currentUser,currentScope,currentStudy,currentId,currentPhase){
    assertActive();if(currentTx!==view||!sameActor(currentUser,actor)||!sameScope(currentScope,s)||currentStudy!==studyId||currentPhase!==phase||!targets.has(currentId))reject('CONTEXT_INVALID');
    const current=await assertCurrent(view,currentUser,s,studyId,currentId,phase,proof);assertActive();
    if(current?.basis?.studyId!==studyId||current.basis.snapshotId!==currentId||current.basis.rootSnapshotId!==rootId||current.manifest?.schemaVersion!=='full-study-simulation-slice-v2'||current.manifest.rootSnapshotId!==rootId)reject('CONTEXT_INVALID');
    return current;
   }});
   return callback(resolver,view,structuredClone(root));
  });
 };
}

/** Internal metadata composition only. No child, SQL, raw frame or proof access.
 * Metadata repository writes use the caller's original transaction. */
export function createFullStudyRootSourceGuard(deps){
 const frame=createProtectedRootFrame(deps),{assertCurrent}=deps;
 return async function withRootSourceGuard(tx,u,scope,studyId,rootId,phase,callback){
  if(phase!=='dispatch'||typeof callback!=='function')reject('CONTEXT_INVALID');
  return frame(tx,u,scope,studyId,rootId,phase,async({view,root,proof,assertActive,s,actor})=>{
   const guard=Object.freeze({async assertCurrent(currentTx,currentUser,currentScope,currentStudy,currentId,currentPhase){
    assertActive();if(currentTx!==tx||!sameActor(currentUser,actor)||!sameScope(currentScope,s)||currentStudy!==studyId||currentId!==rootId||currentPhase!==phase)reject('CONTEXT_INVALID');
    const current=await assertCurrent(view,currentUser,s,studyId,rootId,phase,proof);assertActive();
    if(current?.basis?.studyId!==studyId||current.basis.snapshotId!==rootId||current.basis.manifestHash!==root.basis.manifestHash||current.manifest?.schemaVersion!=='full-study-simulation-root-v2'||current.manifest.studyId!==studyId||!sameScope(current.manifest.scope,s))reject('CONTEXT_INVALID');
    return current;
   }});
   return callback(guard);
  });
 };
}
