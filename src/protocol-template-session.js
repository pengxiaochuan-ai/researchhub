const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
async function sha(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
const stale=()=>Object.assign(Error('登录状态、方案或当前权限已变化，请重新核对。'),{code:'TEMPLATE_STALE_CONTEXT'});
const action='protocol.template.import';
// Persistence contains opaque proof only. Template text and editable draft never enter storage.
export function createProtocolTemplateSession({request,storage=globalThis.sessionStorage,key=()=>crypto.randomUUID(),hash=sha}){
 let context=null,binding=null,epoch=0,record=null,preview=null,running=null,writing=null,checkedMissing=false;
 const storageKey=ctx=>'researchhub:protocol-template:v1:'+encodeURIComponent(JSON.stringify([ctx.accountId,ctx.authVersion,ctx.studyId,ctx.url]));
 const root=()=>'/research-studies/'+encodeURIComponent(context.studyId);
 function persist(){try{if(record)storage.setItem(storageKey(context),JSON.stringify(record));else storage.removeItem(storageKey(context));}catch{if(record)throw Error('无法保留本次带入记录，请检查浏览器存储后重试。');}}
 function validRecord(r){return r&&Object.keys(r).sort().join(',')==='action,authVersion,requestHash,schema,sourceFingerprint,sourceProtocolId,sourceStudyId,studyId,targetFingerprint,requestKey'.split(',').sort().join(',')&&r.schema===1&&r.action===action&&r.authVersion===context.authVersion&&r.studyId===context.studyId&&valid(r.requestKey)&&valid(r.sourceStudyId)&&valid(r.sourceProtocolId)&&digest(r.sourceFingerprint)&&digest(r.targetFingerprint)&&digest(r.requestHash);}
 function guard(){if(!context||context.canConfigure!==true||!valid(context.accountId)||!Number.isSafeInteger(context.authVersion)||context.authVersion<0||!valid(context.studyId)||typeof context.url!=='string')throw stale();}
 function bodyOf(r){return {requestKey:r.requestKey,sourceStudyId:r.sourceStudyId,sourceProtocolId:r.sourceProtocolId,sourceFingerprint:r.sourceFingerprint,targetFingerprint:r.targetFingerprint};}
 function finish(result,r){
  const p=result?.receipt;
  if(!result?.protocol||!p||p.action!==action||p.requestKey!==r.requestKey||p.requestHash!==r.requestHash||p.authVersion!==context.authVersion||p.studyId!==context.studyId||p.targetId!==result.protocol.id||p.sourceStudyId!==r.sourceStudyId||p.sourceProtocolId!==r.sourceProtocolId||p.sourceFingerprint!==r.sourceFingerprint||p.targetFingerprint!==r.targetFingerprint)throw Object.assign(Error('尚不能核定上次带入结果，请保留原请求继续核对。'),{unknown:true});
  record=null;preview=null;checkedMissing=false;persist();return result;
 }
 async function run(fn){guard();if(running)throw Error('正在核对模板，请稍候。');const token=Symbol('template'),version=epoch,bound=binding;running=token;const check=()=>{if(epoch!==version||binding!==bound||running!==token)throw stale();guard();};try{return await fn(check,token);}finally{if(running===token)running=null;if(writing===token)writing=null;}}
 async function execute(check,token,r,priorUnknown=false){
  const body=bodyOf(r);if(await hash(body)!==r.requestHash)throw stale();check();writing=token;
  try{const result=await request(root()+'/protocol-template-imports',{method:'POST',body});check();return finish(result,r);}
  catch(e){check();if(priorUnknown){checkedMissing=false;throw Object.assign(Error([401,403,404].includes(e.status)?'当前权限已变化，尚不能确认原操作结果；请继续核对上次结果或查看研究方案。':'原操作结果仍未确认；请继续核对上次结果或查看研究方案。'),{status:e.status,code:e.code,unknown:true,cause:e});}if(!e.unknown){record=null;checkedMissing=false;persist();}throw e;}
  finally{if(writing===token)writing=null;}
 }
 return {
  setContext(next){
   const nextBinding=next?JSON.stringify([next.accountId,next.authVersion,next.studyId,next.url,next.canConfigure]):null;if(nextBinding===binding)return;
   // A changed view may hide an in-flight operation, but cannot declare that write failed.
   // Keep its opaque marker under the original identity and URL for read-only recovery.
   epoch++;running=null;writing=null;record=null;preview=null;checkedMissing=false;context=next?{...next}:null;binding=nextBinding;
   if(!next||next.canConfigure!==true)return;
   guard();let saved;try{saved=JSON.parse(storage.getItem(storageKey(context))??'null');}catch{}
   if(validRecord(saved))record=saved;else if(saved)try{storage.removeItem(storageKey(context));}catch{}
  },
  invalidate(){epoch++;running=null;writing=null;preview=null;},
  pending:()=>record?structuredClone(record):null,
  inFlight:()=>Boolean(writing),
  search:(search='',cursor=null)=>run(async check=>{const query=new URLSearchParams({search,limit:'10',...(cursor?{cursor}:{})}),result=await request(root()+'/protocol-templates?'+query);check();return result;}),
  preview:(sourceStudyId,sourceProtocolId)=>run(async check=>{if(record)throw Error('请先核对上次带入结果。');if(!valid(sourceStudyId)||!valid(sourceProtocolId))throw stale();preview=null;const result=await request(root()+'/protocol-templates/'+encodeURIComponent(sourceStudyId)+'/'+encodeURIComponent(sourceProtocolId));check();if(result.source?.sourceStudyId!==sourceStudyId||result.source?.sourceProtocolId!==sourceProtocolId||!digest(result.sourceFingerprint)||!digest(result.targetFingerprint))throw Error('模板预览不完整，请重新读取。');preview=result;return result;}),
  import:()=>run(async(check,token)=>{if(record)throw Error('请先核对上次带入结果。');if(!preview?.canImport)throw Error('请先选择可用模板并核对差异。');const body={requestKey:key(),sourceStudyId:preview.source.sourceStudyId,sourceProtocolId:preview.source.sourceProtocolId,sourceFingerprint:preview.sourceFingerprint,targetFingerprint:preview.targetFingerprint},requestHash=await hash(body);check();record={schema:1,action,authVersion:context.authVersion,studyId:context.studyId,...body,requestHash};try{persist();}catch(e){record=null;throw e;}checkedMissing=false;return execute(check,token,record);}),
  check:()=>run(async check=>{if(!record)throw Error('没有待核对的模板带入。');const r=record,result=await request(root()+'/protocol-template-imports/receipts/'+encodeURIComponent(r.requestKey)+'?'+new URLSearchParams({requestHash:r.requestHash}));check();if(result.found===false){checkedMissing=true;return {found:false};}if(result.found!==true)throw Error('尚不能确认带入结果，请继续核对。');return finish(result,r);}),
  retry:()=>run(async(check,token)=>{if(!record||!checkedMissing)throw Error('请先核对上次带入结果，再明确重试原请求。');checkedMissing=false;return execute(check,token,record,true);}),
 };
}
