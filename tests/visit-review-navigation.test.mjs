import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithEsbuild} from 'vite';
import * as capture from '../src/formal-capture-session.js';
import * as flow from '../src/visit-workflow-session.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const scope={tenantId:'tenant',actor:'actor',authVersion:2,studyId:'study',visitId:'visit'};
const ref={assignmentId:'assignment',responseId:'response',revisionNo:1,contentHash:'a'.repeat(64)};
const summary={schemaVersion:'visit-workflow-v1',studyId:'study',visitId:'visit',visit:{id:'visit'},items:[{assignmentId:'assignment',formVersionId:'form',formVersion:{id:'form',schema:{fields:[{key:'value',label:'Observation',type:'number'}]}},title:'Observation form',required:true,mode:'researcher',response:{status:'submitted',version:1,ref,review:null,locked:false,answers:{value:0}},capabilities:{canReview:true,canLock:false},action:'review_lock',unavailable:null}],summaryHash:'b'.repeat(64),canStartBatch:true,maxBatchItems:20};
const route={page:'s09',studyId:'study',visitId:'visit'};
const baseSession={actor:'actor',authVersion:2,verified:true,blocked:false,busy:false,pending:null,revision:1,view:{visit:{id:'visit',status:'completed'}}};
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];

// Both the workflow state machine and workspace navigation guard are actual
// production functions. Only React scheduling, Web Locks and GET/POST transport
// boundaries are supplied in-process; no browser, server or database is used.
async function runner(name,initialProps,dependencies={}){
 let cursor=0,props=initialProps;const slots=[],effects=[];
 const useRef=value=>{const i=cursor++;return slots[i]??(slots[i]={kind:'ref',current:value});};
 const useState=value=>{const i=cursor++;if(!(i in slots))slots[i]={kind:'state',value:typeof value==='function'?value():value};return[slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];};
 const sameDeps=(a,b)=>a?.length===b?.length&&a?.every((v,n)=>Object.is(v,b[n]));
 const useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||!sameDeps(deps,old.deps)){slots[i]={kind:'effect',deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn();});}};
 const useCallback=(fn,deps)=>{const i=cursor++;if(!(i in slots)||!sameDeps(deps,slots[i].deps))slots[i]={kind:'callback',deps,value:fn};return slots[i].value;};
 const path=new URL('../pages/shared/'+name+(name==='useVisitWorkflow'?'.js':'.jsx'),import.meta.url),source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'');
 const code=name==='useVisitWorkflow'?source:(await transformWithEsbuild(source,name+'.jsx',{jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'})).code;
 const React={Fragment:'Fragment',createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const deps={React,useState,useRef,useEffect,useCallback,...capture,...flow,...dependencies};
 const fn=new Function(...Object.keys(deps),code.replace('export default function '+name,'return function '+name))(...Object.values(deps));
 return{render(next=props,flushEffects=true){props=next;cursor=0;const result=fn(props);if(flushEffects)for(const effect of effects.splice(0))effect();return result;},cleanup(){for(const slot of slots)if(slot?.kind==='effect')slot.cleanup?.();}};
}
async function workspace(){
 const handlers=new Map(),assigned=[],loc={pathname:'/pages/s09/',search:'?formalCapture=1&studyId=study&visitId=visit',href:'http://127.0.0.1:19501/pages/s09/?formalCapture=1&studyId=study&visitId=visit',assign:url=>assigned.push(url)};
 const doc={title:'',addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);}};
 const win={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);}};
 const h=await runner('FormalCaptureWorkspace',{pageId:'s09'},{document:doc,window:win,location:loc,useFormalCapture:()=>({...baseSession}),analysisUrl:()=>'/analysis',Button:'Button',Card:'Card',ConfirmDialog:'ConfirmDialog',CaptureImport:'CaptureImport',CaptureVisit:'CaptureVisit',CaptureQueries:'CaptureQueries',FullStudySimulationStage:'FullStudySimulationStage',visitStatus:{},date:()=>''});
 const child=nodes(h.render()).find(n=>n.type==='CaptureVisit');assert(child);
 return{h,assigned,onDirty:child.props.onDirty,click(){
  const link={href:'http://127.0.0.1:19501/pages/s05/?formalCapture=1&studyId=study&assignmentId=assignment',dataset:{},closest:()=>null,matches:()=>false};
  const event={button:0,defaultPrevented:false,target:{closest:()=>link},preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};handlers.get('click')(event);return event;
 },dialog:()=>nodes(h.render()).find(n=>n.type==='ConfirmDialog')};
}
async function hook(onDirty,{lock,marker}={}){
 const store=new Map(),events=new Map(),requests=[];let heldRead=null,who={...baseSession},me={accountId:'actor',authVersion:2,tenantId:'tenant'};
 const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
 const request=async(path,options={})=>{requests.push({path,method:options.method??'GET'});if(path==='/auth/me')return{...me};if(path===flow.visitWorkflowRoot(scope))return heldRead?heldRead.promise:structuredClone(summary);if(path.includes('/batch-receipts/'))throw Object.assign(Error('synthetic original receipt unavailable'),{status:404});throw Error('Unexpected transport '+path);};
 const session=()=>({...who,request,load:async()=>true});
 const h=await runner('useVisitWorkflow',{route,session:session(),onDirty},{localStorage:storage,window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:()=>{}},...(lock?{withVisitReviewLock:lock}:{}),...(marker?{makeVisitReviewMarker:marker}:{})});
 h.render();await until(()=>h.render().scope);
 return{h,requests,store,holdRead(){heldRead=deferred();return heldRead;},render:()=>h.render(),identity(id){who={...who,actor:id,authVersion:3};me={...me,accountId:id,authVersion:3};h.render({route,session:session(),onDirty});},storageEvent(){events.get('storage')({storageArea:storage,key:flow.visitReviewMarkerKey(scope)});}};
}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('bounded actual hook wait exceeded');}

test('only a read-back summary after reverify does not block the real workspace S05 link',async()=>{
 const w=await workspace(),h=await hook(w.onDirty),read=h.holdRead();let pending;
 try{pending=h.render().load();h.render();assert.equal(h.render().busy,true);assert.equal(h.render().pending,null);
  const event=w.click();assert.equal(event.defaultPrevented,false,'pure GET must not ask the user to discard saved work');assert.equal(w.dialog(),undefined);assert.equal(h.requests.filter(x=>x.method==='POST').length,0);
  read.resolve(structuredClone(summary));await pending;h.render();assert.equal(w.click().defaultPrevented,false);
 }finally{read.resolve(structuredClone(summary));await pending;h.h.cleanup();w.h.cleanup();}
});
test('failed read-only summary still lets navigation proceed without inventing unsaved input',async()=>{
 const w=await workspace(),h=await hook(w.onDirty),read=h.holdRead();let pending;
 try{pending=h.render().load();h.render();read.reject(Error('synthetic GET disconnected'));await pending;h.render();assert.match(h.render().error,/disconnected/);assert.equal(w.click().defaultPrevented,false);assert.equal(w.dialog(),undefined);assert.equal(h.requests.filter(x=>x.method==='POST').length,0);}
 finally{read.resolve(structuredClone(summary));await pending;h.h.cleanup();w.h.cleanup();}
});
test('unsaved local answers still block S05 navigation and cancellation keeps the original protection',async()=>{
 const w=await workspace(),h=await hook(w.onDirty),read=h.holdRead();let pending;
 try{w.onDirty('answers',true);pending=h.render().load();h.render();assert.equal(w.click().defaultPrevented,true);const dialog=w.dialog();assert(dialog);dialog.props.onCancel();assert.equal(w.dialog(),undefined);assert.equal(w.assigned.length,0);assert.equal(w.click().defaultPrevented,true);}
 finally{read.resolve(structuredClone(summary));await pending;h.h.cleanup();w.h.cleanup();}
});
test('write preflight is protected synchronously before a pending marker exists; scope change cannot post later',async()=>{
 const w=await workspace(),gate=deferred();let lockHeld=false;const lock=async(_locks,_key,work)=>{lockHeld=true;await gate.promise;return work();},h=await hook(w.onDirty,{lock});let writing;
 try{await h.render().load();h.render();writing=h.render().start(['assignment']);assert(lockHeld);assert.equal(h.store.size,0);assert.equal(w.click().defaultPrevented,true,'write preparation must protect before the first async boundary');h.render();assert.equal(h.render().pending,null);assert.equal(w.click().defaultPrevented,true);
  h.identity('other');await until(()=>h.render().scope?.actor==='other');gate.resolve();await writing;assert.equal(h.requests.filter(x=>x.method==='POST').length,0);}
 finally{gate.resolve();await writing;h.h.cleanup();w.h.cleanup();}
});
test('an original unknown write remains protected during its read-only recovery and a 404 never clears it',async()=>{
 const w=await workspace(),h=await hook(w.onDirty);
 try{const marker=await flow.makeVisitReviewMarker(scope,'create',{requestKey:'original-key',items:flow.visitReviewSelection(summary,['assignment'])});h.store.set(flow.visitReviewMarkerKey(scope),JSON.stringify(marker));h.storageEvent();await tick();h.render();assert.equal(h.render().pending.requestKey,'original-key');assert.equal(w.click().defaultPrevented,true);assert(w.dialog());assert.equal(h.requests.filter(x=>x.method==='POST').length,0);assert.equal(h.store.size,1);}
 finally{h.h.cleanup();w.h.cleanup();}
});
test('async marker hashing remains protected, and unmount before it finishes cannot enqueue a late write',async()=>{
 const w=await workspace(),gate=deferred(),entered=deferred(),marker=async(...args)=>{entered.resolve();await gate.promise;return flow.makeVisitReviewMarker(...args);},h=await hook(w.onDirty,{marker});let writing;
 try{await h.render().load();h.render();writing=h.render().start(['assignment']);await entered.promise;h.render();assert.equal(h.render().pending,null);assert.equal(h.store.size,0);assert.equal(w.click().defaultPrevented,true,'hash preflight is in-flight writing, not a pure read');h.h.cleanup();gate.resolve();await writing;assert.equal(h.requests.filter(x=>x.method==='POST').length,0);assert.equal(h.store.size,0);}
 finally{gate.resolve();await writing;w.h.cleanup();}
});
test('a late unmounted writer cannot clear protection published by the current workspace instance',async()=>{
 const w=await workspace(),gate=deferred(),entered=deferred(),marker=async(...args)=>{entered.resolve();await gate.promise;return flow.makeVisitReviewMarker(...args);},h=await hook(w.onDirty,{marker});let writing;
 try{await h.render().load();h.render();writing=h.render().start(['assignment']);await entered.promise;h.render();h.h.cleanup();
  w.onDirty('visitReview',true);assert.equal(w.click().defaultPrevented,true);gate.resolve();await writing;
  assert.equal(w.click().defaultPrevented,true,'late unmounted writer must not clear current-scope protection');assert.equal(h.requests.filter(x=>x.method==='POST').length,0);assert.equal(h.store.size,0);
 }finally{gate.resolve();await writing;w.h.cleanup();}
});
test('a storage epoch change still releases the old writer and resynchronizes the same mounted workflow',async()=>{
 const w=await workspace(),gate=deferred(),entered=deferred(),marker=async(...args)=>{entered.resolve();await gate.promise;return flow.makeVisitReviewMarker(...args);},h=await hook(w.onDirty,{marker});let writing;
 try{await h.render().load();h.render();writing=h.render().start(['assignment']);await entered.promise;h.render();h.storageEvent();
  assert.equal(w.click().defaultPrevented,true);gate.resolve();await writing;
  await until(()=>h.requests.filter(x=>x.path===flow.visitWorkflowRoot(scope)).length===2&&!h.render().busy);h.render();
  assert.equal(h.render().writing,false);assert.equal(w.click().defaultPrevented,false);assert.equal(h.requests.filter(x=>x.method==='POST').length,0);assert.equal(h.store.size,0);
 }finally{gate.resolve();await writing;h.h.cleanup();w.h.cleanup();}
});

const nodeText=v=>typeof v==='string'||typeof v==='number'?String(v):Array.isArray(v)?v.map(nodeText).join(''):nodeText(v?.props?.children??[]);
const namedButton=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&nodeText(n)===label);
async function reviewPanel(){
 const calls=[],loc={pathname:'/pages/s09/',search:'?formalCapture=1&studyId=study&visitId=visit',hash:'#visit-review'},sum=structuredClone(summary);sum.items.push({...structuredClone(sum.items[0]),assignmentId:'attention',title:'Attention form',response:{...structuredClone(sum.items[0].response),ref:{...ref,assignmentId:'attention'},score:{scoreComplete:false}}});
 const props={route:{...route},session:{...baseSession},workflow:{scope:{...scope},summary:sum,blocked:false,busy:false,batch:null,pending:null,load:()=>calls.push('GET'),start:ids=>calls.push(ids)},expanded:true,onExpand:()=>{}};
 const h=await runner('VisitReviewPanel',props,{Button:'Button',ConfirmDialog:'ConfirmDialog',ReadAnswers:'ReadAnswers',FormPresentation:'FormPresentation',document:{activeElement:{}},location:loc});h.render();h.render();
 return{h,props,calls,loc,select(){nodes(h.render()).find(n=>n.type==='input').props.onChange({target:{checked:true}});},open(){const b=namedButton(h.render(),'审核通过并锁定');assert(b&&!b.props.disabled);b.props.onClick();const d=nodes(h.render()).find(n=>n.type==='ConfirmDialog');assert(d);return d;}};
}
test('actual review panel defaults all and stable attention first; filtering clears explicit selection and confirmation without writing',async()=>{
 const p=await reviewPanel();try{
  let tree=p.h.render();assert.equal(namedButton(tree,'全部').props['aria-pressed'],true);assert(nodes(tree).some(n=>n.props?.role==='group'&&n.props['aria-label']==='审阅清单筛选'));assert.deepEqual(nodes(tree).filter(n=>n.type==='h4').map(nodeText),['Attention form · 必采','Observation form · 必采']);assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));
  p.select();const old=p.open(),gets=p.calls.filter(x=>x==='GET').length;namedButton(p.h.render(),'需关注').props.onClick();old.props.onConfirm();tree=p.h.render();assert.equal(nodes(tree).find(n=>n.type==='ConfirmDialog'),undefined);assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));assert.equal(nodes(tree).filter(n=>n.type==='h4').length,1);assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);assert.equal(p.calls.filter(x=>x==='GET').length,gets);
  assert(nodes(tree).some(n=>n.type==='a'&&n.props.href.includes('/pages/s05/')));assert(nodes(tree).some(n=>n.type==='ReadAnswers'));assert.match(nodeText(tree),/评分：/);
 }finally{p.h.cleanup();}
});
test('actual panel invalidates old confirmation synchronously for scope, URL and same-hash in-place score/source changes',async()=>{
 const changes=[p=>p.props.session.actor='other',p=>p.props.session.authVersion=3,p=>p.props.session.verified=false,p=>p.props.workflow.scope.studyId='other',p=>p.props.route.visitId='other',p=>p.loc.hash='#other',p=>p.props.workflow.summary.items[0].response.score={scoreComplete:false},p=>p.props.workflow.summary.items[0].unavailable={code:'X',message:'Unavailable'},p=>p.props.workflow.summary.items[0].response.ref.contentHash='c'.repeat(64)];
 for(const change of changes){const p=await reviewPanel();try{p.select();const old=p.open();change(p);const tree=p.h.render(p.props,false);assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));assert.equal(nodes(tree).find(n=>n.type==='ConfirmDialog'),undefined);old.props.onConfirm();assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);}finally{p.h.cleanup();}}
 const p=await reviewPanel();try{p.select();const old=p.open();p.loc.search+='&changed=1';old.props.onConfirm();assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);}finally{p.h.cleanup();}
 const q=await reviewPanel();try{q.select();const old=q.open();q.props.workflow.summary.items[1].response.score.scoreComplete=true;old.props.onConfirm();assert.equal(q.calls.filter(x=>Array.isArray(x)).length,0);}finally{q.h.cleanup();}
 const r=await reviewPanel();try{r.select();const old=r.open();r.props.session.verified=false;r.h.render(r.props,false);r.props.session.verified=true;const tree=r.h.render(r.props,false);assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));old.props.onConfirm();assert.equal(r.calls.filter(x=>Array.isArray(x)).length,0);}finally{r.h.cleanup();}
});
test('actual current confirmation still starts only explicit IDs and unavailable does not invent submission state',async()=>{
 const p=await reviewPanel();try{p.select();const modal=p.open();modal.props.onConfirm();modal.props.onConfirm();assert.deepEqual(p.calls.filter(x=>Array.isArray(x)),[['attention']]);
  const broken={...structuredClone(summary.items[0]),assignmentId:'broken',title:'Unavailable form',response:null,action:null,formVersion:null,unavailable:{code:'X',message:'暂不可核对'}};p.props.workflow.summary.items=[broken];const tree=p.h.render(p.props,false),copy=nodeText(tree);assert.doesNotMatch(copy,/尚未提交/);assert.equal((copy.match(/暂不可核对/g)||[]).length,1);
 }finally{p.h.cleanup();}
});
test('a restored active batch invalidates an open confirmation and a former open button without changing the summary',async()=>{
 for(const status of ['ready','blocked','processing']){
  const p=await reviewPanel();try{p.select();const old=p.open();p.props.workflow.batch={status,completedCount:0,items:[]};assert.equal(nodes(p.h.render(p.props,false)).find(n=>n.type==='ConfirmDialog'),undefined);old.props.onConfirm();assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);}finally{p.h.cleanup();}
  const q=await reviewPanel();try{q.select();const oldOpen=namedButton(q.h.render(),'审核通过并锁定').props.onClick;q.props.workflow.batch={status,completedCount:0,items:[]};oldOpen();assert.equal(nodes(q.h.render(q.props,false)).find(n=>n.type==='ConfirmDialog'),undefined);assert.equal(q.calls.filter(x=>Array.isArray(x)).length,0);}finally{q.h.cleanup();}
 }
});
test('a newly pending original write clears selected rows before effects run',async()=>{
 const p=await reviewPanel();try{p.select();p.open();p.props.workflow.pending={requestKey:'other-original-pending'};p.props.workflow.blocked=true;const tree=p.h.render(p.props,false);assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));assert.equal(nodes(tree).find(n=>n.type==='ConfirmDialog'),undefined);}finally{p.h.cleanup();}
});
test('pending appearing and clearing with the same summary cannot revive a captured old confirmation',async()=>{
 const p=await reviewPanel();try{p.select();const old=p.open();p.props.workflow.pending={requestKey:'other-original-pending'};p.props.workflow.blocked=true;p.h.render(p.props,false);old.props.onConfirm();assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);p.props.workflow.pending=null;p.props.workflow.blocked=false;const tree=p.h.render(p.props,false);old.props.onConfirm();assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);assert.equal(nodes(tree).find(n=>n.type==='ConfirmDialog'),undefined);assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));}finally{p.h.cleanup();}
});
test('an already locked revision does not ask its original author to wait for another reviewer',async()=>{
 const p=await reviewPanel();try{const item=p.props.workflow.summary.items[0];item.response.review='review_approved';item.response.locked=true;item.action=null;item.capabilities={canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}};p.props.workflow.summary.items=[item];p.props.workflow.summary.canStartBatch=false;const tree=p.h.render(p.props,false);assert.match(nodeText(tree),/已锁定/);assert.doesNotMatch(nodeText(tree),/待独立审阅|待其他人员审阅/);assert.equal(nodes(tree).filter(n=>n.type==='input').length,0);}finally{p.h.cleanup();}
});
test('an approved revision only awaiting lock retains native lock eligibility without another-review handoff',async()=>{
 const p=await reviewPanel();try{const item=p.props.workflow.summary.items[0];item.response.review='review_approved';item.action=null;item.capabilities={canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}};p.props.workflow.summary.items=[item];p.props.workflow.summary.canStartBatch=false;let tree=p.h.render(p.props,false);assert.match(nodeText(tree),/已审核，待锁定/);assert.doesNotMatch(nodeText(tree),/待独立审阅|待其他人员审阅/);item.action='lock';item.capabilities.canLock=true;p.props.workflow.summary.canStartBatch=true;tree=p.h.render(p.props,false);assert.equal(nodes(tree).filter(n=>n.type==='input').length,1);p.select();assert(namedButton(p.h.render(),'锁定已核对表单'));}finally{p.h.cleanup();}
});
test('a submitted unreviewed author keeps the independent-review handoff and cannot approve',async()=>{
 const p=await reviewPanel();try{const item=p.props.workflow.summary.items[0];item.action=null;item.capabilities={canReview:false,canLock:false,disableReasons:{review:'FORM_INDEPENDENT_REVIEW_REQUIRED'}};p.props.workflow.summary.items=[item];p.props.workflow.summary.canStartBatch=false;let tree=p.h.render(p.props,false);assert.match(nodeText(tree),/待独立审阅/);assert.match(nodeText(tree),/待其他人员审阅/);assert.equal(nodes(tree).filter(n=>n.type==='input').length,0);assert.equal(namedButton(tree,'审核通过并锁定'),undefined);item.response.status='draft';tree=p.h.render(p.props,false);assert.doesNotMatch(nodeText(tree),/待独立审阅|待其他人员审阅/);}finally{p.h.cleanup();}
});
test('over-limit explicit selection reports the native cap and twenty remain actionable only after explicit deselection',async()=>{
 const p=await reviewPanel();try{
  p.props.workflow.summary.items=Array.from({length:21},(_,i)=>{const item=structuredClone(summary.items[0]),id='member'+i;item.assignmentId=id;item.title='Form '+i;item.response.ref={...item.response.ref,assignmentId:id,responseId:'response'+i};return item;});
  const selectAll=()=>{for(let i=0;i<21;i++)nodes(p.h.render(p.props)).filter(n=>n.type==='input')[i].props.onChange({target:{checked:true}});};selectAll();let tree=p.h.render();assert.match(nodeText(tree),/本次最多处理20份，请减少选择后再确认。/);assert.equal(namedButton(tree,'审核通过并锁定').props.disabled,true);namedButton(tree,'审核通过并锁定').props.onClick();assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);assert.equal(nodes(p.h.render()).find(n=>n.type==='ConfirmDialog'),undefined);
  namedButton(p.h.render(),'需关注').props.onClick();tree=p.h.render();assert.doesNotMatch(nodeText(tree),/本次最多处理/);namedButton(tree,'全部').props.onClick();tree=p.h.render();assert(nodes(tree).filter(n=>n.type==='input').every(n=>!n.props.checked));selectAll();nodes(p.h.render()).filter(n=>n.type==='input')[20].props.onChange({target:{checked:false}});tree=p.h.render();assert.doesNotMatch(nodeText(tree),/本次最多处理/);assert.equal(namedButton(tree,'审核通过并锁定').props.disabled,false);p.open().props.onConfirm();assert.deepEqual(p.calls.filter(x=>Array.isArray(x)),[Array.from({length:20},(_,i)=>'member'+i)]);
 }finally{p.h.cleanup();}
});
test('a locked attention item explains its priority before form guidance, score and the long original answers',async()=>{
 const p=await reviewPanel();try{const item=p.props.workflow.summary.items[1];item.response.locked=true;item.response.score.processingStatus='incomplete_data';item.action=null;item.capabilities={canReview:false,canLock:false};const tree=p.h.render(p.props,false),card=nodes(tree).find(n=>n.type==='li'&&n.props.className==='fc-review-item'&&nodeText(n).includes('Attention form')),order=nodes(card),reason=order.findIndex(n=>n.type==='p'&&nodeText(n)==='需关注：资料待补齐'),state=order.findIndex(n=>n.type==='p'&&nodeText(n).includes('已锁定')),guidance=order.findIndex(n=>n.type==='FormPresentation'),score=order.findIndex(n=>n.type==='p'&&nodeText(n).startsWith('评分：')),answers=order.findIndex(n=>n.type==='ReadAnswers');assert(reason>state&&state>=0);assert(reason<guidance&&guidance<score&&score<answers);assert.equal(order[answers].props.answers,item.response.answers);}finally{p.h.cleanup();}
});
test('filter primary presentation stays synchronized with aria-pressed for the current range',async()=>{
 const p=await reviewPanel();try{const check=(tree,all)=>{assert.equal(namedButton(tree,'全部').props.primary,all);assert.equal(namedButton(tree,'全部').props['aria-pressed'],all);assert.equal(namedButton(tree,'需关注').props.primary,!all);assert.equal(namedButton(tree,'需关注').props['aria-pressed'],!all);};check(p.h.render(),true);namedButton(p.h.render(),'需关注').props.onClick();check(p.h.render(),false);namedButton(p.h.render(),'全部').props.onClick();check(p.h.render(),true);assert.equal(p.calls.filter(x=>Array.isArray(x)).length,0);}finally{p.h.cleanup();}
});
