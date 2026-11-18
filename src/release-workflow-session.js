const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
async function sha(v){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v))));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
const stale=()=>Object.assign(Error('登录状态、方案或页面已变化，请重新核对。'),{code:'RELEASE_WORKFLOW_STALE'});
const changed=()=>Object.assign(Error('方案状态、政策或当前条件已变化，请核对当前内容后重新操作。'),{status:409,code:'RELEASE_WORKFLOW_CHANGED'});
const phaseOf={approve:'approving',activate:'activating',check:'checking',submit:'submitting'};
const statusOf={approve:'approved',activate:'executing',check:'draft',submit:'pending_review'};
export function createReleaseWorkflowSession({request,storage=globalThis.sessionStorage,key=()=>crypto.randomUUID(),hash=sha,onStage=()=>{},scope,mayWrite=()=>true}){
 let context=null,binding=null,record=null,epoch=0,running=null,writing=null,checkedMissing=false;
 const storageKey=c=>'researchhub:release-workflow:v1:'+encodeURIComponent(JSON.stringify([c.accountId,c.authVersion,c.studyId,c.protocolId,c.url]));
 const root=()=>'/research-studies/'+encodeURIComponent(context.studyId)+'/protocols/'+encodeURIComponent(context.protocolId);
 const notify=stage=>onStage(stage??record?.phase??null);
 function persist(){try{if(record)storage.setItem(storageKey(context),JSON.stringify(record));else storage.removeItem(storageKey(context));}catch{if(record)throw Error('无法保留本次操作记录，请检查浏览器存储后重试。');}}
 function guard(){if(!context||!valid(context.accountId)||!Number.isSafeInteger(context.authVersion)||context.authVersion<0||!valid(context.studyId)||!valid(context.protocolId)||typeof context.url!=='string')throw stale();if(scope){const actual=scope();if(!actual||['accountId','authVersion','studyId','protocolId','url'].some(k=>actual[k]!==context[k]))throw stale();}}
 function validStep(p){return p&&Object.keys(p).sort().join(',')==='action,requestHash,requestKey'&&valid(p.requestKey)&&p.requestKey.length>=8&&digest(p.requestHash)&&Object.hasOwn(phaseOf,p.action);}
 function validBase(r){return r?.schema===1&&r.actorId===context.accountId&&r.authVersion===context.authVersion&&r.studyId===context.studyId&&r.protocolId===context.protocolId&&['submit','approveActivate'].includes(r.kind)&&digest(r.revision)&&valid(r.policyId)&&digest(r.policyHash)&&Number.isSafeInteger(r.policyVersionNumber)&&r.policyVersionNumber>0;}
 function validRecord(r){
  if(!validBase(r)||Object.keys(r).some(k=>!['schema','kind','actorId','authVersion','studyId','protocolId','revision','policyId','policyHash','policyVersionNumber','phase','pending','completed'].includes(k)))return false;
  if(r.completed&&(!validStep(r.completed)||r.completed.action!==(r.kind==='submit'?'check':'approve')))return false;
  if(r.pending)return validStep(r.pending)&&r.phase===phaseOf[r.pending.action]&&(r.kind==='submit'?['check','submit']:['approve','activate']).includes(r.pending.action)&&(r.pending.action!=='activate'||r.completed?.action==='approve');
  return r.completed&&r.phase===(r.kind==='submit'?'checked':'approved');
 }
 function body(r,p){return {requestKey:p.requestKey,expectedRevision:r.revision,...(p.action==='activate'?{migrateExisting:false}:{policyVersionId:r.policyId,expectedPolicyHash:r.policyHash})};}
 async function run(fn){guard();if(running)throw Error('当前方案操作正在进行，请稍候。');const token=Symbol('release-workflow'),version=epoch,bound=binding;running=token;const check=()=>{if(epoch!==version||bound!==binding||running!==token)throw stale();guard();};try{return await fn(check,token);}finally{if(running===token)running=null;if(writing===token)writing=null;}}
 function verifyProof(result,r,p){
  const proof=result?.receipt,policy=result?.policy;
  if(proof?.proofVersion!==1||proof.requestKey!==p.requestKey||proof.requestHash!==p.requestHash||proof.action!=='protocol.'+p.action||proof.targetId!==r.protocolId||proof.studyId!==r.studyId||proof.actorId!==r.actorId||proof.authVersion!==r.authVersion||result.protocol?.id!==r.protocolId||result.protocol.revision!==r.revision||result.protocol.status!==statusOf[p.action]||policy?.id!==r.policyId||policy.contentHash!==r.policyHash||policy.versionNumber!==r.policyVersionNumber)throw Object.assign(Error('原操作结果证据尚不完整，请继续核对。'),{unknown:true});
  if(['approve','activate'].includes(p.action)&&(result.approvedPolicy?.id!==r.policyId||result.approvedPolicy.contentHash!==r.policyHash||policy.status!=='approved'))throw Object.assign(Error('原批准政策尚不能核定，请继续核对。'),{unknown:true});
  if(p.action==='check'&&typeof result.check?.gate?.ready!=='boolean')throw Object.assign(Error('原检查结果尚不能核定。'),{unknown:true});
 }
 function accept(result,r,p){
  verifyProof(result,r,p);checkedMissing=false;
  if(['approve','check'].includes(p.action)){record={...r,phase:p.action==='approve'?'approved':'checked',pending:null,completed:p};persist();notify();return {phase:record.phase,result};}
  record=null;persist();notify('complete');return {phase:'complete',result};
 }
 async function dispatch(check,token,priorUnknown=false){
  const r=record,p=r.pending,b=body(r,p);if(await hash(b)!==p.requestHash)throw stale();check();
  if(!mayWrite()){if(!priorUnknown){record=r.completed?{...r,phase:r.kind==='submit'?'checked':'approved',pending:null}:null;persist();}notify(priorUnknown?'unknown':undefined);throw Object.assign(Error('请先保存当前修改，再继续方案操作。'),{blockedByEdits:true,unknown:priorUnknown});}
  writing=token;notify(phaseOf[p.action]);let confirmed=false;
  try{const result=await request(root()+'/'+p.action,{method:'POST',body:b});check();verifyProof(result,r,p);confirmed=true;return accept(result,r,p);}
  catch(e){check();if(confirmed){notify();throw e;}if(priorUnknown){checkedMissing=false;notify('unknown');throw Object.assign(Error('原操作结果仍未确认；请继续核对上次结果。'),{status:e.status,code:e.code,unknown:true,cause:e});}if(e.unknown){notify('unknown');throw e;}record=r.completed?{...r,phase:r.kind==='submit'?'checked':'approved',pending:null}:null;persist();notify();throw e;}
  finally{if(writing===token)writing=null;}
 }
 async function prepare(action,check){const p={action,requestKey:key()};p.requestHash=await hash(body(record,p));check();const previous=record;record={...record,phase:phaseOf[action],pending:p};try{persist();}catch(e){record=previous;throw e;}checkedMissing=false;}
 function matches(view,r,status){return view?.protocol?.id===r.protocolId&&view.protocol.revision===r.revision&&view.protocol.status===status&&view.policy?.id===r.policyId&&view.policy.contentHash===r.policyHash&&view.policy.versionNumber===r.policyVersionNumber&&view.capabilities?.canManageRelease===true;}
 async function proofRead(check,p){
  const r=record;if(await hash(body(r,p))!==p.requestHash)throw stale();check();let value;
  try{value=await request(root()+'/release-receipts/'+encodeURIComponent(p.requestKey)+'?'+new URLSearchParams({action:p.action,requestHash:p.requestHash}));check();}catch(e){check();throw Object.assign(Error('原操作结果仍未确认，请继续核对。'),{status:e.status,code:e.code,unknown:true});}
  if(value?.found===false){if(record.pending)checkedMissing=true;notify('unknown');return {found:false};}
  if(value?.found!==true)throw Object.assign(Error('原操作结果尚不能确认。'),{unknown:true});verifyProof(value.result,r,p);return value;
 }
 async function next(check,token,verifyCompleted=false){
  if(!record||record.pending||!record.completed)throw Error('请先核定上一步结果。');
  if(verifyCompleted){const proof=await proofRead(check,record.completed);if(proof.found===false)return proof;}
  const r=record,latest=await request(root()+'/release');check();const submission=r.kind==='submit';
  if(matches(latest,r,submission?'pending_review':'executing')&&(submission||latest.approvedPolicy?.id===r.policyId&&latest.approvedPolicy.contentHash===r.policyHash)){
   record=null;persist();notify('currentComplete');return {phase:'currentComplete',view:latest,performedByThisIntent:false};
  }
  const same=matches(latest,r,submission?'draft':'approved'),ready=latest.release?.gate?.ready===true&&latest.fixedReferences?.ready===true;
  if(submission&&(!same||!ready||latest.capabilities?.canSubmit!==true)){
   record=null;persist();notify('blocked');if(!same)throw Object.assign(changed(),{latest});return {phase:'blocked',view:latest};
  }
  if(!submission&&(!same||!ready||latest.capabilities?.canActivate!==true||latest.policy.status!=='approved'||latest.approvedPolicy?.id!==r.policyId||latest.approvedPolicy.contentHash!==r.policyHash))throw changed();
  if(!mayWrite())return {phase:r.phase,view:latest,blockedByEdits:true};
  await prepare(submission?'submit':'activate',check);return dispatch(check,token);
 }
 async function start(view,kind,check,token){
  if(record)throw Error('请先核对原操作或继续下一步。');const r={schema:1,kind,actorId:context.accountId,authVersion:context.authVersion,studyId:context.studyId,protocolId:context.protocolId,revision:view?.protocol?.revision,policyId:view?.policy?.id,policyHash:view?.policy?.contentHash,policyVersionNumber:view?.policy?.versionNumber,phase:kind==='submit'?'checking':'approving',pending:null,completed:null},submission=kind==='submit';
  if(!validBase(r)||!matches(view,r,submission?'draft':'pending_review')||view.policy.status!=='draft'||(submission?view.capabilities.canSubmitWithCheck!==true:view.capabilities.canApprove!==true||view.capabilities.canApproveAndActivate!==true||view.release?.gate?.ready!==true||view.fixedReferences?.ready!==true))throw changed();
  record=r;const action=submission?(view.capabilities.canSubmit===true?'submit':'check'):'approve';try{await prepare(action,check);}catch(e){record=null;throw e;}const result=await dispatch(check,token);check();return action==='submit'?result:next(check,token);
 }
 return {
  setContext(nextContext){const nextBinding=nextContext?JSON.stringify([nextContext.accountId,nextContext.authVersion,nextContext.studyId,nextContext.protocolId,nextContext.url]):null;if(nextBinding===binding)return;epoch++;running=null;writing=null;record=null;checkedMissing=false;context=nextContext?{...nextContext}:null;binding=nextBinding;if(!context)return;guard();let saved;try{saved=JSON.parse(storage.getItem(storageKey(context))??'null');}catch{}if(validRecord(saved))record=saved;notify();},
  invalidate(){epoch++;running=null;writing=null;},checkpoint:()=>record?structuredClone(record):null,pending:()=>record?.pending?structuredClone(record.pending):null,inFlight:()=>Boolean(writing),
  start:view=>run((check,token)=>start(view,'approveActivate',check,token)),startSubmission:view=>run((check,token)=>start(view,'submit',check,token)),
  continueActivation:()=>run((check,token)=>{if(record?.kind!=='approveActivate')throw changed();return next(check,token,true);}),
  continueSubmission:()=>run((check,token)=>{if(record?.kind!=='submit')throw changed();return next(check,token,true);}),
  recover:()=>run(async check=>{if(!record)return null;const r=record,p=r.pending??r.completed;const value=await proofRead(check,p);if(value.found===false)return value;return r.pending?accept(value.result,r,p):{phase:r.phase,result:value.result};}),
  retryOriginal:()=>run(async(check,token)=>{if(!record?.pending||!checkedMissing)throw Error('请先核对上次结果，再明确重试原操作。');checkedMissing=false;return dispatch(check,token,true);}),
 };
}
