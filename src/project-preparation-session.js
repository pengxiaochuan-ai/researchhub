import {formalUrl} from './formal-preparation-session.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export async function projectPreparationHash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const stale=()=>Object.assign(Error('登录状态或当前课题已变化，请重新核对。'),{code:'RESEARCH_STALE'});
const conflict=()=>Object.assign(Error('课题已有更新，当前输入已保留，请核对最新版本后继续。'),{status:409});
const bodyValues=value=>({title:value.title??'',question:value.question??'',researchType:value.researchType??'',hubKey:value.hubKey||null,pico:{p:'',i:'',c:'',o:'',...value.pico}});
const identity=value=>value&&valid(value.actorId)&&Number.isSafeInteger(value.authVersion)?JSON.stringify([value.actorId,value.authVersion]):null;
// Only opaque operation proof is persisted. Draft text stays in the current form.
export function createProjectPreparation({request,storage=globalThis.sessionStorage,scope,key=()=>crypto.randomUUID(),projectId=null,onSaved=()=>{}}){
 let record=null,memoryBody=null,running=null,writing=null,epoch=0,bound=null;
 const storageKey=id=>'researchhub:project-preparation:v1:'+id+':'+(projectId??'new');
 function validRecord(saved,actor){
  const allowed=['schema','actor','origin','prepare','groupId','projectId','version','sourceHash','pending'];
  if(!saved||typeof saved!=='object'||Object.keys(saved).some(k=>!allowed.includes(k))||saved.schema!==1||saved.actor!==actor||!(saved.origin==='new'||valid(saved.origin))||typeof saved.prepare!=='boolean'||saved.groupId!==null&&!valid(saved.groupId)||saved.projectId!==undefined&&(!valid(saved.projectId)||!Number.isSafeInteger(saved.version)||saved.version<1)||saved.sourceHash!==undefined&&!/^[a-f0-9]{64}$/.test(saved.sourceHash))return false;
  const p=saved.pending;if(!p)return Boolean(saved.projectId);
  if(Object.keys(p).some(k=>!['path','method','action','requestKey','requestHash','expectedVersion'].includes(k))||!valid(p.requestKey)||!/^[a-f0-9]{64}$/.test(p.requestHash))return false;
  if(p.action==='intent.create')return !saved.projectId&&p.path==='/research-projects'&&p.method==='POST'&&p.expectedVersion===undefined;
  if(!saved.projectId||p.expectedVersion!==saved.version)return false;
  return p.action==='intent.update'&&p.path==='/research-projects/'+saved.projectId&&p.method==='PATCH'||p.action==='study.create'&&valid(saved.groupId)&&p.path==='/research-projects/'+saved.projectId+'/studies'&&p.method==='POST';
 }
 function load(){const actor=identity(scope());if(!actor)throw stale();if(bound!==actor){let saved;try{saved=JSON.parse(storage?.getItem(storageKey(actor))??'null');}catch{throw Error('无法读取上次操作标记，请保留输入并检查浏览器存储。');}if(saved&&!validRecord(saved,actor))throw Error('上次操作标记无法核对，请保留输入并联系管理员核定原操作。');record=saved;memoryBody=null;bound=actor;}return actor;}
 function persist(){if(record){const text=JSON.stringify(record);storage?.setItem(storageKey(bound),text);if(record.projectId)storage?.setItem('researchhub:project-preparation:v1:'+bound+':'+record.projectId,text);}else{storage?.removeItem(storageKey(bound));}}
 function finish(){const savedId=record?.projectId,origin=record?.origin??(projectId??'new');record=null;memoryBody=null;persist();storage?.removeItem('researchhub:project-preparation:v1:'+bound+':'+origin);if(savedId)storage?.removeItem('researchhub:project-preparation:v1:'+bound+':'+savedId);}
 function run(fn){let actor;try{actor=load();}catch(error){return Promise.reject(error);}if(running&&running.actor===actor&&running.epoch===epoch)return Promise.reject(Error('正在处理这次课题操作，请稍候。'));
  const token={actor,epoch};running=token;let route=scope()?.route;
  const check=()=>{if(running!==token||token.epoch!==epoch||identity(scope())!==actor||scope()?.route!==route)throw stale();};check.acceptRoute=()=>{route=scope()?.route;};
  return Promise.resolve().then(()=>fn(check)).finally(()=>{if(running===token)running=null;if(writing===token)writing=null;});
 }
 async function readCurrent(check,id){const out=await request('/research-projects/'+id);check();return out;}
 function checkpoint(check,out,sourceHash){record={...record,schema:1,actor:bound,projectId:out.item.id,version:out.item.version,sourceHash,pending:null};memoryBody=null;persist();check();onSaved(out);check.acceptRoute();}
 async function write(check,path,method,body,action){const full={...body,requestKey:key()},hash=await projectPreparationHash(full);check();memoryBody=full;record={...record,pending:{path,method,action,requestKey:full.requestKey,requestHash:hash,...(body.expectedVersion?{expectedVersion:body.expectedVersion}:{})}};persist();const writeToken=running;writing=writeToken;
  try{const out=await request(path,{method,body:full});check();return out;}catch(error){check();if(!error.unknown){if(action==='study.create'){record.pending=null;memoryBody=null;persist();}else finish();}throw error;}finally{if(writing===writeToken)writing=null;}
 }
 async function prepare(check,current){const id=current.item.id;if(current.item.study){const out=await readCurrent(check,id);if(out.item.version!==current.item.version||out.item.study?.id!==current.item.study.id)throw conflict();const overview=await request('/research-studies/'+out.item.study.id);check();if(overview.item?.project?.id!==id||overview.item?.study?.id!==out.item.study.id)throw conflict();finish();return {...out,href:formalUrl('s11',out.item.study.id)};}
  const fresh=await readCurrent(check,id);if(fresh.item.version!==record.version||fresh.item.study)throw conflict();
  if(fresh.capabilities?.canCreateStudy!==true||!(fresh.creationGroups??[]).some(g=>g.id===record.groupId))throw Object.assign(Error('课题已保存，研究组或创建权限已变化，请核对后继续。'),{status:403});
  const out=await write(check,'/research-projects/'+id+'/studies','POST',{expectedVersion:record.version,studyGroupId:record.groupId},'study.create');
  check();checkpoint(check,out,record.sourceHash);finish();return {...out,href:formalUrl('s11',out.item.study.id)};
 }
 return{
  pending(){load();return record?.pending??null;},checkpoint(){load();return record?.projectId?{projectId:record.projectId,version:record.version,groupId:record.groupId}:null;},inFlight:()=>Boolean(writing&&writing===running),
  invalidate(){epoch++;running=null;writing=null;record=null;memoryBody=null;bound=null;},
  discardCheckpoint(){load();if(record?.pending)throw Error('请先核对上次操作。');finish();},
  start(input){return run(async check=>{if(record?.pending)throw Error('上次操作结果待核定，请先核对上次操作。');
   const {mode,values,item,dirty=false,groups=[],groupId=null}=input,selected=groupId||(groups.length===1?groups[0].id:null);
   if(mode==='prepare'&&!item?.study&&(!selected||!groups.some(g=>g.id===selected)))throw Error(groups.length?'请选择研究组后准备研究。':'暂无可创建研究的研究组，可先保存草稿。');
   const hash=await projectPreparationHash(bodyValues(values));check();
   if(record?.projectId&&(item?.id!==record.projectId||item.version!==record.version||!dirty&&(record.sourceHash!==hash||record.groupId!==selected)))throw conflict();
   if(record?.projectId&&dirty){const latest=await readCurrent(check,item.id);if(latest.item.version!==item.version||latest.item.study?.id!==item.study?.id)throw conflict();}
   record={schema:1,actor:bound,origin:projectId??'new',...record,prepare:mode==='prepare',groupId:selected||null,...(item?{projectId:item.id,version:item.version}: {})};
   let current;
   if(!item||dirty){current=await write(check,item?'/research-projects/'+item.id:'/research-projects',item?'PATCH':'POST',{...bodyValues(values),...(item?{expectedVersion:item.version}:{})},item?'intent.update':'intent.create');const sourceHash=await projectPreparationHash(bodyValues(current.item));check();checkpoint(check,current,sourceHash);}
   else{current=await readCurrent(check,item.id);if(current.item.version!==item.version||current.item.study?.id!==item.study?.id)throw conflict();const sourceHash=await projectPreparationHash(bodyValues(current.item));check();checkpoint(check,current,sourceHash);}
   if(mode==='draft'){finish();return current;}return prepare(check,current);
  });},
  recover(){return run(async check=>{if(!record) return null;
   if(!record.pending){const current=await readCurrent(check,record.projectId);if(current.item.version!==record.version)throw conflict();onSaved(current);check.acceptRoute();return current;}
   const pending=record.pending,query=new URLSearchParams({action:pending.action,requestHash:pending.requestHash,...(pending.action!=='intent.create'?{targetId:record.projectId}:{})});
   const proof=await request('/research-projects/receipts/'+pending.requestKey+'?'+query);check();
   if(proof.receipt?.requestKey!==pending.requestKey||proof.receipt.action!==pending.action||proof.receipt.requestHash!==pending.requestHash||proof.receipt.authVersion!==scope().authVersion||proof.receipt.targetId!==proof.item?.id)throw conflict();
   const current=proof.current;if(!current?.item||current.item.id!==proof.item.id||current.item.version!==proof.item.version||current.item.study?.id!==proof.item.study?.id)throw conflict();
   const sourceHash=await projectPreparationHash(bodyValues(current.item));check();checkpoint(check,current,sourceHash);if(!record.prepare||pending.action==='study.create')finish();return current;
  });},
  retryOriginal(values){return run(async check=>{if(!record?.pending)throw Error('没有待核定操作。');const p=record.pending;
   const body=memoryBody??(p.action==='study.create'?{expectedVersion:p.expectedVersion,studyGroupId:record.groupId,requestKey:p.requestKey}:{...bodyValues(values),...(p.action==='intent.update'?{expectedVersion:p.expectedVersion}:{}),requestKey:p.requestKey});
   if(await projectPreparationHash(body)!==p.requestHash)throw Error('当前内容与上次提交不一致，请恢复原内容后重试同一次操作。');check();const writeToken=running;writing=writeToken;
   let out;try{out=await request(p.path,{method:p.method,body});check();}catch(error){check();if(!error.unknown){if(p.action==='study.create'){record.pending=null;persist();}else finish();}throw error;}finally{if(writing===writeToken)writing=null;}
   const current=await readCurrent(check,out.item.id);if(current.item.version!==out.item.version||current.item.study?.id!==out.item.study?.id)throw conflict();const sourceHash=await projectPreparationHash(bodyValues(out.item));check();checkpoint(check,out,sourceHash);if(p.action==='study.create'){finish();return {...out,href:formalUrl('s11',out.item.study.id)};}if(!record.prepare)finish();return out;
  });},
 };
}
