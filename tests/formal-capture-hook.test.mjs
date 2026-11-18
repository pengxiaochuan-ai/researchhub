import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as capture from '../src/formal-capture-session.js';
import {sameFileResult,fileVerified} from '../src/capture-file-session.js';
import {resolveImportLabels} from '../src/capture-import-session.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(value)});
const originalAnswers={value:0,completed:false};
const route={page:'s09',studyId:'study',visitId:'visit',assignmentId:'assignment'};
const command={expectedVersion:0,answers:originalAnswers};

// Execute the production hook itself; deterministic slots supply only React's
// lifecycle and transport boundaries. No alternate command implementation is used.
function mount(){
 const slots=[],queued=[],calls=[],store=new Map(),timers=new Map(),listeners=new Map(),documentListeners=new Map();
 let cursor=0,timerId=0,currentRoute=route,me={accountId:'actor',authVersion:2},user={id:'actor',authenticated:true,authVersion:2};
 let authFetch=null,assignmentFetch=null,postFetch=null,receiptFetch=null,disposed=false;
 let currentCapture={studyId:'study',assignment:{id:'assignment',subjectVisitId:'visit',subjectId:'subject',formVersion:{id:'form',schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'观察值',type:'number'},{key:'completed',label:'已完成',type:'boolean'}]}}},response:{status:'draft',version:0,answers:{...originalAnswers},locked:false,ref:null}};
 let receipt=null;
 const useRef=value=>{const i=cursor++;return slots[i]??(slots[i]={kind:'ref',current:value});};
 const useState=value=>{const i=cursor++;if(!(i in slots))slots[i]={kind:'state',value:typeof value==='function'?value():value};return[slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];};
 const equalDeps=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const useMemo=(factory,deps)=>{const i=cursor++;if(!(i in slots)||!equalDeps(slots[i].deps,deps))slots[i]={kind:'memo',deps,value:factory()};return slots[i].value;};
 const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 const useEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||!equalDeps(old.deps,deps)){slots[i]={kind:'effect',deps,cleanup:old?.cleanup};queued.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn();});}};
 const subscribe=(target,name,fn)=>{if(!target.has(name))target.set(name,new Set());target.get(name).add(fn);};
 const unsubscribe=(target,name,fn)=>target.get(name)?.delete(fn);
 const emit=(target,name,detail)=>{for(const fn of [...target.get(name)??[]])fn({type:name,detail});};
 const window={addEventListener:(name,fn)=>subscribe(listeners,name,fn),removeEventListener:(name,fn)=>unsubscribe(listeners,name,fn),dispatchEvent:event=>emit(listeners,event.type,event.detail)};
 const document={visibilityState:'visible',addEventListener:(name,fn)=>subscribe(documentListeners,name,fn),removeEventListener:(name,fn)=>unsubscribe(documentListeners,name,fn)};
 function save(body){
  currentCapture={...currentCapture,response:{...currentCapture.response,status:'submitted',version:1,answers:structuredClone(body.answers),ref:{assignmentId:'assignment',responseId:'response',revisionNo:1,contentHash:'a'.repeat(64)}}};
  receipt={studyId:'study',result:{id:'assignment'},receipt:{requestKey:body.requestKey,action:'form.submit',targetId:'assignment'}};
  return response(receipt);
 }
 const fetchImpl=async(path,init)=>{
  const call={path,method:init.method,...(init.body?{body:JSON.parse(init.body)}:{})};calls.push(call);
  if(init.method!=='GET'){assert.equal(init.method,'POST');return postFetch?postFetch(call):save(call.body);}
  if(path==='/api/auth/me')return authFetch?authFetch(call):response(me);
  if(path.includes('/receipts/'))return receiptFetch?receiptFetch(call):receipt?response(receipt):response({code:'FORM_RECEIPT_NOT_FOUND',message:'未找到回执'},404);
  if(path.endsWith('/assignments/assignment'))return assignmentFetch?assignmentFetch(call):response(currentCapture);
  if(path.includes('/data-queries?'))return response({items:[],nextCursor:null});
  if(path.includes('/files?'))return response({studyId:'study',visitId:'visit',capabilities:{canUploadPreprocessed:false},preprocessedUploadStatus:'available',items:[]});
  if(path.endsWith('/visits/visit'))return response({visit:{id:'visit',version:1,status:'in_progress',subject:{id:'subject'}}});
  throw Error('Unexpected in-process request '+path);
 };
 const deps={...capture,useState,useRef,useEffect,useCallback,useMemo,getPlatformUser:()=>user,createCaptureClient:options=>capture.createCaptureClient({...options,fetchImpl}),sameFileResult,fileVerified,resolveImportLabels,window,document,sessionStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearInterval:id=>timers.delete(id)};
 const source=readFileSync(new URL('../pages/shared/useFormalCapture.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default function useFormalCapture','return function useFormalCapture');
 const hook=new Function(...Object.keys(deps),source)(...Object.values(deps));
 const render=()=>{assert(!disposed);cursor=0;const value=hook(currentRoute);while(queued.length)queued.shift()();return value;};
 render();
 return{render,calls,store,save,me:()=>structuredClone(me),capture:()=>structuredClone(currentCapture),
  posts:()=>calls.filter(call=>call.method==='POST'),
  auth:value=>{authFetch=value;},assignment:value=>{assignmentFetch=value;},post:value=>{postFetch=value;},receipt:value=>{receiptFetch=value;},
  focus:()=>emit(listeners,'focus'),visibility:()=>emit(documentListeners,'visibilitychange'),poll:()=>{for(const timer of [...timers.values()])if(timer.ms===10000)timer.fn();},
  identity:(id,version)=>{me={accountId:id,authVersion:version};user={id,authenticated:true,authVersion:version};emit(listeners,'qiyan:user-change',user);},
  cleanup:()=>{if(disposed)return;for(const slot of slots)if(slot?.kind==='effect')slot.cleanup?.();disposed=true;},
 };
}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('bounded actual-hook state wait exceeded');}
async function ready(h){await until(()=>h.render().verified);}

test('quiet in-flight reads expose checking without losing verified inputs, then clear it on success',async()=>{
 const h=mount(),hold=deferred();let reading;
 try{await ready(h);h.auth(()=>hold.promise);reading=h.render().load({quiet:true});await tick();const state=h.render();assert.equal(state.checking,true);assert.equal(state.busy,false);assert.equal(state.verified,true);assert.deepEqual(state.view.capture.response.answers,originalAnswers);hold.resolve(response(h.me()));await reading;assert.equal(h.render().checking,false);assert.equal(h.render().verified,true);assert.equal(h.posts().length,0);}
 finally{hold.resolve(response(h.me()));await reading;h.cleanup();}
});

test('quiet read failure clears checking but preserves answers and forbids a new write',async()=>{
 const h=mount(),hold=deferred();let reading;
 try{await ready(h);h.auth(()=>hold.promise);reading=h.render().load({quiet:true});await tick();assert.equal(h.render().checking,true);hold.reject(Error('synthetic read disconnect'));await reading;const failed=h.render();assert.equal(failed.checking,false);assert.equal(failed.verified,false);assert.deepEqual(failed.view.capture.response.answers,originalAnswers);assert.equal(await failed.send('assignment','submit',command),false);assert.equal(h.posts().length,0);assert.equal(h.store.size,0);assert.match(h.render().notice,/^本次尚未执行/);}
 finally{hold.resolve(response(h.me()));await reading;h.cleanup();}
});

test('confirmation hold is stable, suppresses quiet focus/timer reads, allows explicit checks and releases once',async()=>{
 const h=mount();
 try{await ready(h);const state=h.render();assert.equal(typeof state.holdConfirmation,'function');assert.strictEqual(state.holdConfirmation,h.render().holdConfirmation);const release=state.holdConfirmation(),before=h.calls.length;assert.equal(await h.render().load({quiet:true}),false);h.focus();h.visibility();h.poll();await tick();assert.equal(h.calls.length,before);assert.equal(await h.render().load(),true);assert(h.calls.length>before);const afterExplicit=h.calls.length;h.poll();await tick();assert.equal(h.calls.length,afterExplicit);release();release();h.focus();await until(()=>h.calls.length>afterExplicit&&!h.render().checking);assert.equal(h.render().verified,true);assert.equal(h.posts().length,0);}
 finally{h.cleanup();}
});

test('opening confirmation keeps an already-running read, while its hold prevents a replacement quiet read',async()=>{
 const h=mount(),hold=deferred();let reading,release;
 try{await ready(h);assert.equal(typeof h.render().holdConfirmation,'function');h.auth(()=>hold.promise);reading=h.render().load({quiet:true});await tick();release=h.render().holdConfirmation();assert.equal(h.render().checking,true);const count=h.calls.length;h.focus();h.poll();assert.equal(h.calls.length,count);hold.resolve(response(h.me()));await reading;assert.equal(h.render().checking,false);const afterRead=h.calls.length;assert(afterRead>count);h.focus();await tick();assert.equal(h.calls.length,afterRead);release();release=null;h.auth(null);h.poll();await until(()=>h.calls.length>afterRead&&!h.render().checking);}
 finally{hold.resolve(response(h.me()));await reading;release?.();h.cleanup();}
});

test('not-sent notice survives a successful quiet read and a real execute clears it',async()=>{
 const h=mount(),hold=deferred();let reading,writeHold=deferred(),writing;
 try{await ready(h);h.auth(()=>hold.promise);reading=h.render().load({quiet:true});await tick();assert.equal(await h.render().send('assignment','submit',command),false);const message=h.render().notice;assert.match(message,/^本次尚未执行/);assert.equal(h.render().pending,null);assert.equal(h.posts().length,0);hold.resolve(response(h.me()));await reading;assert.equal(h.render().notice,message);h.auth(null);h.post(()=>writeHold.promise);writing=h.render().send('assignment','submit',command);await until(()=>h.posts().length===1);assert.equal(h.render().notice,'');writeHold.resolve(h.save(h.posts()[0].body));assert(await writing);assert.equal(h.render().pending,null);}
 finally{hold.resolve(response(h.me()));await reading;if(writing){writeHold.resolve(h.save(h.posts()[0].body));await writing;}h.cleanup();}
});

test('unverified rejection explains no execution and explicit recovery cannot erase that fact',async()=>{
 const h=mount();
 try{await ready(h);h.auth(async()=>{throw Error('synthetic auth GET disconnect');});assert.equal(await h.render().load({quiet:true}),false);assert.equal(await h.render().send('assignment','submit',command),false);const message=h.render().notice;assert.match(message,/^本次尚未执行/);assert.equal(h.posts().length,0);assert.equal(h.store.size,0);h.auth(null);assert.equal(await h.render().load(),true);assert.equal(h.render().notice,message);assert.deepEqual(h.render().view.capture.response.answers,originalAnswers);}
 finally{h.cleanup();}
});

for(const [label,nextId,nextVersion] of [['another account','next-actor',3],['a new authorization version','actor',3]])test('late pre-confirmation read cannot replay a write or overwrite '+label,async()=>{
 const h=mount(),hold=deferred();let reading;
 try{await ready(h);const old=h.me();let first=true;h.auth(()=>{if(first){first=false;return hold.promise;}return response(h.me());});reading=h.render().load({quiet:true});await tick();assert.equal(await h.render().send('assignment','submit',command),false);h.identity(nextId,nextVersion);await until(()=>h.render().verified&&h.render().actor===nextId);hold.resolve(response(old));await reading;assert.equal(h.render().actor,nextId);assert.equal(h.render().verified,true);assert.equal(h.render().checking,false);assert.equal(h.render().pending,null);assert.equal(h.store.size,0);assert.equal(h.posts().length,0);assert.deepEqual(h.render().view.capture.response.answers,originalAnswers);}
 finally{hold.resolve(response(h.me()));await reading;h.cleanup();}
});

test('double confirmation sends only one POST and preserves the original command values',async()=>{
 const h=mount(),hold=deferred();let first;
 try{await ready(h);h.post(()=>hold.promise);const state=h.render();first=state.send('assignment','submit',command);assert.equal(await state.send('assignment','submit',command),false);assert.equal(h.posts().length,1);assert.deepEqual(h.posts()[0].body.answers,originalAnswers);assert.equal(h.posts()[0].body.expectedVersion,0);assert.equal(h.render().pending.requestKey,h.posts()[0].body.requestKey);hold.resolve(h.save(h.posts()[0].body));assert(await first);assert.equal(h.posts().length,1);assert.equal(h.render().pending,null);assert.equal(h.store.size,0);}
 finally{if(first){hold.resolve(h.save(h.posts()[0].body));await first;}h.cleanup();}
});

test('a lost POST response retains its marker and original-key GET recovery never replays the POST',async()=>{
 const h=mount();
 try{await ready(h);h.post(call=>{h.save(call.body);throw Error('synthetic response lost after save');});assert.equal(await h.render().send('assignment','submit',command),false);const marker=structuredClone(h.render().pending),stored=[...h.store.values()][0];assert.equal(marker.requestKey,h.posts()[0].body.requestKey);assert.match(h.render().error,/尚未确认/);assert(!h.render().notice.startsWith('本次尚未执行'));assert.equal(await h.render().load(),true);assert.equal([...h.store.values()][0],stored);const callCount=h.calls.length;assert(await h.render().recover());assert(h.calls.slice(callCount).every(call=>call.method==='GET'));assert(h.calls.some(call=>call.path.includes('/receipts/'+marker.requestKey)));assert.equal(h.posts().length,1);assert.equal(h.render().pending,null);assert.equal(h.store.size,0);assert.equal(h.render().view.capture.response.status,'submitted');assert.deepEqual(h.render().view.capture.response.answers,originalAnswers);}
 finally{h.cleanup();}
});

test('an acknowledged POST with failed read-back is reported as saved and recovers without a new POST',async()=>{
 const h=mount();
 try{await ready(h);h.post(call=>{const result=h.save(call.body);h.assignment(()=>response({message:'synthetic read-back unavailable'},503));return result;});assert.equal(await h.render().send('assignment','submit',command),false);assert.match(h.render().error,/操作已保存/);assert(!h.render().notice.startsWith('本次尚未执行'));assert.equal(h.render().canRetry,false);const key=h.render().pending.requestKey;h.assignment(null);assert.equal(await h.render().load(),true);assert.equal(h.render().pending.requestKey,key);assert(await h.render().recover());assert.equal(h.posts().length,1);assert.equal(h.render().pending,null);assert.equal(h.render().view.capture.response.status,'submitted');}
 finally{h.cleanup();}
});

test('known version rejection keeps the original answers and does not automatically submit a replacement',async()=>{
 const h=mount();
 try{await ready(h);h.post(()=>response({code:'FORM_VERSION_CONFLICT',message:'对象已有变化，输入已保留，请核对当前状态。'},409));assert.equal(await h.render().send('assignment','submit',command),false);assert.equal(h.posts().length,1);assert.equal(h.posts()[0].body.expectedVersion,0);assert.equal(h.render().pending,null);assert.equal(h.store.size,0);assert.deepEqual(h.render().view.capture.response.answers,originalAnswers);assert.equal(await h.render().load({quiet:true}),true);assert.equal(h.posts().length,1);assert.equal(h.render().view.capture.response.status,'draft');}
 finally{h.cleanup();}
});

test('missing original receipt remains unknown instead of claiming no execution or creating a new command',async()=>{
 const h=mount();
 try{await ready(h);h.post(()=>{throw Error('synthetic disconnected before response');});assert.equal(await h.render().send('assignment','submit',command),false);const key=h.render().pending.requestKey;assert.equal(await h.render().load(),true);assert.equal(await h.render().recover(),false);assert.equal(h.render().pending.requestKey,key);assert.match(h.render().error,/暂未查到上次结果/);assert(!h.render().notice.startsWith('本次尚未执行'));assert.equal(h.posts().length,1);assert.equal(h.store.size,1);}
 finally{h.cleanup();}
});
